-- Include dated historical returns without creating or changing ledger/source records.
-- Exclude bookings already represented by the new ledger to avoid duplicate returns.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_report(p_kind text,p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE src text;q text;records jsonb;n integer;undated integer:=0;BEGIN PERFORM trust_admin.require_staff();
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366 THEN RAISE EXCEPTION 'Choose a date range of up to 366 days';END IF;
 IF p_kind IN ('loans','donations','overdue') THEN
 src:='SELECT b."orderNo" AS reference,c.name,b."issueDate" AS date,b."endDate" AS due,b.status,(SELECT count(*) FROM legacy_trust.booking_items i WHERE i.booking_id=b.id) AS copies FROM legacy_trust.bookings b LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id WHERE b."issueDate" BETWEEN $1 AND $2 AND '||CASE WHEN p_kind='donations' THEN 'k.kind=''donation''' ELSE 'k.kind=''loan''' END;
 IF p_kind='overdue' THEN src:=src||' AND b.status IN (''issue'',''partial_return'') AND b."endDate"<current_date';END IF;
 ELSIF p_kind='returns' THEN src:='SELECT b."orderNo" AS reference,c.name,r.returned_at AS date,x.utbn,x."bookName" AS title,r.disposition AS status FROM trust_admin.loan_returns r JOIN legacy_trust.bookings b ON b.id=r.booking_id JOIN legacy_trust.book_lists x ON x.id=r.book_id LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id WHERE r.returned_at BETWEEN $1 AND $2 AND r.disposition<>''corrected'' UNION ALL SELECT DISTINCT b."orderNo" AS reference,c.name,b."returnDate" AS date,x.utbn,x."bookName" AS title,''historical_return''::text AS status FROM legacy_trust.bookings b JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id AND k.kind=''loan'' JOIN legacy_trust.booking_items i ON i.booking_id=b.id JOIN legacy_trust.book_lists x ON x.id=i.book_id LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id WHERE b.status=''return'' AND b."returnDate" BETWEEN $1 AND $2 AND NOT EXISTS(SELECT 1 FROM trust_admin.loan_returns r WHERE r.booking_id=b.id)';
 SELECT count(*) INTO undated FROM legacy_trust.bookings b JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id AND k.kind='loan' WHERE b.status='return' AND b."returnDate" IS NULL AND NOT EXISTS(SELECT 1 FROM trust_admin.loan_returns r WHERE r.booking_id=b.id);
 ELSE RAISE EXCEPTION 'Unknown report';END IF;
 EXECUTE 'SELECT count(*) FROM ('||src||')d' INTO n USING p_from,p_to;
 EXECUTE 'SELECT coalesce(jsonb_agg(x),''[]''::jsonb) FROM (SELECT * FROM ('||src||')d ORDER BY date DESC,reference LIMIT 5000)x' INTO records USING p_from,p_to;
 RETURN jsonb_build_object('rows',records,'total',n,'limited',n>5000,'undated_historical_returns',undated);END $$;
ALTER FUNCTION public.admin_report(text,date,date) SET timezone TO 'Asia/Kolkata';
NOTIFY pgrst,'reload schema';
COMMIT;
