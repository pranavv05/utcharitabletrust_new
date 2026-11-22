-- Exact numeric UTBN lookup, including early copies otherwise hidden by substring pagination.
BEGIN;
ALTER FUNCTION public.admin_list(text,text,integer,text,text) RENAME TO admin_list_workflows;
REVOKE ALL ON FUNCTION public.admin_list_workflows(text,text,integer,text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.admin_list(p_entity text,p_search text DEFAULT '',p_page integer DEFAULT 1,p_filter text DEFAULT '',p_sort text DEFAULT 'newest') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE copy_number integer;
BEGIN
 PERFORM trust_admin.require_staff();
 IF p_page<1 OR p_page>100000 THEN RAISE EXCEPTION 'Invalid page';END IF;
 IF p_entity IN ('books','loans','donations','returns') AND trim(p_search) ~ '^[0-9]{1,10}$' THEN
 IF trim(p_search)::numeric>2147483647 THEN RETURN public.admin_list_workflows(p_entity,p_search,p_page,p_filter,p_sort);END IF;
 copy_number:=trim(p_search)::integer;
 IF p_entity='books' THEN
 RETURN (WITH matching AS MATERIALIZED(SELECT b.*,c.name AS donor_name FROM legacy_trust.book_lists b LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id WHERE b.utbn=copy_number AND (p_filter='' OR b.status=p_filter)),paged AS(SELECT * FROM matching ORDER BY id DESC LIMIT 25 OFFSET (p_page-1)*25) SELECT jsonb_build_object('rows',(SELECT coalesce(jsonb_agg(p),'[]') FROM paged p),'total',(SELECT count(*) FROM matching),'page',p_page));
 ELSIF EXISTS(SELECT 1 FROM legacy_trust.book_lists WHERE utbn=copy_number) THEN
 RETURN (WITH matching AS MATERIALIZED(SELECT b.*,c.name,c.phone,k.kind FROM legacy_trust.bookings b LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id WHERE k.kind=CASE WHEN p_entity='donations' THEN 'donation' ELSE 'loan' END AND (p_entity<>'returns' OR b.status IN ('issue','partial_return')) AND (p_filter='' OR b.status=p_filter OR (p_filter='overdue' AND b.status IN ('issue','partial_return') AND b."endDate"<current_date)) AND EXISTS(SELECT 1 FROM legacy_trust.booking_items i JOIN legacy_trust.book_lists x ON x.id=i.book_id WHERE i.booking_id=b.id AND x.utbn=copy_number)),paged AS(SELECT * FROM matching ORDER BY CASE WHEN p_sort='name' THEN lower(name) END ASC NULLS LAST,CASE WHEN p_sort='due' THEN "endDate" END ASC NULLS LAST,CASE WHEN p_sort='oldest' THEN created_at END ASC NULLS LAST,CASE WHEN p_sort NOT IN ('name','due','oldest') THEN created_at END DESC NULLS LAST,id DESC LIMIT 25 OFFSET (p_page-1)*25) SELECT jsonb_build_object('rows',(SELECT coalesce(jsonb_agg(p),'[]') FROM paged p),'total',(SELECT count(*) FROM matching),'page',p_page));
 END IF;
 END IF;
 RETURN public.admin_list_workflows(p_entity,p_search,p_page,p_filter,p_sort);
END $$;
REVOKE ALL ON FUNCTION public.admin_list(text,text,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list(text,text,integer,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
