'use client';
import {useMemo,useState} from 'react';
import {TrustImage} from './ui/trust-image';
import type {SiteContent} from '@/lib/site-content';
const rank=(role:string)=>role==='Chairman'?0:role==='Advisory Board Chairman'?1:role==='President'?2:/president|chair|trustee|secretary|treasurer|director/i.test(role)?3:10;
export function TeamDirectory({team}:{team:SiteContent['team']}){
 const[role,setRole]=useState('Leadership');const[sort,setSort]=useState('seniority');
 const roles=useMemo(()=>Array.from(new Set(team.map(p=>p.role))).sort((a,b)=>rank(a)-rank(b)||a.localeCompare(b)),[team]);
 const people=team.filter(p=>role==='Leadership'?rank(p.role)<10:p.role===role).toSorted((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='name-desc'?b.name.localeCompare(a.name):rank(a.role)-rank(b.role));
 return <div className="team-directory"><div className="directory-toolbar"><div className="team-role-filters" role="group" aria-label="Filter members by role">{['Leadership',...roles].map(r=><button className={r===role?'active':''} key={r} aria-pressed={r===role} onClick={()=>setRole(r)}>{r==='Trust member'?'Trust members':r}</button>)}</div><label>Sort by<select value={sort} onChange={e=>setSort(e.target.value)}><option value="seniority">Leadership order</option><option value="name">Name: A–Z</option><option value="name-desc">Name: Z–A</option></select></label></div><div className="directory-heading"><h2>{role==='Leadership'?'Guiding the trust':role==='Trust member'?'Our trust members':role}</h2><p>{role==='Leadership'?'Meet the people leading our shared purpose. Select a role above to discover the wider team.':'The people contributing their time, care and commitment to our work.'}</p></div><div className="team-grid" aria-live="polite">{people.map((m,i)=><article className="team-card" key={m.name+i}><TrustImage src={m.image} alt={m.name} loading="lazy"/><h3>{m.name}</h3><p>{m.role}</p></article>)}</div>{!people.length&&<p>No published profiles for this role yet.</p>}</div>
}
