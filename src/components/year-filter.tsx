'use client';
import type {YearFilter as YearValue} from '@/lib/media';

/** Row of year chips ("All years", newest year first, optionally "Undated") for filtering a list. */
export function YearFilter({
  years,
  value,
  onChange,
  hasUndated = false,
  label = 'Filter by year',
}: {
  years: string[];
  value: YearValue;
  onChange: (value: YearValue) => void;
  hasUndated?: boolean;
  label?: string;
}) {
  if (!years.length && !hasUndated) return null;
  const options: {value: YearValue; label: string}[] = [
    {value: 'all', label: 'All years'},
    ...years.map((y) => ({value: y, label: y})),
    ...(hasUndated ? [{value: 'undated', label: 'Undated'}] : []),
  ];
  return (
    <div className="filter-tabs sx-year-filter" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={'filter-tab' + (value === option.value ? ' active' : '')}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
