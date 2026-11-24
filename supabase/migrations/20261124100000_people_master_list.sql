-- One master list of people.
--
-- Until now a person was stored as either a "donor" or a "borrower", the donor and borrower pickers each showed
-- only their own kind, and phone and email had to be unique. So a donor who later borrowed was missing from the
-- borrower picker, adding them again hit the unique phone/email and the screen said the record "already exists".
-- Numbers handed out for new people, donations and issues were also never moved past the old records, so a
-- number an old record already had could be given out again, with the same vague message.
--
-- This migration:
--  * hands out reference numbers and UTBNs that skip anything already used, and moves the counters past old records;
--  * lets any active person donate or borrow ("donor" and "borrower" become roles worked out from what they did);
--  * lets people share a phone number or email (families do), blocks only an exact repeat of the same name and
--    phone, and returns who a repeat matches so the screen can offer "use this person";
--  * searches people by name (words in any order), phone (any formatting), email or their reference number;
--  * adds a duplicates finder and a merge for administrators, keeping all history.
-- Nothing is deleted from existing data.
BEGIN;

-- Normal forms used to compare people: a phone is its last 10 digits, a name is lower-case with single spaces.
CREATE FUNCTION trust_admin.phone_key(p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT right(regexp_replace(coalesce(p,''),'[^0-9]','','g'),10)
$$;
CREATE FUNCTION trust_admin.name_key(p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT lower(regexp_replace(btrim(coalesce(p,'')),'[[:space:]]+',' ','g'))
$$;

-- Move the shared reference counter past every number already in use.
DO $$
DECLARE top bigint;
BEGIN
 SELECT greatest(
  coalesce((SELECT max(substring("customerId" from '([0-9]{1,15})$')::bigint) FROM legacy_trust.customers),0),
  coalesce((SELECT max(substring("memberId" from '([0-9]{1,15})$')::bigint) FROM legacy_trust.members),0),
  coalesce((SELECT max(substring("orderNo" from '([0-9]{1,15})$')::bigint) FROM legacy_trust.bookings),0)
 ) INTO top;
 IF top+1>(SELECT last_value+CASE WHEN is_called THEN 1 ELSE 0 END FROM trust_admin.reference_seq) THEN
  PERFORM setval('trust_admin.reference_seq',top+1,false);
 END IF;
 SELECT coalesce(max(utbn),0) INTO top FROM legacy_trust.book_lists;
 IF top+1>(SELECT last_value+CASE WHEN is_called THEN 1 ELSE 0 END FROM trust_admin.utbn_seq) THEN
  PERFORM setval('trust_admin.utbn_seq',top+1,false);
 END IF;
END $$;

-- Reference numbers (UTC-P-, UTC-M-, UTC-D-, UTC-I-) and UTBNs that can never repeat one that exists.
CREATE FUNCTION trust_admin.next_reference() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n bigint;tries integer:=0;
BEGIN
 LOOP
  n:=nextval('trust_admin.reference_seq');
  EXIT WHEN NOT EXISTS(SELECT 1 FROM legacy_trust.customers WHERE "customerId" ~ ('(^|[^0-9])0*'||n||'$'))
   AND NOT EXISTS(SELECT 1 FROM legacy_trust.members WHERE "memberId" ~ ('(^|[^0-9])0*'||n||'$'))
   AND NOT EXISTS(SELECT 1 FROM legacy_trust.bookings WHERE "orderNo" ~ ('(^|[^0-9])0*'||n||'$'));
  tries:=tries+1;
  IF tries>100000 THEN RAISE EXCEPTION 'Could not allocate a reference number. Please try again';END IF;
 END LOOP;
 RETURN n;
END $$;
CREATE FUNCTION trust_admin.next_utbn() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;tries integer:=0;
BEGIN
 LOOP
  n:=nextval('trust_admin.utbn_seq');
  EXIT WHEN NOT EXISTS(SELECT 1 FROM legacy_trust.book_lists WHERE utbn=n);
  tries:=tries+1;
  IF tries>100000 THEN RAISE EXCEPTION 'Could not allocate a UTBN. Please try again';END IF;
 END LOOP;
 RETURN n;
END $$;

-- Rewrite three live functions in place (their rules, settings and permissions stay as they are):
--  * every new reference number / UTBN comes from the safe allocators above;
--  * any active person can donate or borrow, whichever "type" they were first saved as.
DO $$
DECLARE def text;fn text;
BEGIN
 FOREACH fn IN ARRAY ARRAY['public.admin_save(text,jsonb,text,boolean)','public.admin_donate(jsonb)','public.admin_issue(jsonb)'] LOOP
  SELECT pg_get_functiondef(fn::regprocedure) INTO def;
  def:=replace(def,'nextval(''trust_admin.reference_seq'')','trust_admin.next_reference()');
  def:=replace(def,'nextval(''trust_admin.utbn_seq'')','trust_admin.next_utbn()');
  IF fn LIKE '%admin_donate%' THEN
   IF position('id=donor AND type=''donar'' AND status=''active''' IN def)=0 THEN RAISE EXCEPTION 'Unexpected admin_donate definition';END IF;
   def:=replace(def,'id=donor AND type=''donar'' AND status=''active''','id=donor AND status=''active''');
   def:=replace(def,'Choose an active donor','Choose a person from the list. Archived people cannot donate');
  ELSIF fn LIKE '%admin_issue%' THEN
   IF position('id=person AND type=''customer'' AND status=''active''' IN def)=0 THEN RAISE EXCEPTION 'Unexpected admin_issue definition';END IF;
   def:=replace(def,'id=person AND type=''customer'' AND status=''active''','id=person AND status=''active''');
   def:=replace(def,'Choose an active borrower','Choose a person from the list. Archived people cannot borrow');
  END IF;
  EXECUTE def;
 END LOOP;
END $$;

-- The dashboard's donor and borrower counts now count what people did, not how they were first saved.
DO $$
DECLARE def text;
BEGIN
 SELECT pg_get_functiondef('public.admin_overview()'::regprocedure) INTO def;
 IF position('''donors'',(SELECT count(*) FROM legacy_trust.customers WHERE type=''donar'')' IN def)=0 THEN RAISE EXCEPTION 'Unexpected admin_overview definition';END IF;
 def:=replace(def,'''donors'',(SELECT count(*) FROM legacy_trust.customers WHERE type=''donar'')',
  '''people'',(SELECT count(*) FROM legacy_trust.customers WHERE status=''active''),''donors'',(SELECT count(DISTINCT b.customer_id) FROM legacy_trust.bookings b JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id WHERE k.kind=''donation'' AND b.status<>''cancelled'')');
 def:=replace(def,'''borrowers'',(SELECT count(*) FROM legacy_trust.customers WHERE type=''customer'')',
  '''borrowers'',(SELECT count(DISTINCT b.customer_id) FROM legacy_trust.bookings b JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id WHERE k.kind=''loan'' AND b.status<>''cancelled'')');
 EXECUTE def;
END $$;

-- Phone and email may be shared (a family often has one phone). Only an exact repeat of the same name and phone
-- number is refused. This is a check on new or changed rows, so old data that repeats cannot make this fail.
DROP INDEX IF EXISTS legacy_trust.customers_email_unique;
DROP INDEX IF EXISTS legacy_trust.customers_phone_unique;
CREATE INDEX customers_phone_key_idx ON legacy_trust.customers (trust_admin.phone_key(phone));
CREATE INDEX customers_email_key_idx ON legacy_trust.customers (lower(email));
CREATE INDEX customers_name_key_idx ON legacy_trust.customers (trust_admin.name_key(name));

CREATE FUNCTION trust_admin.guard_person_duplicate() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE other text;
BEGIN
 IF trust_admin.phone_key(NEW.phone)='' THEN RETURN NEW;END IF;
 -- Editing other details of an entry that already repeats an older one must keep working.
 IF TG_OP='UPDATE' AND NEW.name IS NOT DISTINCT FROM OLD.name AND NEW.phone IS NOT DISTINCT FROM OLD.phone THEN RETURN NEW;END IF;
 PERFORM pg_advisory_xact_lock(hashtext('person:'||trust_admin.name_key(NEW.name)||':'||trust_admin.phone_key(NEW.phone)));
 SELECT o."customerId" INTO other FROM legacy_trust.customers o
  WHERE o.id<>NEW.id AND trust_admin.name_key(o.name)=trust_admin.name_key(NEW.name) AND trust_admin.phone_key(o.phone)=trust_admin.phone_key(NEW.phone) LIMIT 1;
 IF FOUND THEN RAISE EXCEPTION '% with this phone number is already in the list (%)',NEW.name,other;END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER customers_guard_duplicate BEFORE INSERT OR UPDATE OF name,phone ON legacy_trust.customers
 FOR EACH ROW EXECUTE FUNCTION trust_admin.guard_person_duplicate();

-- The people list: one list for everyone. Search matches name (words in any order), phone (however it is
-- written), email and the person's reference number. Roles come from what the person has done.
CREATE FUNCTION trust_admin.people_list(p_search text,p_page integer,p_filter text,p_sort text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE words text[];flt text:=CASE coalesce(p_filter,'') WHEN 'donar' THEN 'donor' WHEN 'customer' THEN 'borrower' ELSE coalesce(p_filter,'') END;
BEGIN
 IF btrim(coalesce(p_search,'')) ~ '^[0-9+() -]{3,40}$' THEN
  -- A search made only of digits and phone punctuation is one phone number, however it is spaced.
  words:=ARRAY[regexp_replace(btrim(p_search),'[[:space:]]+','','g')];
 ELSE
  SELECT coalesce(array_agg(w),ARRAY[]::text[]) INTO words FROM (
   SELECT left(w,40) AS w FROM unnest(regexp_split_to_array(lower(btrim(coalesce(p_search,''))),'[[:space:]]+')) w WHERE w<>'' LIMIT 6) s;
 END IF;
 RETURN (
  WITH matched AS MATERIALIZED (
   SELECT c.* FROM legacy_trust.customers c
   WHERE NOT EXISTS(SELECT 1 FROM unnest(words) w WHERE position(w IN lower(concat_ws(' ',c.name,c.email,c.phone,regexp_replace(c.phone,'[^0-9]','','g'),c."customerId")))=0
      -- a phone typed with dashes, brackets or a country code still matches a phone written another way
      AND NOT (w ~ '^[0-9+()-]+$' AND length(regexp_replace(w,'[^0-9]','','g'))>=3 AND position(right(regexp_replace(w,'[^0-9]','','g'),10) IN regexp_replace(c.phone,'[^0-9]','','g'))>0))
    AND (flt='' OR (flt='active' AND c.status='active') OR (flt='inactive' AND c.status='inactive')
     OR (flt='donor' AND EXISTS(SELECT 1 FROM legacy_trust.bookings b JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id WHERE b.customer_id=c.id AND k.kind='donation' AND b.status<>'cancelled'))
     OR (flt='borrower' AND EXISTS(SELECT 1 FROM legacy_trust.bookings b JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id WHERE b.customer_id=c.id AND k.kind='loan' AND b.status<>'cancelled')))
  ),paged AS (
   SELECT m.*,row_number() OVER (ORDER BY CASE WHEN p_sort='name' THEN lower(m.name) END ASC NULLS LAST,CASE WHEN p_sort='oldest' THEN m.created_at END ASC NULLS LAST,CASE WHEN p_sort NOT IN ('name','oldest') THEN m.created_at END DESC NULLS LAST,m.id DESC) AS rn
   FROM matched m ORDER BY rn LIMIT 25 OFFSET (p_page-1)*25
  )
  SELECT jsonb_build_object('rows',coalesce(jsonb_agg(
   to_jsonb(p)-'rn'||jsonb_build_object(
    'donations',(SELECT count(*) FROM legacy_trust.bookings b JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id WHERE b.customer_id=p.id AND k.kind='donation' AND b.status<>'cancelled'),
    'borrowings',(SELECT count(*) FROM legacy_trust.bookings b JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id WHERE b.customer_id=p.id AND k.kind='loan' AND b.status<>'cancelled'),
    'books_donated',(SELECT count(*) FROM legacy_trust.book_lists x WHERE x.customer_id=p.id),
    'outstanding',(SELECT count(*) FROM legacy_trust.bookings b WHERE b.customer_id=p.id AND b.status IN ('issue','partial_return')))
   ORDER BY p.rn),'[]'::jsonb),'total',(SELECT count(*) FROM matched),'page',p_page) FROM paged p
 );
END $$;

ALTER FUNCTION public.admin_list(text,text,integer,text,text) RENAME TO admin_list_before_people;
REVOKE ALL ON FUNCTION public.admin_list_before_people(text,text,integer,text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.admin_list(p_entity text,p_search text DEFAULT '',p_page integer DEFAULT 1,p_filter text DEFAULT '',p_sort text DEFAULT 'newest') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_entity<>'people' THEN RETURN public.admin_list_before_people(p_entity,p_search,p_page,p_filter,p_sort);END IF;
 PERFORM trust_admin.require_staff();
 IF p_page<1 OR p_page>100000 THEN RAISE EXCEPTION 'Invalid page';END IF;
 RETURN trust_admin.people_list(p_search,p_page,p_filter,p_sort);
END $$;
ALTER FUNCTION public.admin_list(text,text,integer,text,text) SET timezone TO 'Asia/Kolkata';
REVOKE ALL ON FUNCTION public.admin_list(text,text,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list(text,text,integer,text,text) TO authenticated;

-- A person's profile: roles, totals and other entries that might be the same person.
CREATE OR REPLACE FUNCTION public.admin_person(p_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM trust_admin.require_staff();
 SELECT to_jsonb(c)||jsonb_build_object(
   'outstanding',(SELECT count(*) FROM legacy_trust.bookings WHERE customer_id=c.id AND status IN ('issue','partial_return')),
   'donations',(SELECT count(*) FROM legacy_trust.bookings b JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id WHERE b.customer_id=c.id AND k.kind='donation' AND b.status<>'cancelled'),
   'borrowings',(SELECT count(*) FROM legacy_trust.bookings b JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id WHERE b.customer_id=c.id AND k.kind='loan' AND b.status<>'cancelled'),
   'books_donated',(SELECT count(*) FROM legacy_trust.book_lists x WHERE x.customer_id=c.id),
   'possible_duplicates',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'customerId',o."customerId",'phone',o.phone,'email',o.email,
      'reason',array_to_string(array_remove(ARRAY[CASE WHEN trust_admin.phone_key(o.phone)=trust_admin.phone_key(c.phone) AND trust_admin.phone_key(c.phone)<>'' THEN 'same phone' END,CASE WHEN lower(o.email)=lower(c.email) AND c.email<>'' THEN 'same email' END,CASE WHEN trust_admin.name_key(o.name)=trust_admin.name_key(c.name) THEN 'same name' END],NULL),', '))),'[]'::jsonb)
     FROM legacy_trust.customers o WHERE o.id<>c.id AND ((trust_admin.phone_key(o.phone)=trust_admin.phone_key(c.phone) AND trust_admin.phone_key(c.phone)<>'') OR (lower(o.email)=lower(c.email) AND c.email<>'') OR trust_admin.name_key(o.name)=trust_admin.name_key(c.name))),
   'transactions',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT b.id,b."orderNo",b."issueDate",b."endDate",b.status,k.kind,(SELECT count(*) FROM legacy_trust.booking_items WHERE booking_id=b.id) AS copies
      FROM legacy_trust.bookings b LEFT JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id WHERE b.customer_id=c.id ORDER BY b.created_at DESC NULLS LAST,b.id DESC LIMIT 200)x))
 INTO result FROM legacy_trust.customers c WHERE c.id=p_id;
 IF result IS NULL THEN RAISE EXCEPTION 'Person not found';END IF;
 RETURN result;
END $$;

-- Add or edit a person. Returns {status:'created'|'updated'|'exists'|'similar', ...}. It never fails just because
-- someone with the same phone or email exists: it says who, so the screen can offer "use this person".
CREATE FUNCTION public.admin_person_save(p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id text:=nullif(p_data->>'id','');
 v_name text:=btrim(regexp_replace(coalesce(p_data->>'name',''),'[[:space:]]+',' ','g'));
 v_phone text:=btrim(regexp_replace(coalesce(p_data->>'phone',''),'[[:space:]]+',' ','g'));
 v_email text:=lower(btrim(coalesce(p_data->>'email','')));
 v_address text:=btrim(coalesce(p_data->>'address',''));
 v_blood text:=btrim(coalesce(p_data->>'bloodGroup',''));
 v_confirm boolean:=coalesce(nullif(p_data->>'confirm_similar','')::boolean,false);
 cur legacy_trust.customers;exact record;matches jsonb;new_id text;new_status text;changed boolean:=true;
BEGIN
 PERFORM trust_admin.require_staff(true);
 IF length(v_name)<2 OR length(v_name)>120 OR v_name ~ '^[0-9[:punct:][:space:]]+$' THEN RAISE EXCEPTION 'Enter the person''s full name';END IF;
 IF v_phone !~ '^[+0-9 ()-]{10,20}$' OR length(regexp_replace(v_phone,'[^0-9]','','g')) NOT BETWEEN 10 AND 15 THEN RAISE EXCEPTION 'Enter a valid phone number with 10 to 15 digits';END IF;
 IF length(v_email)>254 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN RAISE EXCEPTION 'Enter a valid email address';END IF;
 IF length(v_address)>400 THEN RAISE EXCEPTION 'The address is too long';END IF;
 IF v_blood NOT IN ('','A+','A-','B+','B-','AB+','AB-','O+','O-') THEN RAISE EXCEPTION 'Choose a valid blood group';END IF;
 IF v_id IS NOT NULL THEN
  SELECT * INTO cur FROM legacy_trust.customers WHERE id=v_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Person not found';END IF;
  changed:=trust_admin.name_key(cur.name)<>trust_admin.name_key(v_name) OR trust_admin.phone_key(cur.phone)<>trust_admin.phone_key(v_phone) OR lower(cur.email)<>v_email;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('person:'||trust_admin.name_key(v_name)||':'||trust_admin.phone_key(v_phone)));
 IF changed THEN
  SELECT o.id,o.name,o."customerId",o.phone,o.email,o.status INTO exact FROM legacy_trust.customers o
   WHERE o.id IS DISTINCT FROM v_id AND trust_admin.name_key(o.name)=trust_admin.name_key(v_name) AND trust_admin.phone_key(o.phone)=trust_admin.phone_key(v_phone) LIMIT 1;
  IF FOUND THEN
   RETURN jsonb_build_object('status','exists','person',jsonb_build_object('id',exact.id,'name',exact.name,'customerId',exact."customerId",'phone',exact.phone,'email',exact.email,'archived',exact.status='inactive'));
  END IF;
  IF NOT v_confirm THEN
   SELECT coalesce(jsonb_agg(m),'[]'::jsonb) INTO matches FROM (
    SELECT jsonb_build_object('id',o.id,'name',o.name,'customerId',o."customerId",'phone',o.phone,'email',o.email,'archived',o.status='inactive',
     'reason',array_to_string(array_remove(ARRAY[CASE WHEN trust_admin.phone_key(o.phone)=trust_admin.phone_key(v_phone) THEN 'same phone number' END,CASE WHEN lower(o.email)=v_email THEN 'same email' END,CASE WHEN trust_admin.name_key(o.name)=trust_admin.name_key(v_name) THEN 'same name' END],NULL),', ')) AS m
    FROM legacy_trust.customers o
    WHERE o.id IS DISTINCT FROM v_id AND (trust_admin.phone_key(o.phone)=trust_admin.phone_key(v_phone) OR lower(o.email)=v_email OR trust_admin.name_key(o.name)=trust_admin.name_key(v_name))
    ORDER BY o.created_at DESC NULLS LAST LIMIT 8) s;
   IF jsonb_array_length(matches)>0 THEN RETURN jsonb_build_object('status','similar','matches',matches);END IF;
  END IF;
 END IF;
 IF v_id IS NULL THEN
  new_id:=gen_random_uuid()::text;
  INSERT INTO legacy_trust.customers(id,"customerId",name,email,phone,address,"bloodGroup",type,status,created_at,updated_at)
   VALUES(new_id,'UTC-P-'||trust_admin.next_reference(),v_name,v_email,v_phone,nullif(v_address,''),nullif(v_blood,''),'customer','active',now(),now());
  PERFORM trust_admin.log_event('create','people',new_id,'People record created · '||v_name);
  RETURN jsonb_build_object('status','created','id',new_id,'customerId',(SELECT "customerId" FROM legacy_trust.customers WHERE id=new_id));
 END IF;
 new_status:=coalesce(nullif(p_data->>'status',''),cur.status);
 IF new_status NOT IN ('active','inactive') THEN RAISE EXCEPTION 'Invalid status';END IF;
 IF new_status='inactive' AND cur.status<>'inactive' AND EXISTS(SELECT 1 FROM legacy_trust.bookings WHERE customer_id=v_id AND status IN ('issue','partial_return')) THEN RAISE EXCEPTION 'Resolve outstanding loans before archiving this person';END IF;
 UPDATE legacy_trust.customers SET name=v_name,email=v_email,phone=v_phone,address=nullif(v_address,''),"bloodGroup"=nullif(v_blood,''),status=new_status,updated_at=now() WHERE id=v_id;
 PERFORM trust_admin.log_event('update','people',v_id,'People record updated · '||v_name);
 RETURN jsonb_build_object('status','updated','id',v_id,'customerId',cur."customerId");
END $$;

-- Groups of entries that may be the same person (same phone, same email or same name). Anyone on staff can look.
CREATE FUNCTION public.admin_duplicate_people() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM trust_admin.require_staff();
 RETURN (
  WITH k AS MATERIALIZED (SELECT c.id,c.name,c."customerId",c.phone,c.email,trust_admin.phone_key(c.phone) AS pk,lower(c.email) AS ek,trust_admin.name_key(c.name) AS nk FROM legacy_trust.customers c WHERE c.status='active'),
  g AS (
   SELECT 'same phone number' AS reason,pk AS key,array_agg(id) AS ids FROM k WHERE pk<>'' GROUP BY pk HAVING count(*)>1
   UNION ALL SELECT 'same email',ek,array_agg(id) FROM k WHERE ek<>'' GROUP BY ek HAVING count(*)>1
   UNION ALL SELECT 'same name',nk,array_agg(id) FROM k WHERE nk<>'' GROUP BY nk HAVING count(*)>1
  ),lim AS (SELECT * FROM g ORDER BY array_length(ids,1) DESC,reason,key LIMIT 100)
  SELECT coalesce(jsonb_agg(jsonb_build_object('reason',lim.reason,'people',(
   SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'customerId',c."customerId",'phone',c.phone,'email',c.email,
     'donations',(SELECT count(*) FROM legacy_trust.bookings b JOIN trust_admin.transaction_kinds t ON t.booking_id=b.id WHERE b.customer_id=c.id AND t.kind='donation' AND b.status<>'cancelled'),
     'borrowings',(SELECT count(*) FROM legacy_trust.bookings b JOIN trust_admin.transaction_kinds t ON t.booking_id=b.id WHERE b.customer_id=c.id AND t.kind='loan' AND b.status<>'cancelled'))
    ORDER BY c.created_at NULLS LAST,c.id) FROM legacy_trust.customers c WHERE c.id=ANY(lim.ids))) ),'[]'::jsonb)
  FROM lim);
END $$;

-- Merge one entry into another (administrators only). Everything the removed entry did moves to the kept one.
CREATE FUNCTION public.admin_merge_people(p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_keep text:=p_data->>'keep_id';v_remove text:=p_data->>'remove_id';k legacy_trust.customers;r legacy_trust.customers;moved_tx integer;moved_books integer;
BEGIN
 IF trust_admin.require_staff(true)<>'admin' THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';END IF;
 IF v_keep IS NULL OR v_remove IS NULL OR v_keep=v_remove THEN RAISE EXCEPTION 'Choose two different people to merge';END IF;
 PERFORM 1 FROM legacy_trust.customers WHERE id IN (v_keep,v_remove) ORDER BY id FOR UPDATE;
 SELECT * INTO k FROM legacy_trust.customers WHERE id=v_keep;
 IF NOT FOUND THEN RAISE EXCEPTION 'The person to keep was not found';END IF;
 SELECT * INTO r FROM legacy_trust.customers WHERE id=v_remove;
 IF NOT FOUND THEN RAISE EXCEPTION 'The person to merge was not found';END IF;
 UPDATE legacy_trust.bookings SET customer_id=v_keep,updated_at=now() WHERE customer_id=v_remove;
 GET DIAGNOSTICS moved_tx=ROW_COUNT;
 UPDATE legacy_trust.book_lists SET customer_id=v_keep,updated_at=now() WHERE customer_id=v_remove;
 GET DIAGNOSTICS moved_books=ROW_COUNT;
 UPDATE legacy_trust.customers SET address=coalesce(nullif(k.address,''),r.address),"bloodGroup"=coalesce(nullif(k."bloodGroup",''),r."bloodGroup"),updated_at=now() WHERE id=v_keep;
 DELETE FROM legacy_trust.customers WHERE id=v_remove;
 PERFORM trust_admin.log_event('update','people',v_keep,'Merged '||r.name||' ('||r."customerId"||', '||r.phone||', '||r.email||') into '||k.name||' ('||k."customerId"||') · '||moved_tx||' transactions and '||moved_books||' book copies moved');
 RETURN jsonb_build_object('id',v_keep,'moved_transactions',moved_tx,'moved_copies',moved_books);
END $$;

REVOKE ALL ON FUNCTION public.admin_person_save(jsonb),public.admin_duplicate_people(),public.admin_merge_people(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_person_save(jsonb),public.admin_duplicate_people(),public.admin_merge_people(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION trust_admin.people_list(text,integer,text,text),trust_admin.next_reference(),trust_admin.next_utbn() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
