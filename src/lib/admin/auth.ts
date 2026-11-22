import {redirect} from 'next/navigation';
import {staffContext} from '@/lib/supabase/server';
export async function requireStaff() {
  const ctx = await staffContext();
  if (!ctx) redirect('/login');
  return ctx;
}
