-- New website sections managed from the admin: news and media, testimonials, partners, legal documents,
-- intern colleges and the trust's certification badge. Also: permanent delete for website content,
-- a bulk "set year" action for gallery photos, and a storage bucket that accepts PDFs and videos.
-- Existing programme, gallery, team and announcement records are untouched.
BEGIN;

ALTER TABLE trust_admin.site_content DROP CONSTRAINT IF EXISTS site_content_kind_check;
ALTER TABLE trust_admin.site_content ADD CONSTRAINT site_content_kind_check
  CHECK(kind IN ('programme','gallery','team','announcement','news','testimonial','partner','legal','college','setting'));

-- Allowed media: images and PDFs in the public bucket, plus short videos.
CREATE FUNCTION trust_admin.valid_media(url text,kinds text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT url='' OR (kinds LIKE '%image%' AND (url ~ '^/images/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp)$' OR url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/trust-media/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp)$'))
  OR (kinds LIKE '%pdf%' AND (url ~ '^/files/[a-zA-Z0-9_./-]+\.pdf$' OR url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/trust-media/[a-zA-Z0-9_./-]+\.pdf$'))
  OR (kinds LIKE '%video%' AND url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/trust-media/[a-zA-Z0-9_./-]+\.(mp4|webm)$')
$$;

CREATE OR REPLACE FUNCTION public.admin_content_save(p_data jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());v_kind text:=p_data->>'kind';slug text:=p_data->>'slug';data jsonb:=p_data->'data';v_status text:=p_data->>'status';
 k text;line text;max_len integer;allowed text[];required_to_publish text[];
BEGIN
 IF trust_admin.require_staff(true)<>'admin' THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';END IF;
 IF v_kind IS NULL OR v_kind NOT IN ('programme','gallery','team','announcement','news','testimonial','partner','legal','college','setting') OR slug IS NULL OR slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(slug)>120 OR length(trim(coalesce(p_data->>'name','')))=0 OR length(p_data->>'name')>150 OR jsonb_typeof(data) IS DISTINCT FROM 'object' OR octet_length(data::text)>40000 THEN RAISE EXCEPTION 'Check the content name, slug and fields';END IF;
 IF coalesce(v_status,'') NOT IN ('draft','published','archived') THEN RAISE EXCEPTION 'Choose draft, published or archived';END IF;
 -- Every field must be text; text fields have sensible limits.
 FOR k IN SELECT jsonb_object_keys(data) LOOP
  IF jsonb_typeof(data->k)<>'string' THEN RAISE EXCEPTION 'Field % must be text',k;END IF;
  max_len:=CASE WHEN k IN ('body','photos') THEN 12000 WHEN k IN ('quote','description','summary','bio','note') THEN 3000 ELSE 1000 END;
  IF length(data->>k)>max_len THEN RAISE EXCEPTION 'Field % is too long',k;END IF;
 END LOOP;
 -- New kinds accept only their own fields.
 allowed:=CASE v_kind
  WHEN 'news' THEN ARRAY['date','category','summary','body','image','photos','video_url','video_file','year']
  WHEN 'testimonial' THEN ARRAY['quote','role','image','video_url','featured']
  WHEN 'partner' THEN ARRAY['tier','logo','website','description','since']
  WHEN 'legal' THEN ARRAY['group','number','issued','valid_until','issuer','file','image','body','year']
  WHEN 'college' THEN ARRAY['city','logo','interns','period','note']
  WHEN 'setting' THEN ARRAY['standard','certificate_no','issuer','valid_until','image','link','note']
  ELSE NULL END;
 IF allowed IS NOT NULL THEN
  FOR k IN SELECT jsonb_object_keys(data) LOOP
   IF NOT k=ANY(allowed) THEN RAISE EXCEPTION 'Unknown field %',k;END IF;
  END LOOP;
 END IF;
 -- Images, files and links.
 FOREACH k IN ARRAY ARRAY['image','logo'] LOOP
  IF NOT trust_admin.valid_media(coalesce(data->>k,''),'image') THEN RAISE EXCEPTION 'Use an uploaded image or an existing /images/ path for %',k;END IF;
 END LOOP;
 IF NOT trust_admin.valid_media(coalesce(data->>'file',''),'image pdf') THEN RAISE EXCEPTION 'Upload a PDF or image for the document';END IF;
 IF NOT trust_admin.valid_media(coalesce(data->>'video_file',''),'video') THEN RAISE EXCEPTION 'Upload an MP4 or WebM video';END IF;
 IF coalesce(data->>'photos','')<>'' THEN
  IF array_length(string_to_array(trim(data->>'photos'),E'\n'),1)>12 THEN RAISE EXCEPTION 'Add at most 12 extra photographs';END IF;
  FOREACH line IN ARRAY string_to_array(trim(data->>'photos'),E'\n') LOOP
   IF NOT trust_admin.valid_media(trim(line),'image') THEN RAISE EXCEPTION 'Each extra photograph must be an uploaded image';END IF;
  END LOOP;
 END IF;
 IF coalesce(data->>'link','')<>'' AND (data->>'link' !~ '^/[a-zA-Z0-9/?=&%#._-]*$' OR data->>'link' LIKE '//%') AND data->>'link' !~ '^https://[^\s]{4,250}$' THEN RAISE EXCEPTION 'Use a relative website link or an https link';END IF;
 IF v_kind='setting' AND coalesce(data->>'link','')<>'' AND data->>'link' !~ '^/[a-zA-Z0-9/?=&%#._-]*$' AND data->>'link' !~ '^https://[^\s]{4,250}$' THEN RAISE EXCEPTION 'Use a relative website link or an https link';END IF;
 IF coalesce(data->>'website','')<>'' AND data->>'website' !~ '^https://[^\s]{4,250}$' THEN RAISE EXCEPTION 'The website must start with https://';END IF;
 IF coalesce(data->>'video_url','')<>'' AND data->>'video_url' !~ '^https://(www\.)?(youtube\.com/watch\?v=[A-Za-z0-9_-]{6,20}|youtu\.be/[A-Za-z0-9_-]{6,20}|vimeo\.com/[0-9]{5,15})([&?#][A-Za-z0-9_=&%.-]*)?$' THEN RAISE EXCEPTION 'Use a YouTube or Vimeo link';END IF;
 -- Dates, years, counts and choices.
 FOREACH k IN ARRAY ARRAY['date','issued','valid_until'] LOOP
  IF coalesce(data->>k,'')<>'' THEN
   IF data->>k !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Use the date format YYYY-MM-DD for %',k;END IF;
   PERFORM (data->>k)::date;
  END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['year','since'] LOOP
  IF coalesce(data->>k,'')<>'' AND (data->>k !~ '^\d{4}$' OR (data->>k)::int NOT BETWEEN 1950 AND 2100) THEN RAISE EXCEPTION 'Use a four-digit year for %',k;END IF;
 END LOOP;
 IF coalesce(data->>'interns','')<>'' AND (data->>'interns' !~ '^\d{1,5}$') THEN RAISE EXCEPTION 'Interns must be a number';END IF;
 IF coalesce(data->>'tier','')<>'' AND data->>'tier' NOT IN ('principal','gold','silver','supporter') THEN RAISE EXCEPTION 'Choose a partner tier';END IF;
 IF coalesce(data->>'group','')<>'' AND v_kind='legal' AND data->>'group' NOT IN ('registration','report','policy','certification','other') THEN RAISE EXCEPTION 'Choose a document group';END IF;
 IF coalesce(data->>'featured','')<>'' AND data->>'featured' NOT IN ('yes','no') THEN RAISE EXCEPTION 'Featured must be yes or no';END IF;
 -- Publishing needs the essentials for each kind.
 IF v_status='published' THEN
  required_to_publish:=CASE v_kind
   WHEN 'programme' THEN ARRAY['image','description','body']
   WHEN 'gallery' THEN ARRAY['image']
   WHEN 'team' THEN ARRAY['image']
   WHEN 'news' THEN ARRAY['date']
   WHEN 'testimonial' THEN ARRAY['quote']
   WHEN 'partner' THEN ARRAY['logo']
   WHEN 'college' THEN ARRAY['interns']
   WHEN 'setting' THEN ARRAY['standard']
   ELSE ARRAY[]::text[] END;
  FOREACH k IN ARRAY required_to_publish LOOP
   IF length(trim(coalesce(data->>k,'')))=0 THEN RAISE EXCEPTION 'A published % needs: %',v_kind,k;END IF;
  END LOOP;
  IF v_kind='legal' AND length(trim(coalesce(data->>'file','')))=0 AND length(trim(coalesce(data->>'body','')))=0 THEN RAISE EXCEPTION 'A published document needs a file or text';END IF;
 END IF;
 IF nullif(p_data->>'id','') IS NOT NULL THEN PERFORM 1 FROM trust_admin.site_content WHERE site_content.id=v_id AND site_content.kind=v_kind FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Content not found';END IF;IF NOT EXISTS(SELECT 1 FROM trust_admin.site_content c WHERE c.id=v_id AND c.updated_at=(p_data->>'expected_updated_at')::timestamptz) THEN RAISE EXCEPTION 'This content changed in another session. Close and reopen it before saving';END IF;END IF;
 INSERT INTO trust_admin.site_content AS c(id,kind,slug,name,data,status,sort_order) VALUES(v_id,v_kind,slug,trim(p_data->>'name'),data,v_status,coalesce((p_data->>'sort_order')::integer,0)) ON CONFLICT ON CONSTRAINT site_content_pkey DO UPDATE SET slug=excluded.slug,name=excluded.name,data=excluded.data,status=excluded.status,sort_order=excluded.sort_order,updated_at=now();
 RETURN v_id::text;END $$;

-- Permanent delete for website content (administrators). The audit log keeps a snapshot.
CREATE FUNCTION public.admin_content_delete(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k text;s text;n text;
BEGIN
 IF trust_admin.require_staff(true)<>'admin' THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';END IF;
 SELECT kind,slug,name INTO k,s,n FROM trust_admin.site_content WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Content not found';END IF;
 IF k='programme' AND s='book-bank' THEN RAISE EXCEPTION 'The Book Bank programme is linked from across the site. Archive it instead';END IF;
 DELETE FROM trust_admin.site_content WHERE id=p_id;
 PERFORM trust_admin.log_event('delete','site_content',p_id::text,'Deleted '||k||': '||n);
END $$;

-- Set (or clear) the year on many gallery photographs at once.
CREATE FUNCTION public.admin_content_set_year(p_ids uuid[],p_year text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE changed integer;
BEGIN
 IF trust_admin.require_staff(true)<>'admin' THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';END IF;
 IF p_ids IS NULL OR cardinality(p_ids)=0 OR cardinality(p_ids)>500 THEN RAISE EXCEPTION 'Choose between 1 and 500 photographs';END IF;
 IF coalesce(p_year,'')<>'' AND (p_year !~ '^\d{4}$' OR p_year::int NOT BETWEEN 1950 AND 2100) THEN RAISE EXCEPTION 'Use a four-digit year';END IF;
 UPDATE trust_admin.site_content SET data=CASE WHEN coalesce(p_year,'')='' THEN data-'year' ELSE data||jsonb_build_object('year',p_year) END,updated_at=now() WHERE id=ANY(p_ids) AND kind='gallery';
 GET DIAGNOSTICS changed=ROW_COUNT;
 PERFORM trust_admin.log_event('update','site_content','bulk','Set year '||coalesce(nullif(p_year,''),'(none)')||' on '||changed||' photographs');
 RETURN changed;
END $$;

REVOKE ALL ON FUNCTION trust_admin.valid_media(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_content_delete(uuid),public.admin_content_set_year(uuid[],text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_content_delete(uuid),public.admin_content_set_year(uuid[],text) TO authenticated;

-- Existing public certificates move into the editable legal documents list; the ISO badge starts as a draft.
INSERT INTO trust_admin.site_content(kind,slug,name,data,status,sort_order) VALUES
('legal','trust-certificate-1','Trust certificate 1','{"group":"registration","file":"/images/cert/cert1.webp","image":"/images/cert/cert1.webp"}','published',1),
('legal','trust-certificate-2','Trust certificate 2','{"group":"registration","file":"/images/cert/cert2.webp","image":"/images/cert/cert2.webp"}','published',2),
('legal','trust-certificate-3','Trust certificate 3','{"group":"registration","file":"/images/cert/cert4.webp","image":"/images/cert/cert4.webp"}','published',3),
('legal','trust-certificate-4','Trust certificate 4','{"group":"registration","file":"/images/cert/cert5.webp","image":"/images/cert/cert5.webp"}','published',4),
('setting','iso-certification','ISO certification','{}','draft',0)
ON CONFLICT(kind,slug) DO NOTHING;

-- Hosted Supabase only: allow PDFs and short videos in the public media bucket.
DO $$ BEGIN IF to_regclass('storage.buckets') IS NOT NULL THEN
 UPDATE storage.buckets SET file_size_limit=52428800,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','application/pdf','video/mp4','video/webm'] WHERE id='trust-media';
END IF;END $$;

NOTIFY pgrst,'reload schema';
COMMIT;
