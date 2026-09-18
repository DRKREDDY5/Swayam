import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { runAgent, MAX_INPUT, type EnvConfig } from '@/lib/agent';
const Schema=z.object({message:z.string().trim().min(1).max(MAX_INPUT),language:z.enum(['te','en']),guideId:z.string().max(30).optional(),step:z.number().int().min(0).max(20).optional()}).strict();
export async function POST(req:Request){
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Request origin rejected.'},{status:403});
 const raw=await req.text();if(raw.length>6000)return Response.json({error:'Question is too long.'},{status:413});
 try{const input=Schema.parse(JSON.parse(raw));const answer=await runAgent(input,env as EnvConfig);return Response.json(answer,{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'Please send a short question and choose Telugu or English.'},{status:400});}
}
