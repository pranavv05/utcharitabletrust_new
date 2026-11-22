import {requireStaff} from '@/lib/admin/auth';
import {Dashboard} from '@/components/admin/dashboard';
import {monthStart, trustDate} from '@/lib/admin/dates';
import type {Row} from '@/lib/admin/config';

type ListResult = {data: {rows?: Row[]; total?: number} | null; error: unknown};
const rows = (result: ListResult) => (result.error ? [] : (result.data?.rows ?? []));
const total = (result: ListResult) => (result.error ? null : (result.data?.total ?? 0));

export default async function Page() {
  const {db, staff} = await requireStaff();
  const from = monthStart(),
    to = trustDate();
  // The overview is required; the extra panels degrade to empty lists instead of blocking the page.
  const [overview, overdue, inbox, loans, donations, audit] = await Promise.all([
    db.rpc('admin_overview'),
    db.rpc('admin_list', {p_entity: 'returns', p_page: 1, p_filter: 'overdue', p_search: '', p_sort: 'due'}),
    db.rpc('admin_list', {
      p_entity: 'submissions',
      p_page: 1,
      p_filter: 'new',
      p_search: '',
      p_sort: 'newest',
    }),
    db.rpc('admin_report', {p_kind: 'loans', p_from: from, p_to: to}),
    db.rpc('admin_report', {p_kind: 'donations', p_from: from, p_to: to}),
    db.rpc('admin_list', {p_entity: 'audit', p_page: 1, p_filter: '', p_search: '', p_sort: 'newest'}),
  ]);
  if (overview.error) throw Error('The workspace could not load. Please try again.');
  // The activity log also records every low-level row change; the dashboard shows only what staff did.
  const activity = rows(audit as ListResult)
    .filter((a) => !/^Record (insert|update|delete) · /.test(String(a.summary)))
    .slice(0, 5);
  return (
    <Dashboard
      data={{...overview.data, activity}}
      name={staff.name}
      canWrite={staff.role !== 'viewer'}
      overdue={rows(overdue as ListResult).slice(0, 5)}
      inbox={rows(inbox as ListResult).slice(0, 5)}
      month={{loans: total(loans as ListResult), donations: total(donations as ListResult)}}
    />
  );
}
