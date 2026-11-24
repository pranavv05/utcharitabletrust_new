import {Reports} from '@/components/admin/reports';
import {ConflictReview} from '@/components/admin/conflicts';
import {ContentManager} from '@/components/admin/content-manager';
import {notFound} from 'next/navigation';
import {requireStaff} from '@/lib/admin/auth';
import {serverClient} from '@/lib/supabase/server';
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
  const special = ['reports', 'conflicts', 'content', 'settings'].includes(section);
  if (!special && !Object.hasOwn(sections, section)) notFound();
  const search = await searchParams;
  // The list does not depend on who the staff member is (the database checks that itself), so it is fetched
  // at the same time as the staff check instead of after it.
  const db = special ? null : await serverClient();
  // (The database call only starts when awaited, so it is started here by hand.)
  const early = db
    ? Promise.resolve(
        db.rpc('admin_list', {p_entity: section, p_page: 1, p_filter: search.filter || '', p_search: ''}),
      )
    : null;
  const {staff, user} = await requireStaff();
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
  const {data, error} = (await early) ?? {data: null, error: Error('unavailable')};
  if (error) throw Error('Unable to load this section. Please try again.');
  return (
    <Workspace
      key={section}
      section={section as Section}
      initial={data}
      canWrite={staff.role !== 'viewer'}
      isAdmin={staff.role === 'admin'}
    />
  );
}
