-- Lets an administrator change the UTBN (the copy number printed on a book's label) from Book inventory.
-- Safeguards: administrators only; the new number must be a whole number from 1 to 99999999 that no other
-- copy uses; a copy that is out on loan cannot be renumbered; the change is written to the activity log; and the
-- counter that hands out numbers to newly donated copies is moved past the new number so it can never repeat it.
BEGIN;

CREATE FUNCTION public.admin_utbn(p_data jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id text:=p_data->>'id';v_raw text:=btrim(coalesce(p_data->>'utbn',''));v_new integer;b record;next_number bigint;
BEGIN
 IF trust_admin.require_staff(true)<>'admin' THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';END IF;
 IF v_raw !~ '^[0-9]{1,8}$' THEN RAISE EXCEPTION 'Enter a whole number from 1 to 99999999';END IF;
 v_new:=v_raw::integer;
 IF v_new<1 THEN RAISE EXCEPTION 'Enter a whole number from 1 to 99999999';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('utbn'));
 SELECT id,"bookName",utbn,status INTO b FROM legacy_trust.book_lists WHERE id=v_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Book not found';END IF;
 IF b.utbn=v_new THEN RAISE EXCEPTION 'This copy already has that number';END IF;
 IF b.status='issue' THEN RAISE EXCEPTION 'Return the issued copy before changing its number';END IF;
 IF EXISTS(SELECT 1 FROM legacy_trust.book_lists o WHERE o.utbn=v_new AND o.id<>v_id) THEN RAISE EXCEPTION 'UTBN % is already used by another copy',v_new;END IF;
 UPDATE legacy_trust.book_lists SET utbn=v_new,updated_at=now() WHERE id=v_id;
 SELECT last_value+CASE WHEN is_called THEN 1 ELSE 0 END INTO next_number FROM trust_admin.utbn_seq;
 IF v_new>=next_number THEN PERFORM setval('trust_admin.utbn_seq',v_new+1,false);END IF;
 PERFORM trust_admin.log_event('update','books',v_id,'UTBN changed from '||b.utbn||' to '||v_new||' · '||b."bookName");
 RETURN v_new;
END $$;

-- Two copies can never share a UTBN from now on, whichever way a number is set (this screen, a donation, an
-- import or a manual change). A unique index would refuse to build if old records already repeat a number, so
-- this is a check on every new or changed number instead; existing repeats are left for an administrator to
-- renumber (the book's edit dialog shows a warning for them).
CREATE FUNCTION trust_admin.enforce_unique_utbn() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('utbn:'||NEW.utbn));
 IF EXISTS(SELECT 1 FROM legacy_trust.book_lists o WHERE o.utbn=NEW.utbn AND o.id<>NEW.id) THEN
  RAISE EXCEPTION 'UTBN % is already used by another copy',NEW.utbn USING ERRCODE='23505';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER book_lists_unique_utbn BEFORE INSERT OR UPDATE OF utbn ON legacy_trust.book_lists
 FOR EACH ROW EXECUTE FUNCTION trust_admin.enforce_unique_utbn();

REVOKE ALL ON FUNCTION public.admin_utbn(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_utbn(jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
