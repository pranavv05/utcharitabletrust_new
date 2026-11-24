/** Shown at once while an admin page loads, so clicking a menu item feels instant. */
export default function Loading() {
  return (
    <div className="admin-loading" role="status" aria-label="Loading">
      <span className="admin-loading-bar admin-loading-title" />
      <span className="admin-loading-bar admin-loading-sub" />
      <div className="admin-loading-card">
        {Array.from({length: 7}, (_, i) => (
          <span key={i} className="admin-loading-bar admin-loading-row" />
        ))}
      </div>
    </div>
  );
}
