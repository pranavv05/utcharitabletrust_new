import {NextResponse} from 'next/server';
import {staffContext} from '@/lib/supabase/server';
import {sameOrigin} from '@/lib/validation';
import {createLimiter} from '@/lib/rate-limit';
import {lookupIsbn, readCover, validateImageDataUrl} from '@/lib/admin/book-lookup';
import {toIsbn13} from '@/lib/admin/isbn';

export const runtime = 'nodejs';
// Photo reading costs money per call, so each staff member gets a small bounded allowance. Looking up a
// barcode is free but uses other people's servers, so it has a larger one.
const limiter = createLimiter({limit: 30, windowMs: 10 * 60 * 1000});
const lookupLimiter = createLimiter({limit: 150, windowMs: 10 * 60 * 1000});
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
  let body: {isbn?: unknown; image?: unknown; remember?: unknown};
  try {
    const text = await request.text();
    if (text.length > 6_000_000) throw Error();
    body = JSON.parse(text);
    if (!body || typeof body !== 'object') throw Error();
  } catch {
    return NextResponse.json({message: 'Invalid request.'}, {status: 400});
  }

  const tooMany = (gate: {retryAfter: number}) =>
    NextResponse.json(
      {message: 'Too many scans. Please wait a few minutes.'},
      {status: 429, headers: {'Retry-After': String(gate.retryAfter)}},
    );

  // Staff confirmed a book's details, so the next copy of the same book fills in by itself.
  if (body.remember && typeof body.remember === 'object') {
    const r = body.remember as Record<string, unknown>;
    const isbn = typeof r.isbn === 'string' ? toIsbn13(r.isbn) : null;
    if (!isbn) return NextResponse.json({message: 'Not a valid ISBN.'}, {status: 400});
    const {error} = await ctx.db.rpc('admin_isbn_remember', {
      p_data: {
        isbn,
        title: String(r.title ?? ''),
        author: String(r.author ?? ''),
        class_name: String(r.class_name ?? ''),
      },
    });
    // Remembering is a convenience: it never gets in the way of adding the book.
    return NextResponse.json({ok: !error}, {headers: noStore});
  }

  if (typeof body.isbn === 'string') {
    const isbn = toIsbn13(body.isbn);
    if (!isbn)
      return NextResponse.json({message: 'That is not a valid ISBN. Check the digits.'}, {status: 400});
    const gate = lookupLimiter.hit(ctx.user.id);
    if (!gate.allowed) return tooMany(gate);
    // The trust's own record of books it has already entered comes first: instant, and it knows the class.
    const known = await ctx.db.rpc('admin_isbn_find', {p_isbn: isbn});
    const mine = known.data as {title: string; author: string; class_name: string} | null;
    if (mine?.title)
      return NextResponse.json(
        {
          book: {
            title: mine.title,
            author: mine.author,
            class_name: mine.class_name,
            isbn,
            source: 'catalogue',
          },
        },
        {headers: noStore},
      );
    const book = await lookupIsbn(isbn, fetch, {googleKey: process.env.GOOGLE_BOOKS_API_KEY});
    return book
      ? NextResponse.json({book}, {headers: noStore})
      : NextResponse.json(
          {
            message:
              'This book is not in our records or the online book databases. Type its details once and they will be remembered for the next copy.',
            isbn,
          },
          {status: 404},
        );
  }

  const photoGate = limiter.hit(ctx.user.id);
  if (!photoGate.allowed) return tooMany(photoGate);
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
