'use client';
import Link from 'next/link';
import {useId, useState} from 'react';
import {send} from './workspace';
import type {Row} from '@/lib/admin/config';

export type PersonMatch = {
  id: string;
  name: string;
  customerId: string;
  phone: string;
  email: string;
  reason?: string;
  archived?: boolean;
};
type Outcome = {
  status: 'created' | 'updated' | 'exists' | 'similar';
  id?: string;
  customerId?: string;
  person?: PersonMatch;
  matches?: PersonMatch[];
};

const bloodGroups = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const asRow = (m: PersonMatch): Row => ({
  id: m.id,
  name: m.name,
  customerId: m.customerId,
  phone: m.phone,
  email: m.email,
  status: m.archived ? 'inactive' : 'active',
});

/**
 * Add or edit a person. If someone with the same phone, email or name is already in the list, it says who
 * and offers to use that person instead of failing, so the same person is never created twice by accident.
 * `onUse` is given when the form is used inside a picker (issue or donation), where "use this person" is the
 * natural way out.
 */
export function PersonForm({
  row,
  compact = false,
  onSaved,
  onUse,
}: {
  row: Row | null;
  compact?: boolean;
  onSaved: (person: Row, status: 'created' | 'updated') => void;
  onUse?: (person: Row) => void;
}) {
  const uid = useId();
  const [values, setValues] = useState({
    name: String(row?.name ?? ''),
    phone: String(row?.phone ?? ''),
    email: String(row?.email ?? ''),
    address: String(row?.address ?? ''),
    bloodGroup: String(row?.bloodGroup ?? ''),
    status: String(row?.status ?? 'active'),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Outcome | null>(null);
  const change = (key: keyof typeof values, value: string) => {
    setValues((v) => ({...v, [key]: value}));
    setPending(null);
    setError('');
  };
  async function submit(confirm: boolean) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = (await send('people', {
        id: row?.id,
        data: {...values, ...(row ? {} : {status: undefined})},
        confirm_similar: confirm,
      })) as Outcome;
      if (result.status === 'created' || result.status === 'updated') {
        onSaved(
          {
            id: result.id,
            customerId: result.customerId,
            name: values.name.trim().replace(/\s+/g, ' '),
            phone: values.phone.trim(),
            email: values.email.trim().toLowerCase(),
            address: values.address,
            status: values.status,
          },
          result.status,
        );
      } else setPending(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const field = (key: string) => `${uid}-${key}`;
  // Inside another form (the issue and donation screens) this must not be a form itself, and Enter must
  // save the person rather than submit the screen around it.
  const Wrapper = compact ? 'div' : 'form';
  const wrapperProps = compact
    ? {
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault();
            void submit(false);
          }
        },
      }
    : {
        onSubmit: (e: React.FormEvent) => {
          e.preventDefault();
          void submit(false);
        },
      };
  return (
    <Wrapper className="admin-form" {...wrapperProps}>
      <div className="admin-form-grid">
        <label htmlFor={field('name')}>
          Full name <span className="admin-required">*</span>
          <input
            id={field('name')}
            value={values.name}
            required
            maxLength={120}
            autoComplete="off"
            onChange={(e) => change('name', e.target.value)}
          />
        </label>
        <label htmlFor={field('phone')}>
          Phone number <span className="admin-required">*</span>
          <input
            id={field('phone')}
            type="tel"
            inputMode="tel"
            value={values.phone}
            required
            maxLength={20}
            autoComplete="off"
            onChange={(e) => change('phone', e.target.value)}
          />
        </label>
        <label htmlFor={field('email')}>
          Email address <span className="admin-required">*</span>
          <input
            id={field('email')}
            type="email"
            value={values.email}
            required
            maxLength={254}
            autoComplete="off"
            onChange={(e) => change('email', e.target.value)}
          />
        </label>
        {!compact && (
          <label htmlFor={field('blood')}>
            Blood group
            <select
              id={field('blood')}
              value={values.bloodGroup}
              onChange={(e) => change('bloodGroup', e.target.value)}
            >
              {bloodGroups.map((g) => (
                <option key={g} value={g}>
                  {g || 'Not specified'}
                </option>
              ))}
            </select>
          </label>
        )}
        <label htmlFor={field('address')} className="full">
          Address
          <textarea
            id={field('address')}
            rows={compact ? 2 : 3}
            maxLength={400}
            value={values.address}
            onChange={(e) => change('address', e.target.value)}
          />
        </label>
        {row && (
          <label htmlFor={field('status')}>
            Status
            <select
              id={field('status')}
              value={values.status}
              onChange={(e) => change('status', e.target.value)}
            >
              <option value="active">Active</option>
              <option value="inactive">Archived</option>
            </select>
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="admin-notice error">
          {error.replace(/loans/gi, 'issued books')}
        </p>
      )}
      {pending?.status === 'exists' && pending.person && (
        <div role="alert" className="admin-notice error admin-person-match">
          <p>
            <strong>{pending.person.name}</strong> ({pending.person.customerId}) is already in the list with
            this phone number{pending.person.archived ? ', but that entry is archived' : ''}.
          </p>
          <div className="admin-person-match-actions">
            {onUse && !pending.person.archived && (
              <button
                type="button"
                className="admin-button primary"
                onClick={() => onUse(asRow(pending.person as PersonMatch))}
              >
                Use {pending.person.name}
              </button>
            )}
            {!onUse && (
              <Link className="admin-button secondary" href={'/admin/people?id=' + pending.person.id}>
                Open {pending.person.name}
              </Link>
            )}
            {pending.person.archived && (
              <span>Restore the archived entry from the People page to use it again.</span>
            )}
          </div>
        </div>
      )}
      {pending?.status === 'similar' && pending.matches && (
        <div role="alert" className="admin-notice error admin-person-match">
          <p>
            {row ? (
              <>
                <strong>Another entry already has some of these details.</strong> Save anyway only if they are
                different people.
              </>
            ) : (
              <>
                <strong>Someone like this is already in the list.</strong> Is this the same person?
              </>
            )}
          </p>
          <ul>
            {pending.matches.map((m) => (
              <li key={m.id}>
                <span>
                  <strong>{m.name}</strong> ({m.customerId}) · {m.phone} · {m.email}
                  <small>
                    {m.reason}
                    {m.archived ? ' · archived' : ''}
                  </small>
                </span>
                {onUse && !m.archived && !row ? (
                  <button type="button" className="admin-button secondary" onClick={() => onUse(asRow(m))}>
                    Yes, use this person
                  </button>
                ) : (
                  <Link className="admin-text-link" href={'/admin/people?id=' + m.id} target="_blank">
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <div className="admin-person-match-actions">
            <button
              type="button"
              className="admin-button primary"
              disabled={busy}
              onClick={() => void submit(true)}
            >
              {row ? 'Save anyway' : 'No, add as a different person'}
            </button>
            <button type="button" className="admin-button secondary" onClick={() => setPending(null)}>
              Change the details
            </button>
          </div>
        </div>
      )}
      <div className="admin-form-footer">
        <span>Changes are recorded in the activity log.</span>
        <button
          type={compact ? 'button' : 'submit'}
          className="admin-button primary"
          disabled={busy || pending !== null}
          onClick={compact ? () => void submit(false) : undefined}
        >
          {busy ? 'Saving…' : row ? 'Save changes' : compact ? 'Save and select person' : 'Add person'}
        </button>
      </div>
    </Wrapper>
  );
}
