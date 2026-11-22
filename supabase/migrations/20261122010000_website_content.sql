-- Staff-managed website content. Published records only are exposed publicly.
BEGIN;
CREATE TABLE trust_admin.site_content(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),kind text NOT NULL CHECK(kind IN ('programme','gallery','team','announcement')),slug text NOT NULL,name text NOT NULL CHECK(length(name) BETWEEN 1 AND 150),data jsonb NOT NULL DEFAULT '{}',status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),sort_order integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(kind,slug));
ALTER TABLE trust_admin.site_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON trust_admin.site_content FROM PUBLIC,anon,authenticated;
CREATE TRIGGER content_audit AFTER INSERT OR UPDATE OR DELETE ON trust_admin.site_content FOR EACH ROW EXECUTE FUNCTION trust_admin.capture_change();
CREATE TRIGGER content_refresh AFTER INSERT OR UPDATE OR DELETE ON trust_admin.site_content FOR EACH STATEMENT EXECUTE FUNCTION trust_admin.bump_change('content');
CREATE FUNCTION public.website_content() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'slug',slug,'name',name,'data',data,'sort_order',sort_order) ORDER BY sort_order,created_at,id),'[]') FROM trust_admin.site_content WHERE status='published' $$;
CREATE FUNCTION public.admin_content(p_kind text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF trust_admin.require_staff()<>'admin' THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';END IF;
 RETURN (SELECT coalesce(jsonb_agg(c ORDER BY sort_order,created_at,id),'[]') FROM trust_admin.site_content c WHERE p_kind='' OR kind=p_kind);END $$;
CREATE FUNCTION public.admin_content_save(p_data jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());v_kind text:=p_data->>'kind';slug text:=p_data->>'slug';data jsonb:=p_data->'data';img text;link text;BEGIN
 IF trust_admin.require_staff(true)<>'admin' THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';END IF;
 IF v_kind IS NULL OR v_kind NOT IN ('programme','gallery','team','announcement') OR slug IS NULL OR slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(slug)>120 OR length(trim(coalesce(p_data->>'name','')))=0 OR length(p_data->>'name')>150 OR jsonb_typeof(data) IS DISTINCT FROM 'object' OR octet_length(data::text)>25000 THEN RAISE EXCEPTION 'Check the content name, slug and fields';END IF;
 IF coalesce(p_data->>'status','') NOT IN ('draft','published','archived') THEN RAISE EXCEPTION 'Choose draft, published or archived';END IF;
 img:=coalesce(data->>'image','');link:=coalesce(data->>'link','');
 IF img<>'' AND img !~ '^/images/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp)$' AND img !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/trust-media/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp)$' THEN RAISE EXCEPTION 'Use an uploaded image or an existing /images/ path';END IF;
 IF link<>'' AND (link !~ '^/[a-zA-Z0-9/?=&%#._-]*$' OR link LIKE '//%') THEN RAISE EXCEPTION 'Use a relative website link';END IF;
 IF p_data->>'status'='published' AND v_kind IN ('programme','gallery','team') AND img='' THEN RAISE EXCEPTION 'A published record needs an image';END IF;
 IF v_kind='programme' AND p_data->>'status'='published' AND (length(trim(coalesce(data->>'description','')))=0 OR length(trim(coalesce(data->>'body','')))=0) THEN RAISE EXCEPTION 'Published programmes need a description and body';END IF;
 IF nullif(p_data->>'id','') IS NOT NULL THEN PERFORM 1 FROM trust_admin.site_content WHERE site_content.id=v_id AND site_content.kind=v_kind FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Content not found';END IF;IF NOT EXISTS(SELECT 1 FROM trust_admin.site_content c WHERE c.id=v_id AND c.updated_at=(p_data->>'expected_updated_at')::timestamptz) THEN RAISE EXCEPTION 'This content changed in another session. Close and reopen it before saving';END IF;END IF;
 INSERT INTO trust_admin.site_content AS c(id,kind,slug,name,data,status,sort_order) VALUES(v_id,v_kind,slug,trim(p_data->>'name'),data,p_data->>'status',coalesce((p_data->>'sort_order')::integer,0)) ON CONFLICT ON CONSTRAINT site_content_pkey DO UPDATE SET slug=excluded.slug,name=excluded.name,data=excluded.data,status=excluded.status,sort_order=excluded.sort_order,updated_at=now();
 RETURN v_id::text;END $$;
REVOKE ALL ON FUNCTION public.website_content() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.website_content() TO anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_content(text),public.admin_content_save(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_content(text),public.admin_content_save(jsonb) TO authenticated;
-- Storage exists on hosted Supabase; keep isolated PostgreSQL tests portable.
DO $$ BEGIN IF to_regclass('storage.buckets') IS NOT NULL THEN
 INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('trust-media','trust-media',true,5242880,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
 EXECUTE 'CREATE POLICY trust_media_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id=''trust-media'' AND EXISTS(SELECT 1 FROM public.staff WHERE user_id=auth.uid() AND active AND role=''admin''))';
 END IF;END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
