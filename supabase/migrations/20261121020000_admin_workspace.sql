-- Incremental admin workspace. Preserves imported tables and records.
BEGIN;
CREATE SCHEMA trust_admin;
REVOKE ALL ON SCHEMA trust_admin FROM PUBLIC, anon, authenticated;
CREATE TABLE public.staff (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 role text NOT NULL CHECK(role IN ('admin','operator','viewer')),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.staff TO authenticated;
CREATE POLICY own_staff ON public.staff FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE trust_admin.audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor uuid NOT NULL, action text NOT NULL, entity text NOT NULL,
 record_id text, summary text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE trust_admin.loan_returns (
 booking_id char(36) NOT NULL REFERENCES legacy_trust.bookings(id),
 book_id char(36) NOT NULL REFERENCES legacy_trust.book_lists(id),
 disposition text NOT NULL CHECK(disposition IN ('return','lost')),
 returned_at date NOT NULL, actor uuid NOT NULL,
 PRIMARY KEY(booking_id,book_id)
);
CREATE TABLE trust_admin.submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL,
 name text NOT NULL, email text NOT NULL, phone text NOT NULL,
 message text NOT NULL, subject text, blood_group text, city text, address text,
 status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewed','archived')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX submission_email_date ON trust_admin.submissions(lower(email),created_at DESC);
CREATE INDEX audit_date ON trust_admin.audit(created_at DESC);
ALTER TABLE trust_admin.audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_admin.loan_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_admin.submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA trust_admin FROM PUBLIC, anon, authenticated;
CREATE SEQUENCE trust_admin.reference_seq;
-- Preserve imported UTBNs, allocate new ones under a dedicated sequence.
CREATE SEQUENCE trust_admin.utbn_seq;
SELECT setval('trust_admin.utbn_seq',greatest(coalesce(max(utbn),0)+1,1),false) FROM legacy_trust.book_lists;
CREATE FUNCTION trust_admin.require_staff(write_access boolean DEFAULT false) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r text;
BEGIN
 SELECT role INTO r FROM public.staff WHERE user_id=auth.uid() AND active;
 IF r IS NULL OR (write_access AND r='viewer') THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;
 RETURN r;
END $$;
CREATE FUNCTION trust_admin.log_event(a text,e text,r text,s text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO trust_admin.audit(actor,action,entity,record_id,summary) VALUES(auth.uid(),a,e,r,s);
$$;
CREATE FUNCTION public.admin_overview() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM trust_admin.require_staff();
 RETURN jsonb_build_object(
 'books',(SELECT count(*) FROM legacy_trust.book_lists),
 'available',(SELECT count(*) FROM legacy_trust.book_lists WHERE status='active'),
 'issued',(SELECT count(*) FROM legacy_trust.book_lists WHERE status='issue'),
 'lost',(SELECT count(*) FROM legacy_trust.book_lists WHERE status='lost'),
 'donors',(SELECT count(*) FROM legacy_trust.customers WHERE type='donar'),
 'borrowers',(SELECT count(*) FROM legacy_trust.customers WHERE type='customer'),
 'members',(SELECT count(*) FROM legacy_trust.members),
 'overdue',(SELECT count(*) FROM legacy_trust.bookings WHERE status IN ('issue','partial_return') AND "endDate"<current_date),
 'submissions',(SELECT count(*) FROM trust_admin.submissions WHERE status='new'),
 'recent',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT b.id,b."orderNo",b.status,b."issueDate",b."endDate",c.name FROM legacy_trust.bookings b LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id ORDER BY b.created_at DESC NULLS LAST LIMIT 6)x),
 'activity',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT summary,created_at FROM trust_admin.audit ORDER BY id DESC LIMIT 5)x));
