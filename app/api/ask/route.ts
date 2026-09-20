import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {MAX_INPUT,type EnvConfig} from '@/lib/agent';
import {answerQuestion} from '@/lib/answers';
import {createAnswerDiagnostics} from '@/lib/answer-diagnostics';
import {limitedBody,requestGuard,sessionFor,signSpeech,verifySpeech} from '@/lib/server-safety';
import {recalledEvidence,rememberEvidence,type ReviewedEvidence} from '@/lib/followup-evidence';
const Schema=z.object({message:z.string().trim().min(1).max(MAX_INPUT),language:z.enum(['te','en']),guideId:z.string().max(30).optional(),step:z.number().int().min(0).max(20).optional(),history:z.array(z.string().max(MAX_INPUT)).max(4).optional(),mode:z.enum(['auto','guided']).optional(),contextToken:z.string().max(20000).optional()}).strict();
export async function POST(req:Request){
 const e=env as EnvConfig;const rejected=await requestGuard(req,'ask',!!e.FIREWORKS_API_KEY);if(rejected)return rejected;
 try{const raw=await limitedBody(req,42000);const parsed=Schema.parse(JSON.parse(new TextDecoder().decode(raw)));const {contextToken,...input}=parsed;const session=sessionFor(req);const secret=e.FIREWORKS_API_KEY||e.ELEVENLABS_API_KEY;let priorAnswer: {text:string;language:'te'|'en'}|undefined;
 let previous:ReviewedEvidence|undefined;let reviewed:ReviewedEvidence|undefined;
 if(contextToken&&secret){try{priorAnswer=await verifySpeech(contextToken,session.id,secret);previous=await recalledEvidence(contextToken);}catch{/* Expired or invalid context is not trusted or reused. */}}
 // Only local development responses expose this content-free trace. No raw
 // requests, provider payloads, credentials, cookies or signed tokens enter it.
 const diagnostics=typeof process!=='undefined'&&process.env.NODE_ENV==='development'&&['localhost','127.0.0.1','[::1]'].includes(new URL(req.url).hostname)?createAnswerDiagnostics(req.headers.get('X-Swayam-Test-Case')||undefined):undefined;
 const answer=await answerQuestion({...input,priorAnswer},e,fetch,diagnostics,req.signal,{previous,onReviewed:bundle=>{reviewed=bundle;}});
 const responseFinished=diagnostics?.begin('response');
 // Audio is optional: signing failure must never discard a reviewed written answer.
 if(answer.kind!=='guide'&&secret){try{answer.speechToken=await signSpeech(answer.message,input.language,session.id,secret);}catch{/* Return the written answer without an audio capability. */}}
 if(answer.kind==='answer'&&answer.speechToken&&reviewed){try{await rememberEvidence(answer.speechToken,reviewed);}catch{/* A cache failure must not hide the written answer. */}}
 responseFinished?.();
 const headers:Record<string,string>={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};if(session.cookie)headers['Set-Cookie']=session.cookie;return Response.json({...answer,...(diagnostics?{diagnostics:diagnostics.snapshot()}:{})},{headers});
 }catch(err){return Response.json({error:'Please send a short question without private details.'},{status:err instanceof Error&&err.message==='too-large'?413:400,headers:{'Cache-Control':'no-store'}});}
}
