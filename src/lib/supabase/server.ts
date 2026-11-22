import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {isConfigured} from '@/lib/content';
export async function serverClient(){if(!isConfigured())return null;const store=await cookies();return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll(){return store.getAll()},setAll(values){try{values.forEach(({name,value,options})=>store.set(name,value,options))}catch{/* Server components cannot write cookies; the proxy refreshes them. */}}}});}
export async function staffContext(){const db=await serverClient();if(!db)return null;const {data:{user}}=await db.auth.getUser();if(!user)return null;const {data:staff}=await db.from('staff').select('user_id,name,role').eq('user_id',user.id).eq('active',true).single();return staff?{db,user,staff}:null;}
