import {BrandLogo} from '@/components/brand-logo';
import {notFound} from 'next/navigation';
import {requireStaff} from '@/lib/admin/auth';
import {PrintButton} from '@/components/admin/print-button';
import {ReceiptDocument, type ReceiptTrust} from '@/components/admin/receipt';
import {getSiteContent} from '@/lib/site-content';
import {trustContacts} from '@/lib/contact-links';
import {trustDate} from '@/lib/admin/dates';

export default async function Receipt({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const {db} = await requireStaff();
  const {data, error} = await db.rpc('admin_record', {p_entity: 'loans', p_id: id});
  if (error || !data) notFound();
  // The registration number and certification come from the published Legal documents, so they are
  // never typed in two places. Nothing is printed until an administrator has entered them there.
  const site = await getSiteContent().catch(() => null);
  const trust: ReceiptTrust = {
    name: 'UT Charitable Trust',
    address: trustContacts.address,
    phone: trustContacts.phone.number,
    email: trustContacts.email,
    registration: site?.legal.find((d) => d.group === 'registration' && d.number)?.number,
    iso: site?.iso?.standard,
  };
  return (
    <>
      <div className="receipt-toolbar admin-no-print">
        <PrintButton />
      </div>
      <ReceiptDocument data={data} trust={trust} logo={<BrandLogo />} printedOn={trustDate()} />
    </>
  );
}
