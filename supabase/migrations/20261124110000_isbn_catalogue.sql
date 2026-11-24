-- A memory of books the trust's staff have already entered, filed by ISBN.
--
-- Donated books repeat: the same textbook arrives many times. Public book databases do not know many
-- Indian titles at all, and none of them know the class a school book is for. So the first time staff
-- type a book's details after scanning its barcode, they are remembered, and every later copy of that
-- book fills in instantly (title, author and class) from the trust's own record.
BEGIN;

CREATE TABLE trust_admin.book_catalogue (
 isbn text PRIMARY KEY CHECK (isbn ~ '^97[89][0-9]{10}$'),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 250),
 author text NOT NULL DEFAULT '' CHECK (length(author)<=150),
 class_name text NOT NULL DEFAULT '' CHECK (length(class_name)<=100),
 times_used integer NOT NULL DEFAULT 1,
 updated_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE trust_admin.book_catalogue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON trust_admin.book_catalogue FROM PUBLIC,anon,authenticated;

-- What the trust already knows about a book (the 13-digit ISBN), or nothing.
CREATE FUNCTION public.admin_isbn_find(p_isbn text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM trust_admin.require_staff();
 IF coalesce(p_isbn,'') !~ '^97[89][0-9]{10}$' THEN RETURN NULL;END IF;
 SELECT jsonb_build_object('isbn',isbn,'title',title,'author',author,'class_name',class_name,'times_used',times_used) INTO result FROM trust_admin.book_catalogue WHERE isbn=p_isbn;
 RETURN result;
END $$;

-- Remember the details staff confirmed for a book. The latest confirmed details win.
CREATE FUNCTION public.admin_isbn_remember(p_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_isbn text:=p_data->>'isbn';
 v_title text:=btrim(regexp_replace(coalesce(p_data->>'title',''),'[[:space:]]+',' ','g'));
 v_author text:=btrim(regexp_replace(coalesce(p_data->>'author',''),'[[:space:]]+',' ','g'));
 v_class text:=btrim(regexp_replace(coalesce(p_data->>'class_name',''),'[[:space:]]+',' ','g'));
BEGIN
 PERFORM trust_admin.require_staff(true);
 IF coalesce(v_isbn,'') !~ '^97[89][0-9]{10}$' THEN RAISE EXCEPTION 'Not a valid ISBN';END IF;
 IF length(v_title) NOT BETWEEN 1 AND 250 OR length(v_author)>150 OR length(v_class)>100 THEN RAISE EXCEPTION 'Check the title, author and class';END IF;
 INSERT INTO trust_admin.book_catalogue(isbn,title,author,class_name,updated_by) VALUES(v_isbn,v_title,v_author,v_class,auth.uid())
 ON CONFLICT (isbn) DO UPDATE SET title=EXCLUDED.title,author=EXCLUDED.author,class_name=EXCLUDED.class_name,times_used=trust_admin.book_catalogue.times_used+1,updated_by=auth.uid(),updated_at=now();
END $$;

REVOKE ALL ON FUNCTION public.admin_isbn_find(text),public.admin_isbn_remember(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_isbn_find(text),public.admin_isbn_remember(jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
