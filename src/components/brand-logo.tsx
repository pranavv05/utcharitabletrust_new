import Image from 'next/image';

/** Official artwork, with a light wordmark for dark surfaces. */
export function BrandLogo({onDark=false}:{onDark?:boolean}) {
 return <span className={`brand-logo${onDark?' brand-logo-on-dark':''}`}>
  <Image className="brand-logo-light" src="/images/logo.png" alt="UT Charitable Trust" width={208} height={54} sizes="208px" loading="eager"/>
  <Image className="brand-logo-dark" src="/images/footer/footer-logo.webp" alt="UT Charitable Trust" width={208} height={56} sizes="208px" loading="eager"/>
 </span>;
}
