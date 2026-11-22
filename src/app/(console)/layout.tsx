import type {Metadata} from 'next';
import '@/styles/admin.css';
export const metadata: Metadata = {
  title: {absolute: 'Workspace | UT Charitable Trust'},
  robots: {index: false, follow: false},
};
export default function ConsoleLayout({children}: {children: React.ReactNode}) {
  return children;
}
