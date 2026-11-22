'use client';
import Link from 'next/link';
import {useRef} from 'react';
import {useMagnetic} from '@/hooks/use-magnetic';
export function MagneticLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  useMagnetic(ref);
  return (
    <Link ref={ref} href={href} className={`magnetic-link ${className}`} data-cursor="Explore">
      <span>{children}</span>
      <span className="button-orbit" aria-hidden="true">
        +
      </span>
    </Link>
  );
}
