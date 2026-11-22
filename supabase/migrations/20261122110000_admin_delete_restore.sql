-- Restore archived records, and permanently delete records that were never used.
-- Records with history (issues, donations, returns, approvals) can only be archived, so past
-- reports and receipts keep their names. Deleting is limited to administrators; the audit log
-- keeps a before-snapshot of every deleted row.
BEGIN;

CREATE FUNCTION public.admin_restore(p_entity text,p_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tbl text;found_id text;label text;
BEGIN
 PERFORM trust_admin.require_staff(true);
 CASE p_entity
  WHEN 'people' THEN tbl:='customers';
  WHEN 'members' THEN tbl:='members';
  WHEN 'books' THEN tbl:='book_lists';
  WHEN 'authors' THEN tbl:='authors';
  WHEN 'classes' THEN tbl:='class_names';
  ELSE RAISE EXCEPTION 'Unsupported operation';
 END CASE;
 EXECUTE format('SELECT id FROM legacy_trust.%I WHERE id=$1 FOR UPDATE',tbl) INTO found_id USING p_id;
 IF found_id IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
 EXECUTE format('UPDATE legacy_trust.%I SET status=''active'',updated_at=now() WHERE id=$1 AND status=''inactive''',tbl) USING p_id;
 PERFORM trust_admin.log_event('restore',p_entity,p_id,'Record restored');
END $$;

CREATE FUNCTION public.admin_delete(p_entity text,p_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE found_id text;label text;used integer;
BEGIN
 IF trust_admin.require_staff(true)<>'admin' THEN RAISE EXCEPTION 'Only an administrator can permanently delete records' USING ERRCODE='42501'; END IF;
 IF p_entity='submissions' THEN
  SELECT id::text INTO found_id FROM trust_admin.submissions WHERE id::text=p_id FOR UPDATE;
  IF found_id IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
  IF EXISTS(SELECT 1 FROM trust_admin.approvals WHERE submission_id::text=p_id) THEN RAISE EXCEPTION 'This application was approved as a member. Archive it instead'; END IF;
  DELETE FROM trust_admin.submissions WHERE id::text=p_id;
  PERFORM trust_admin.log_event('delete','submissions',p_id,'Inbox message deleted');
  RETURN;
 END IF;
 IF p_entity='books' THEN
  SELECT id,"bookName" INTO found_id,label FROM legacy_trust.book_lists WHERE id=p_id FOR UPDATE;
  IF found_id IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
  IF EXISTS(SELECT 1 FROM legacy_trust.booking_items WHERE book_id=p_id) OR EXISTS(SELECT 1 FROM trust_admin.loan_returns WHERE book_id=p_id) OR EXISTS(SELECT 1 FROM trust_admin.corrections WHERE book_id=p_id) THEN
   RAISE EXCEPTION 'This copy has issue or donation history. Archive it instead';
  END IF;
  DELETE FROM legacy_trust.book_lists WHERE id=p_id;
 ELSIF p_entity='people' THEN
  SELECT id,name INTO found_id,label FROM legacy_trust.customers WHERE id=p_id FOR UPDATE;
  IF found_id IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
  IF EXISTS(SELECT 1 FROM legacy_trust.bookings WHERE customer_id=p_id) OR EXISTS(SELECT 1 FROM legacy_trust.book_lists WHERE customer_id=p_id) THEN
   RAISE EXCEPTION 'This person has donation or issue history. Archive them instead';
  END IF;
  DELETE FROM legacy_trust.customers WHERE id=p_id;
 ELSIF p_entity='members' THEN
  SELECT id,name INTO found_id,label FROM legacy_trust.members WHERE id=p_id FOR UPDATE;
  IF found_id IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
  IF EXISTS(SELECT 1 FROM trust_admin.approvals WHERE member_id=p_id) THEN
   RAISE EXCEPTION 'This member was approved from an application. Archive them instead';
  END IF;
  DELETE FROM legacy_trust.members WHERE id=p_id;
 ELSIF p_entity='authors' THEN
  SELECT id,title INTO found_id,label FROM legacy_trust.authors WHERE id=p_id FOR UPDATE;
  IF found_id IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
  SELECT count(*) INTO used FROM legacy_trust.book_lists WHERE lower(trim(author))=lower(trim(label));
  IF used>0 THEN RAISE EXCEPTION '% book copies use this author. Archive it instead',used; END IF;
  DELETE FROM legacy_trust.authors WHERE id=p_id;
 ELSIF p_entity='classes' THEN
  SELECT id,title INTO found_id,label FROM legacy_trust.class_names WHERE id=p_id FOR UPDATE;
  IF found_id IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
  SELECT count(*) INTO used FROM legacy_trust.book_lists WHERE lower(trim("class"))=lower(trim(label));
  IF used>0 THEN RAISE EXCEPTION '% book copies use this class. Archive it instead',used; END IF;
  DELETE FROM legacy_trust.class_names WHERE id=p_id;
 ELSE
  RAISE EXCEPTION 'Unsupported operation';
 END IF;
 PERFORM trust_admin.log_event('delete',p_entity,p_id,'Deleted '||coalesce(label,'record'));
END $$;

REVOKE ALL ON FUNCTION public.admin_restore(text,text),public.admin_delete(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore(text,text),public.admin_delete(text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
