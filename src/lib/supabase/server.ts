import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {cache} from 'react';
import {isConfigured} from '@/lib/content';
export const serverClient=cache(async function(){if(!isConfigured())return null;const store=await cookies();return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll(){return store.getAll()},setAll(values){try{values.forEach(({name,value,options})=>store.set(name,value,options))}catch{/* Server components cannot write cookies; the proxy refreshes them. */}}}})});
/**
 * The signed-in staff member, or null. Worked out once per request (the admin layout and the page both ask,
 * and now share one answer). The sign-in is checked from the signed token itself, which needs no trip to the
 * auth server when the project uses signing keys; the database re-checks who is calling on every query anyway.
 */
export const staffContext = cache(async () => {
  const db = await serverClient();
  if (!db) return null;
  const {data} = await db.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const {data: staff} = await db
    .from('staff')
    .select('user_id,name,role')
    .eq('user_id', claims.sub)
    .eq('active', true)
    .single();
  return staff ? {db, user: {id: claims.sub, email: (claims.email as string | undefined) ?? ''}, staff} : null;
});
