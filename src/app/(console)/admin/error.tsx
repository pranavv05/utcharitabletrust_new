'use client';
export default function AdminError({reset}: {reset: () => void}) {
  return (
    <section className="admin-card admin-empty">
      <h1>We couldn’t load this page.</h1>
      <p>Please retry. If the issue persists, contact your administrator.</p>
      <button className="admin-button primary" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
