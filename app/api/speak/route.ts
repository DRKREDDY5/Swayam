import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { getGuide } from '@/lib/guides';
import type { EnvConfig } from '@/lib/agent';
const Schema=z.object({guideId:z.string(),step:z.number().int().min(0).max(20),language:z.enum(['te','en'])}).strict();
export async function POST(req:Request){
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Request origin rejected.'},{status:403});
 const e=env as EnvConfig;if(!e.ELEVENLABS_API_KEY||!e.ELEVENLABS_VOICE_ID)return Response.json({error:'Cloud voice is not configured.'},{status:503});
 try{const raw=await req.text();if(raw.length>1000)throw Error();const p=Schema.parse(JSON.parse(raw));const g=getGuide(p.guideId);if(!g?.steps[p.step])throw Error();
  const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(e.ELEVENLABS_VOICE_ID)}`,{method:'POST',headers:{'xi-api-key':e.ELEVENLABS_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({text:g.steps[p.step][p.language],model_id:'eleven_v3',language_code:p.language}),signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error();return new Response(r.body,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Audio is unavailable. Please use the displayed steps.'},{status:502});}
}
