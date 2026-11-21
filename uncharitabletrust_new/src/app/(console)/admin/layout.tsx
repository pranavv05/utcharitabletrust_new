import {requireStaff} from '@/lib/admin/auth';
import {AdminShell} from '@/components/admin/shell';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}){const {staff}=await requireStaff();return <AdminShell name={staff.name} role={staff.role}>{children}</AdminShell>}
