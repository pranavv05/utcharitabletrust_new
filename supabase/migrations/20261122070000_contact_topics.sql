-- Contact enquiries use five public topics and may omit a phone number.
-- Membership requirements, access grants, rate limits and existing records are preserved.
BEGIN;
CREATE OR REPLACE FUNCTION public.submit_request(payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mail text:=lower(trim(payload->>'email'));
BEGIN
 IF payload->>'kind' IS NULL OR payload->>'kind' NOT IN ('contact','membership') OR length(coalesce(payload->>'name','')) NOT BETWEEN 2 AND 120 OR length(coalesce(mail,'')) NOT BETWEEN 3 AND 254 OR mail !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' OR (coalesce(payload->>'phone','') !~ '^[+0-9 ()-]{10,18}$' AND NOT (payload->>'kind'='contact' AND coalesce(payload->>'phone','')='')) OR length(coalesce(payload->>'message','')) NOT BETWEEN 10 AND 3000 THEN RAISE EXCEPTION 'Invalid submission' USING ERRCODE='22023'; END IF;
 IF length(coalesce(payload->>'city',''))>120 OR length(coalesce(payload->>'address',''))>400 OR length(coalesce(payload->>'subject',''))>120 OR (payload->>'kind'='membership' AND length(trim(coalesce(payload->>'city','')))=0) THEN RAISE EXCEPTION 'Check submission details' USING ERRCODE='22023'; END IF;
 IF payload->>'kind'='contact' AND coalesce(payload->>'subject','') NOT IN ('Donate essentials','Volunteer','Request support','Partner with us','Media & other') THEN RAISE EXCEPTION 'Choose how you would like to help' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(48290311);
 IF (SELECT count(*) FROM trust_admin.submissions WHERE created_at>now()-interval '1 day')>=500 THEN RAISE EXCEPTION 'Daily submission limit reached. Contact the trust directly'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(mail));
 IF EXISTS(SELECT 1 FROM trust_admin.submissions WHERE lower(email)=mail AND created_at>now()-interval '5 minutes') THEN RAISE EXCEPTION 'Please wait before sending again'; END IF;
 INSERT INTO trust_admin.submissions(kind,name,email,phone,message,subject,blood_group,city,address) VALUES(payload->>'kind',trim(payload->>'name'),mail,coalesce(payload->>'phone',''),payload->>'message',payload->>'subject',left(payload->>'blood_group',4),payload->>'city',payload->>'address');
END $$;
COMMIT;
