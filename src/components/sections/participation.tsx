'use client';
import { useRef } from 'react';
import Link from 'next/link';
import {BrandLogo} from '@/components/brand-logo';
import { gsap, useGSAP } from '@/lib/motion';
const steps = [
 {title:'Find your way to help.',text:'Explore our programmes. Choose something that matters to you, from education to everyday essentials.',href:'/our-work',link:'Explore our work'},
 {title:'Start a conversation.',text:'Tell our team about your time, your skills, or a book you would like to donate.',href:'/contact',link:'Talk to the trust'},
 {title:'Make it happen. Together.',text:'Join our community of members and volunteers. Turn a shared intention into practical support.',href:'/join',link:'Become a member'},
];
export function Participation() {
 const scope=useRef<HTMLElement>(null);
 useGSAP(()=>{const mm=gsap.matchMedia();mm.add('(prefers-reduced-motion: no-preference)',()=>{gsap.fromTo('.journey-line-fill',{scaleY:0},{scaleY:1,ease:'power1.inOut',scrollTrigger:{trigger:'.journey-steps',start:'top 65%',end:'bottom 65%',scrub:.5}});gsap.utils.toArray<HTMLElement>('.journey-step').forEach(step=>{gsap.from(step,{opacity:.3,y:20,duration:.8,ease:'power3.out',scrollTrigger:{trigger:step,start:'top 85%',toggleActions:'play none none reverse'}});});});return()=>mm.revert();},{scope});
 return <section ref={scope} id="take-part" className="chapter participation-chapter"><div className="experience-container participation-grid"><div className="participation-heading"><span className="chapter-tag">TAKE PART</span><h2>It starts<br/>with <em>you.</em></h2><p>You don’t need to do something extraordinary. Sometimes, showing up is where it begins.</p><div className="participation-logo"><BrandLogo/></div></div><div className="journey-steps"><div className="journey-line"><span className="journey-line-fill"/></div>{steps.map((step,index)=><article className="journey-step" key={step.title}><span className="journey-number">0{index+1}</span><div><h3>{step.title}</h3><p>{step.text}</p><Link className="draw-link" href={step.href}>{step.link}</Link></div></article>)}</div></div></section>;
}
