'use client';
import {useEffect, useState} from 'react';
import {ShieldCheck, KeyRound, Users} from 'lucide-react';
import {send} from './workspace';
import type {Row} from '@/lib/admin/config';
export function SettingsPanel({name, email, role}: {name: string; email: string; role: string}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [team, setTeam] = useState<Row[]>([]);
  function load() {
    if (role === 'admin')
      fetch('/api/admin/team')
        .then(async (r) => {
          if (!r.ok) throw Error();
          return r.json();
        })
        .then((d) => {
          if (!Array.isArray(d)) throw Error();
          setTeam(d);
          setError('');
        })
        .catch(() => setError('Unable to load staff.'));
  }
  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener('trust:changed', refresh);
    return () => window.removeEventListener('trust:changed', refresh);
  }, [role]);
  async function password(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setError('');
    setMessage('');
    if (f.get('password') !== f.get('confirm')) {
      setError('New passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'password', current: f.get('current'), password: f.get('password')}),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.message);
      form.reset();
      setMessage('Password updated.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function staff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await send('team', {...data, active: data.active === 'true'});
      form.reset();
      load();
      setMessage('Staff access updated.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">YOUR WORKSPACE</p>
          <h1>Settings</h1>
          <p>Account security and team access.</p>
        </div>
      </div>
      {error && (
        <p className="admin-notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="admin-notice success" role="status">
          {message}
        </p>
      )}
      <div className="admin-settings-grid">
        <section className="admin-card">
          <div className="admin-card-heading">
            <h2>Your account</h2>
            <ShieldCheck size={21} />
          </div>
          <dl className="admin-detail-list">
            <div>
              <dt>Name</dt>
              <dd>{name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{role}</dd>
            </div>
          </dl>
          <p className="admin-form-help">Staff access is checked by the application and by the database.</p>
        </section>
        <section className="admin-card">
          <div className="admin-card-heading">
            <h2>Change password</h2>
            <KeyRound size={21} />
          </div>
          <form className="admin-form" onSubmit={password}>
            <label>
              Current password
              <input
                type="password"
                name="current"
                autoComplete="current-password"
                required
                maxLength={200}
              />
            </label>
            <label>
              New password
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={200}
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                name="confirm"
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={200}
              />
            </label>
            <button disabled={busy} className="admin-button primary">
              Update password
            </button>
          </form>
        </section>
      </div>
      {role === 'admin' && (
        <section className="admin-card admin-team-card">
          <div className="admin-card-heading">
            <div>
              <h2>Staff access</h2>
              <p>Administrators manage access. Operators manage records. Viewers can read.</p>
            </div>
            <Users size={21} />
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {team.map((s) => (
                  <tr key={String(s.user_id)}>
                    <td>{String(s.name)}</td>
                    <td>{String(s.email)}</td>
                    <td>{String(s.role)}</td>
                    <td>{s.active ? 'Enabled' : 'Disabled'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form className="admin-form" onSubmit={staff}>
            <h3>Add or update staff access</h3>
            <p className="admin-form-help">
              The email must already have an account in Supabase Authentication. This form does not send
              invitation emails.
            </p>
            <div className="admin-form-grid">
              <label>
                Email address
                <input name="email" type="email" required />
              </label>
              <label>
                Name
                <input name="name" required maxLength={120} />
              </label>
              <label>
                Role
                <select name="role">
                  <option value="operator">Operator</option>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <label>
                Access
                <select name="active">
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </label>
            </div>
            <button disabled={busy} className="admin-button primary">
              Save staff access
            </button>
          </form>
        </section>
      )}
    </>
  );
}
