import {NextResponse} from 'next/server';
import {staffContext} from '@/lib/supabase/server';
import {sameOrigin} from '@/lib/validation';
import {createLimiter} from '@/lib/rate-limit';
import {lookupIsbn, readCover, validateImageDataUrl} from '@/lib/admin/book-lookup';
import {normalizeIsbn} from '@/lib/admin/isbn';

export const runtime = 'nodejs';
// Photo reading costs money per call, so each staff member gets a small bounded allowance.
const limiter = createLimiter({limit: 30, windowMs: 10 * 60 * 1000});
const noStore = {'Cache-Control': 'private, no-store'};

export async function GET() {
  const ctx = await staffContext();
  if (!ctx) return NextResponse.json({message: 'Staff access required.'}, {status: 401});
  return NextResponse.json({photoReading: Boolean(process.env.GROQ_API_KEY)}, {headers: noStore});
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({message: 'Request not allowed.'}, {status: 403});
  const ctx = await staffContext();
  if (!ctx) return NextResponse.json({message: 'Staff access required.'}, {status: 401});
  if (ctx.staff.role === 'viewer')
    return NextResponse.json({message: 'Your account has read-only access.'}, {status: 403});
  const gate = limiter.hit(ctx.user.id);
  if (!gate.allowed)
    return NextResponse.json(
      {message: 'Too many scans. Please wait a few minutes.'},
      {status: 429, headers: {'Retry-After': String(gate.retryAfter)}},
    );

  let body: {isbn?: unknown; image?: unknown};
  try {
    const text = await request.text();
    if (text.length > 6_000_000) throw Error();
    body = JSON.parse(text);
    if (!body || typeof body !== 'object') throw Error();
  } catch {
    return NextResponse.json({message: 'Invalid request.'}, {status: 400});
  }

  if (typeof body.isbn === 'string') {
    if (!normalizeIsbn(body.isbn))
      return NextResponse.json({message: 'That is not a valid ISBN. Check the digits.'}, {status: 400});
    const book = await lookupIsbn(body.isbn);
    return book
      ? NextResponse.json({book}, {headers: noStore})
      : NextResponse.json(
          {message: 'No book found for that ISBN. Take a photo of the cover or type the details.'},
          {status: 404},
        );
  }

  const image = validateImageDataUrl(body.image);
  if (!image.ok) return NextResponse.json({message: 'Send a JPEG, PNG or WebP photo.'}, {status: 400});
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      {message: 'Photo reading is not set up on this server yet. Scan the barcode or type the details.'},
      {status: 503},
    );
  try {
    const book = await readCover(image.url, {
      apiKey,
      model: process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
    });
    return book
      ? NextResponse.json({book}, {headers: noStore})
      : NextResponse.json(
          {message: 'Could not read a book title from that photo. Try a clearer, closer photo of the cover.'},
          {status: 422},
        );
  } catch {
    return NextResponse.json(
      {message: 'The photo reading service is unavailable right now. Please type the details.'},
      {status: 502},
    );
  }
}
