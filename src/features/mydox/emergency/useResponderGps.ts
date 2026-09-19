import {useEffect,useRef,useState} from 'react';
import {command} from './api';
import {useDeviceLocation} from '../ambulance/useDeviceLocation';
import {isFreshLocation} from '../ambulance/location';
import type {EmergencyController} from './useEmergency';
import type {Portal} from './model';
/** Foreground implementation. Native background location is a separate, unimplemented adapter. */
export function useResponderGps(controller:EmergencyController,kind:Portal,onDuty:boolean){
 const active=controller.data?.cases.find(c=>c.state==='open'&&!!c.ambulance_id&&c.ambulance_status!=='handed_over');
 const resource=controller.data?.resources.find(r=>r.kind===kind);const resourceId=resource?.id;
 const gps=useDeviceLocation(kind==='ambulance'&&controller.userId?`emergency-crew:${controller.userId}`:null,kind==='ambulance'&&(onDuty||!!active));
 const [error,setError]=useState<string|null>(null);
 const latest=useRef({controller,kind,onDuty,active,resource,gps});latest.current={controller,kind,onDuty,active,resource,gps};
 const run=useRef<()=>void>(()=>{});
 useEffect(()=>{
  if(!controller.userId||!resourceId||!['hospital','doctor','ambulance'].includes(kind))return;
  const actor=controller.userId;let done=false,busy=false,lastCapture='';let abort:AbortController|null=null;
  let lastAt=0;
  async function publish(force=false){
   const s=latest.current;
   if(done||busy||document.hidden||s.controller.userId!==actor||Date.now()-lastAt<(force?0:10_000))return;
   busy=true;lastAt=Date.now();abort=new AbortController();
   const point=s.gps.fresh&&isFreshLocation(s.gps.location)?s.gps.location:null;
   try{
    await command('heartbeat',{kind,enabled:s.onDuty,expected_actor:actor,...(kind==='ambulance'&&point?{lat:point.lat,lng:point.lng,captured_at:point.capturedAt}:{})},abort.signal);
    if(s.active&&point&&s.active.state==='open'&&point.capturedAt!==lastCapture){
     await command('position',{case_id:s.active.id,expected_actor:actor,lat:point.lat,lng:point.lng,accuracy_m:point.accuracy,captured_at:point.capturedAt},abort.signal);lastCapture=point.capturedAt;
    }
    if(!done)setError(null);
   }catch(e){if(!done&&s.controller.userId===actor)setError(e instanceof Error?e.message:'GPS/availability update failed.');}
   finally{busy=false;}
  }
  const refresh=()=>{void publish(true);};run.current=refresh;refresh();
  const tick=setInterval(()=>{void publish();},10_000);
  const visibility=()=>{if(document.hidden)abort?.abort();else refresh();};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('online',refresh);
  return()=>{done=true;abort?.abort();clearInterval(tick);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',refresh);if(run.current===refresh)run.current=()=>{};};
 },[controller.userId,resourceId,kind]);
 useEffect(()=>{run.current();},[onDuty,active?.id]);
 return {gps,error};
}
