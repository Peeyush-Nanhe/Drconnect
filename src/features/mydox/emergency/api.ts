import {supabase} from '@/integrations/supabase/client';
import type {Json} from '@/integrations/supabase/types';
import type {Dashboard,Portal,Case} from './model';
// Narrow transport contract prevents dynamic-name inference over the app's large schema.
const transport = supabase as unknown as {
 rpc(name: 'emergency_dashboard'|'emergency_snapshot'|'emergency_command',args:Record<string,Json>): {
  abortSignal(signal:AbortSignal):PromiseLike<{data:Json|null;error:{code:string;message:string}|null}>;
 };
};
async function rpc(name:'emergency_dashboard'|'emergency_snapshot'|'emergency_command',args:Record<string,Json>,signal?:AbortSignal) {
 const deadline=new AbortController();const timeout=setTimeout(()=>deadline.abort(),15_000);
 const abort=()=>deadline.abort(); signal?.addEventListener('abort',abort,{once:true});
 if(signal?.aborted) deadline.abort();
 try {
  const {data,error}=await transport.rpc(name,args).abortSignal(deadline.signal);
  if(error){
   if(['PGRST202','42P01'].includes(error.code))throw new Error('Coordinated dispatch is not installed in this project. Apply the new emergency database setup; do not rerun old ambulance scripts.');
   if(error.code==='23505')throw new Error('This responder or bed is already committed. Refresh the case before continuing.');
   throw new Error(error.message||'Dispatch could not be confirmed. Refresh before retrying.');
  }
  if(data===null||typeof data!=='object'||Array.isArray(data))throw new Error('No confirmed database response. Refresh the case.');
  return data;
 } finally {clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
export async function getDashboard(kind:Portal,signal?:AbortSignal):Promise<Dashboard>{
 const d=await rpc('emergency_dashboard',{p_kind:kind},signal);
 if(typeof d.user_id!=='string'||!Array.isArray(d.cases)||!Array.isArray(d.offers))throw new Error('Unexpected emergency dashboard response.');
 return d as unknown as Dashboard;
}
export async function getCase(id:string,signal?:AbortSignal):Promise<Case>{
 const d=await rpc('emergency_snapshot',{p_case_id:id},signal);
 if(d.id!==id)throw new Error('Case response did not match the requested case.');
 return d as unknown as Case;
}
export async function command(action:string,payload:Record<string,Json>,signal?:AbortSignal){
 return rpc('emergency_command',{p_action:action,p_payload:payload},signal);
}
