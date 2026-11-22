-- Cancel a donation or an issued-book entry that was made by mistake. The record stays in history
-- (shown as Cancelled, with who cancelled it and why) and reports exclude it. Administrators only.
--  * An issue can be cancelled only while nothing has been returned: its copies go back on the shelf.
--  * A donation can be cancelled only while all its copies are still on the shelf and were never issued:
--    its copies are archived. Book numbers (UTBN) already assigned are not reused.
BEGIN;
ALTER TABLE legacy_trust.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE legacy_trust.bookings ADD CONSTRAINT bookings_status_check CHECK(status IN ('active','issue','lost','inactive','return','new','partial_return','closed_correction','cancelled'));

CREATE TABLE trust_admin.cancellations(booking_id char(36) PRIMARY KEY REFERENCES legacy_trust.bookings(id),actor uuid NOT NULL,reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 500),previous_status text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE trust_admin.cancellations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON trust_admin.cancellations FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.admin_cancel(p_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id text:=p_data->>'transaction_id';v_reason text:=trim(coalesce(p_data->>'reason',''));b legacy_trust.bookings%ROWTYPE;v_kind text;
BEGIN
 IF trust_admin.require_staff(true)<>'admin' THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';END IF;
 IF length(v_reason) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'Enter a reason of 10 to 500 characters';END IF;
 SELECT * INTO b FROM legacy_trust.bookings WHERE id=v_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found';END IF;
 SELECT kind INTO v_kind FROM trust_admin.transaction_kinds WHERE booking_id=v_id;
 IF v_kind IS NULL THEN RAISE EXCEPTION 'Transaction not found';END IF;
 IF b.status='cancelled' THEN RAISE EXCEPTION 'This entry is already cancelled';END IF;
 IF v_kind='loan' THEN
  IF b.status<>'issue' OR EXISTS(SELECT 1 FROM trust_admin.loan_returns WHERE booking_id=v_id) THEN RAISE EXCEPTION 'Only an issue with nothing returned yet can be cancelled. Record the return instead';END IF;
  UPDATE legacy_trust.book_lists x SET status='active',updated_at=now() FROM legacy_trust.booking_items i WHERE i.booking_id=v_id AND i.book_id=x.id AND x.status='issue' AND NOT EXISTS(SELECT 1 FROM legacy_trust.booking_items i2 JOIN legacy_trust.bookings b2 ON b2.id=i2.booking_id WHERE i2.book_id=x.id AND b2.id<>v_id AND b2.status IN ('issue','partial_return'));
 ELSE
  IF EXISTS(SELECT 1 FROM legacy_trust.booking_items i JOIN legacy_trust.book_lists x ON x.id=i.book_id WHERE i.booking_id=v_id AND x.status<>'active') THEN RAISE EXCEPTION 'Some copies from this donation are no longer on the shelf (issued, lost or archived). Resolve them first';END IF;
  IF EXISTS(SELECT 1 FROM legacy_trust.booking_items other WHERE other.booking_id<>v_id AND other.book_id IN (SELECT book_id FROM legacy_trust.booking_items WHERE booking_id=v_id)) OR EXISTS(SELECT 1 FROM trust_admin.loan_returns r WHERE r.book_id IN (SELECT book_id FROM legacy_trust.booking_items WHERE booking_id=v_id)) THEN RAISE EXCEPTION 'Copies from this donation were issued before. Archive them instead';END IF;
  UPDATE legacy_trust.book_lists SET status='inactive',updated_at=now() WHERE id IN (SELECT book_id FROM legacy_trust.booking_items WHERE booking_id=v_id);
 END IF;
 UPDATE legacy_trust.bookings SET status='cancelled',updated_at=now() WHERE id=v_id;
 INSERT INTO trust_admin.cancellations(booking_id,actor,reason,previous_status) VALUES(v_id,auth.uid(),v_reason,b.status);
 PERFORM trust_admin.log_event('cancel','transactions',v_id,'Cancelled '||b."orderNo"||': '||v_reason);
END $$;
REVOKE ALL ON FUNCTION public.admin_cancel(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel(jsonb) TO authenticated;

-- Cancelled entries no longer count in the date-range reports.
CREATE OR REPLACE FUNCTION public.admin_report(p_kind text,p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE src text;q text;records jsonb;n integer;undated integer:=0;BEGIN PERFORM trust_admin.require_staff();
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366 THEN RAISE EXCEPTION 'Choose a date range of up to 366 days';END IF;
 IF p_kind IN ('loans','donations','overdue') THEN
 src:='SELECT b."orderNo" AS reference,c.name,b."issueDate" AS date,b."endDate" AS due,b.status,(SELECT count(*) FROM legacy_trust.booking_items i WHERE i.booking_id=b.id) AS copies FROM legacy_trust.bookings b LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id WHERE b."issueDate" BETWEEN $1 AND $2 AND '||CASE WHEN p_kind='donations' THEN 'k.kind=''donation''' ELSE 'k.kind=''loan''' END||' AND b.status<>''cancelled''';
 IF p_kind='overdue' THEN src:=src||' AND b.status IN (''issue'',''partial_return'') AND b."endDate"<current_date';END IF;
 ELSIF p_kind='returns' THEN src:='SELECT b."orderNo" AS reference,c.name,r.returned_at AS date,x.utbn,x."bookName" AS title,r.disposition AS status FROM trust_admin.loan_returns r JOIN legacy_trust.bookings b ON b.id=r.booking_id JOIN legacy_trust.book_lists x ON x.id=r.book_id LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id WHERE r.returned_at BETWEEN $1 AND $2 AND r.disposition<>''corrected'' UNION ALL SELECT DISTINCT b."orderNo" AS reference,c.name,b."returnDate" AS date,x.utbn,x."bookName" AS title,''historical_return''::text AS status FROM legacy_trust.bookings b JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id AND k.kind=''loan'' JOIN legacy_trust.booking_items i ON i.booking_id=b.id JOIN legacy_trust.book_lists x ON x.id=i.book_id LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id WHERE b.status=''return'' AND b."returnDate" BETWEEN $1 AND $2 AND NOT EXISTS(SELECT 1 FROM trust_admin.loan_returns r WHERE r.booking_id=b.id)';
 SELECT count(*) INTO undated FROM legacy_trust.bookings b JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id AND k.kind='loan' WHERE b.status='return' AND b."returnDate" IS NULL AND NOT EXISTS(SELECT 1 FROM trust_admin.loan_returns r WHERE r.booking_id=b.id);
 ELSE RAISE EXCEPTION 'Unknown report';END IF;
 EXECUTE 'SELECT count(*) FROM ('||src||')d' INTO n USING p_from,p_to;
 EXECUTE 'SELECT coalesce(jsonb_agg(x),''[]''::jsonb) FROM (SELECT * FROM ('||src||')d ORDER BY date DESC,reference LIMIT 5000)x' INTO records USING p_from,p_to;
 RETURN jsonb_build_object('rows',records,'total',n,'limited',n>5000,'undated_historical_returns',undated);END $$;
ALTER FUNCTION public.admin_report(text,date,date) SET timezone TO 'Asia/Kolkata';

-- Hosted Supabase only: let administrators remove files that belong to deleted website content.
DO $$ BEGIN IF to_regclass('storage.objects') IS NOT NULL THEN
 DROP POLICY IF EXISTS trust_media_select ON storage.objects;
 DROP POLICY IF EXISTS trust_media_delete ON storage.objects;
 EXECUTE 'CREATE POLICY trust_media_select ON storage.objects FOR SELECT TO authenticated USING(bucket_id=''trust-media'' AND EXISTS(SELECT 1 FROM public.staff WHERE user_id=auth.uid() AND active AND role=''admin''))';
 EXECUTE 'CREATE POLICY trust_media_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id=''trust-media'' AND EXISTS(SELECT 1 FROM public.staff WHERE user_id=auth.uid() AND active AND role=''admin''))';
END IF;END $$;

NOTIFY pgrst,'reload schema';
COMMIT;
