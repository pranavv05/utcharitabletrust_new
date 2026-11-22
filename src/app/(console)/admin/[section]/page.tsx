import {Reports} from '@/components/admin/reports';
import {ConflictReview} from '@/components/admin/conflicts';
import {ContentManager} from '@/components/admin/content-manager';
import {notFound} from 'next/navigation';
import {requireStaff} from '@/lib/admin/auth';
import {sections, type Section} from '@/lib/admin/config';
import {Workspace} from '@/components/admin/workspace';
import {SettingsPanel} from '@/components/admin/settings';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{section: string}>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const {section} = await params;
  const {db, staff, user} = await requireStaff();
  if (section === 'reports') return <Reports canExport={staff.role !== 'viewer'} />;
  if (section === 'conflicts') {
    if (staff.role !== 'admin') notFound();
    return <ConflictReview />;
  }
  if (section === 'content') {
    if (staff.role !== 'admin') notFound();
    return <ContentManager />;
  }
  if (section === 'settings')
    return <SettingsPanel name={staff.name} role={staff.role} email={user.email || ''} />;
  if (!Object.hasOwn(sections, section)) notFound();
  const search = await searchParams;
  const {data, error} = await db.rpc('admin_list', {
    p_entity: section,
    p_page: 1,
    p_filter: search.filter || '',
    p_search: '',
  });
  if (error) throw Error('Unable to load this section. Please try again.');
  return (
    <Workspace key={section} section={section as Section} initial={data} canWrite={staff.role !== 'viewer'} />
  );
}
