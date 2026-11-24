'use client';
import {useCallback, useEffect, useState} from 'react';
import {send} from './workspace';
import type {Row} from '@/lib/admin/config';

type Person = {
  id: string;
  name: string;
  customerId: string;
  phone: string;
  email: string;
  donations: number;
  borrowings: number;
};
type Group = {reason: string; people: Person[]};

/** Merge every other entry in `others` into `keep`, one at a time. Administrators only. */
export async function mergeInto(keep: string, others: string[]) {
  for (const id of others) await send('merge', {keep_id: keep, remove_id: id});
}

/**
 * Entries that may be the same person (same phone, email or name). An administrator picks the entry to keep
 * and the others are merged into it, so their donations, issues and copies are never lost.
 */
export function PeopleDuplicates({isAdmin, onChanged}: {isAdmin: boolean; onChanged: () => void}) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<{keep: Person; others: Person[]} | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    fetch('/api/admin/duplicates')
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.message);
        setGroups(d as Group[]);
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);
  async function merge() {
    if (!confirm) return;
    setBusy(true);
    setError('');
    try {
      await mergeInto(
        confirm.keep.id,
        confirm.others.map((p) => p.id),
      );
      setConfirm(null);
      load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (error && !groups) return <p role="alert">{error}</p>;
  if (!groups) return <p>Looking for entries that may be the same person…</p>;
  return (
    <div className="admin-duplicates">
      {error && (
        <p role="alert" className="admin-notice error">
          {error}
        </p>
      )}
      {!groups.length && <p>No entries share a phone number, email or name. Everyone is listed once.</p>}
      {groups.length > 0 && (
        <p className="admin-form-help">
          These entries share a phone number, email or name. Often it is a family sharing a phone, so check
          before merging.{' '}
          {isAdmin
            ? 'Merging keeps every donation, issue and book.'
            : 'Only an administrator can merge entries.'}
        </p>
      )}
      {groups.map((g, i) => (
        <section className="admin-duplicate-group" key={i}>
          <h3>{g.reason[0].toUpperCase() + g.reason.slice(1)}</h3>
          <ul>
            {g.people.map((p) => (
              <li key={p.id}>
                <span>
                  <strong>{p.name}</strong> ({p.customerId})
                  <small>
                    {p.phone} · {p.email} · {p.donations} donation{p.donations === 1 ? '' : 's'} ·{' '}
                    {p.borrowings} issue{p.borrowings === 1 ? '' : 's'}
                  </small>
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    className="admin-button secondary"
                    onClick={() => setConfirm({keep: p, others: g.people.filter((x) => x.id !== p.id)})}
                  >
                    Keep this one
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {confirm && (
        <div className="admin-notice error" role="alertdialog" aria-label="Confirm merge">
          <p>
            Keep <strong>{confirm.keep.name}</strong> ({confirm.keep.customerId}) and merge{' '}
            {confirm.others.map((p) => `${p.name} (${p.customerId})`).join(', ')} into it? Their donations,
            issues and books move to {confirm.keep.name} and the other{' '}
            {confirm.others.length === 1 ? 'entry is' : 'entries are'} removed. This cannot be undone.
          </p>
          <div className="admin-person-match-actions">
            <button type="button" className="admin-button primary" disabled={busy} onClick={merge}>
              {busy ? 'Merging…' : 'Yes, merge'}
            </button>
            <button
              type="button"
              className="admin-button secondary"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export type {Row};
