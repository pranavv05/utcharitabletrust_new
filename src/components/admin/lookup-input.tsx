'use client';
import {useEffect, useId, useState} from 'react';
export function LookupInput({
  entity,
  value,
  onChange,
}: {
  entity: 'authors' | 'classes';
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [options, setOptions] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/admin/${entity}?filter=active&search=${encodeURIComponent(value)}`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setOptions(d.rows.map((r: {title: string}) => r.title));
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [entity, value]);
  return (
    <>
      <input required list={id} value={value} maxLength={250} onChange={(e) => onChange(e.target.value)} />
      <datalist id={id}>
        {options.map((x) => (
          <option value={x} key={x} />
        ))}
      </datalist>
    </>
  );
}
