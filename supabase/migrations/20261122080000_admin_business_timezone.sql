-- Calendar rules follow the trust's operating timezone, even while connections use UTC.
-- Function configuration only: no source records, timestamps, grants or roles change.
BEGIN;
ALTER FUNCTION public.admin_donate(jsonb) SET timezone TO 'Asia/Kolkata';
ALTER FUNCTION public.admin_issue(jsonb) SET timezone TO 'Asia/Kolkata';
ALTER FUNCTION public.admin_return(jsonb) SET timezone TO 'Asia/Kolkata';
ALTER FUNCTION public.admin_renew(jsonb) SET timezone TO 'Asia/Kolkata';
ALTER FUNCTION public.admin_correct(jsonb) SET timezone TO 'Asia/Kolkata';
ALTER FUNCTION public.admin_overview() SET timezone TO 'Asia/Kolkata';
ALTER FUNCTION public.admin_list(text,text,integer,text,text) SET timezone TO 'Asia/Kolkata';
ALTER FUNCTION public.admin_report(text,date,date) SET timezone TO 'Asia/Kolkata';
NOTIFY pgrst,'reload schema';
COMMIT;
