import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {MAX_INPUT,type EnvConfig} from '@/lib/agent';
import {answerQuestion} from '@/lib/answers';
import {limitedBody,requestGuard,sessionFor,signSpeech,verifySpeech} from '@/lib/server-safety';
const Schema=z.object({message:z.string().trim().min(1).max(MAX_INPUT),language:z.enum(['te','en']),guideId:z.string().max(30).optional(),step:z.number().int().min(0).max(20).optional(),history:z.array(z.string().max(MAX_INPUT)).max(4).optional(),mode:z.enum(['auto','guided']).optional(),contextToken:z.string().max(20000).optional()}).strict();
export async function POST(req:Request){
 const e=env as EnvConfig;const rejected=await requestGuard(req,'ask',!!e.FIREWORKS_API_KEY);if(rejected)return rejected;
 try{const raw=await limitedBody(req,42000);const parsed=Schema.parse(JSON.parse(new TextDecoder().decode(raw)));const {contextToken,...input}=parsed;const session=sessionFor(req);const secret=e.FIREWORKS_API_KEY||e.ELEVENLABS_API_KEY;let priorAnswer: {text:string;language:'te'|'en'}|undefined;
 if(contextToken&&secret){try{priorAnswer=await verifySpeech(contextToken,session.id,secret);}catch{/* Expired or invalid context is not trusted or reused. */}}
 const answer=await answerQuestion({...input,priorAnswer},e);
 if(answer.kind!=='guide'&&secret)answer.speechToken=await signSpeech(answer.message,input.language,session.id,secret);
 const headers:Record<string,string>={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};if(session.cookie)headers['Set-Cookie']=session.cookie;return Response.json(answer,{headers});
 }catch(err){return Response.json({error:'Please send a short question without private details.'},{status:err instanceof Error&&err.message==='too-large'?413:400,headers:{'Cache-Control':'no-store'}});}
}
