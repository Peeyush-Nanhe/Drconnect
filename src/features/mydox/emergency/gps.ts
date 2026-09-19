import {locationFromPosition} from '../ambulance/location';
import type {DeviceLocation} from '../ambulance/location';
export const PICKUP_TIMEOUT_MS=5500;
/** Permission denial, unsupported GPS and the 5.5s deadline resolve null, never a fake pin. */
export function capturePickup(geo:Geolocation|undefined=typeof navigator==='undefined'?undefined:navigator.geolocation,timeout=PICKUP_TIMEOUT_MS):Promise<DeviceLocation|null>{
 return new Promise(resolve=>{
  let finished=false;
  const end=(location:DeviceLocation|null)=>{if(!finished){finished=true;clearTimeout(timer);resolve(location);}};
  const timer=setTimeout(()=>end(null),timeout);
  if(!geo){end(null);return;}
  try{geo.getCurrentPosition(p=>{try{end(locationFromPosition(p));}catch{end(null);}},()=>end(null),{enableHighAccuracy:true,maximumAge:0,timeout});}
  catch{end(null);}
 });
}
