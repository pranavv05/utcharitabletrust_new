'use client';
import {trustDate} from '@/lib/admin/dates';
import {useEffect, useState, useRef} from 'react';
import {display, type Row} from '@/lib/admin/config';
import {columnLabel, orderColumns, reportPresets, summarizeReport} from '@/lib/admin/report-summary';
import {PrintButton} from '@/components/admin/print-button';
export function Reports({canExport}: {canExport: boolean}) {
  const today = trustDate();
  const [kind, setKind] = useState('loans'),
    [from, setFrom] = useState(today.slice(0, 8) + '01'),
    [to, setTo] = useState(today),
    [report, setReport] = useState<{
      rows: Row[];
      total: number;
      limited: boolean;
      undated_historical_returns?: number;
    } | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(''),
    [page, setPage] = useState(1),
    [filterText, setFilterText] = useState('');
  const activeRequest = useRef<AbortController | null>(null);
  const query = new URLSearchParams({kind, from, to}).toString();
  async function load() {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/admin/reports?' + query, {signal: controller.signal});
      const d = await r.json();
      if (!r.ok) throw Error(d.message);
      if (controller.signal.aborted) return;
      setReport(d);
      setPage(1);
      setLoaded(query);
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    const refresh = () => {
      if (loaded === query) void load();
    };
    window.addEventListener('trust:changed', refresh);
    return () => window.removeEventListener('trust:changed', refresh);
  }, [loaded, query]);
  useEffect(() => {
    activeRequest.current?.abort();
    setBusy(false);
    setReport(null);
    setLoaded('');
    setFilterText('');
    return () => activeRequest.current?.abort();
  }, [kind, from, to]);
  const keys = report?.rows[0] ? orderColumns(Object.keys(report.rows[0])) : [];
  const needle = filterText.trim().toLowerCase();
  const shown = report
    ? needle
      ? report.rows.filter((row) =>
          Object.values(row).some((v) =>
            String(v ?? '')
              .toLowerCase()
              .includes(needle),
          ),
        )
      : report.rows
    : [];
  const summary = report?.rows.length ? summarizeReport(report.rows) : null;
  const presets = reportPresets();
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">UNDERSTAND THE IMPACT</p>
          <h1>Reports</h1>
          <p>Date-filtered book-bank records, ready for review.</p>
        </div>
      </div>
      <section className="admin-card">
        <div className="admin-report-presets" role="group" aria-label="Quick date ranges">
          {presets.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className={from === preset.from && to === preset.to ? 'is-active' : ''}
              aria-pressed={from === preset.from && to === preset.to}
              onClick={() => {
                setFrom(preset.from);
                setTo(preset.to);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <form
          className="admin-report-filters"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <label>
            Report
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="loans">Books issued</option>
              <option value="donations">Donations received</option>
              <option value="returns">Returns and losses</option>
              <option value="overdue">Currently overdue books</option>
            </select>
          </label>
          <label>
            From
            <input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" required min={from} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button className="admin-button primary" disabled={busy}>
            {busy ? 'Loading…' : 'Generate report'}
          </button>
        </form>
        <p className="admin-form-help">
          Up to 366 days per report. Issue and donation reports use the issue/donation date; returns use the
          recorded return date and label imported history separately. Overdue shows books still outstanding
          today.
        </p>
        {error && (
          <p role="alert" className="admin-notice error">
            {error}
          </p>
        )}
        {report && (
          <>
            <div className="admin-subheading">
              <h3>{report.total.toLocaleString('en-IN')} records</h3>
              <PrintButton />
              {canExport && loaded === query && (
                <a className="admin-button secondary" href={'/api/admin/reports?' + query + '&format=csv'}>
                  Download CSV
                </a>
              )}
            </div>
            {!!report.undated_historical_returns && (
              <p className="admin-notice">
                {report.undated_historical_returns} historical returned{' '}
                {report.undated_historical_returns === 1 ? 'record has' : 'records have'} no recorded return
                date. These remain in transaction history and cannot be placed in a date-range report.
              </p>
            )}
            {report.limited && (
              <p className="admin-notice">
                Showing/exporting the first 5,000 records. Choose a smaller date range for a complete report.
              </p>
            )}
            {summary && (
              <div className="admin-report-summary">
                <div>
                  <span>Records</span>
                  <strong>{summary.records.toLocaleString('en-IN')}</strong>
                </div>
                {summary.copies !== null && (
                  <div>
                    <span>Book copies</span>
                    <strong>{summary.copies.toLocaleString('en-IN')}</strong>
                  </div>
                )}
                <div>
                  <span>People</span>
                  <strong>{summary.people.toLocaleString('en-IN')}</strong>
                </div>
                <div className="wide">
                  <span>{summary.copies !== null ? 'Most active (copies)' : 'Most records'}</span>
                  <ol>
                    {summary.topPeople.map((person) => (
                      <li key={person.name}>
                        {person.name} <b>{person.count.toLocaleString('en-IN')}</b>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="wide">
                  <span>By status</span>
                  <ul>
                    {summary.byStatus.map((item) => (
                      <li key={item.status}>
                        {display(item.status)} <b>{item.count.toLocaleString('en-IN')}</b>
                      </li>
                    ))}
                  </ul>
                </div>
                {report?.limited && (
                  <p className="admin-form-help">Summary covers the first 5,000 records.</p>
                )}
              </div>
            )}
            {report.rows.length > 0 && (
              <label className="admin-report-search">
                <span className="admin-visually-hidden">Search this report</span>
                <input
                  type="search"
                  placeholder="Search this report by name, reference, book or status…"
                  value={filterText}
                  onChange={(e) => {
                    setFilterText(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
            )}
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    {keys.map((k) => (
                      <th key={k}>{columnLabel(k)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.slice((page - 1) * 50, page * 50).map((row, i) => (
                    <tr key={i}>
                      {keys.map((k) => (
                        <td key={k}>{display(row[k])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!shown.length && (
                <p className="admin-empty-inline">
                  {report.rows.length ? 'No rows match your search.' : 'No records in this date range.'}
                </p>
              )}
            </div>
            {shown.length > 50 && (
              <div className="admin-pagination">
                <span>
                  Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, shown.length)} of {shown.length}
                </span>
                <div>
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </button>
                  <button disabled={page * 50 >= shown.length} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
