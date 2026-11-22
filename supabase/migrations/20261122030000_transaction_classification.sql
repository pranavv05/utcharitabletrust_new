-- The legacy donation controller created status=new. A person may also borrow,
-- so their current donor/borrower type must not classify a historical loan.
BEGIN;
UPDATE trust_admin.transaction_kinds k SET kind=CASE WHEN b.status='new' OR b."orderNo" LIKE 'UTC-D-%' THEN 'donation' ELSE 'loan' END FROM legacy_trust.bookings b WHERE b.id=k.booking_id AND k.kind IS DISTINCT FROM CASE WHEN b.status='new' OR b."orderNo" LIKE 'UTC-D-%' THEN 'donation' ELSE 'loan' END;
UPDATE public.trust_changes SET version=version+1,updated_at=now() WHERE scope='admin';
NOTIFY pgrst,'reload schema';
COMMIT;
