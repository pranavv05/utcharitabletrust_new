import {revalidatePath} from 'next/cache';
import {toCsv} from '@/lib/admin/csv';
import {NextResponse} from 'next/server';
import {staffContext} from '@/lib/supabase/server';
import {sameOrigin, parsePage, staffAccessSchema, recordActionSchema} from '@/lib/validation';
import {sections} from '@/lib/admin/config';
import {plainTerms} from '@/lib/admin/terms';
export async function GET(request: Request, {params}: {params: Promise<{entity: string}>}) {
  const ctx = await staffContext();
  if (!ctx) return NextResponse.json({message: 'Staff access required.'}, {status: 401});
  const {entity} = await params;
  const url = new URL(request.url);
  let result;
  if (entity === 'person')
    result = await ctx.db.rpc('admin_person', {p_id: url.searchParams.get('id') || ''});
  else if (entity === 'application')
    result = await ctx.db.rpc('admin_application', {p_id: url.searchParams.get('id') || ''});
  else if (entity === 'conflicts') result = await ctx.db.rpc('admin_conflicts');
  else if (entity === 'content')
    result = await ctx.db.rpc('admin_content', {p_kind: url.searchParams.get('kind') || ''});
  else if (entity === 'reports') {
    const kind = url.searchParams.get('kind') || 'loans',
      from = url.searchParams.get('from') || '',
      to = url.searchParams.get('to') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
      return NextResponse.json({message: 'Choose valid dates.'}, {status: 400});
    result = await ctx.db.rpc('admin_report', {p_kind: kind, p_from: from, p_to: to});
    if (url.searchParams.get('format') === 'csv') {
      if (ctx.staff.role === 'viewer')
        return NextResponse.json({message: 'Export requires an operator or administrator.'}, {status: 403});
      if (result.error) return NextResponse.json({message: 'Unable to generate report.'}, {status: 400});
      return new Response(toCsv(result.data.rows), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=trust-report-${from}-${to}.csv`,
          'Cache-Control': 'private, no-store',
        },
      });
    }
  } else if (entity === 'team') result = await ctx.db.rpc('admin_team');
  else if (entity === 'overview') result = await ctx.db.rpc('admin_overview');
  else if (entity === 'record')
    /* only loans have a detail record */ result = await ctx.db.rpc('admin_record', {
      p_entity: 'loans',
      p_id: url.searchParams.get('id') || '',
    });
  else if (Object.hasOwn(sections, entity))
    result = await ctx.db.rpc('admin_list', {
      p_entity: entity,
      p_search: (url.searchParams.get('search') || '').slice(0, 150),
      p_page: parsePage(url.searchParams.get('page')),
      p_filter: (url.searchParams.get('filter') || '').slice(0, 40),
      p_sort: (url.searchParams.get('sort') || 'newest').slice(0, 20),
    });
  else return NextResponse.json({message: 'Section not found.'}, {status: 404});
  if (result.error)
    return NextResponse.json({message: 'Unable to load these records. Please try again.'}, {status: 503});
  return NextResponse.json(result.data, {headers: {'Cache-Control': 'private, no-store'}});
}
export async function POST(request: Request, {params}: {params: Promise<{entity: string}>}) {
  if (!sameOrigin(request)) return NextResponse.json({message: 'Request not allowed.'}, {status: 403});
  const ctx = await staffContext();
  if (!ctx) return NextResponse.json({message: 'Staff access required.'}, {status: 401});
  if (ctx.staff.role === 'viewer')
    return NextResponse.json({message: 'Your account has read-only access.'}, {status: 403});
  const {entity} = await params;
  let body;
  try {
    const text = await request.text();
    if (text.length > 200000) throw Error();
    body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error();
  } catch {
    return NextResponse.json({message: 'Invalid request.'}, {status: 400});
  }
  let result;
  if (entity === 'content') {
    if (ctx.staff.role !== 'admin')
      return NextResponse.json({message: 'Administrator access required.'}, {status: 403});
    result = await ctx.db.rpc('admin_content_save', {p_data: body});
  } else if (entity === 'content-delete' || entity === 'content-year') {
    if (ctx.staff.role !== 'admin')
      return NextResponse.json({message: 'Administrator access required.'}, {status: 403});
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (entity === 'content-delete') {
      if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id))
        return NextResponse.json({message: 'Choose a record first.'}, {status: 400});
      result = await ctx.db.rpc('admin_content_delete', {p_id: body.id});
    } else {
      if (
        !ids.length ||
        ids.length > 500 ||
        !ids.every((x: unknown) => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x))
      )
        return NextResponse.json({message: 'Choose between 1 and 500 photographs.'}, {status: 400});
      result = await ctx.db.rpc('admin_content_set_year', {
        p_ids: ids,
        p_year: typeof body.year === 'string' ? body.year : '',
      });
    }
  } else if (['renew', 'followup', 'approve', 'correct'].includes(entity))
    result = await ctx.db.rpc('admin_' + entity, {p_data: body});
  else if (entity === 'team') {
    const access = staffAccessSchema.safeParse(body);
    if (!access.success)
      return NextResponse.json({message: 'Enter a valid email, name and role.'}, {status: 400});
    result = await ctx.db.rpc('admin_set_staff', {
      p_email: access.data.email,
      p_name: access.data.name,
      p_role: access.data.role,
      p_active: access.data.active !== false,
    });
  } else if (entity === 'delete' || entity === 'restore') {
    const action = recordActionSchema.safeParse(body);
    if (!action.success) return NextResponse.json({message: 'Choose a record first.'}, {status: 400});
    if (entity === 'delete' && ctx.staff.role !== 'admin')
      return NextResponse.json({message: 'Only an administrator can delete records.'}, {status: 403});
    result = await ctx.db.rpc('admin_' + entity, {p_entity: action.data.entity, p_id: action.data.id});
  } else if (['donate', 'issue', 'return'].includes(entity))
    result = await ctx.db.rpc('admin_' + entity, {p_data: body});
  else if (entity === 'submissions')
    result = await ctx.db.rpc('admin_submission', {p_id: body.id, p_status: body.status});
  else if (['books', 'people', 'members', 'authors', 'classes'].includes(entity))
    result = await ctx.db.rpc('admin_save', {
      p_entity: entity,
      p_data: body.data || {},
      p_id: body.id || null,
      p_archive: body.archive === true,
    });
  else return NextResponse.json({message: 'Operation not found.'}, {status: 404});
  if (result.error) {
    const code = result.error.code;
    const message =
      code === '23505'
        ? 'A record with those details already exists.'
        : code === 'P0001'
          ? plainTerms(result.error.message)
          : code === '22007' || code === '22P02'
            ? 'Check the selected values and dates.'
            : code === '42501'
              ? 'You do not have permission to do this.'
              : 'Unable to save. Check your details and try again.';
    return NextResponse.json({message}, {status: code === '42501' ? 403 : 400});
  }
  if (entity === 'content' || entity === 'content-delete' || entity === 'content-year')
    revalidatePath('/', 'layout');
  return NextResponse.json({ok: true, id: result.data});
}
