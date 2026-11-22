import {NextResponse} from 'next/server';
import {serverClient} from '@/lib/supabase/server';
import {authRequestSchema} from '@/lib/admin/auth-validation';
import {sameOrigin} from '@/lib/validation';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({message:'Request not allowed.'},{status:403});
 const db=await serverClient();if(!db)return NextResponse.json({message:'Authentication is not configured.'},{status:503});
 let body;try{const result=authRequestSchema.safeParse(await request.json());if(!result.success)return NextResponse.json({message:'Invalid authentication request.'},{status:400});body=result.data}catch{return NextResponse.json({message:'Invalid request.'},{status:400})}
 if(body.action==='logout'){await db.auth.signOut();return NextResponse.json({ok:true})}
 if(body.action==='password'){
  const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({message:'Sign in first.'},{status:401});
  if(typeof body.current!=='string'||typeof body.password!=='string'||body.password.length<10||body.password.length>200)return NextResponse.json({message:'Use a new password of at least 10 characters.'},{status:400});
  const {error:check}=await db.auth.signInWithPassword({email:user.email!,password:body.current});if(check)return NextResponse.json({message:'Current password is incorrect.'},{status:400});
  const {error}=await db.auth.updateUser({password:body.password});if(error)return NextResponse.json({message:'Unable to update password. Check the account password requirements.'},{status:400});
  return NextResponse.json({ok:true});
 }
 if(typeof body.email!=='string'||typeof body.password!=='string'||body.email.length>254||body.password.length>200)return NextResponse.json({message:'Enter your email and password.'},{status:400});
 const {error}=await db.auth.signInWithPassword({email:body.email.trim(),password:body.password});
 if(error)return NextResponse.json({message:'Sign-in failed. Check your details or try again later.'},{status:401});
 const {data:{user}}=await db.auth.getUser();const {data:staff}=await db.from('staff').select('name,role').eq('user_id',user?.id).eq('active',true).maybeSingle();
 if(!staff){await db.auth.signOut();return NextResponse.json({message:'This account has not been granted staff access. Contact your administrator.'},{status:403})}
 return NextResponse.json({ok:true});
}
