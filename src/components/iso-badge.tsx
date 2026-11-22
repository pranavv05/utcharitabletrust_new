import Link from 'next/link';
import {BadgeCheck} from 'lucide-react';
import type {IsoInfo} from '@/lib/site-content';

/** "UT Charitable Trust · ISO 9001:2015 certified" pill. Shows nothing until the certification is published. */
export function IsoBadge({iso, variant = 'pill'}: {iso: IsoInfo | null; variant?: 'pill' | 'line'}) {
  if (!iso) return null;
  const label = iso.standard + ' certified';
  return (
    <Link
      href="/legal#certification"
      className={'sx-iso sx-iso-' + variant}
      aria-label={'UT Charitable Trust is ' + label + '. View certification details'}
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
