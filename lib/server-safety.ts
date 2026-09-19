// Server-only helpers. Counts contain no conversation text; limits are best-effort per Worker isolate.
const counters=new Map<string,{start:number;count:number}>();
export async function limitedBody(req:Request,max:number){
 if(Number(req.headers.get('content-length')||0)>max)throw Error('too-large');
 const reader=req.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Error('too-large');}chunks.push(value);}}finally{reader.releaseLock();}
 const out=new Uint8Array(size);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length;}return out;
}
export async function requestGuard(req:Request,bucket:string,paid:boolean){
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Request origin rejected.'},{status:403,headers:{'Cache-Control':'no-store'}});
 if(req.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Request origin rejected.'},{status:403});
 if(!paid)return null;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(req.headers.get('cf-connecting-ip')||'private-local'));
 const key=bucket+Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');const now=Date.now();
 if(counters.size>1000)counters.clear();const v=counters.get(key);if(!v||now-v.start>3600000){counters.set(key,{start:now,count:1});return null;}
 if(v.count>=120)return Response.json({error:'Please pause and try again later.'},{status:429,headers:{'Retry-After':'3600','Cache-Control':'no-store'}});v.count++;return null;
}
export function sessionFor(req:Request){const existing=req.headers.get('cookie')?.match(/(?:^|;\s*)swayam_session=([a-f0-9-]{36})(?:;|$)/)?.[1];const id=existing||crypto.randomUUID();return {id,cookie:existing?null:`swayam_session=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600${new URL(req.url).protocol==='https:'?'; Secure':''}`};}
const enc=new TextEncoder();
function b64(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function unb64(text:string){return Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
async function signingKey(secret:string){return crypto.subtle.importKey('raw',enc.encode('swayam-answer-audio-v1:'+secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function signSpeech(text:string,language:'te'|'en',session:string,secret:string){const body=b64(enc.encode(JSON.stringify({text,language,session,exp:Date.now()+900000})));const sig=await crypto.subtle.sign('HMAC',await signingKey(secret),enc.encode(body));return body+'.'+b64(new Uint8Array(sig));}
export async function verifySpeech(token:string,session:string,secret:string){
 if(token.length>20000)throw Error('invalid-token');const parts=token.split('.');if(parts.length!==2)throw Error('invalid-token');const [body,sig]=parts;
 if(!await crypto.subtle.verify('HMAC',await signingKey(secret),unb64(sig),enc.encode(body)))throw Error('invalid-token');
 const data=JSON.parse(new TextDecoder().decode(unb64(body)));if(data.session!==session||data.exp<Date.now()||data.exp>Date.now()+910000||typeof data.text!=='string'||data.text.length>3500||!['te','en'].includes(data.language))throw Error('invalid-token');return data as {text:string;language:'te'|'en'};
}
