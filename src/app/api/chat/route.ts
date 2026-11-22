import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSiteContent} from '@/lib/site-content';
import {guideReply, chatContext} from '@/lib/trust-chat';
import {sameOrigin} from '@/lib/validation';
import {groqReply} from '@/lib/groq-chat';
import {createHash} from 'node:crypto';
import {clientIp} from '@/lib/client-ip';
export const runtime = 'nodejs';
const schema = z
  .object({
    messages: z
      .array(z.object({role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000)}))
      .min(1)
      .max(12),
  })
  .refine((v) => v.messages.at(-1)?.role === 'user');
// Bounded per-process burst protection. Configure provider spend limits for deployment.
const limits = new Map<string, {count: number; until: number}>();
export function GET() {
  return NextResponse.json(
    {mode: process.env.GROQ_API_KEY ? 'groq' : 'guide'},
    {headers: {'Cache-Control': 'no-store'}},
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({message: 'This request is not allowed.'}, {status: 403});
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 18000)
    return NextResponse.json({message: 'Please send a shorter conversation.'}, {status: 413});
  let parsed;
  try {
    parsed = schema.safeParse(JSON.parse(raw));
  } catch {
    return NextResponse.json({message: 'Please send a question.'}, {status: 400});
  }
  if (!parsed.success)
    return NextResponse.json({message: 'Please keep messages under 2,000 characters.'}, {status: 400});
  const now = Date.now();
  for (const [key, v] of limits) if (v.until < now) limits.delete(key);
  const key = createHash('sha256').update(clientIp(request.headers)).digest('hex');
  const limit = limits.get(key);
  if (limit && limit.count >= 20)
    return NextResponse.json(
      {message: 'You’ve sent several messages. Please try again in a few minutes.'},
      {status: 429, headers: {'Retry-After': String(Math.max(1, Math.ceil((limit.until - now) / 1000)))}},
    );
  if (!limit && limits.size >= 5000)
    return NextResponse.json({message: 'The chat is busy. Please try again shortly.'}, {status: 503});
  limits.set(key, {count: (limit?.count || 0) + 1, until: limit?.until || now + 600000});
  let site;
  try {
    site = await getSiteContent();
  } catch {
    return NextResponse.json(
      {
        message:
          'The trust’s published information is temporarily unavailable. Please use WhatsApp to reach the team.',
      },
      {status: 503},
    );
  }
  const last = parsed.data.messages.at(-1)!.content;
  const fallback = guideReply(last, site);
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json(fallback, {headers: {'Cache-Control': 'no-store'}});
  try {
    const message = await groqReply(parsed.data.messages, chatContext(site), {
      apiKey,
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    });
    return NextResponse.json(
      {message, links: fallback.links, mode: 'groq'},
      {headers: {'Cache-Control': 'no-store'}},
    );
  } catch {
    return NextResponse.json(
      {
        ...fallback,
        message:
          'AI replies are temporarily unavailable. Here is information from the trust’s website:\n\n' +
          fallback.message,
      },
      {headers: {'Cache-Control': 'no-store'}},
    );
  }
}
