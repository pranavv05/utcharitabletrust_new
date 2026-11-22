-- Per-client limit for public submissions. The web app passes a one-way hash of the visitor's
-- address as payload.ip_hash. The global daily cap and per-email cooldown are unchanged.
-- A caller that bypasses the web app can omit ip_hash, so these limits reduce abuse rather than eliminate it.
BEGIN;
ALTER TABLE trust_admin.submissions ADD COLUMN IF NOT EXISTS ip_hash text;
CREATE INDEX IF NOT EXISTS submissions_ip_hash_created_idx ON trust_admin.submissions(ip_hash,created_at) WHERE ip_hash IS NOT NULL;
CREATE OR REPLACE FUNCTION public.submit_request(payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mail text:=lower(trim(payload->>'email'));ip text:=nullif(payload->>'ip_hash','');
BEGIN
 IF payload->>'kind' IS NULL OR payload->>'kind' NOT IN ('contact','membership') OR length(coalesce(payload->>'name','')) NOT BETWEEN 2 AND 120 OR length(coalesce(mail,'')) NOT BETWEEN 3 AND 254 OR mail !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' OR (coalesce(payload->>'phone','') !~ '^[+0-9 ()-]{10,18}$' AND NOT (payload->>'kind'='contact' AND coalesce(payload->>'phone','')='')) OR length(coalesce(payload->>'message','')) NOT BETWEEN 10 AND 3000 THEN RAISE EXCEPTION 'Invalid submission' USING ERRCODE='22023'; END IF;
 IF length(coalesce(payload->>'city',''))>120 OR length(coalesce(payload->>'address',''))>400 OR length(coalesce(payload->>'subject',''))>120 OR (payload->>'kind'='membership' AND length(trim(coalesce(payload->>'city','')))=0) OR length(coalesce(payload->>'ip_hash',''))>128 THEN RAISE EXCEPTION 'Check submission details' USING ERRCODE='22023'; END IF;
 IF payload->>'kind'='contact' AND coalesce(payload->>'subject','') NOT IN ('Donate essentials','Volunteer','Request support','Partner with us','Media & other') THEN RAISE EXCEPTION 'Choose how you would like to help' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(48290311);
 IF (SELECT count(*) FROM trust_admin.submissions WHERE created_at>now()-interval '1 day')>=500 THEN RAISE EXCEPTION 'Daily submission limit reached. Contact the trust directly'; END IF;
 IF ip IS NOT NULL AND (SELECT count(*) FROM trust_admin.submissions WHERE ip_hash=ip AND created_at>now()-interval '1 hour')>=5 THEN RAISE EXCEPTION 'Too many requests from this connection. Please try again later' USING ERRCODE='P0001'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(mail));
 IF EXISTS(SELECT 1 FROM trust_admin.submissions WHERE lower(email)=mail AND created_at>now()-interval '5 minutes') THEN RAISE EXCEPTION 'Please wait before sending again'; END IF;
 INSERT INTO trust_admin.submissions(kind,name,email,phone,message,subject,blood_group,city,address,ip_hash) VALUES(payload->>'kind',trim(payload->>'name'),mail,coalesce(payload->>'phone',''),payload->>'message',payload->>'subject',left(payload->>'blood_group',4),payload->>'city',payload->>'address',ip);
END $$;
REVOKE ALL ON FUNCTION public.submit_request(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_request(jsonb) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
