'use client';
import {FitPhoto} from '@/components/ui/fit-photo';
import Image from 'next/image';
import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/motion';
const scenes = [
  { title: 'Opportunity should have no barriers.', text: 'A school bag. A set of books. The everyday things that help a child stay curious and keep learning.', image: '/images/stationary/stationary3.webp', label: 'EDUCATION & OPPORTUNITY' },
  { title: 'Care should always be within reach.', text: 'Community blood donation and practical medical support bring people together when it matters.', image: '/images/blood/blood12.webp', label: 'HEALTH & WELLBEING' },
  { title: 'Dignity belongs to everyone.', text: 'Food, clothing, and support through changing seasons. Small acts that make everyday life a little better.', image: '/images/cloth/cloth6.webp', label: 'EVERYDAY ESSENTIALS' },
];
export function CommunityStory() {
  const scope = useRef<HTMLElement>(null);
  useGSAP(() => {
    const mm=gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)',()=>{
      gsap.utils.toArray<HTMLElement>('.context-scene',scope.current).forEach(scene=>{
        gsap.from(scene,{opacity:0,y:35,duration:.85,ease:'power3.out',scrollTrigger:{trigger:scene,start:'top 88%',once:true}});
        gsap.from(scene.querySelectorAll('.context-copy>*'),{opacity:0,y:18,duration:.7,stagger:.09,ease:'power3.out',scrollTrigger:{trigger:scene,start:'top 80%',once:true}});
      });
    });
    mm.add('(min-width:900px) and (prefers-reduced-motion: no-preference)',()=>{
      gsap.utils.toArray<HTMLElement>('.context-photo img',scope.current).forEach(image=>gsap.fromTo(image,{scale:1.08,yPercent:-3},{scale:1.02,yPercent:3,ease:'none',scrollTrigger:{trigger:image.parentElement,start:'top bottom',end:'bottom top',scrub:1}}));
    });
    return()=>mm.revert();
  },{scope});
  return <section ref={scope} className="chapter context-chapter" id="community" aria-labelledby="community-title"><div className="experience-container context-heading"><span className="chapter-tag">THE COMMUNITY</span><h2 id="community-title">Real needs.<br/><em>Human responses.</em></h2></div><div className="context-scenes">{scenes.map((scene) => <article className="context-scene" key={scene.label}><div className="context-photo"><FitPhoto src={scene.image} alt={scene.label.toLowerCase()+' activity by UT Charitable Trust'} sizes="(max-width: 899px) 100vw, 52vw"/></div><div className="context-copy"><p className="overline">{scene.label}</p><h3>{scene.title}</h3><p>{scene.text}</p><span className="context-rule"/></div></article>)}</div></section>;
}
