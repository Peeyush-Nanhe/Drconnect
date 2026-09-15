import assert from 'node:assert/strict';
import {before,after,beforeEach,test} from 'node:test';
import {fixture} from './emergency-fixture.mjs';
let f;
before(async()=>{f=await fixture();await f.cmd(f.admin,'enable',{enabled:true});});
after(()=>f.db.close());
beforeEach(async()=>{await f.db.exec("update public.emergency_cases set state='cancelled' where state='open';update emergency_private.resources set enabled=false;update emergency_private.bays set case_id=null,state='available';");});
const tick=()=>f.actor(null,'select public.emergency_run_due()',[],'service_role');
const snap=async(p,c)=>(await f.actor(p,'select public.emergency_snapshot($1) as data',[c])).rows[0].data;
const setup=async(transport='ambulance')=>{const h=await f.resource('hospital'),a=await f.resource('ambulance'),d=await f.resource('doctor'),p=await f.user();await f.cmd(h.owner,'roster',{hospital_id:h.id,doctor_id:d.id,category:'cardiac',preferred:true});const c=await f.create(p,{transport});return{h,a,d,p,c};};

test('public dispatch tables have RLS and cannot be written directly by a patient',async()=>{
 const p=await f.user();for(const table of ['emergency_cases','emergency_offers','emergency_events','emergency_notifications','emergency_positions']){
  const q=await f.db.query('select relrowsecurity from pg_class where oid=$1::regclass',[`public.${table}`]);assert.equal(q.rows[0].relrowsecurity,true);
  await assert.rejects(f.actor(p,`delete from public.${table}`),/permission denied/);
 }
});
test('anonymous RPC and private table access are refused',async()=>{
 await assert.rejects(f.actor(null,"select public.emergency_dashboard('patient')",[],'anon'),/permission denied/);
 const p=await f.user();await assert.rejects(f.actor(p,'select * from emergency_private.resources'),/permission denied/);
 await assert.rejects(f.actor(p,'select emergency_private.tick()'),/permission denied/);
 await assert.rejects(f.actor(p,'select public.emergency_run_due()'),/permission denied/);
});
test('patient cannot configure resources or enable dispatch',async()=>{
 const p=await f.user();await assert.rejects(f.cmd(p,'configure_resource',{kind:'ambulance',owner_id:p,label:'X',categories:['cardiac']}),/administrator/);
 await assert.rejects(f.cmd(p,'enable',{enabled:true}),/Admin/);
});
test('admin cannot configure an unapproved account or treat another provider subtype as an ambulance',async()=>{
 const p=await f.user('ambulance',false);await assert.rejects(f.cmd(f.admin,'configure_resource',{kind:'ambulance',owner_id:p,label:'X',categories:['cardiac']}),/approval/);
 const doc=await f.user('doctor');await assert.rejects(f.cmd(f.admin,'configure_resource',{kind:'ambulance',owner_id:doc,label:'X',categories:['cardiac']}),/approval/);
});
test('no timers or submitted acceptance fields assign responders when a case is created',async()=>{
 const {p,c}=await setup();const current=await snap(p,c.id);assert.equal(current.state,'open');assert.equal(current.hospital_id,null);assert.equal(current.ambulance_id,null);assert.equal(current.doctor_id,null);assert.equal(current.ambulance_status,'searching');
 assert.ok(current.events.some(e=>e.event==='sent'));
});
test('duplicate request keys and concurrent-looking retries recover the same patient case without extra events',async()=>{
 const p=await f.user(),key=f.uuid();const a=await f.create(p,{request_key:key});const b=await f.create(p,{request_key:key});const c=await f.create(p);
 assert.equal(a.id,b.id);assert.equal(c.id,a.id);assert.equal(a.events.length,b.events.length);
});
test('patient phone defaults to the saved profile rather than invented contact details',async()=>{
 const p=await f.user();await f.db.query("update public.profiles set phone='+918888888888' where id=$1",[p]);const c=await f.create(p);assert.equal(c.phone,'+918888888888');
});
test('missing GPS still saves a case, alerts operators and does not invent nearby offers',async()=>{
 const h=await f.resource('hospital'),a=await f.resource('ambulance'),p=await f.user();const c=await f.create(p,{lat:null,lng:null,accuracy_m:null,captured_at:null,pickup_text:'Caller-provided test address'});
 assert.equal(c.location_status,'needs_location');assert.equal(c.needs_attention,true);assert.equal((await f.dash(h.owner,'hospital')).offers.length,0);assert.equal((await f.dash(a.owner,'ambulance')).offers.length,0);
 const notices=(await f.dash(f.admin,'admin')).notifications;assert.ok(notices.some(n=>n.case_id===c.id));
});
test('patient can resolve a missing pickup but another patient cannot',async()=>{
 const h=await f.resource('hospital'),p=await f.user(),stranger=await f.user();const c=await f.create(p,{lat:null,lng:null,accuracy_m:null,captured_at:null});
 await assert.rejects(f.cmd(stranger,'confirm_pickup',{case_id:c.id,lat:18.52,lng:73.85,reason:'test'}),/denied/);
 const saved=await f.cmd(p,'confirm_pickup',{case_id:c.id,lat:18.52,lng:73.85,reason:'Patient confirms'});assert.equal(saved.location_status,'verified');assert.ok(await f.offer(h.owner,'hospital',c.id));
});
test('GPS invalid ranges and stale capture timestamps fail, not substituted locations',async()=>{
 await assert.rejects(f.create(await f.user(),{lat:100}),/check constraint/);
 await assert.rejects(f.create(await f.user(),{captured_at:'2000-01-01T00:00:00Z'}),/expired/);
});
test('self transport creates hospital offers and then specialist offers, never ambulance offers',async()=>{
 const {h,a,d,p,c}=await setup('self');assert.equal(c.ambulance_status,'not_requested');assert.ok(await f.offer(h.owner,'hospital',c.id));assert.equal(await f.offer(a.owner,'ambulance',c.id),undefined);
 await f.accept(h,c.id);assert.ok(await f.offer(d.owner,'doctor',c.id));await f.accept(d,c.id);assert.equal((await snap(p,c.id)).transport,'self');
});
test('4 km hospital radius excludes distant hospitals and emergency-off hospitals',async()=>{
 const h=await f.resource('hospital',{lat:18.565}),off=await f.resource('hospital');await f.cmd(off.owner,'heartbeat',{kind:'hospital',enabled:false});const p=await f.user(),c=await f.create(p);
 assert.equal(await f.offer(h.owner,'hospital',c.id),undefined);assert.equal(await f.offer(off.owner,'hospital',c.id),undefined);
});
test('server worker expands by 1 km per minute and caps at 15 km without a patient screen',async()=>{
 const h=await f.resource('hospital',{lat:18.565}),p=await f.user(),c=await f.create(p);
 await f.db.query("update public.emergency_cases set search_started_at=clock_timestamp()-interval '125 seconds' where id=$1",[c.id]);await tick();assert.equal((await snap(p,c.id)).radius_km,6);assert.ok(await f.offer(h.owner,'hospital',c.id));
 await f.db.query("update public.emergency_cases set search_started_at=clock_timestamp()-interval '30 minutes' where id=$1",[c.id]);await tick();assert.equal((await snap(p,c.id)).radius_km,15);assert.equal((await snap(p,c.id)).needs_attention,true);
});
test('wrong category and stale ambulance heartbeat cannot receive offers',async()=>{
 const h=await f.resource('hospital'),a=await f.resource('ambulance');await f.db.query("update emergency_private.resources set categories='{stroke}' where id=$1",[h.id]);await f.db.query("update emergency_private.resources set heartbeat_at=clock_timestamp()-interval '5 minutes' where id=$1",[a.id]);
 const c=await f.create(await f.user());assert.equal(await f.offer(h.owner,'hospital',c.id),undefined);assert.equal(await f.offer(a.owner,'ambulance',c.id),undefined);
});
test('hospital acceptance has one winner; a second eligible hospital cannot overwrite it',async()=>{
 const h=await f.resource('hospital'),second=await f.resource('hospital'),p=await f.user(),c=await f.create(p),o=await f.offer(second.owner,'hospital',c.id);
 await f.accept(h,c.id);await assert.rejects(f.cmd(second.owner,'accept',{case_id:c.id,offer_id:o.id}),/already assigned/);assert.equal((await snap(p,c.id)).hospital_id,h.id);
});
test('ambulance first accept works independently before hospital acceptance',async()=>{
 const {h,a,p,c}=await setup();const other=await f.resource('ambulance');await tick();const losing=await f.offer(other.owner,'ambulance',c.id);
 const saved=await f.accept(a,c.id);assert.equal(saved.hospital_id,null);assert.equal(saved.ambulance_id,a.id);
 await assert.rejects(f.cmd(other.owner,'accept',{case_id:c.id,offer_id:losing.id}),/already assigned/);
 await f.cmd(a.owner,'ambulance_status',{case_id:c.id,status:'en_route'});assert.equal((await snap(p,c.id)).en_route_at!==null,true);assert.ok(await f.offer(h.owner,'hospital',c.id));
});
test('same ambulance cannot claim a second open case even with a previously delivered offer',async()=>{
 const a=await f.resource('ambulance'),p1=await f.user(),p2=await f.user(),c1=await f.create(p1),c2=await f.create(p2);const o2=await f.offer(a.owner,'ambulance',c2.id);
 await f.accept(a,c1.id);await assert.rejects(f.cmd(a.owner,'accept',{case_id:c2.id,offer_id:o2.id}),/unique|duplicate/);assert.equal((await snap(p2,c2.id)).ambulance_id,null);
});
test('preferred doctor only, then immediate wider facility pool after rejection',async()=>{
 const {h,d,c}=await setup(),backup=await f.resource('doctor');await f.cmd(h.owner,'roster',{hospital_id:h.id,doctor_id:backup.id,category:'cardiac',preferred:false});await f.accept(h,c.id);
 const preferred=await f.offer(d.owner,'doctor',c.id);assert.equal(preferred.stage,'preferred');assert.equal(await f.offer(backup.owner,'doctor',c.id),undefined);
 await f.cmd(d.owner,'decline',{case_id:c.id,offer_id:preferred.id});assert.equal((await f.offer(backup.owner,'doctor',c.id)).stage,'broadcast');
});
test('server timeout expires preferred offer, so a late preferred accept cannot steal the broadcast',async()=>{
 const {h,d,p,c}=await setup(),backup=await f.resource('doctor');await f.cmd(h.owner,'roster',{hospital_id:h.id,doctor_id:backup.id,category:'cardiac',preferred:false});await f.accept(h,c.id);const o=await f.offer(d.owner,'doctor',c.id);
 await f.db.query("update public.emergency_cases set preferred_deadline=clock_timestamp()-interval '1 second' where id=$1",[c.id]);await tick();await assert.rejects(f.cmd(d.owner,'accept',{case_id:c.id,offer_id:o.id}),/expired/);await f.accept(backup,c.id);assert.equal((await snap(p,c.id)).doctor_id,backup.id);
});
test('no preferred specialist goes directly to the relevant hospital broadcast pool',async()=>{
 const h=await f.resource('hospital'),d=await f.resource('doctor'),p=await f.user(),c=await f.create(p);await f.cmd(h.owner,'roster',{hospital_id:h.id,doctor_id:d.id,category:'cardiac',preferred:false});await f.accept(h,c.id);assert.equal((await f.offer(d.owner,'doctor',c.id)).stage,'broadcast');
});
test('two broadcast doctors cannot both win the same specialist assignment',async()=>{
 const h=await f.resource('hospital'),d1=await f.resource('doctor'),d2=await f.resource('doctor');for(const d of [d1,d2])await f.cmd(h.owner,'roster',{hospital_id:h.id,doctor_id:d.id,category:'cardiac',preferred:false});const p=await f.user(),c=await f.create(p);await f.accept(h,c.id);const o2=await f.offer(d2.owner,'doctor',c.id);await f.accept(d1,c.id);await assert.rejects(f.cmd(d2.owner,'accept',{case_id:c.id,offer_id:o2.id}),/already assigned/);assert.equal((await snap(p,c.id)).doctor_id,d1.id);
});
test('hospital can accept multiple cases but cannot reserve the same normalized bay twice',async()=>{
 const h=await f.resource('hospital'),p1=await f.user(),p2=await f.user(),c1=await f.create(p1),c2=await f.create(p2);await f.accept(h,c1.id);await f.accept(h,c2.id);
 await f.cmd(h.owner,'assign_bay',{case_id:c1.id,label:'ER  1'});await assert.rejects(f.cmd(h.owner,'assign_bay',{case_id:c2.id,label:'er 1'}),/already reserved/);
 await f.cmd(h.owner,'assign_bay',{case_id:c2.id,label:'ER 2'});assert.equal((await snap(p2,c2.id)).bed_label,'ER 2');
});
test('patient cannot self-assign bed, mark admission or progress an ambulance',async()=>{
 const {h,a,p,c}=await setup();await f.accept(h,c.id);await f.accept(a,c.id);
 await assert.rejects(f.cmd(p,'assign_bay',{case_id:c.id,label:'X'}),/Only receiving hospital/);
 await assert.rejects(f.cmd(p,'admit',{case_id:c.id,note:'Here'}),/receiving hospital/);
 await assert.rejects(f.cmd(p,'ambulance_status',{case_id:c.id,status:'en_route'}),/Assigned ambulance/);
});
test('missing assignment fails closed instead of nullable authorization bypass',async()=>{
 const p=await f.user(),c=await f.create(p);await assert.rejects(f.cmd(p,'assign_bay',{case_id:c.id,label:'X'}),/receiving hospital/);await assert.rejects(f.cmd(p,'admit',{case_id:c.id,note:'Here'}),/receiving hospital/);await assert.rejects(f.cmd(p,'position',{case_id:c.id,lat:18.5,lng:73.8,captured_at:new Date().toISOString(),accuracy_m:10}),/assigned ambulance/);
});
test('trip stages are explicit, ordered and transport needs an accepted hospital',async()=>{
 const {a,h,p,c}=await setup();await f.accept(a,c.id);await assert.rejects(f.cmd(a.owner,'ambulance_status',{case_id:c.id,status:'arrived'}),/Invalid/);await f.cmd(a.owner,'ambulance_status',{case_id:c.id,status:'en_route'});await f.cmd(a.owner,'ambulance_status',{case_id:c.id,status:'arrived'});await assert.rejects(f.cmd(a.owner,'ambulance_status',{case_id:c.id,status:'transporting'}),/hospital/);await f.accept(h,c.id);await f.cmd(a.owner,'ambulance_status',{case_id:c.id,status:'transporting'});assert.equal((await snap(p,c.id)).state,'open');
});
test('self transport admission needs hospital confirmation, not ambulance or specialist completion',async()=>{
 const {h,p,c}=await setup('self');await f.accept(h,c.id);const saved=await f.cmd(h.owner,'admit',{case_id:c.id,note:'Hospital confirms actual patient admission'});assert.equal(saved.state,'admitted');assert.equal(saved.ambulance_id,null);assert.equal(saved.doctor_id,null);assert.equal((await snap(p,c.id)).doctor_stage,'stopped');
});
test('crew handover is not admission and does not release an occupied bed',async()=>{
 const {h,a,p,c}=await setup();await f.accept(h,c.id);await f.accept(a,c.id);await f.cmd(h.owner,'assign_bay',{case_id:c.id,label:'Bed 1'});for(const status of ['en_route','arrived','transporting','handed_over'])await f.cmd(a.owner,'ambulance_status',{case_id:c.id,status});assert.equal((await snap(p,c.id)).state,'open');
 await f.cmd(h.owner,'admit',{case_id:c.id,note:'Hospital admission confirmed'});assert.equal((await f.dash(h.owner,'hospital')).bays.find(b=>b.case_id===c.id).state,'occupied');await f.cmd(h.owner,'release_bay',{hospital_id:h.id,label:'Bed 1'});assert.equal((await f.dash(h.owner,'hospital')).bays.find(b=>b.label==='Bed 1').state,'available');
});
test('cancellation withdraws pending offers and blocks stale acceptance',async()=>{
 const {h,p,c}=await setup(),offer=await f.offer(h.owner,'hospital',c.id);await f.cmd(p,'cancel',{case_id:c.id,reason:'Synthetic duplicate request'});await assert.rejects(f.cmd(h.owner,'accept',{case_id:c.id,offer_id:offer.id}),/expired|assigned/);assert.equal((await snap(p,c.id)).state,'cancelled');
});
test('GPS publisher is restricted to assigned crew, preserves pickup and never changes trip state',async()=>{
 const {a,h,p,c}=await setup();await f.accept(a,c.id);const payload={case_id:c.id,lat:18.521,lng:73.851,accuracy_m:15,captured_at:new Date().toISOString()};await assert.rejects(f.cmd(p,'position',payload),/assigned ambulance/);await f.cmd(a.owner,'position',payload);const cur=await snap(p,c.id);assert.equal(cur.position.lat,18.521);assert.equal(cur.pickup_lat,18.52);assert.equal(cur.ambulance_status,'accepted');assert.equal(cur.hospital_id,null);
});
test('newer GPS wins; stale/future/out-of-range samples are rejected',async()=>{
 const {a,p,c}=await setup();await f.accept(a,c.id);const now=new Date().toISOString();await f.cmd(a.owner,'position',{case_id:c.id,lat:18.5,lng:73.8,accuracy_m:10,captured_at:now});await f.cmd(a.owner,'position',{case_id:c.id,lat:18.4,lng:73.7,accuracy_m:10,captured_at:now});assert.equal((await snap(p,c.id)).position.lat,18.5);
 for(const payload of [{lat:91,captured_at:now},{lat:18,captured_at:'2000-01-01T00:00:00Z'},{lat:18,captured_at:'2099-01-01T00:00:00Z'}])await assert.rejects(f.cmd(a.owner,'position',{case_id:c.id,lng:73,accuracy_m:10,...payload}),/rejected|constraint/);
});
test('strangers cannot read case, audit events, GPS or another user notification',async()=>{
 const {a,p,c}=await setup();await f.accept(a,c.id);const stranger=await f.user();await assert.rejects(snap(stranger,c.id),/denied/);
 for(const t of ['emergency_cases','emergency_events','emergency_positions'])assert.deepEqual((await f.actor(stranger,`select * from public.${t}`)).rows,[]);
 assert.deepEqual((await f.actor(stranger,'select * from public.emergency_notifications')).rows,[]);
});
test('revoking existing account approval prevents further crew status/GPS access',async()=>{
 const {a,p,c}=await setup();await f.accept(a,c.id);await f.actor(null,"update public.account_role_requests set status='rejected' where user_id=$1",[a.owner],'service_role');
 await assert.rejects(f.cmd(a.owner,'ambulance_status',{case_id:c.id,status:'en_route'}),/denied/);await assert.rejects(f.dash(a.owner,'ambulance'),/approved/);assert.equal((await snap(p,c.id)).ambulance_status,'accepted');
});
test('failed assignment rolls back event and notification writes; accepted retry does not duplicate them',async()=>{
 const {h,p,c}=await setup();const o=await f.offer(h.owner,'hospital',c.id);await f.cmd(h.owner,'accept',{case_id:c.id,offer_id:o.id});const before=(await snap(p,c.id)).events.length;
 await f.cmd(h.owner,'accept',{case_id:c.id,offer_id:o.id});assert.equal((await snap(p,c.id)).events.length,before);
 const rows=await f.db.query('select user_id,dedupe_key,count(*) from public.emergency_notifications group by user_id,dedupe_key having count(*)>1');assert.equal(rows.rows.length,0);
});
test('old ambulance creation is blocked after V2 cutover',async()=>{
 const p=await f.user();await assert.rejects(f.actor(p,"insert into public.ambulance_requests(patient_id,pickup) values($1,'Synthetic test pickup')",[p]),/upgraded/);
});

test('identity changed after the UI captured its actor is rejected before a write',async()=>{
 const p=await f.user(),other=await f.user();await assert.rejects(f.cmd(p,'create',{expected_actor:other,request_key:f.uuid(),category:'cardiac',transport:'self'}),/Account changed/);
});
test('malformed triage cannot poison responder screen rendering',async()=>{
 const p=await f.user();for(const triage of [[null],[{question:5,answer:'yes'}],[{question:'Q',answer:{x:1}}]])await assert.rejects(f.create(p,{triage}),/Invalid triage/);
});
test('admin cannot silently replace active receiving hospital details',async()=>{
 const {h,c}=await setup();await f.accept(h,c.id);
 await assert.rejects(f.cmd(f.admin,'configure_resource',{kind:'hospital',owner_id:h.owner,hospital_ref:h.hospital_ref,categories:['cardiac']}),/Resolve active assignments/);
});
