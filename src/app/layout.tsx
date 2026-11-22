import type {Metadata} from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './editorial.css';
import '@/styles/experience.css';
import '@/styles/visual-refresh.css';
import '@/styles/public-refinement.css';
import '@/styles/image-fit.css';

const display = localFont({
  src: '../styles/fonts/display.ttf',
  variable: '--type-display',
  display: 'swap',
  weight: '200 800',
});
const sans = localFont({
  src: '../styles/fonts/sans.ttf',
  variable: '--type-sans',
  display: 'swap',
  weight: '100 1000',
});
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {default: 'UT Charitable Trust | Humanity. In action.', template: '%s | UT Charitable Trust'},
  description:
    'A community-led charitable trust in Silvassa. Education, health, and everyday acts of care. Discover our work and find your way to help.',
  openGraph: {
    title: 'UT Charitable Trust | Humanity. In action.',
    description:
      'For every child with a dream. For every family finding its way. For the community we call home.',
    type: 'website',
    images: [
      {url: '/images/banner.webp', width: 1800, height: 831, alt: 'UT Charitable Trust with its community'},
    ],
  },
  twitter: {card: 'summary_large_image'},
  icons: {icon: '/images/favicon/favicon-32x32.webp'},
};
const themeScript = `try{var staff=/^\\/(admin|login)(\\/|$)/.test(location.pathname);var t=localStorage.getItem('ut-theme');document.documentElement.dataset.theme=staff&&t!=='light'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}`;
export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${sans.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{__html: themeScript}} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