END $$;
CREATE FUNCTION public.admin_list(p_entity text,p_search text DEFAULT '',p_page integer DEFAULT 1,p_filter text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE src text; q text; n bigint; records jsonb; term text;
BEGIN
 PERFORM trust_admin.require_staff();
 IF p_page<1 OR p_page>100000 THEN RAISE EXCEPTION 'Invalid page'; END IF;
 term:='%'||replace(replace(left(trim(p_search),150),'%','\%'),'_','\_')||'%';
 CASE p_entity
 WHEN 'books' THEN src:='SELECT b.*,c.name AS donor_name FROM legacy_trust.book_lists b LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id';
 WHEN 'people' THEN src:='SELECT * FROM legacy_trust.customers';
 WHEN 'members' THEN src:='SELECT * FROM legacy_trust.members';
 WHEN 'authors' THEN src:='SELECT * FROM legacy_trust.authors';
 WHEN 'classes' THEN src:='SELECT * FROM legacy_trust.class_names';
 WHEN 'loans' THEN src:='SELECT b.*,c.name,c.phone FROM legacy_trust.bookings b LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id';
 WHEN 'contacts' THEN src:='SELECT * FROM legacy_trust.contacts';
 WHEN 'feedback' THEN src:='SELECT * FROM legacy_trust.feedback';
 WHEN 'submissions' THEN src:='SELECT * FROM trust_admin.submissions';
 WHEN 'audit' THEN src:='SELECT a.*,s.name FROM trust_admin.audit a LEFT JOIN public.staff s ON s.user_id=a.actor';
 ELSE RAISE EXCEPTION 'Unknown section'; END CASE;
 -- Search only meaningful editorial/reference fields, not every field of a private row.
 q:=' FROM ('||src||') d WHERE concat_ws('' '',to_jsonb(d)->>''name'',to_jsonb(d)->>''title'',to_jsonb(d)->>''bookName'',to_jsonb(d)->>''author'',to_jsonb(d)->>''class'',to_jsonb(d)->>''utbn'',to_jsonb(d)->>''orderNo'',to_jsonb(d)->>''email'',to_jsonb(d)->>''phone'',to_jsonb(d)->>''summary'') ILIKE $1 AND ($2='''' OR to_jsonb(d)->>''status''=$2 OR to_jsonb(d)->>''type''=$2 OR to_jsonb(d)->>''kind''=$2)';
 EXECUTE 'SELECT count(*)'||q INTO n USING term,p_filter;
 EXECUTE 'SELECT coalesce(jsonb_agg(x),''[]''::jsonb) FROM (SELECT d.*'||q||' ORDER BY to_jsonb(d)->>''created_at'' DESC NULLS LAST, d.id DESC LIMIT 25 OFFSET $3)x' INTO records USING term,p_filter,(p_page-1)*25;
 RETURN jsonb_build_object('rows',records,'total',n,'page',p_page);
END $$;
CREATE FUNCTION public.admin_record(p_entity text,p_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM trust_admin.require_staff();
 IF p_entity<>'loans' THEN RAISE EXCEPTION 'Unsupported detail'; END IF;
 SELECT to_jsonb(b)||jsonb_build_object('person',to_jsonb(c),'items',(
 SELECT coalesce(jsonb_agg(to_jsonb(book)||jsonb_build_object('disposition',r.disposition,'returned_at',r.returned_at)),'[]'::jsonb)
 FROM legacy_trust.booking_items i JOIN legacy_trust.book_lists book ON book.id=i.book_id
 LEFT JOIN trust_admin.loan_returns r ON r.booking_id=b.id AND r.book_id=book.id WHERE i.booking_id=b.id)) INTO result
 FROM legacy_trust.bookings b LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id WHERE b.id=p_id;
 IF result IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.admin_save(p_entity text,p_data jsonb,p_id text DEFAULT NULL,p_archive boolean DEFAULT false) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tbl text; fields text[]; columns_sql text; values_sql text; assignments text; item text; id_value text:=coalesce(p_id,gen_random_uuid()::text); data jsonb:=p_data;
BEGIN
 PERFORM trust_admin.require_staff(true);
 CASE p_entity
 WHEN 'people' THEN tbl:='customers';fields:=ARRAY['name','email','phone','address','bloodGroup','type','status'];
 WHEN 'members' THEN tbl:='members';fields:=ARRAY['name','email','phone','bloodgroup','address','city','purpose','status'];
 WHEN 'books' THEN tbl:='book_lists';fields:=ARRAY['bookName','author','class','status'];
 WHEN 'authors' THEN tbl:='authors';fields:=ARRAY['title','status'];
 WHEN 'classes' THEN tbl:='class_names';fields:=ARRAY['title','status'];
 ELSE RAISE EXCEPTION 'Unsupported operation'; END CASE;
 IF p_entity='books' AND p_id IS NULL THEN RAISE EXCEPTION 'Use donation intake to add copies'; END IF;
 IF p_id IS NOT NULL THEN
  EXECUTE format('SELECT id FROM legacy_trust.%I WHERE id=$1 FOR UPDATE',tbl) INTO item USING p_id;
  IF item IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
 END IF;
 IF p_entity='books' AND EXISTS(SELECT 1 FROM legacy_trust.book_lists WHERE id=p_id AND status='issue') THEN RAISE EXCEPTION 'Return the issued copy before editing or archiving it'; END IF;
 IF p_archive THEN
  IF p_id IS NULL THEN RAISE EXCEPTION 'Select an existing record'; END IF;
  IF p_entity='people' AND EXISTS(SELECT 1 FROM legacy_trust.bookings WHERE customer_id=p_id AND status IN ('issue','partial_return')) THEN RAISE EXCEPTION 'Resolve outstanding loans before archiving this person'; END IF;
  EXECUTE format('UPDATE legacy_trust.%I SET status=''inactive'',updated_at=now() WHERE id=$1',tbl) USING p_id;
 ELSE
  IF length(coalesce(data->>'status',''))=0 THEN data:=data||'{"status":"active"}'::jsonb; END IF;
  IF data->>'status' NOT IN ('active','inactive') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF p_entity IN ('people','members') THEN
   IF length(trim(coalesce(data->>'name','')))<2 OR length(data->>'name')>120 OR length(coalesce(data->>'email',''))>254 OR coalesce(data->>'email','') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' OR coalesce(data->>'phone','') !~ '^[+0-9 ()-]{10,18}$' THEN RAISE EXCEPTION 'Check name, email and phone'; END IF;
   data:=data||jsonb_build_object('email',lower(trim(data->>'email')));
   IF p_entity='people' AND coalesce(data->>'type','') NOT IN ('donar','customer') THEN RAISE EXCEPTION 'Invalid person type'; END IF;
   IF p_entity='members' AND (length(trim(coalesce(data->>'city','')))=0 OR length(trim(coalesce(data->>'purpose','')))=0) THEN RAISE EXCEPTION 'City and purpose are required'; END IF;
   IF p_entity='members' AND coalesce(data->>'bloodgroup','') NOT IN ('','A+','A-','B+','B-','AB+','AB-','O+','O-') THEN RAISE EXCEPTION 'Invalid blood group'; END IF;
  ELSIF p_entity='books' THEN
   IF length(trim(coalesce(data->>'bookName','')))=0 OR length(trim(coalesce(data->>'author','')))=0 OR length(trim(coalesce(data->>'class','')))=0 THEN RAISE EXCEPTION 'Title, author and class are required'; END IF;
  ELSE
   IF length(trim(coalesce(data->>'title','')))=0 OR length(data->>'title')>255 THEN RAISE EXCEPTION 'Title is required'; END IF;
   PERFORM pg_advisory_xact_lock(hashtext(tbl||lower(trim(data->>'title'))));
   EXECUTE format('SELECT id FROM legacy_trust.%I WHERE lower(trim(title))=lower(trim($1)) AND id<>$2 LIMIT 1',tbl) INTO item USING data->>'title',id_value;
   IF item IS NOT NULL THEN RAISE EXCEPTION 'Title already exists'; END IF;
  END IF;
  IF p_id IS NULL THEN
   data:=data||jsonb_build_object('id',id_value,'created_at',now(),'updated_at',now());
   fields:=fields||ARRAY['id','created_at','updated_at'];
   IF p_entity='people' THEN fields:=fields||ARRAY['customerId'];data:=data||jsonb_build_object('customerId','UTC-P-'||nextval('trust_admin.reference_seq')); END IF;
   IF p_entity='members' THEN fields:=fields||ARRAY['memberId'];data:=data||jsonb_build_object('memberId','UTC-M-'||nextval('trust_admin.reference_seq')); END IF;
   SELECT string_agg(format('%I',f),','),string_agg(format('x.%I',f),',') INTO columns_sql,values_sql FROM unnest(fields)f;
   EXECUTE format('INSERT INTO legacy_trust.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::legacy_trust.%I,$1)x',tbl,columns_sql,values_sql,tbl) USING data;
  ELSE
   data:=data||jsonb_build_object('updated_at',now());fields:=fields||ARRAY['updated_at'];
   SELECT string_agg(format('%I=x.%I',f,f),',') INTO assignments FROM unnest(fields)f;
   EXECUTE format('UPDATE legacy_trust.%I t SET %s FROM jsonb_populate_record(NULL::legacy_trust.%I,$1)x WHERE t.id=$2',tbl,assignments,tbl) USING data,p_id;
  END IF;
 END IF;
 PERFORM trust_admin.log_event(CASE WHEN p_archive THEN 'archive' WHEN p_id IS NULL THEN 'create' ELSE 'update' END,p_entity,id_value,initcap(p_entity)||CASE WHEN p_archive THEN ' record archived' WHEN p_id IS NULL THEN ' record created' ELSE ' record updated' END);
 RETURN id_value;
END $$;
CREATE FUNCTION public.admin_donate(p_data jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE donor text:=p_data->>'person_id'; booking text:=gen_random_uuid()::text; ref text; b jsonb; book text;
BEGIN
 PERFORM trust_admin.require_staff(true);
 IF NOT EXISTS(SELECT 1 FROM legacy_trust.customers WHERE id=donor AND type='donar' AND status='active') THEN RAISE EXCEPTION 'Choose an active donor'; END IF;
 IF jsonb_typeof(p_data->'books') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'books') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Add between 1 and 200 books'; END IF;
 ref:='UTC-D-'||nextval('trust_admin.reference_seq');
 INSERT INTO legacy_trust.bookings(id,"orderNo","issueDate","endDate",customer_id,status,created_at,updated_at) VALUES(booking,ref,current_date,current_date,donor,'new',now(),now());
 FOR b IN SELECT value FROM jsonb_array_elements(p_data->'books') LOOP
  IF length(trim(coalesce(b->>'title','')))=0 OR length(trim(coalesce(b->>'author','')))=0 OR length(trim(coalesce(b->>'class_name','')))=0 THEN RAISE EXCEPTION 'Every book needs title, author and class'; END IF;
  book:=gen_random_uuid()::text;
  INSERT INTO legacy_trust.book_lists(id,"bookName",author,class,utbn,customer_id,status,created_at,updated_at) VALUES(book,trim(b->>'title'),trim(b->>'author'),trim(b->>'class_name'),nextval('trust_admin.utbn_seq'),donor,'active',now(),now());
  INSERT INTO legacy_trust.booking_items(id,"orderNo",booking_id,book_id,created_at,updated_at) VALUES(gen_random_uuid()::text,ref,booking,book,now(),now());
 END LOOP;
 PERFORM trust_admin.log_event('donation','loans',booking,'Donation registered · '||jsonb_array_length(p_data->'books')||' copies');
 RETURN booking;
END $$;
CREATE FUNCTION public.admin_issue(p_data jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE person text:=p_data->>'person_id'; ids text[]; booking text:=gen_random_uuid()::text; ref text; due date; issued date; book text;
BEGIN
 PERFORM trust_admin.require_staff(true);
 IF jsonb_typeof(p_data->'book_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'book_ids') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Choose 1 to 100 copies'; END IF;
 SELECT array_agg(value::uuid::text ORDER BY value) INTO ids FROM jsonb_array_elements_text(p_data->'book_ids');
 IF cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids)x) THEN RAISE EXCEPTION 'Duplicate book selection'; END IF;
 issued:=coalesce((p_data->>'issue_date')::date,current_date);due:=(p_data->>'due_date')::date;
 IF due IS NULL OR due<issued OR issued>current_date THEN RAISE EXCEPTION 'Check issue and due dates'; END IF;
 IF NOT EXISTS(SELECT 1 FROM legacy_trust.customers WHERE id=person AND type='customer' AND status='active') THEN RAISE EXCEPTION 'Choose an active borrower'; END IF;
 PERFORM 1 FROM legacy_trust.book_lists WHERE id=ANY(ids) ORDER BY id FOR UPDATE;
 IF (SELECT count(*) FROM legacy_trust.book_lists WHERE id=ANY(ids) AND status='active')<>cardinality(ids) THEN RAISE EXCEPTION 'A selected copy is no longer available'; END IF;
 ref:='UTC-L-'||nextval('trust_admin.reference_seq');
 INSERT INTO legacy_trust.bookings(id,"orderNo","issueDate","endDate",customer_id,status,created_at,updated_at) VALUES(booking,ref,issued,due,person,'issue',now(),now());
 FOREACH book IN ARRAY ids LOOP
  INSERT INTO legacy_trust.booking_items(id,"orderNo",booking_id,book_id,created_at,updated_at) VALUES(gen_random_uuid()::text,ref,booking,book,now(),now());
 END LOOP;
 UPDATE legacy_trust.book_lists SET status='issue',updated_at=now() WHERE id=ANY(ids);
 PERFORM trust_admin.log_event('issue','loans',booking,'Books issued · '||cardinality(ids)||' copies');RETURN booking;
END $$;
CREATE FUNCTION public.admin_return(p_data jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE booking text:=p_data->>'transaction_id'; ids text[]; b legacy_trust.bookings; book text; disposition text:=CASE WHEN coalesce((p_data->>'lost')::boolean,false) THEN 'lost' ELSE 'return' END; penalty numeric; returned date; outstanding integer;
BEGIN
 PERFORM trust_admin.require_staff(true);
 SELECT * INTO b FROM legacy_trust.bookings WHERE id=booking FOR UPDATE;
 IF b.id IS NULL OR b.status NOT IN ('issue','partial_return') THEN RAISE EXCEPTION 'Choose an outstanding loan'; END IF;
 IF jsonb_typeof(p_data->'book_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'book_ids') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Choose 1 to 100 copies'; END IF;
 SELECT array_agg(value::uuid::text ORDER BY value) INTO ids FROM jsonb_array_elements_text(p_data->'book_ids');
 IF cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids)x) THEN RAISE EXCEPTION 'Duplicate book selection'; END IF;
 penalty:=coalesce((p_data->>'penalty')::numeric,0);returned:=coalesce((p_data->>'return_date')::date,current_date);
 IF penalty<0 OR penalty>1000000 OR returned<b."issueDate" OR returned>current_date THEN RAISE EXCEPTION 'Check return date and penalty'; END IF;
 PERFORM 1 FROM legacy_trust.book_lists WHERE id=ANY(ids) ORDER BY id FOR UPDATE;
 FOREACH book IN ARRAY ids LOOP
  IF NOT EXISTS(SELECT 1 FROM legacy_trust.booking_items i JOIN legacy_trust.book_lists c ON c.id=i.book_id WHERE i.booking_id=booking AND i.book_id=book AND c.status='issue') OR EXISTS(SELECT 1 FROM trust_admin.loan_returns WHERE booking_id=booking AND book_id=book) THEN RAISE EXCEPTION 'A copy is not outstanding on this loan'; END IF;
  IF EXISTS(SELECT 1 FROM legacy_trust.booking_items i JOIN legacy_trust.bookings other ON other.id=i.booking_id WHERE i.book_id=book AND other.id<>booking AND other.status IN ('issue','partial_return') AND NOT EXISTS(SELECT 1 FROM trust_admin.loan_returns r WHERE r.booking_id=other.id AND r.book_id=book)) THEN RAISE EXCEPTION 'Conflicting historical loans require review before returning this copy'; END IF;
  INSERT INTO trust_admin.loan_returns(booking_id,book_id,disposition,returned_at,actor) VALUES(booking,book,disposition,returned,auth.uid());
 END LOOP;
 UPDATE legacy_trust.book_lists SET status=CASE WHEN disposition='lost' THEN 'lost' ELSE 'active' END,updated_at=now() WHERE id=ANY(ids);
 SELECT count(DISTINCT i.book_id) INTO outstanding FROM legacy_trust.booking_items i WHERE i.booking_id=booking AND NOT EXISTS(SELECT 1 FROM trust_admin.loan_returns r WHERE r.booking_id=booking AND r.book_id=i.book_id);
 UPDATE legacy_trust.bookings SET status=CASE WHEN outstanding>0 THEN 'partial_return' WHEN EXISTS(SELECT 1 FROM trust_admin.loan_returns lr WHERE lr.booking_id=booking AND lr.disposition='lost') THEN 'lost' ELSE 'return' END,
 "returnDate"=CASE WHEN outstanding=0 THEN returned ELSE "returnDate" END,
 "penaltyAmount"=((CASE WHEN coalesce("penaltyAmount",'') ~ '^[0-9]+(\.[0-9]+)?$' THEN "penaltyAmount"::numeric ELSE 0 END)+penalty)::text,
 "penaltyReason"=concat_ws(E'\n',nullif("penaltyReason",''),nullif(left(p_data->>'reason',1000),'')),updated_at=now() WHERE id=booking;
 PERFORM trust_admin.log_event(disposition,'loans',booking,CASE WHEN disposition='lost' THEN 'Copies reported lost' ELSE 'Books returned' END||' · '||cardinality(ids)||' copies · penalty '||penalty);RETURN booking;
END $$;
CREATE FUNCTION public.admin_submission(p_id uuid,p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM trust_admin.require_staff(true);
 IF p_status NOT IN ('new','reviewed','archived') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 UPDATE trust_admin.submissions SET status=p_status WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
 PERFORM trust_admin.log_event('review','submissions',p_id::text,'Submission marked '||p_status);
END $$;
CREATE FUNCTION public.submit_request(payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mail text:=lower(trim(payload->>'email'));
BEGIN
 IF payload->>'kind' IS NULL OR payload->>'kind' NOT IN ('contact','membership') OR length(coalesce(payload->>'name','')) NOT BETWEEN 2 AND 120 OR length(coalesce(mail,'')) NOT BETWEEN 3 AND 254 OR mail !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' OR coalesce(payload->>'phone','') !~ '^[+0-9 ()-]{10,18}$' OR length(coalesce(payload->>'message','')) NOT BETWEEN 10 AND 3000 THEN RAISE EXCEPTION 'Invalid submission' USING ERRCODE='22023'; END IF;
 IF length(coalesce(payload->>'city',''))>120 OR length(coalesce(payload->>'address',''))>400 OR length(coalesce(payload->>'subject',''))>120 OR (payload->>'kind'='membership' AND length(trim(coalesce(payload->>'city','')))=0) THEN RAISE EXCEPTION 'Check submission details' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(48290311);
 IF (SELECT count(*) FROM trust_admin.submissions WHERE created_at>now()-interval '1 day')>=500 THEN RAISE EXCEPTION 'Daily submission limit reached. Contact the trust directly'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(mail));
 IF EXISTS(SELECT 1 FROM trust_admin.submissions WHERE lower(email)=mail AND created_at>now()-interval '5 minutes') THEN RAISE EXCEPTION 'Please wait before sending again'; END IF;
 INSERT INTO trust_admin.submissions(kind,name,email,phone,message,subject,blood_group,city,address) VALUES(payload->>'kind',trim(payload->>'name'),mail,payload->>'phone',payload->>'message',payload->>'subject',left(payload->>'blood_group',4),payload->>'city',payload->>'address');
END $$;
CREATE FUNCTION public.admin_team() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF trust_admin.require_staff()<>'admin' THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT s.user_id,s.name,s.role,s.active,u.email FROM public.staff s JOIN auth.users u ON u.id=s.user_id ORDER BY s.created_at)x);
END $$;
CREATE FUNCTION public.admin_set_staff(p_email text,p_name text,p_role text,p_active boolean DEFAULT true) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid;
BEGIN
 IF trust_admin.require_staff()<>'admin' THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 IF p_role NOT IN ('admin','operator','viewer') OR length(trim(p_name)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Check name and role'; END IF;
 SELECT id INTO target FROM auth.users WHERE lower(email)=lower(trim(p_email));
 IF target IS NULL THEN RAISE EXCEPTION 'Create this account in Supabase Authentication first'; END IF;
 IF target=auth.uid() AND (NOT p_active OR p_role<>'admin') THEN RAISE EXCEPTION 'You cannot remove your own administrator access'; END IF;
 INSERT INTO public.staff(user_id,name,role,active) VALUES(target,trim(p_name),p_role,p_active) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,role=excluded.role,active=excluded.active;
 PERFORM trust_admin.log_event('staff_access','staff',target::text,'Staff access updated · '||p_role||CASE WHEN p_active THEN '' ELSE ' · disabled' END);
END $$;
REVOKE ALL ON FUNCTION public.admin_team(),public.admin_set_staff(text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_team(),public.admin_set_staff(text,text,text,boolean) TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA trust_admin FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_overview(),public.admin_list(text,text,integer,text),public.admin_record(text,text),public.admin_save(text,jsonb,text,boolean),public.admin_donate(jsonb),public.admin_issue(jsonb),public.admin_return(jsonb),public.admin_submission(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_overview(),public.admin_list(text,text,integer,text),public.admin_record(text,text),public.admin_save(text,jsonb,text,boolean),public.admin_donate(jsonb),public.admin_issue(jsonb),public.admin_return(jsonb),public.admin_submission(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_request(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_request(jsonb) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
