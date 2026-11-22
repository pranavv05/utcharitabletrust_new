import {NextResponse} from 'next/server';
import {staffContext} from '@/lib/supabase/server';
import {sameOrigin} from '@/lib/validation';
import {validateLargeUpload} from '@/lib/admin/media-upload';

/**
 * Issues a one-time signed upload link for a PDF or video. The browser then uploads the file straight to
 * storage, so large files never pass through the web server. The storage bucket enforces the 50 MB limit
 * and the allowed content types; only administrators can create links.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({message: 'Request not allowed.'}, {status: 403});
  const ctx = await staffContext();
  if (!ctx || ctx.staff.role !== 'admin')
    return NextResponse.json({message: 'Administrator access required.'}, {status: 403});
  let body: {type?: unknown; size?: unknown};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({message: 'Invalid request.'}, {status: 400});
  }
  const check = validateLargeUpload(body?.type, body?.size);
  if (!check.ok) return NextResponse.json({message: check.message}, {status: 400});
  const path = `${ctx.user.id}/${crypto.randomUUID()}.${check.ext}`;
  const bucket = ctx.db.storage.from('trust-media');
  const {data, error} = await bucket.createSignedUploadUrl(path);
  if (error || !data)
    return NextResponse.json(
      {message: 'Upload is not available. Check the media bucket setup and try again.'},
      {status: 503},
    );
  return NextResponse.json(
    {path, token: data.token, contentType: check.type, publicUrl: bucket.getPublicUrl(path).data.publicUrl},
    {headers: {'Cache-Control': 'private, no-store'}},
  );
}
