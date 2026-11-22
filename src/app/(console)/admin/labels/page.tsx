import QRCode from 'qrcode';
import {requireStaff} from '@/lib/admin/auth';
import {PrintButton} from '@/components/admin/print-button';
import {parsePage} from '@/lib/validation';
export default async function Labels({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const {db} = await requireStaff();
  const p = await searchParams;
  const {data, error} = await db.rpc('admin_list', {
    p_entity: 'books',
    p_search: (p.search || '').slice(0, 150),
    p_filter: p.filter || '',
    p_page: parsePage(p.page || null),
    p_sort: p.sort || 'newest',
  });
  if (error) throw Error('Unable to load labels');
  const rows = await Promise.all(
    (data.rows as {id: string; utbn: number; bookName: string}[]).map(async (b) => ({
      ...b,
      qr: await QRCode.toDataURL(String(b.utbn), {width: 180, margin: 2, errorCorrectionLevel: 'M'}),
    })),
  );
  return (
    <section className="admin-card">
      <div className="admin-page-heading">
        <div>
          <h1>Book QR labels</h1>
          <p>
            Labels for the current inventory page (up to 25 copies). Scan the numeric UTBN into inventory,
            issue or return search using a QR-capable keyboard scanner.
          </p>
        </div>
        <PrintButton />
      </div>
      <div className="admin-labels">
        {rows.map((b) => (
          <article className="admin-book-label" key={b.id}>
            {/* Generated locally; no external QR service receives identifiers. */}
            <img src={b.qr} alt={'QR for UTBN ' + b.utbn} width={90} height={90} />
            <div>
              <small>UT CHARITABLE TRUST</small>
              <strong>UTBN {b.utbn}</strong>
              <span>{b.bookName}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
