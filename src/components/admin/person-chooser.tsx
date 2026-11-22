'use client';
import {useState} from 'react';
import {RecordPicker, send} from './workspace';
import type {Row} from '@/lib/admin/config';
export function PersonChooser({
  type,
  selected,
  onChange,
}: {
  type: 'donar' | 'customer';
  selected: Row[];
  onChange: (rows: Row[]) => void;
}) {
  const [creating, setCreating] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [data, setData] = useState({name: '', email: '', phone: '', address: ''});
  async function create() {
    setBusy(true);
    setError('');
    try {
      const r = await send('people', {data: {...data, type, status: 'active'}});
      onChange([{...data, type, id: r.id, status: 'active'}]);
      setCreating(false);
      setData({name: '', email: '', phone: '', address: ''});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <RecordPicker
        entity="people"
        filter={type}
        label={type === 'donar' ? 'Donor' : 'Borrower'}
        selected={selected}
        onChange={onChange}
      />
      <button type="button" className="admin-text-link" onClick={() => setCreating(!creating)}>
        {creating ? 'Cancel new person' : '+ Add a new ' + (type === 'donar' ? 'donor' : 'borrower')}
      </button>
      {creating && (
        <fieldset className="admin-inline-create">
          <legend>New {type === 'donar' ? 'donor' : 'borrower'}</legend>
          <div className="admin-form-grid">
            {(['name', 'email', 'phone', 'address'] as const).map((key) => (
              <label key={key}>
                {key === 'name'
                  ? 'Full name'
                  : key === 'email'
                    ? 'Email address'
                    : key === 'phone'
                      ? 'Phone number'
                      : 'Address'}
                <input
                  type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                  value={data[key]}
                  maxLength={key === 'address' ? 400 : 120}
                  onChange={(e) => setData({...data, [key]: e.target.value})}
                />
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="admin-notice error">
              {error}
            </p>
          )}
          <button type="button" className="admin-button secondary" disabled={busy} onClick={create}>
            {busy ? 'Saving…' : 'Save and select person'}
          </button>
        </fieldset>
      )}
    </div>
  );
}
