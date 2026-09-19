import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import type {Json} from '@/integrations/supabase/types';
import {getDashboard,command} from './api';
import type {Dashboard,Portal} from './model';
export function useEmergency(kind:Portal){
 const [identity,setIdentity]=useState<string|null>(null),[authReady,setAuthReady]=useState(false);
 const [record,setRecord]=useState<{user:string;kind:Portal;data:Dashboard;at:number}|null>(null);
 const [error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const live=useRef({identity,kind});live.current={identity,kind};const refreshRef=useRef<()=>void>(()=>{}),writeLock=useRef(false);
 useEffect(()=>{
  let done=false,authVersion=0;
  let subscription:{unsubscribe():void}|undefined;
  const apply=(id:string|null)=>{if(!done){setAuthReady(true);if(live.current.identity===id){refreshRef.current();return;}setIdentity(id);setRecord(null);setError(null);}};
  const failure=(message:string)=>{if(!done){setAuthReady(true);setLoading(false);setError(message);}};
  const timeout=setTimeout(()=>{if(authVersion===0)failure('Could not verify your sign-in. Call for help; reload when connected.');},15_000);
  try {
   const auth=supabase.auth;
   void auth.getUser().then(({data,error:e})=>{
    clearTimeout(timeout);
    if(done||authVersion!==0)return; // An auth event is newer than this network response.
    apply(data.user?.id??null);
    if(e)failure('Please sign in again. Emergency calls remain available.');
   }).catch(()=>{clearTimeout(timeout);if(authVersion===0)failure('Could not verify your sign-in. Call for help; reload when connected.');});
   subscription=auth.onAuthStateChange((event,session)=>{
    if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event)){authVersion++;clearTimeout(timeout);apply(session?.user.id??null);}
   }).data.subscription;
  } catch(e) {clearTimeout(timeout);failure(e instanceof Error?e.message:'Dispatch sign-in is not configured. Call for help.');}
  return()=>{done=true;authVersion++;clearTimeout(timeout);subscription?.unsubscribe();};
 },[]);
 useEffect(()=>{
  if(!identity){setLoading(!authReady);return;}
  setLoading(true);
  let done=false,pending=false,again=false;let abort:AbortController|null=null;
  const scope=`${kind}:${identity}`;
  async function load(){
   if(done||document.hidden)return;
   if(pending){again=true;return;}pending=true;abort=new AbortController();
   try{const d=await getDashboard(kind,abort.signal);
    if(!done&&`${live.current.kind}:${live.current.identity}`===scope&&d.user_id===identity){setRecord({user:identity!,kind,data:d,at:Date.now()});setError(null);}
   }catch(e){if(!done)setError(e instanceof Error?e.message:'Dispatch connection unavailable.');}
   finally{pending=false;if(!done)setLoading(false);if(again&&!done){again=false;queueMicrotask(()=>{void load();});}}
  }
  const refresh=()=>{void load();};refreshRef.current=refresh;refresh();
  const channel=supabase.channel(`emergency:${scope}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'emergency_notifications',filter:`user_id=eq.${identity}`},refresh)
   .on('postgres_changes',{event:'*',schema:'public',table:'emergency_cases'},refresh)
   .on('postgres_changes',{event:'*',schema:'public',table:'emergency_positions'},refresh)
   .on('postgres_changes',{event:'*',schema:'public',table:'emergency_offers',filter:`recipient_id=eq.${identity}`},refresh)
   .subscribe(status=>{if(status==='SUBSCRIBED')refresh();});
  const poll=setInterval(refresh,5_000);
  const offline=()=>setError('Offline. Showing the last confirmed status; no new assignment is confirmed.');
  window.addEventListener('online',refresh);window.addEventListener('offline',offline);document.addEventListener('visibilitychange',refresh);
  return()=>{done=true;abort?.abort();clearInterval(poll);void supabase.removeChannel(channel);window.removeEventListener('online',refresh);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',refresh);if(refreshRef.current===refresh)refreshRef.current=()=>{};};
 },[identity,kind,authReady]);
 const act=useCallback(async(action:string,payload:Record<string,Json>)=>{
  if(writeLock.current)throw new Error('An action is already being confirmed.');
  const actor=live.current.identity;if(!actor)throw new Error('Sign in to continue.');
  writeLock.current=true;setBusy(true);setError(null);
  try{const result=await command(action,{...payload,expected_actor:actor});
   if(live.current.identity!==actor)throw new Error('The signed-in account changed. Reopen this case.');
   refreshRef.current();return result;
  }catch(e){if(live.current.identity===actor)setError(e instanceof Error?e.message:'Could not confirm action.');refreshRef.current();throw e;}
  finally{writeLock.current=false;setBusy(false);}
 },[]);
 return {userId:identity,data:record?.user===identity&&record?.kind===kind?record.data:null,syncedAt:record?.user===identity?record.at:null,
  authReady,loading,busy,error,act,refresh:()=>refreshRef.current()};
}
export type EmergencyController=ReturnType<typeof useEmergency>;
