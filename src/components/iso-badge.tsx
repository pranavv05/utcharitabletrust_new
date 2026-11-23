import Link from 'next/link';
import {BadgeCheck} from 'lucide-react';
import type {IsoInfo} from '@/lib/site-content';

/**
 * The trust's ISO certification. It always says the trust is ISO certified; once the standard is entered in
 * the admin panel (Website content → ISO certification) it names it too, for example "ISO 9001:2015 certified".
 */
export function isoLabel(iso: IsoInfo | null) {
  return iso ? iso.standard + ' certified' : 'ISO Certified Trust';
}

export function IsoBadge({iso, variant = 'pill'}: {iso: IsoInfo | null; variant?: 'pill' | 'line'}) {
  const label = isoLabel(iso);
  return (
    <Link
      href="/legal#certification"
      className={'sx-iso sx-iso-' + variant}
      aria-label={
        'UT Charitable Trust is ' + (iso ? label : 'an ISO certified trust') + '. View certification details'
      }
    >
      <BadgeCheck size={variant === 'pill' ? 16 : 15} aria-hidden="true" />
      {variant === 'line' ? (
        <span>
          UT Charitable Trust · <strong>{label}</strong>
        </span>
      ) : (
        <span>{label}</span>
      )}
    </Link>
  );
}
