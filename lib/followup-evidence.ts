import type {Source} from './answers';
import type {Evidence} from './evidence';

/** Public source material only; never stores a question, answer or recording.
 * A hash of the session-bound signed capability partitions access. Callers must
 * verify that capability before reading. Misses (including a different Worker
 * isolate) fall back to retrieval. This is an optimization, not durable state. */
export type ReviewedEvidence={category:string;query:string;sources:Source[];evidence:Evidence[];retrievedAtMs:number};
export const EVIDENCE_TTL_MS=10*60*1000;
const MAX_ENTRIES=64;
const cache=new Map<string,ReviewedEvidence>();
const eligible=new Set(['general','food','culture']);
export function reusableEvidence(bundle:ReviewedEvidence,now=Date.now()){
 return eligible.has(bundle.category)&&Number.isFinite(bundle.retrievedAtMs)&&now>=bundle.retrievedAtMs&&now-bundle.retrievedAtMs<EVIDENCE_TTL_MS&&bundle.sources.length>0&&bundle.evidence.length>0;
}
export function isSimplification(message:string){
 return /^(?:please\s+)?(?:simplify(?:\s+(?:that|it|this))?|(?:explain|say)(?:\s+(?:that|it|this))?\s+(?:more simply|in simpler (?:terms|words))|make (?:that|it|this) simpler|ఇంకా సులభంగా చెప్పండి|మరింత సులభంగా చెప్పండి)[.!?\s]*$/iu.test(message.trim());
}
async function cacheKey(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function rememberEvidence(token:string,bundle:ReviewedEvidence){
 const now=Date.now();if(!reusableEvidence(bundle,now))return;
 for(const [key,value] of cache)if(!reusableEvidence(value,now))cache.delete(key);
 while(cache.size>=MAX_ENTRIES)cache.delete(cache.keys().next().value!);
 cache.set(await cacheKey(token),structuredClone(bundle));
}
export async function recalledEvidence(verifiedToken:string){
 const key=await cacheKey(verifiedToken);const bundle=cache.get(key);
 if(!bundle)return undefined;
 if(!reusableEvidence(bundle)){cache.delete(key);return undefined;}
 return structuredClone(bundle);
}
