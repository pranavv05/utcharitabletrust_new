'use client';
import Image from 'next/image';
import Link from 'next/link';
import {useRef} from 'react';
import {gsap,useGSAP} from '@/lib/motion';

export function Hero(){
 const scope=useRef<HTMLElement>(null);
 useGSAP(()=>{const mm=gsap.matchMedia();mm.add('(prefers-reduced-motion: no-preference)',()=>{
  gsap.from('.bright-hero-line>span',{yPercent:110,rotate:2,duration:1,stagger:.12,ease:'power4.out'});
  gsap.from('.bright-hero-meta,.bright-hero-copy,.bright-hero-actions,.bright-hero-foot',{opacity:0,y:20,duration:.8,stagger:.1,delay:.3,ease:'power3.out'});
  gsap.from('.hero-main-frame',{opacity:0,y:45,rotate:5,duration:1.1,ease:'power3.out',delay:.15});
  gsap.from('.hero-small-frame,.hero-note',{opacity:0,y:30,scale:.94,duration:.9,stagger:.12,delay:.45,ease:'back.out(1.2)'});
  gsap.to('.hero-main-frame',{yPercent:7,ease:'none',scrollTrigger:{trigger:scope.current,start:'top top',end:'bottom top',scrub:1}});
 });return()=>mm.revert()},{scope});
 return <section ref={scope} className="chapter bright-hero" id="purpose" aria-labelledby="hero-heading"><div className="experience-container bright-hero-grid">
  <div className="bright-hero-text"><div className="bright-hero-meta"><span className="hero-community-dot"/> ROOTED IN SILVASSA. OPEN TO EVERYONE.</div><h1 id="hero-heading"><span className="bright-hero-line"><span>Humanity.</span></span><span className="bright-hero-line"><span>In <em>action.</em></span></span></h1><p className="bright-hero-copy">For every child with a dream. For every family finding its way. For the community we call home.</p><div className="bright-hero-actions"><Link href="/join" className="bright-button">Be part of the change</Link><Link href="/our-work" className="bright-secondary">Discover our work</Link></div><div className="bright-hero-foot"><span className="hero-colour-mark" aria-hidden="true"><i/><i/><i/><i/></span><p>Small acts of care.<br/><strong>A world of possibility.</strong></p></div></div>
  <div className="bright-hero-visual"><div className="hero-sun" aria-hidden="true"/><figure className="hero-main-frame"><div className="hero-main-image"><Image src="/images/banner.webp" alt="UT Charitable Trust with children and families in its community" fill priority sizes="(max-width: 760px) 90vw, 48vw" quality={85}/></div><figcaption><span>People at the heart of it all.</span><span className="photo-caption-dot" aria-hidden="true"/></figcaption></figure><figure className="hero-small-frame"><div><Image src="/images/stationary/stationary3.webp" alt="Children taking part in the trust’s education activities" fill sizes="(max-width: 760px) 38vw, 19vw"/></div><figcaption>Room to learn. Space to grow.</figcaption></figure><div className="hero-note"><span aria-hidden="true">✳</span><p>A little care.<br/><strong>A lasting difference.</strong></p></div><span className="hero-spark" aria-hidden="true">✳</span></div>
 </div><a className="bright-scroll" href="#community"><span aria-hidden="true"/>Explore the good we can do together</a></section>
}
