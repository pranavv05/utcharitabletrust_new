'use client';
import {useState} from 'react';
import {RecordPicker} from './workspace';
import {PersonForm} from './person-form';
import type {Row} from '@/lib/admin/config';

/**
 * Pick anyone from the one list of people, whether they donate, borrow or both. Searching works by name, phone,
 * email or reference number. A person who is not in the list yet can be added right here; if someone with the
 * same details already exists, the form offers to use that person instead.
 */
export function PersonChooser({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: Row[];
  onChange: (rows: Row[]) => void;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <div>
      <RecordPicker entity="people" label={label} selected={selected} onChange={onChange} />
      <button type="button" className="admin-text-link" onClick={() => setCreating(!creating)}>
        {creating ? 'Cancel new person' : "+ Can't find them? Add a new person"}
      </button>
      {creating && (
        <fieldset className="admin-inline-create">
          <legend>New person</legend>
          <PersonForm
            row={null}
            compact
            onSaved={(person) => {
              onChange([person]);
              setCreating(false);
            }}
            onUse={(person) => {
              onChange([person]);
              setCreating(false);
            }}
          />
        </fieldset>
      )}
    </div>
  );
}
