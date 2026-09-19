import type { DeviceLocation } from '../ambulance/location';
export type Portal = 'patient' | 'hospital' | 'doctor' | 'ambulance' | 'admin';
export type Category = 'cardiac' | 'stroke' | 'trauma' | 'breath' | 'pregnancy' | 'other';
export type Transport = 'ambulance' | 'self';
export type CrewStatus = 'not_requested' | 'searching' | 'accepted' | 'en_route' | 'arrived' | 'transporting' | 'handed_over';
export interface Resource { id:string;owner_id:string;kind:Exclude<Portal,'patient'|'admin'>;label:string;categories:Category[];enabled:boolean;hospital_ref:string|null;lat:number|null;lng:number|null;heartbeat_at:string|null; }
export interface Offer { id:string;case_id:string;resource_id:string;kind:Resource['kind'];category:Category;stage:string;distance_km:number|null;expires_at:string|null;hospital_label:string|null;created_at:string; }
export interface Event { event:string;version:number;created_at:string;detail:Record<string,unknown>; }
export interface Position {case_id:string;resource_id:string;lat:number;lng:number;accuracy_m:number;captured_at:string;received_at:string;}
export interface Case {
 id:string;patient_id:string;request_key:string;category:Category;triage:{question:string;answer:string}[];
 transport:Transport;patient_name:string;phone:string|null;pickup_text:string;
 pickup_lat:number|null;pickup_lng:number|null;pickup_accuracy_m:number|null;pickup_captured_at:string|null;
 location_status:'gps'|'verified'|'needs_location';state:'open'|'admitted'|'cancelled';
 hospital_id:string|null;hospital_accepted_at:string|null;bed_label:string|null;bed_assigned_at:string|null;
 doctor_id:string|null;doctor_accepted_at:string|null;doctor_stage:string;preferred_deadline:string|null;
 ambulance_id:string|null;ambulance_accepted_at:string|null;ambulance_status:CrewStatus;
 en_route_at:string|null;pickup_arrived_at:string|null;transporting_at:string|null;handed_over_at:string|null;
 admitted_at:string|null;cancelled_at:string|null;version:number;radius_km:number;needs_attention:boolean;updated_at:string;created_at:string;
 hospital:{id:string;label:string;lat:number|null;lng:number|null}|null;
 doctor:{id:string;label:string}|null;ambulance:{id:string;label:string}|null;
 position:Position|null;events:Event[];
}
export interface Notice {id:string;case_id:string;title:string;created_at:string;read_at:string|null;}
export interface Dashboard {
 user_id:string;admin:boolean;enabled:boolean;worker_checked_at:string|null;
 profile:{name:string|null;phone:string|null}|null;resources:Resource[];offers:Offer[];cases:Case[];notifications:Notice[];
 hospitals:{id:string;name:string;lat:number|null;lng:number|null;emergency:boolean}[];
 accounts:{id:string;name:string;view:string;role:string}[];
 doctors:{id:string;label:string;categories:Category[]}[];
 roster:{hospital_id:string;doctor_id:string;category:Category;preferred:boolean;enabled:boolean}[];
 bays:{hospital_id:string;label:string;case_id:string|null;state:string}[];
}
export const LABELS:Record<Category,string>={cardiac:'Cardiac / Chest pain',stroke:'Brain / Stroke',trauma:'Ortho / Trauma',breath:'Chest / Breathing',pregnancy:'Pregnancy / Obstetrics',other:'Something else'};
export const CREW_LABELS:Record<CrewStatus,string>={not_requested:'Not requested · self transport',searching:'Waiting for an ambulance',accepted:'Ambulance accepted',en_route:'Ambulance en route to pickup',arrived:'Ambulance arrived at pickup',transporting:'Transporting to hospital',handed_over:'Crew reports handover complete'};
export const NEXT_CREW:Partial<Record<CrewStatus,CrewStatus>>={accepted:'en_route',en_route:'arrived',arrived:'transporting',transporting:'handed_over'};
export function milestones(c:Case) {
 return [
  {label:'Emergency request saved',at:c.created_at},
  {label:c.hospital?`${c.hospital.label} accepted`:'Hospital acceptance',at:c.hospital_accepted_at},
  {label:c.bed_label?`Bed / bay: ${c.bed_label}`:'Bed / bay assigned',at:c.bed_assigned_at},
  {label:c.doctor?`${c.doctor.label} accepted`:'Specialist acceptance',at:c.doctor_accepted_at},
  ...(c.transport==='ambulance'?[
   {label:'Ambulance accepted',at:c.ambulance_accepted_at},{label:'En route to pickup',at:c.en_route_at},
   {label:'Arrived at pickup',at:c.pickup_arrived_at},{label:'Transporting',at:c.transporting_at},
   {label:'Crew handover recorded',at:c.handed_over_at}]:[]),
  {label:'Hospital confirmed admission',at:c.admitted_at}
 ]; // Check each timestamp independently; never assume earlier rows happened.
}
export function casePickup(c:Case):DeviceLocation|null {
 if(c.pickup_lat===null||c.pickup_lng===null)return null;
 return {lat:c.pickup_lat,lng:c.pickup_lng,accuracy:c.pickup_accuracy_m??0,capturedAt:c.pickup_captured_at||c.created_at};
}
export function vehiclePoint(c:Case):DeviceLocation|null {
 const p=c.position;if(!p)return null;
 return {lat:p.lat,lng:p.lng,accuracy:p.accuracy_m,capturedAt:p.captured_at};
}
export function positionIsLive(c:Case,now=Date.now()) {
 const p=c.position;return !!p && c.state==='open' && c.ambulance_status!=='handed_over' &&
 now-Date.parse(p.captured_at)<=30_000 && now-Date.parse(p.received_at)<=30_000 && now-Date.parse(p.captured_at)>=-5000;
}
