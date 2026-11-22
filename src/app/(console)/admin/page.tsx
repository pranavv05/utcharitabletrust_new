import {requireStaff} from '@/lib/admin/auth';
import {Dashboard} from '@/components/admin/dashboard';
export default async function Page(){const {db,staff}=await requireStaff();const {data,error}=await db.rpc('admin_overview');if(error)throw Error('The workspace could not load. Please try again.');return <Dashboard data={data} name={staff.name} canWrite={staff.role!=='viewer'}/>}
