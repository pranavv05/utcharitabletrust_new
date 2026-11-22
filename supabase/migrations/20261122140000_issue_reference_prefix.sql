-- New issued-book references start with UTC-I- instead of UTC-L-. References already created keep their
-- number and prefix. The existing function is rewritten in place, so its rules, settings and permissions
-- are unchanged; only the prefix text differs. Anything that is not a donation (UTC-D-) is still an issue.
BEGIN;
DO $$
DECLARE def text;
BEGIN
 SELECT pg_get_functiondef('public.admin_issue(jsonb)'::regprocedure) INTO def;
 IF position('''UTC-L-''' IN def)=0 THEN RAISE EXCEPTION 'Unexpected admin_issue definition; the prefix was not found';END IF;
 EXECUTE replace(def,'''UTC-L-''','''UTC-I-''');
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
