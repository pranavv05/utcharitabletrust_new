import {z} from 'zod';
import {contactTopics} from './contact-links';
export const requestSchema = z
  .object({
    kind: z.enum(['contact', 'membership']),
    name: z.string().trim().min(2).max(120),
    email: z.email().max(254),
    phone: z.string().trim().max(18),
    message: z.string().trim().min(10).max(3000),
    subject: z.string().trim().max(120).optional(),
    blood_group: z.enum(['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
    city: z.string().trim().max(120).optional(),
    address: z.string().trim().max(400).optional(),
    website: z.string().max(300).optional(),
    'cf-turnstile-response': z.string().max(2048).optional(),
  })
  .superRefine((v, ctx) => {
    if (!(/^[+0-9 ()-]{10,18}$/.test(v.phone) || (v.kind === 'contact' && v.phone === '')))
      ctx.addIssue({code: 'custom', path: ['phone'], message: 'Please enter a valid phone number.'});
    if (v.kind === 'contact' && !contactTopics.some((t) => t.name === v.subject))
      ctx.addIssue({code: 'custom', path: ['subject'], message: 'Choose how you would like to help.'});
    if (v.kind === 'membership' && !v.city)
      ctx.addIssue({code: 'custom', path: ['city'], message: 'Please enter your city.'});
  });
export const personSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  phone: z.string().regex(/^[+0-9 ()-]{10,18}$/),
  address: z.string().max(400).optional(),
  type: z.enum(['donor', 'borrower']),
});
export const donationSchema = z.object({
  person_id: z.uuid(),
  books: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(250),
        author: z.string().trim().min(1).max(150),
        class_name: z.string().trim().min(1).max(100),
      }),
    )
    .min(1)
    .max(200),
});
export const issueSchema = z.object({
  person_id: z.uuid(),
  book_ids: z
    .array(z.uuid())
    .min(1)
    .max(100)
    .refine((a) => new Set(a).size === a.length, 'Duplicate book IDs are not allowed.'),
  due_date: z.iso.date(),
});
export const returnSchema = z.object({
  transaction_id: z.uuid(),
  book_ids: z
    .array(z.uuid())
    .min(1)
    .max(100)
    .refine((a) => new Set(a).size === a.length),
  penalty: z.number().min(0).max(1000000),
  reason: z.string().max(1000).optional(),
  lost: z.boolean().optional(),
});
export function parsePage(value: string | null) {
  const n = Number(value || 1);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 100000) : 1;
}
export const recordActionSchema = z.object({
  entity: z.enum(['books', 'people', 'members', 'authors', 'classes', 'submissions']),
  id: z.string().min(1).max(64),
});
export const staffAccessSchema = z.object({
  email: z.email().max(254),
  name: z.string().trim().min(1).max(120),
  role: z.enum(['admin', 'operator', 'viewer']),
  active: z.boolean().optional(),
});
/**
 * CSRF guard for cookie-authenticated writes. Browsers always send Origin on cross-origin POSTs and
 * Sec-Fetch-Site on modern versions; either one identifying another site rejects the request.
 * Requests with neither header come from non-browser clients, which have no ambient cookies to abuse.
 */
export function sameOrigin(request: Request) {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
