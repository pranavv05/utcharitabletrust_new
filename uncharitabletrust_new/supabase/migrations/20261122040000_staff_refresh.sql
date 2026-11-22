-- Staff access changes refresh authorised workspaces using the same private counter.
BEGIN;
CREATE TRIGGER staff_refresh AFTER INSERT OR UPDATE OR DELETE ON public.staff FOR EACH STATEMENT EXECUTE FUNCTION trust_admin.bump_change('admin');
NOTIFY pgrst,'reload schema';
COMMIT;
