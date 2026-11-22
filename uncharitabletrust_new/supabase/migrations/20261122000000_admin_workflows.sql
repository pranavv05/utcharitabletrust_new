-- Incremental workflows. No imported record is changed by this migration.
BEGIN;
ALTER TABLE trust_admin.audit ADD COLUMN before_data jsonb, ADD COLUMN after_data jsonb;
CREATE TABLE trust_admin.followups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id char(36) NOT NULL REFERENCES legacy_trust.bookings(id),actor uuid NOT NULL,note text NOT NULL CHECK(length(note) BETWEEN 3 AND 2000),channel text NOT NULL CHECK(channel IN ('phone','email','in_person','other')),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE trust_admin.approvals(submission_id uuid PRIMARY KEY REFERENCES trust_admin.submissions(id),member_id char(36) NOT NULL REFERENCES legacy_trust.members(id),actor uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE trust_admin.corrections(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),book_id char(36) NOT NULL REFERENCES legacy_trust.book_lists(id),kept_loan char(36) NOT NULL REFERENCES legacy_trust.bookings(id),reason text NOT NULL,actor uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE trust_admin.followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_admin.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_admin.corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON trust_admin.followups,trust_admin.approvals,trust_admin.corrections FROM PUBLIC,anon,authenticated;
ALTER TABLE legacy_trust.bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE legacy_trust.bookings ADD CONSTRAINT bookings_status_check CHECK(status IN ('active','issue','lost','inactive','return','new','partial_return','closed_correction'));
ALTER TABLE trust_admin.loan_returns DROP CONSTRAINT loan_returns_disposition_check;
ALTER TABLE trust_admin.loan_returns ADD CONSTRAINT loan_returns_disposition_check CHECK(disposition IN ('return','lost','corrected'));
CREATE TABLE public.trust_changes(scope text PRIMARY KEY CHECK(scope IN ('admin','catalogue','content')),version bigint NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.trust_changes(scope) VALUES('admin'),('catalogue'),('content');
ALTER TABLE public.trust_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trust_changes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.trust_changes TO anon,authenticated;
CREATE POLICY public_changes ON public.trust_changes FOR SELECT TO anon USING(scope IN ('catalogue','content'));
CREATE POLICY staff_changes ON public.trust_changes FOR SELECT TO authenticated USING(scope IN ('catalogue','content') OR EXISTS(SELECT 1 FROM public.staff s WHERE s.user_id=auth.uid() AND s.active));
CREATE FUNCTION trust_admin.bump_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE public.trust_changes SET version=version+1,updated_at=now() WHERE scope='admin' OR scope=TG_ARGV[0]; RETURN NULL;
END $$;
CREATE FUNCTION trust_admin.capture_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.uid() IS NOT NULL THEN
 INSERT INTO trust_admin.audit(actor,action,entity,record_id,summary,before_data,after_data) VALUES(auth.uid(),lower(TG_OP),TG_TABLE_NAME,coalesce(to_jsonb(NEW)->>'id',to_jsonb(OLD)->>'id'),'Record '||lower(TG_OP)||' · '||TG_TABLE_NAME,CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
 END IF;RETURN NULL;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['book_lists','bookings','booking_items','customers','members','authors','class_names'] LOOP
 EXECUTE format('CREATE TRIGGER record_changes AFTER INSERT OR UPDATE OR DELETE ON legacy_trust.%I FOR EACH ROW EXECUTE FUNCTION trust_admin.capture_change()',t);
 EXECUTE format('CREATE TRIGGER refresh_workspace AFTER INSERT OR UPDATE OR DELETE ON legacy_trust.%I FOR EACH STATEMENT EXECUTE FUNCTION trust_admin.bump_change(%L)',t,CASE WHEN t='book_lists' THEN 'catalogue' ELSE 'admin' END);
 END LOOP;
END $$;
CREATE TRIGGER refresh_inbox AFTER INSERT OR UPDATE ON trust_admin.submissions FOR EACH STATEMENT EXECUTE FUNCTION trust_admin.bump_change('admin');
CREATE TRIGGER refresh_followups AFTER INSERT ON trust_admin.followups FOR EACH STATEMENT EXECUTE FUNCTION trust_admin.bump_change('admin');
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.trust_changes; END IF; END $$;
-- Snapshot transaction type so later person edits cannot reclassify loan history.
CREATE TABLE trust_admin.transaction_kinds(booking_id char(36) PRIMARY KEY REFERENCES legacy_trust.bookings(id),kind text NOT NULL CHECK(kind IN ('loan','donation')));
ALTER TABLE trust_admin.transaction_kinds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON trust_admin.transaction_kinds FROM PUBLIC,anon,authenticated;
INSERT INTO trust_admin.transaction_kinds SELECT b.id,CASE WHEN b.status='new' OR b."orderNo" LIKE 'UTC-D-%' OR c.type='donar' THEN 'donation' ELSE 'loan' END FROM legacy_trust.bookings b LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id;
CREATE FUNCTION trust_admin.classify_transaction() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 INSERT INTO trust_admin.transaction_kinds(booking_id,kind) VALUES(NEW.id,CASE WHEN NEW.status='new' OR NEW."orderNo" LIKE 'UTC-D-%' THEN 'donation' ELSE 'loan' END);RETURN NULL;END $$;
CREATE TRIGGER classify_new_transaction AFTER INSERT ON legacy_trust.bookings FOR EACH ROW EXECUTE FUNCTION trust_admin.classify_transaction();
-- Preserve the existing list implementation for the unchanged directories.
ALTER FUNCTION public.admin_list(text,text,integer,text,text) RENAME TO admin_list_previous;
REVOKE ALL ON FUNCTION public.admin_list_previous(text,text,integer,text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.admin_list(p_entity text,p_search text DEFAULT '',p_page integer DEFAULT 1,p_filter text DEFAULT '',p_sort text DEFAULT 'newest') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE records jsonb;n bigint;term text;sort_sql text;q text;
BEGIN
 PERFORM trust_admin.require_staff();
 IF p_entity NOT IN ('loans','donations','returns') THEN RETURN public.admin_list_previous(p_entity,p_search,p_page,p_filter,p_sort);END IF;
 IF p_page<1 OR p_page>100000 THEN RAISE EXCEPTION 'Invalid page';END IF;
 term:='%'||replace(replace(left(trim(p_search),150),'%','\%'),'_','\_')||'%';
 q:=' FROM (SELECT b.*,c.name,c.phone,k.kind AS kind,(SELECT string_agg(x.utbn::text,'' '') FROM legacy_trust.booking_items i JOIN legacy_trust.book_lists x ON x.id=i.book_id WHERE i.booking_id=b.id) AS utbns FROM legacy_trust.bookings b LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id) d WHERE kind=$1 AND concat_ws('' '',d.name,d.phone,d."orderNo",d.utbns) ILIKE $2 AND ($3='''' OR d.status=$3 OR ($3=''overdue'' AND d.status IN (''issue'',''partial_return'') AND d."endDate"<current_date))';
 IF p_entity='returns' THEN q:=q||' AND d.status IN (''issue'',''partial_return'')';END IF;
 sort_sql:=CASE p_sort WHEN 'oldest' THEN 'd.created_at ASC NULLS LAST' WHEN 'name' THEN 'lower(d.name) ASC' WHEN 'due' THEN 'd."endDate" ASC' ELSE 'd.created_at DESC NULLS LAST' END;
 EXECUTE 'SELECT count(*)'||q INTO n USING CASE WHEN p_entity='donations' THEN 'donation' ELSE 'loan' END,term,p_filter;
 EXECUTE 'SELECT coalesce(jsonb_agg(x),''[]''::jsonb) FROM (SELECT d.*'||q||' ORDER BY '||sort_sql||',d.id DESC LIMIT 25 OFFSET $4)x' INTO records USING CASE WHEN p_entity='donations' THEN 'donation' ELSE 'loan' END,term,p_filter,(p_page-1)*25;
 RETURN jsonb_build_object('rows',records,'total',n,'page',p_page);
END $$;
CREATE FUNCTION public.admin_person(p_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;BEGIN PERFORM trust_admin.require_staff();
 SELECT to_jsonb(c)||jsonb_build_object('outstanding',(SELECT count(*) FROM legacy_trust.bookings WHERE customer_id=c.id AND status IN ('issue','partial_return')),'transactions',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT b.id,b."orderNo",b."issueDate",b."endDate",b.status,(SELECT count(*) FROM legacy_trust.booking_items WHERE booking_id=b.id) AS copies FROM legacy_trust.bookings b WHERE b.customer_id=c.id ORDER BY b.created_at DESC NULLS LAST,b.id DESC LIMIT 200)x)) INTO result FROM legacy_trust.customers c WHERE c.id=p_id;
 IF result IS NULL THEN RAISE EXCEPTION 'Person not found';END IF;RETURN result;END $$;
CREATE FUNCTION public.admin_renew(p_data jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b legacy_trust.bookings;due date:=(p_data->>'due_date')::date;BEGIN PERFORM trust_admin.require_staff(true);
 SELECT * INTO b FROM legacy_trust.bookings WHERE id=p_data->>'transaction_id' FOR UPDATE;
 IF b.id IS NULL OR b.status NOT IN ('issue','partial_return') THEN RAISE EXCEPTION 'Choose an outstanding loan';END IF;
 IF due IS NULL OR due<=b."endDate" OR due<current_date OR length(trim(coalesce(p_data->>'reason','')))<3 THEN RAISE EXCEPTION 'Choose a later due date and enter a renewal reason';END IF;
 UPDATE legacy_trust.bookings SET "endDate"=due,updated_at=now() WHERE id=b.id;
 PERFORM trust_admin.log_event('renew','loans',b.id,'Due date extended from '||b."endDate"||' to '||due||' · '||left(p_data->>'reason',1000));RETURN b.id;END $$;
CREATE FUNCTION public.admin_followup(p_data jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target_booking text:=p_data->>'transaction_id';BEGIN PERFORM trust_admin.require_staff(true);
 PERFORM 1 FROM legacy_trust.bookings WHERE bookings.id=target_booking AND status IN ('issue','partial_return') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an outstanding loan';END IF;
 INSERT INTO trust_admin.followups(booking_id,actor,note,channel) VALUES(target_booking,auth.uid(),trim(p_data->>'note'),p_data->>'channel');
 PERFORM trust_admin.log_event('followup','loans',target_booking,'Borrower follow-up recorded');RETURN target_booking;END $$;
CREATE FUNCTION public.admin_approve(p_data jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s trust_admin.submissions;existing text;member text;BEGIN PERFORM trust_admin.require_staff(true);
 SELECT * INTO s FROM trust_admin.submissions WHERE id=(p_data->>'submission_id')::uuid FOR UPDATE;
 IF s.id IS NULL OR s.kind<>'membership' OR s.status='archived' THEN RAISE EXCEPTION 'Choose a membership application that is not archived';END IF;
 SELECT member_id INTO member FROM trust_admin.approvals WHERE submission_id=s.id;IF member IS NOT NULL THEN RETURN member;END IF;
 PERFORM pg_advisory_xact_lock(hashtext(lower(s.email)));
 SELECT id INTO existing FROM legacy_trust.members WHERE lower(email)=lower(s.email) LIMIT 1;
 IF existing IS NOT NULL THEN
 IF p_data->>'existing_member_id' IS DISTINCT FROM existing THEN RAISE EXCEPTION 'A member with this email already exists. Review and link that member instead';END IF;member:=existing;
 ELSE member:=public.admin_save('members',jsonb_build_object('name',s.name,'email',s.email,'phone',s.phone,'bloodgroup',coalesce(s.blood_group,''),'city',s.city,'address',s.address,'purpose',s.message),NULL,false);END IF;
 INSERT INTO trust_admin.approvals(submission_id,member_id,actor) VALUES(s.id,member,auth.uid());
 UPDATE trust_admin.submissions SET status='reviewed' WHERE id=s.id;
 PERFORM trust_admin.log_event('approve','members',member,'Membership application approved');RETURN member;END $$;
-- Add follow-ups and approval linkage to the existing detail response.
ALTER FUNCTION public.admin_record(text,text) RENAME TO admin_record_previous;
REVOKE ALL ON FUNCTION public.admin_record_previous(text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.admin_record(p_entity text,p_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM trust_admin.require_staff();RETURN public.admin_record_previous(p_entity,p_id)||jsonb_build_object('kind',(SELECT kind FROM trust_admin.transaction_kinds WHERE booking_id=p_id),'followups',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT f.note,f.channel,f.created_at,s.name FROM trust_admin.followups f LEFT JOIN public.staff s ON s.user_id=f.actor WHERE f.booking_id=p_id ORDER BY f.created_at DESC)x));END $$;
CREATE FUNCTION public.admin_application(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s trust_admin.submissions;BEGIN PERFORM trust_admin.require_staff();SELECT * INTO s FROM trust_admin.submissions WHERE id=p_id;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Application not found';END IF;
 RETURN jsonb_build_object('approved_member_id',(SELECT member_id FROM trust_admin.approvals WHERE submission_id=s.id),'existing_member',(SELECT jsonb_build_object('id',id,'name',name,'email',email) FROM legacy_trust.members WHERE lower(email)=lower(s.email) LIMIT 1));END $$;
CREATE FUNCTION public.admin_conflicts() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF trust_admin.require_staff()<>'admin' THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';END IF;
 RETURN (SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT c.id,c.utbn,c."bookName",jsonb_agg(jsonb_build_object('id',b.id,'reference',b."orderNo",'borrower',p.name,'due',b."endDate")) AS loans FROM legacy_trust.book_lists c JOIN legacy_trust.booking_items i ON i.book_id=c.id JOIN legacy_trust.bookings b ON b.id=i.booking_id LEFT JOIN legacy_trust.customers p ON p.id=b.customer_id WHERE b.status IN ('issue','partial_return') AND NOT EXISTS(SELECT 1 FROM trust_admin.loan_returns r WHERE r.book_id=c.id AND r.booking_id=b.id) GROUP BY c.id,c.utbn,c."bookName" HAVING count(DISTINCT b.id)>1 ORDER BY c.utbn LIMIT 200)x);END $$;
CREATE FUNCTION public.admin_correct(p_data jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE book text:=p_data->>'book_id';kept text:=p_data->>'kept_loan';ids text[];other text;remaining integer;BEGIN
 IF trust_admin.require_staff(true)<>'admin' THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';END IF;
 IF length(trim(coalesce(p_data->>'reason','')))<10 THEN RAISE EXCEPTION 'Explain the verified correction in at least 10 characters';END IF;
 SELECT array_agg(DISTINCT b.id::text ORDER BY b.id::text) INTO ids FROM legacy_trust.bookings b JOIN legacy_trust.booking_items i ON i.booking_id=b.id WHERE i.book_id=book AND b.status IN ('issue','partial_return') AND NOT EXISTS(SELECT 1 FROM trust_admin.loan_returns r WHERE r.book_id=book AND r.booking_id=b.id);
 IF cardinality(ids)<2 OR NOT kept=ANY(ids) THEN RAISE EXCEPTION 'Choose the verified loan from an unresolved conflict';END IF;
 PERFORM 1 FROM legacy_trust.bookings WHERE id=ANY(ids) ORDER BY id FOR UPDATE;
 PERFORM 1 FROM legacy_trust.book_lists WHERE id=book AND status='issue' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'The copy is no longer issued';END IF;
 -- Recheck after acquiring locks; repeated/stale corrections must not change data.
 FOREACH other IN ARRAY ids LOOP IF EXISTS(SELECT 1 FROM trust_admin.loan_returns WHERE booking_id=other AND book_id=book) THEN RAISE EXCEPTION 'Conflict changed; reload before correcting';END IF; END LOOP;
 INSERT INTO trust_admin.corrections(book_id,kept_loan,reason,actor) VALUES(book,kept,left(p_data->>'reason',2000),auth.uid());
 FOREACH other IN ARRAY ids LOOP IF other<>kept THEN
 INSERT INTO trust_admin.loan_returns(booking_id,book_id,disposition,returned_at,actor) VALUES(other,book,'corrected',current_date,auth.uid());
 SELECT count(*) INTO remaining FROM legacy_trust.booking_items i WHERE i.booking_id=other AND NOT EXISTS(SELECT 1 FROM trust_admin.loan_returns r WHERE r.booking_id=other AND r.book_id=i.book_id);
 UPDATE legacy_trust.bookings SET status=CASE WHEN remaining=0 THEN 'closed_correction' ELSE 'partial_return' END,updated_at=now() WHERE id=other;
 END IF;END LOOP;
 PERFORM trust_admin.log_event('correction','loans',kept,'Historical conflict corrected · UTBN copy '||book||' · '||left(p_data->>'reason',1000));RETURN kept;END $$;
CREATE FUNCTION public.admin_report(p_kind text,p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE src text;q text;records jsonb;n integer;BEGIN PERFORM trust_admin.require_staff();
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366 THEN RAISE EXCEPTION 'Choose a date range of up to 366 days';END IF;
 IF p_kind IN ('loans','donations','overdue') THEN
 src:='SELECT b."orderNo" AS reference,c.name,b."issueDate" AS date,b."endDate" AS due,b.status,(SELECT count(*) FROM legacy_trust.booking_items i WHERE i.booking_id=b.id) AS copies FROM legacy_trust.bookings b LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id WHERE b."issueDate" BETWEEN $1 AND $2 AND '||CASE WHEN p_kind='donations' THEN 'k.kind=''donation''' ELSE 'k.kind=''loan''' END;
 IF p_kind='overdue' THEN src:=src||' AND b.status IN (''issue'',''partial_return'') AND b."endDate"<current_date';END IF;
 ELSIF p_kind='returns' THEN src:='SELECT b."orderNo" AS reference,c.name,r.returned_at AS date,x.utbn,x."bookName" AS title,r.disposition AS status FROM trust_admin.loan_returns r JOIN legacy_trust.bookings b ON b.id=r.booking_id JOIN legacy_trust.book_lists x ON x.id=r.book_id LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id WHERE r.returned_at BETWEEN $1 AND $2 AND r.disposition<>''corrected''';
 ELSE RAISE EXCEPTION 'Unknown report';END IF;
 EXECUTE 'SELECT count(*) FROM ('||src||')d' INTO n USING p_from,p_to;
 EXECUTE 'SELECT coalesce(jsonb_agg(x),''[]''::jsonb) FROM (SELECT * FROM ('||src||')d ORDER BY date DESC,reference LIMIT 5000)x' INTO records USING p_from,p_to;
 RETURN jsonb_build_object('rows',records,'total',n,'limited',n>5000);END $$;
DO $$ DECLARE f record;BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('admin_list','admin_person','admin_renew','admin_followup','admin_approve','admin_record','admin_application','admin_conflicts','admin_correct','admin_report') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);END LOOP;END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA trust_admin FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
