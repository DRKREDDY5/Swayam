import { env } from 'cloudflare:workers';
import { privacyReason, type EnvConfig } from '@/lib/agent';
export async function POST(req:Request){
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Request origin rejected.'},{status:403});
 const e=env as EnvConfig;if(!e.ELEVENLABS_API_KEY)return Response.json({error:'Cloud transcription is not configured.'},{status:503});
 if(Number(req.headers.get('content-length')||0)>3000000)return Response.json({error:'Recording is too large.'},{status:413});
 try{const form=await req.formData();const file=form.get('audio');if(!(file instanceof File)||file.size>2500000||!/^audio\/(webm|ogg|mp4|wav|mpeg)/.test(file.type))return Response.json({error:'Use a short audio recording.'},{status:400});
  const body=new FormData();body.append('file',file);body.append('model_id','scribe_v2');body.append('language_code',form.get('language')==='en'?'eng':'tel');body.append('tag_audio_events','false');
  const r=await fetch('https://api.elevenlabs.io/v1/speech-to-text',{method:'POST',headers:{'xi-api-key':e.ELEVENLABS_API_KEY},body,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error();const d=await r.json() as {text?:string};const text=String(d.text||'').slice(0,1200);
  if(privacyReason(text))return Response.json({error:'Private numbers were detected. Please ask again without Aadhaar numbers, OTPs or PINs.'},{status:422});
  return Response.json({text},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Could not understand the recording. Please try again or select a task.'},{status:502});}
}
