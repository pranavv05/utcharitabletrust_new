import {createServerClient} from '@supabase/ssr';
import {NextResponse, type NextRequest} from 'next/server';
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({request});
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    return response;
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({name, value}) => request.cookies.set(name, value));
          response = NextResponse.next({request});
          values.forEach(({name, value, options}) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  // Refreshes an expired sign-in. The token is checked from its signature, so this needs no trip to the auth server.
  await db.auth.getClaims();
  return response;
}
export const config = {
  matcher: [
    '/admin/:path*',
    '/login',
    '/api/admin/:path*',
    '/api/admin-media/:path*',
    '/api/admin-media',
    '/api/auth',
  ],
};
