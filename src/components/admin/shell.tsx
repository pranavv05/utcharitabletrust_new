'use client';
import {AdminLive} from '@/components/live-updates';
import {BrandLogo} from '@/components/brand-logo';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {useState, useEffect, useRef} from 'react';
import type {LucideIcon} from 'lucide-react';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  UserCheck,
  ArrowLeftRight,
  Undo2,
  Gift,
  Inbox,
  Tags,
  PenLine,
  History,
  BarChart3,
  Globe,
  ShieldCheck,
  Archive,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import {ThemeToggle} from '@/components/theme-toggle';
type NavItem = {href: string; label: string; Icon: LucideIcon; adminOnly?: boolean};
type NavGroup = {label: string; items: NavItem[]; collapsed?: boolean};
/** Grouped by how often staff use each page: daily work first, rarely-used records last. */
export const navGroups: NavGroup[] = [
  {label: 'OVERVIEW', items: [{href: '/admin', label: 'Overview', Icon: LayoutDashboard}]},
  {
    label: 'DAILY WORK',
    items: [
      {href: '/admin/loans', label: 'Loans', Icon: ArrowLeftRight},
      {href: '/admin/returns', label: 'Return books', Icon: Undo2},
      {href: '/admin/donations', label: 'Donations', Icon: Gift},
      {href: '/admin/submissions', label: 'Inbox', Icon: Inbox},
    ],
  },
  {
    label: 'LIBRARY',
    items: [
      {href: '/admin/books', label: 'Book inventory', Icon: BookOpen},
      {href: '/admin/authors', label: 'Authors', Icon: PenLine},
      {href: '/admin/classes', label: 'Classes & categories', Icon: Tags},
    ],
  },
  {
    label: 'PEOPLE',
    items: [
      {href: '/admin/people', label: 'Donors & borrowers', Icon: Users},
      {href: '/admin/members', label: 'Members', Icon: UserCheck},
    ],
  },
  {
    label: 'INSIGHTS',
    items: [
      {href: '/admin/reports', label: 'Reports', Icon: BarChart3},
      {href: '/admin/audit', label: 'Activity log', Icon: History},
    ],
  },
  {
    label: 'WEBSITE & ADMIN',
    items: [
      {href: '/admin/content', label: 'Website content', Icon: Globe, adminOnly: true},
      {href: '/admin/conflicts', label: 'Record review', Icon: ShieldCheck, adminOnly: true},
      {href: '/admin/settings', label: 'Settings', Icon: Settings},
    ],
  },
  {
    label: 'ARCHIVES',
    collapsed: true,
    items: [
      {href: '/admin/contacts', label: 'Contact archive', Icon: MessageSquare},
      {href: '/admin/feedback', label: 'Feedback archive', Icon: Archive},
    ],
  },
];
/** The nav entry that owns a path; sub-paths such as /admin/loans/123 resolve to their section. */
export function activeNavItem(path: string, role: string) {
  return navGroups
    .flatMap((g) => g.items)
    .filter((i) => role === 'admin' || !i.adminOnly)
    .find((i) =>
      i.href === '/admin' ? path === '/admin' : path === i.href || path.startsWith(i.href + '/'),
    );
}
export function AdminShell({children, name, role}: {children: React.ReactNode; name: string; role: string}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [mobile, setMobile] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = matchMedia('(max-width:760px)');
    const update = () => {
      setMobile(media.matches);
      if (!media.matches) setOpen(false);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!mobile || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    nav.current?.querySelector<HTMLButtonElement>('.admin-mobile-close')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(nav.current?.querySelectorAll<HTMLElement>('a,button:not([disabled])') || []);
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, [mobile, open]);

  async function logout() {
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'logout'}),
      });
      if (!r.ok) throw Error();
      router.replace('/login');
      router.refresh();
    } catch {
      setMessage('Unable to sign out. Please try again.');
    }
  }
  const title = activeNavItem(path, role)?.label || 'Workspace';
  return (
    <div className="admin-app">
      <aside
        ref={nav}
        inert={mobile && !open}
        aria-hidden={mobile && !open ? true : undefined}
        className={'admin-sidebar ' + (open ? 'is-open' : '')}
        aria-label="Workspace navigation"
      >
        <Link href="/admin" className="admin-brand" onClick={() => setOpen(false)}>
          <BrandLogo />
        </Link>
        <div className="admin-brand-caption">
          TRUST OPERATIONS <span>BOOK BANK</span>
        </div>
        <button className="admin-mobile-close" onClick={() => setOpen(false)} aria-label="Close navigation">
          <X size={20} />
        </button>
        <nav>
          {navGroups.map((group) => {
            const items = group.items.filter((item) => role === 'admin' || !item.adminOnly);
            if (!items.length) return null;
            const links = items.map(({href, label, Icon}) => {
              const current = activeNavItem(path, role)?.href === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={current ? 'is-active' : ''}
                  aria-current={current ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </Link>
              );
            });
            return group.collapsed ? (
              <details
                className="admin-nav-group admin-nav-more"
                key={group.label}
                open={items.some((i) => path.startsWith(i.href))}
              >
                <summary>{group.label}</summary>
                {links}
              </details>
            ) : (
              <div className="admin-nav-group" key={group.label}>
                <p>{group.label}</p>
                {links}
              </div>
            );
          })}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link href="/" target="_blank">
            View public website <ExternalLink size={15} />
          </Link>
          <div className="admin-profile">
            <span className="admin-avatar">{name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{name}</strong>
              <small>
                {role === 'admin'
                  ? 'Administrator'
                  : role === 'viewer'
                    ? 'Read-only access'
                    : 'Operations staff'}
              </small>
            </div>
            <button onClick={logout} aria-label="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      {open && (
        <button className="admin-nav-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />
      )}
      <div className="admin-main" inert={mobile && open}>
        <header className="admin-topbar">
          <div>
            <button
              ref={menu}
              className="admin-menu-toggle"
              aria-label="Open navigation"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className="admin-breadcrumb">
              Workspace <span>/</span> <strong>{title}</strong>
            </span>
          </div>
          <div className="admin-topbar-end">
            <span className="admin-environment">UT Charitable Trust</span>
            <AdminLive />
            <ThemeToggle />
            <span className="admin-avatar small">{name.slice(0, 1).toUpperCase()}</span>
          </div>
        </header>
        <main id="main" className="admin-content">
          {message && (
            <p role="alert" className="admin-notice error">
              {message}
            </p>
          )}
          {children}
        </main>
        <footer className="admin-bottomline">
          <span>UT Charitable Trust · Community in action</span>
          <span>Trust operations workspace</span>
        </footer>
      </div>
    </div>
  );
}
