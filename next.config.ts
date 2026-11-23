import type {NextConfig} from 'next';
import path from 'node:path';
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
const dev = process.env.NODE_ENV !== 'production';
// Next.js and the theme bootstrap script use inline scripts, so 'unsafe-inline' is required until nonces are adopted.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabase ? ' ' + supabase.origin : ''}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabase ? ` ${supabase.origin} wss://${supabase.host}` : ''}${dev ? ' ws:' : ''}`,
  'frame-src https://challenges.cloudflare.com https://maps.google.com https://www.google.com https://www.youtube-nocookie.com https://player.vimeo.com',
  `media-src 'self' blob:${supabase ? ' ' + supabase.origin : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
const securityHeaders = [
  {key: 'X-Content-Type-Options', value: 'nosniff'},
  {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
  {key: 'X-Frame-Options', value: 'DENY'},
  {key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains'},
  {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'},
  {key: 'Cross-Origin-Opener-Policy', value: 'same-origin'},
  {key: 'Content-Security-Policy', value: csp},
];
const nextConfig: NextConfig = {
  distDir: process.env.UTTRUST_BUILD_DIR || '.next',
  poweredByHeader: false,
  images: {
    qualities: [75, 85],
    remotePatterns: supabase
      ? [
          {
            // https for a hosted project; http only for a local test backend such as localhost.
            protocol: supabase.protocol === 'http:' ? 'http' : 'https',
            hostname: supabase.hostname,
            ...(supabase.port ? {port: supabase.port} : {}),
            pathname: '/storage/v1/object/public/trust-media/**',
          },
        ]
      : [],
  },
  turbopack: {root: path.resolve(process.cwd())},
  async redirects() {
    return [
      {source: '/index.php', destination: '/', permanent: true},
      {source: '/bookbank.php', destination: '/book-bank', permanent: true},
      {source: '/ceo-message.php', destination: '/president-message', permanent: true},
      {source: '/member.php', destination: '/team', permanent: true},
      {source: '/certificate.php', destination: '/legal', permanent: true},
      {source: '/certificates', destination: '/legal', permanent: true},
      {source: '/volunteer.php', destination: '/join', permanent: true},
      {source: '/:page.php', destination: '/:page', permanent: true},
    ];
  },
  async headers() {
    return [{source: '/(.*)', headers: securityHeaders}];
  },
};
export default nextConfig;
