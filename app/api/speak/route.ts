import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {getGuide} from '@/lib/guides';
import {privacyReason,type EnvConfig} from '@/lib/agent';
import {limitedBody,requestGuard,sessionFor,verifySpeech} from '@/lib/server-safety';
const Schema=z.union([z.object({guideId:z.string().max(30),step:z.number().int().min(0).max(20),language:z.enum(['te','en'])}).strict(),z.object({speechToken:z.string().max(20000)}).strict()]);
export async function POST(req:Request){
 const e=env as EnvConfig;const rejected=await requestGuard(req,'speak',!!e.ELEVENLABS_API_KEY);if(rejected)return rejected;
 if(!e.ELEVENLABS_API_KEY||!e.ELEVENLABS_VOICE_ID)return Response.json({error:'Cloud voice is not configured.'},{status:503});
 try{const raw=await limitedBody(req,21000);const p=Schema.parse(JSON.parse(new TextDecoder().decode(raw)));let text:string,language:'te'|'en';
 if('speechToken' in p){const secret=e.FIREWORKS_API_KEY||e.ELEVENLABS_API_KEY;if(!secret)throw Error();const signed=await verifySpeech(p.speechToken,sessionFor(req).id,secret);text=signed.text;language=signed.language;}
 else{const g=getGuide(p.guideId);if(!g?.steps[p.step])throw Error();text=g.steps[p.step][p.language];language=p.language;}
 if(privacyReason(text))throw Error();
 const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(e.ELEVENLABS_VOICE_ID)}`,{method:'POST',headers:{'xi-api-key':e.ELEVENLABS_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({text,model_id:'eleven_v3',language_code:language}),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error();return new Response(r.body,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Audio could not be played. Ask again or use the displayed answer.'},{status:422,headers:{'Cache-Control':'no-store'}});}
}
