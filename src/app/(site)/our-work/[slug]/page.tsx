export const dynamic='force-dynamic';
import {programmePhotos} from '@/lib/photos';
import {getSiteContent} from '@/lib/site-content';
import { TrustImage } from '@/components/ui/trust-image';
import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {programmes} from '@/lib/content';
import {PageIntro,JoinBanner} from '@/components/shared';
export function generateStaticParams(){return programmes.filter(p=>p.slug!=='book-bank').map(p=>({slug:p.slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const {programmes}=await getSiteContent();return {title:programmes.find(p=>p.slug===slug)?.name||'Programme'};}
export default async function Programme({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const {programmes}=await getSiteContent();const p=programmes.find(p=>p.slug===slug);if(!p)notFound();return <><PageIntro eyebrow={p.category} title={p.title} description={p.description}/><section className="page-content"><div className="container"><div className="activity-hero"><TrustImage src={p.image} alt={p.name+' programme'}/><div><h2>{p.name}</h2><p className="programme-description">{p.body}</p><p>Every contribution starts with a conversation. Speak with our team about current needs and how you can take part.</p><Link href={`/contact?subject=${encodeURIComponent(p.name)}`} className="button">Ask about this programme</Link></div></div><section className="programme-in-pictures" aria-label="Programme photographs"><div className="programme-pictures-heading"><h2>The work in pictures</h2><Link href="/gallery" className="outlined-link">Explore gallery</Link></div><div className="programme-picture-grid">{programmePhotos(slug).slice(0,8).map(photo=><Link key={photo.src} href={'/gallery?photo='+encodeURIComponent(photo.src)} aria-label={'View '+photo.caption}><TrustImage src={photo.src} alt={photo.caption} loading="lazy" sizes="(max-width:600px) 90vw,30vw"/></Link>)}</div></section><Link href="/our-work" className="text-link">Explore all our programmes</Link></div></section><JoinBanner/></>}
