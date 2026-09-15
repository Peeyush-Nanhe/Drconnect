import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
export async function fixture() {
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,phone text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 create publication supabase_realtime;`);
 const dir=new URL('../staging/supabase/migrations/',import.meta.url);
 for (const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,dir),'utf8'));
 await db.exec(await readFile(new URL('../supabase/manual/AMBULANCE_MANUAL_ACCEPTANCE.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../database/emergency/01_dispatch_core.sql',import.meta.url),'utf8'));
 let sequence=0; const uuid=()=>`50000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`;
 async function actor(u,sql,params=[],role='authenticated') {
  return db.transaction(async tx=>{
   await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[u||'',role]);
   await tx.exec(`set local role ${role}`);return tx.query(sql,params);
  });
 }
 async function user(kind='patient',approved=true) {
  const id=uuid(),role=kind==='hospital'?'facility':kind==='admin'?'admin':kind==='patient'?'patient':'provider',view={hospital:'hub',doctor:'medico',ambulance:'ambulance'}[kind];
  await db.query('insert into auth.users(id,email,phone,raw_user_meta_data) values($1,$2,$3,$4)',[id,`${id}@example.invalid`,'+919000000000',{role,subtype:view,full_name:`Synthetic ${kind} ${sequence}`}]);
  if(kind==='admin') await db.query("insert into public.user_roles(user_id,role) values($1,'admin') on conflict do nothing",[id]);
  if(approved && view) {
   await db.query('insert into public.user_roles(user_id,role) values($1,$2::public.app_role) on conflict do nothing',[id,role]);
   await actor(null,"update public.account_role_requests set status='approved' where user_id=$1",[id],'service_role');
  }
  return id;
 }
 const admin=await user('admin');
 async function cmd(u,action,p={}) { return (await actor(u,'select public.emergency_command($1,$2) as data',[action,p])).rows[0].data; }
 const dash=async(u,kind='patient')=>(await actor(u,'select public.emergency_dashboard($1) as data',[kind])).rows[0].data;
 async function resource(kind,opts={}) {
  const owner=await user(kind,opts.approved!==false); const config={kind,owner_id:owner,label:`Synthetic ${kind}`,categories:['cardiac','stroke','trauma','breath','pregnancy','other']};
  if(kind==='hospital') {config.hospital_ref=uuid();await db.query("insert into public.hospitals(id,name,area,lat,lng,emergency) values($1,'Synthetic hospital','Test area',$2,$3,true)",[config.hospital_ref,opts.lat??18.52,opts.lng??73.85]);}
  const row=await cmd(admin,'configure_resource',config);
  await cmd(owner,'heartbeat',{kind,enabled:true,...(kind==='ambulance'?{lat:opts.lat??18.52,lng:opts.lng??73.85,captured_at:new Date().toISOString()}: {})});
  return {...row,owner};
 }
 const create=async(patient,extra={})=>cmd(patient,'create',{request_key:uuid(),category:'cardiac',triage:[{question:'Test question',answer:'Test answer'}],transport:'ambulance',lat:18.52,lng:73.85,accuracy_m:20,captured_at:new Date().toISOString(),...extra});
 const offer=async(owner,kind,cid)=>(await dash(owner,kind)).offers.find(x=>x.case_id===cid);
 const accept=async(res,cid)=>cmd(res.owner,'accept',{case_id:cid,offer_id:(await offer(res.owner,res.kind,cid))?.id});
 return {db,uuid,actor,user,admin,cmd,dash,resource,create,offer,accept};
}
