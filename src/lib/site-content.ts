import {cache} from 'react';
import {serverClient} from '@/lib/supabase/server';
import {programmes,gallery} from '@/lib/content';
import team from '@/lib/team.json';
import {photoDetails,photoCategory} from './photos';
export type SiteContent={programmes:typeof programmes;gallery:typeof gallery;team:typeof team;announcements:{id:string;name:string;body:string;link:string}[]};
type Entry={id:string;kind:string;slug:string;name:string;data:Record<string,string>};
export const getSiteContent=cache(async():Promise<SiteContent>=>{const fallback={programmes,gallery,team,announcements:[]};const db=await serverClient();if(!db)return fallback;const {data,error}=await db.rpc('website_content');if(error||!Array.isArray(data))throw Error('Published website content is temporarily unavailable.');const rows=data as Entry[];return {
 programmes:rows.filter(r=>r.kind==='programme').map(r=>({slug:r.slug,name:r.name,title:r.data.title||r.name,category:r.data.category||'Community',description:r.data.description||'',body:r.data.body||'',image:r.data.image,color:['blue','red','green','yellow'].includes(r.data.color)?r.data.color:'blue'})),
 gallery:rows.filter(r=>r.kind==='gallery').map(r=>({src:r.data.image,category:photoCategory(r.data.category||'Community'),caption:r.name,description:r.data.description||photoDetails(r.data.image,r.data.category).description,href:r.data.link||photoDetails(r.data.image,r.data.category).href})),
 team:rows.filter(r=>r.kind==='team').map(r=>({name:r.name,role:r.data.role||'',image:r.data.image})),
 announcements:rows.filter(r=>r.kind==='announcement').map(r=>({id:r.id,name:r.name,body:r.data.body||'',link:r.data.link||''}))};});
