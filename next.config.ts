import type { NextConfig } from 'next';
import path from 'node:path';
const nextConfig: NextConfig = { distDir:process.env.UTTRUST_BUILD_DIR||'.next', poweredByHeader: false, images:{qualities:[75,85],remotePatterns:process.env.NEXT_PUBLIC_SUPABASE_URL?[{protocol:'https',hostname:new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,pathname:'/storage/v1/object/public/trust-media/**'}]:[]}, turbopack: { root: path.resolve(process.cwd()) }, async redirects() { return [
{source:'/index.php',destination:'/',permanent:true},{source:'/bookbank.php',destination:'/book-bank',permanent:true},{source:'/ceo-message.php',destination:'/president-message',permanent:true},{source:'/member.php',destination:'/team',permanent:true},{source:'/certificate.php',destination:'/certificates',permanent:true},{source:'/volunteer.php',destination:'/join',permanent:true},{source:'/:page.php',destination:'/:page',permanent:true}
];}, async headers() { return [{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'}]}]; } };
export default nextConfig;
