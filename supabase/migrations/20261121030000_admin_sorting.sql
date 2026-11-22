-- Server-side sorting and an exact overdue filter; imported records are unchanged.
BEGIN;
DROP FUNCTION public.admin_list(text,text,integer,text);
CREATE FUNCTION public.admin_list(p_entity text,p_search text DEFAULT '',p_page integer DEFAULT 1,p_filter text DEFAULT '',p_sort text DEFAULT 'newest') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE src text; q text; n bigint; records jsonb; term text; ordering text;
BEGIN
 PERFORM trust_admin.require_staff();
 IF p_page<1 OR p_page>100000 THEN RAISE EXCEPTION 'Invalid page'; END IF;
 term:='%'||replace(replace(left(trim(p_search),150),'%','\%'),'_','\_')||'%';
 CASE p_entity
 WHEN 'books' THEN src:='SELECT b.*,c.name AS donor_name FROM legacy_trust.book_lists b LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id';
 WHEN 'people' THEN src:='SELECT * FROM legacy_trust.customers';
 WHEN 'members' THEN src:='SELECT * FROM legacy_trust.members';
 WHEN 'authors' THEN src:='SELECT * FROM legacy_trust.authors';
 WHEN 'classes' THEN src:='SELECT * FROM legacy_trust.class_names';
 WHEN 'loans' THEN src:='SELECT b.*,c.name,c.phone FROM legacy_trust.bookings b LEFT JOIN legacy_trust.customers c ON c.id=b.customer_id';
 WHEN 'contacts' THEN src:='SELECT * FROM legacy_trust.contacts';
 WHEN 'feedback' THEN src:='SELECT * FROM legacy_trust.feedback';
 WHEN 'submissions' THEN src:='SELECT * FROM trust_admin.submissions';
 WHEN 'audit' THEN src:='SELECT a.*,s.name FROM trust_admin.audit a LEFT JOIN public.staff s ON s.user_id=a.actor';
 ELSE RAISE EXCEPTION 'Unknown section'; END CASE;
 -- Search only meaningful editorial/reference fields, not every field of a private row.
 q:=' FROM ('||src||') d WHERE concat_ws('' '',to_jsonb(d)->>''name'',to_jsonb(d)->>''title'',to_jsonb(d)->>''bookName'',to_jsonb(d)->>''author'',to_jsonb(d)->>''class'',to_jsonb(d)->>''utbn'',to_jsonb(d)->>''orderNo'',to_jsonb(d)->>''email'',to_jsonb(d)->>''phone'',to_jsonb(d)->>''summary'') ILIKE $1 AND ($2='''' OR to_jsonb(d)->>''status''=$2 OR to_jsonb(d)->>''type''=$2 OR to_jsonb(d)->>''kind''=$2 OR ($2=''overdue'' AND to_jsonb(d)->>''status'' IN (''issue'',''partial_return'') AND to_jsonb(d)->>''endDate''<current_date::text))';
 ordering:=CASE p_sort
 WHEN 'oldest' THEN 'to_jsonb(d)->>''created_at'' ASC NULLS LAST'
 WHEN 'name' THEN 'lower(coalesce(to_jsonb(d)->>''bookName'',to_jsonb(d)->>''title'',to_jsonb(d)->>''name'','''')) ASC'
 WHEN 'utbn' THEN '(to_jsonb(d)->>''utbn'')::integer ASC NULLS LAST'
 WHEN 'due' THEN 'to_jsonb(d)->>''endDate'' ASC NULLS LAST'
 ELSE 'to_jsonb(d)->>''created_at'' DESC NULLS LAST' END;
 EXECUTE 'SELECT count(*)'||q INTO n USING term,p_filter;
 EXECUTE 'SELECT coalesce(jsonb_agg(x),''[]''::jsonb) FROM (SELECT d.*'||q||' ORDER BY '||ordering||', d.id DESC LIMIT 25 OFFSET $3)x' INTO records USING term,p_filter,(p_page-1)*25;
 RETURN jsonb_build_object('rows',records,'total',n,'page',p_page);
END $$;
REVOKE ALL ON FUNCTION public.admin_list(text,text,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list(text,text,integer,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
