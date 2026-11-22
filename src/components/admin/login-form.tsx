'use client';
import {BrandLogo} from '@/components/brand-logo';
import Image from 'next/image';
import Link from 'next/link';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {LockKeyhole, Eye, EyeOff, ShieldCheck} from 'lucide-react';
import {ThemeToggle} from '@/components/theme-toggle';
export function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: f.get('email'), password: f.get('password')}),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.message);
      router.replace('/admin');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="admin-login">
      <section className="admin-login-story">
        <div className="admin-login-logo">
          <BrandLogo onDark />
        </div>
        <div className="admin-login-photo">
          <Image
            src="/images/banner.webp"
            alt="The trust working alongside its community"
            fill
            sizes="50vw"
            priority
          />
        </div>
        <div className="admin-login-copy">
          <span className="admin-eyebrow">THE WORK BEHIND THE IMPACT</span>
          <h1>
            Small actions.
            <br />
            Lasting possibilities.
          </h1>
          <p>A shared workspace for the people who keep our book bank and community moving forward.</p>
        </div>
        <span className="admin-login-foot">Education. Care. Community.</span>
      </section>
      <section className="admin-login-form">
        <div className="admin-login-tools">
          <Link href="/">Public website</Link>
          <ThemeToggle />
        </div>
        <div className="admin-login-card">
          <span className="admin-login-icon">
            <LockKeyhole size={25} />
          </span>
          <p className="admin-eyebrow">TRUST OPERATIONS</p>
          <h2>Welcome back.</h2>
          <p>Sign in to your staff workspace.</p>
          <form onSubmit={submit}>
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@utcharitabletrust.com"
                required
                maxLength={254}
              />
            </label>
            <label>
              Password
              <div className="admin-password">
                <input
                  name="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  maxLength={200}
                />
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  aria-label={visible ? 'Hide password' : 'Show password'}
                >
                  {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </label>
            {error && (
              <p className="admin-notice error" role="alert">
                {error}
              </p>
            )}
            <button className="admin-button primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in to workspace'}
            </button>
          </form>
          <div className="admin-login-note">
            <ShieldCheck size={18} />
            <span>
              Access is limited to approved trust staff. Contact your administrator if you need help signing
              in.
            </span>
          </div>
        </div>
        <span className="admin-login-copyright">© {new Date().getFullYear()} UT Charitable Trust</span>
      </section>
    </main>
  );
}
