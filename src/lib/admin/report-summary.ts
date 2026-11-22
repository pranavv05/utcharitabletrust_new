import type {Row} from './config';
import {trustDate} from './dates';

export type Preset = {id: string; label: string; from: string; to: string};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (value: string) => new Date(value + 'T00:00:00Z');

/** Quick date ranges in the trust's calendar. Financial years run 1 April to 31 March (India). */
export function reportPresets(now = new Date()): Preset[] {
  const today = trustDate(now);
  const t = utc(today);
  const y = t.getUTCFullYear(),
    m = t.getUTCMonth();
  const monthStart = new Date(Date.UTC(y, m, 1));
  const lastMonthStart = new Date(Date.UTC(y, m - 1, 1));
  const lastMonthEnd = new Date(Date.UTC(y, m, 0));
  const fyStartYear = m >= 3 ? y : y - 1;
  const last30 = new Date(t);
  last30.setUTCDate(last30.getUTCDate() - 29);
  return [
    {id: 'month', label: 'This month', from: iso(monthStart), to: today},
    {id: 'last-month', label: 'Last month', from: iso(lastMonthStart), to: iso(lastMonthEnd)},
    {id: '30', label: 'Last 30 days', from: iso(last30), to: today},
    {id: 'fy', label: 'This financial year', from: `${fyStartYear}-04-01`, to: today},
    {
      id: 'last-fy',
      label: 'Last financial year',
      from: `${fyStartYear - 1}-04-01`,
      to: `${fyStartYear}-03-31`,
    },
  ];
}

export type ReportSummary = {
  records: number;
  copies: number | null;
  people: number;
  topPeople: {name: string; count: number}[];
  byStatus: {status: string; count: number}[];
};

/** Totals computed from the rows already loaded for a report (at most 5,000). */
export function summarizeReport(rows: Row[]): ReportSummary {
  const people = new Map<string, number>();
  const statuses = new Map<string, number>();
  let copies = 0,
    hasCopies = false;
  for (const row of rows) {
    const weight = row.copies === undefined || row.copies === null ? 1 : Number(row.copies) || 0;
    if (row.copies !== undefined && row.copies !== null) {
      hasCopies = true;
      copies += Number(row.copies) || 0;
    }
    const name = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : 'Unknown';
    people.set(name, (people.get(name) || 0) + weight);
    const status = String(row.status ?? 'unknown');
    statuses.set(status, (statuses.get(status) || 0) + 1);
  }
  const sorted = (map: Map<string, number>) =>
    [...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    records: rows.length,
    copies: hasCopies ? copies : null,
    people: people.size,
    topPeople: sorted(people)
      .slice(0, 5)
      .map(([name, count]) => ({name, count})),
    byStatus: sorted(statuses).map(([status, count]) => ({status, count})),
  };
}

const headings: Record<string, string> = {
  reference: 'Reference',
  name: 'Person',
  date: 'Date',
  due: 'Due date',
  status: 'Status',
  copies: 'Copies',
  utbn: 'UTBN',
  title: 'Book title',
};
export const columnLabel = (key: string) => headings[key] || key.replaceAll('_', ' ');

const columnOrder = ['reference', 'name', 'date', 'due', 'utbn', 'title', 'copies', 'status'];
/** Report columns in reading order (reference first); unknown columns follow alphabetically. */
export const orderColumns = (keys: string[]) =>
  keys.toSorted((a, b) => {
    const ia = columnOrder.indexOf(a),
      ib = columnOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
