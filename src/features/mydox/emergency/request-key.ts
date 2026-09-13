/** Cryptographically generated idempotency key; older WebViews may lack randomUUID. */
export function newRequestKey(source:Crypto|undefined=globalThis.crypto):string {
 if(source?.randomUUID)return source.randomUUID();
 if(!source?.getRandomValues)throw new Error('This browser cannot create a secure request identifier. Call for help and reopen the app in a supported browser.');
 const bytes=source.getRandomValues(new Uint8Array(16));
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
