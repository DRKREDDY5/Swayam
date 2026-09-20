"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Mic, Square, ArrowRight, ArrowLeft, ShieldCheck, Volume2, RotateCcw, ExternalLink, Send, Check, X, Keyboard, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { GUIDES, SOURCES, ACTIONS, getGuide, type Language } from "@/lib/guides";
import { privacyReason, safeAuditText } from "@/lib/agent";
import { GREETING } from '@/lib/greeting';
import { IndiaFlag } from '@/components/india-flag';
import type {AnswerDecision as Decision} from '@/lib/answers';
const topicArt:Record<string,{emoji:string;tone:string;hint:{te:string;en:string}}>={
 lpg:{emoji:'🔥',tone:'peach',hint:{te:'అధికారిక మార్గం',en:'Official routes'}},
 'chicken-biryani':{emoji:'🍲',tone:'saffron',hint:{te:'వంటింట్లో కొత్త రుచి',en:'Something delicious'}},
 whatsapp:{emoji:'💬',tone:'mint',hint:{te:'ఫొటో పంచుకుందాం',en:'Share a little moment'}},
 kitchenware:{emoji:'🥘',tone:'blue',hint:{te:'మీ వంటింటికి',en:'For your kitchen'}},
 sarees:{emoji:'🥻',tone:'rose',hint:{te:'మీకు నచ్చిన శైలి',en:'Find your next favourite'}},
 schemes:{emoji:'🏛️',tone:'blue',hint:{te:'పథకాలు తెలుసుకుందాం',en:'Explore official information'}},
 'land-rights':{emoji:'⚖️',tone:'mint',hint:{te:'న్యాయ సహాయం వైపు',en:'Understand where to turn'}},
 ganesh:{emoji:'🪔',tone:'saffron',hint:{te:'కథ, సంప్రదాయం, చరిత్ర',en:'A story to discover'}},
 aadhaar:{emoji:'🪪',tone:'peach',hint:{te:'UIDAI సేవలు',en:'UIDAI services'}},
 digilocker:{emoji:'📂',tone:'blue',hint:{te:'పత్రాలకు దారి',en:'Find your documents'}},
 pension:{emoji:'🤝',tone:'mint',hint:{te:'Jeevan Pramaan',en:'Jeevan Pramaan'}},
 'lemon-rice':{emoji:'🍋',tone:'saffron',hint:{te:'సులభమైన వంటకం',en:'A familiar favourite'}},
 festivals:{emoji:'🎊',tone:'rose',hint:{te:'మరిన్ని సంప్రదాయాలు',en:'More celebrations'}}
};
const topicOrder=['lpg','chicken-biryani','whatsapp','kitchenware','sarees','schemes','land-rights','ganesh','aadhaar','digilocker','pension','lemon-rice','festivals'];
const groups=[{id:'all',en:'All topics',te:'అన్ని'},{id:'services',en:'Everyday help',te:'రోజువారీ సహాయం'},{id:'home',en:'Home & shopping',te:'ఇల్లు, షాపింగ్'},{id:'culture',en:'Stories & festivals',te:'కథలు, పండుగలు'}];
function groupOf(category:string){return ['kitchen','shopping'].includes(category)?'home':category==='culture'?'culture':'services';}
type SpeechEvent={results:{[key:number]:{[key:number]:{transcript:string}}}};
type Recognizer={lang:string;continuous:boolean;interimResults:boolean;onstart:(()=>void)|null;onresult:((e:SpeechEvent)=>void)|null;onerror:((e:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void};
type SpeechWindow=Window & {SpeechRecognition?:new()=>Recognizer;webkitSpeechRecognition?:new()=>Recognizer};
const copy={te:{greeting:'మీ మాటతో,',together:'మీ ముందడుగు.',sub:'మీ ప్రశ్న చెప్పండి. ఒక్కో అడుగు సులభంగా తెలుసుకోండి.',speak:'మాట్లాడండి',stop:'ఆపండి',choose:'దేనిలో సహాయం కావాలి?',type:'టైప్ చేయవచ్చు',placeholder:'ఉదా: నా గ్యాస్‌కు ఆధార్ KYC ఎలా చేయాలి?',ask:'అడగండి',listen:'వినండి',repeat:'మళ్లీ వినండి',next:'తర్వాతి అడుగు',back:'వెనుకకు',source:'ఈ సమాచారానికి ఆధారం',privacy:'ఆధార్ నంబర్, OTP లేదా PIN ఇక్కడ చెప్పవద్దు.',new:'కొత్త ప్రశ్న',heard:'మీ ప్రశ్న ఇలా వినిపించింది',confirm:'ఇదే నా ప్రశ్న',empty:'ఒక్కో అడుగుతో మరింత నమ్మకం.',emptysub:'వంటకం నుంచి రోజువారీ పనుల వరకు — మీ భాషలో, ఒక్కో అడుగుగా.',step:'అడుగు',of:'/',ready:'సిద్ధంగా ఉన్న మార్గదర్శకాలు',review:'చివరిగా చూసిన తేదీ',notice:'పని చేయడానికి సహాయం. అధికారిక సేవకు ప్రత్యామ్నాయం కాదు.',voiceTitle:'మాట్లాడే ముందు',voiceBody:'మీ మాటలు టెక్స్ట్‌గా మార్చడానికి వాయిస్ సేవకు వెళ్తాయి. ఆధార్ నంబర్, OTP లేదా PIN చెప్పవద్దు. రికార్డింగ్ ఈ యాప్‌లో నిల్వ చేయము. వాయిస్ సేవ తన నిబంధనల ప్రకారం నిల్వ చేయవచ్చు.',proceed:'సరే, మాట్లాడతాను',cancel:'వద్దు',open:'మూలం ఉన్న సైట్ తెరుస్తున్నారు',openBody:'ఆ సైట్‌లో పూర్తి సమాచారం చూడండి. అధికారిక సేవ అని నిర్ధారించుకున్న తర్వాతే వ్యక్తిగత వివరాలు నమోదు చేయండి.',finish:'విధానం చూశారు',finishBody:'ఇది మార్గదర్శకం మాత్రమే. అధికారిక పని పూర్తయిందని నిర్ధారణ కాదు.',readAll:'అన్ని అడుగులు చూడండి',close:'మూసివేయండి'},en:{greeting:'Your voice.',together:'Your next step.',sub:'Ask in your own words. Find a clear next step.',speak:'Speak your question',stop:'Stop recording',choose:'What would you like help with?',type:'Or type a question',placeholder:'Example: How do I do Aadhaar KYC for my gas connection?',ask:'Ask Swayam',listen:'Listen',repeat:'Listen again',next:'Next step',back:'Back',source:'Where this information comes from',privacy:'Keep Aadhaar numbers, OTPs and PINs out of this chat.',new:'New question',heard:'Here is what I heard',confirm:'Confirm and ask',empty:'A little guidance. More independence.',emptysub:'From a new recipe to an everyday task — in your language, at your pace.',step:'STEP',of:'OF',ready:'Available guides',review:'Last reviewed',notice:'Independent guidance. Not a government service.',voiceTitle:'Before you speak',voiceBody:'Your audio is sent to a speech service for transcription. Do not say Aadhaar numbers, OTPs or PINs. This app does not store your recording. The speech provider may retain it under your account settings.',proceed:'Continue and speak',cancel:'Cancel',open:'You are leaving Swayam',openBody:'Read the full source there. Check that it is the official service before entering any private details.',finish:'You have seen the steps',finishBody:'This is guidance, not confirmation that your official task is complete.',readAll:'View all steps',close:'Close'}};
const subscribeHydration=()=>()=>{};
export default function Home(){
 const [lang,setLang]=useState<Language>('te');
 const [draft,setDraft]=useState(''),[decision,setDecision]=useState<Decision|null>(null);
 const [question,setQuestion]=useState(''),[answeredQuestion,setAnsweredQuestion]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[requestError,setRequestError]=useState(''),[audioError,setAudioError]=useState('');
 const [requestOutcome,setRequestOutcome]=useState(''),[workSeconds,setWorkSeconds]=useState(0);
 const [playbackKind,setPlaybackKind]=useState<'greeting'|'answer'>('greeting'),[audioPhase,setAudioPhase]=useState<'idle'|'loading'|'playing'>('idle');
 const [voicePhase,setVoicePhase]=useState<'idle'|'permission'|'listening'|'transcribing'|'review'>('idle');
 const [transcript,setTranscript]=useState(''),[speaking,setSpeaking]=useState(false);
 const [voiceConsent,setVoiceConsent]=useState(false),[acceptedVoice,setAcceptedVoice]=useState(false);
 const [external,setExternal]=useState(''),[allSteps,setAllSteps]=useState(false),[showTyping,setShowTyping]=useState(true);
 const hydrated=useSyncExternalStore(subscribeHydration,()=>true,()=>false);
 const [statusLoaded,setStatusLoaded]=useState(false);
 const [status,setStatus]=useState({modelReady:false,searchReady:false,answersReady:false,transcriptionReady:false,speechReady:false});
 const history=useRef<string[]>([]),asking=useRef(false),voiceEpoch=useRef(0),askEpoch=useRef(0);
 const rec=useRef<Recognizer|null>(null),media=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null);
 const audio=useRef<HTMLAudioElement|null>(null),audioUrl=useRef<string|null>(null),recordTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const epoch=useRef(0),answerRef=useRef<HTMLElement|null>(null),transcriptRef=useRef<HTMLTextAreaElement|null>(null);
 const askController=useRef<AbortController|null>(null),transcribeController=useRef<AbortController|null>(null),audioController=useRef<AbortController|null>(null);
 const recording=voicePhase==='listening',voiceWorking=voicePhase==='permission'||recording||voicePhase==='transcribing';
 const c=copy[lang],guide=getGuide(decision?.guideId||''),step=decision?.step||0;
 useEffect(()=>{
  const statusController=new AbortController();
  fetch('/api/status',{signal:statusController.signal}).then(r=>r.json() as Promise<typeof status>).then(setStatus).catch(()=>{}).finally(()=>{if(!statusController.signal.aborted)setStatusLoaded(true);});
  return()=>{
   statusController.abort();voiceEpoch.current++;askEpoch.current++;epoch.current++;
   askController.current?.abort();transcribeController.current?.abort();audioController.current?.abort();
   if(rec.current){rec.current.onend=null;rec.current.onresult=null;rec.current.onerror=null;rec.current.stop();}
   if(media.current){media.current.onstop=null;if(media.current.state==='recording')media.current.stop();}
   stream.current?.getTracks().forEach(t=>t.stop());if(recordTimer.current)clearTimeout(recordTimer.current);
   window.speechSynthesis?.cancel();audio.current?.pause();if(audioUrl.current)URL.revokeObjectURL(audioUrl.current);
  };
 },[]);
 useEffect(()=>{if(voicePhase==='review'){transcriptRef.current?.focus();transcriptRef.current?.scrollIntoView({block:'nearest'});}},[voicePhase]);
 useEffect(()=>{if(!busy)return;const started=Date.now();const timer=setInterval(()=>setWorkSeconds(Math.floor((Date.now()-started)/1000)),1000);return()=>clearInterval(timer);},[busy]);
 function stopSpeech(){epoch.current++;audioController.current?.abort();audioController.current=null;window.speechSynthesis?.cancel();audio.current?.pause();if(audioUrl.current){URL.revokeObjectURL(audioUrl.current);audioUrl.current=null;}setSpeaking(false);setAudioPhase('idle');}
 function cancelAsk(){
  askEpoch.current++;askController.current?.abort();asking.current=false;setBusy(false);setRequestOutcome('cancelled');
  setRequestError(lang==='te'?'సమాధానం కోసం వెతకడం ఆపాను. మీ ప్రశ్నను మార్చవచ్చు లేదా మళ్లీ అడగవచ్చు.':'The request was stopped. You can edit your question or ask again.');
  setDraft(current=>current||question);
 }
 async function ask(text:string){
  const confirmed=text.trim();if(asking.current||voiceWorking||!confirmed)return;
  stopSpeech();stopRecording(true);setError('');setAudioError('');setRequestError('');setRequestOutcome('');setQuestion(safeAuditText(confirmed));setWorkSeconds(0);
  if(privacyReason(confirmed)){
   setDecision({kind:'blocked',message:c.privacy,reason:'client-privacy',engine:'rules'});setAnsweredQuestion(safeAuditText(confirmed));setTranscript('');setDraft('');setVoicePhase('idle');return;
  }
  asking.current=true;const generation=++askEpoch.current;const controller=new AbortController();askController.current=controller;
  setTranscript('');setVoicePhase('idle');setDraft('');setBusy(true);
  requestAnimationFrame(()=>answerRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
  try{
   const r=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({message:confirmed,language:lang,history:history.current.slice(-4),...(decision?.speechToken?{contextToken:decision.speechToken}:{}),...(guide?{guideId:guide.id,step}:{})})});
   const data=await r.json() as Decision;
   if(!r.ok||!['answer','guide','clarify','blocked','unsupported'].includes(data.kind)||typeof data.message!=='string')throw Error('answer-unavailable');
   if(askEpoch.current!==generation)return;
   if(data.outcome==='service-error'||data.outcome==='timeout'||data.outcome==='cancelled'||(data.kind==='unsupported'&&data.outcome==='insufficient-evidence')){setRequestOutcome(data.outcome);setRequestError(data.message);return;}
   setDecision(data);setAnsweredQuestion(safeAuditText(confirmed));if(data.kind==='answer'||data.kind==='guide'||data.kind==='clarify')history.current=[...history.current.slice(-3),confirmed];setAllSteps(false);
  }catch{
   if(askEpoch.current===generation){setRequestOutcome('service-error');setRequestError(lang==='te'?'ప్రస్తుతం సమాధానం రాలేదు. మీ ప్రశ్న ఇక్కడే ఉంది. మళ్లీ ప్రయత్నించండి.':'The answer could not be loaded. Your question is still here. Please try again.');}
  }finally{if(askEpoch.current===generation){asking.current=false;setBusy(false);}}
 }
 function selectGuide(id:string){
  if(asking.current)return;stopRecording(true);stopSpeech();const g=getGuide(id);if(!g)return;
  setError('');setAudioError('');setRequestError('');setTranscript('');setQuestion(g.title[lang]);setAnsweredQuestion(g.title[lang]);history.current=[];
  setDecision({kind:'guide',guideId:id,step:0,message:g.summary[lang],reason:'selected-guide',engine:'rules'});setAllSteps(false);
  setTimeout(()=>answerRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),50);
 }
 function move(n:number){if(!guide)return;stopSpeech();setDecision(d=>d?{...d,step:Math.max(0,Math.min(guide.steps.length-1,n))}:d);}
 async function speak(greeting=false){
  if(busy||voiceWorking)return;
  if(!greeting&&!guide&&!decision?.message)return;if(speaking){stopSpeech();return;}
  setAudioError('');setPlaybackKind(greeting?'greeting':'answer');setAudioPhase('loading');const n=++epoch.current;
  const unavailable=lang==='te'?'ఆడియో వినిపించలేదు. రాసిన సమాధానం ఇక్కడ చదవవచ్చు.':'Audio is unavailable. You can still read the answer here.';
  if(status.speechReady&&(greeting||guide||decision?.speechToken)){
   setSpeaking(true);const controller=new AbortController();audioController.current=controller;
   try{
    const r=await fetch('/api/speak',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify(greeting?{greeting:true,language:lang}:guide?{guideId:guide.id,step,language:lang}:{speechToken:decision?.speechToken})});
    if(!r.ok)throw Error();const url=URL.createObjectURL(await r.blob());if(epoch.current!==n){URL.revokeObjectURL(url);return;}
    audioUrl.current=url;const player=new Audio(url);audio.current=player;
    player.onplaying=()=>{if(epoch.current===n)setAudioPhase('playing');};
    player.onended=()=>{if(epoch.current===n){setSpeaking(false);setAudioPhase('idle');}URL.revokeObjectURL(url);};
    player.onerror=()=>{if(epoch.current===n){setSpeaking(false);setAudioPhase('idle');setAudioError(unavailable);}URL.revokeObjectURL(url);};
    await player.play();return;
   }catch{if(epoch.current!==n)return;if(audioUrl.current){URL.revokeObjectURL(audioUrl.current);audioUrl.current=null;}setSpeaking(false);}finally{if(audioController.current===controller)audioController.current=null;}
  }
  if(epoch.current!==n)return;
  const synth=window.speechSynthesis;if(!synth){setAudioPhase('idle');setAudioError(unavailable);return;}
  const voice=synth.getVoices().find(v=>v.lang.toLowerCase().startsWith(lang));if(!voice&&lang==='te'){setAudioPhase('idle');setAudioError(unavailable);return;}
  const u=new SpeechSynthesisUtterance(greeting?GREETING[lang]:guide?guide.steps[step][lang]:(decision?.message||''));u.lang=lang==='te'?'te-IN':'en-IN';if(voice)u.voice=voice;u.rate=.85;
  u.onstart=()=>{if(epoch.current===n)setAudioPhase('playing');};
  u.onend=()=>{if(epoch.current===n){setSpeaking(false);setAudioPhase('idle');}};u.onerror=()=>{if(epoch.current===n){setSpeaking(false);setAudioPhase('idle');setAudioError(unavailable);}};
  try{setSpeaking(true);synth.speak(u);}catch{setSpeaking(false);setAudioPhase('idle');setAudioError(unavailable);}
 }
 function handleTranscript(text:string,generation:number){
  if(voiceEpoch.current!==generation)return;
  const heard=text.trim();if(!heard){setVoicePhase('idle');setError(lang==='te'?'మాటలు వినిపించలేదు. మళ్లీ మాట్లాడండి లేదా టైప్ చేయండి.':'No speech was heard. Try again or type your question.');return;}
  if(privacyReason(heard)){setError(c.privacy);setTranscript('');setVoicePhase('idle');return;}
  setTranscript(heard);setVoicePhase('review');
 }
 function stopRecording(cancel=false){
  if(recordTimer.current){clearTimeout(recordTimer.current);recordTimer.current=null;}
  if(cancel){voiceEpoch.current++;transcribeController.current?.abort();setVoicePhase('idle');setTranscript('');}
  else if(rec.current||media.current?.state==='recording')setVoicePhase('transcribing');
  rec.current?.stop();if(media.current?.state==='recording')media.current.stop();stream.current?.getTracks().forEach(t=>t.stop());
 }
 async function beginRecording(){
  if(asking.current||voiceWorking)return;setVoiceConsent(false);setAcceptedVoice(true);stopSpeech();stopRecording(true);setError('');setAudioError('');setTranscript('');setVoicePhase('permission');
  const generation=++voiceEpoch.current;
  if(status.transcriptionReady&&navigator.mediaDevices?.getUserMedia&&typeof MediaRecorder!=='undefined'){
   try{
    const inputStream=await navigator.mediaDevices.getUserMedia({audio:true});
    if(voiceEpoch.current!==generation){inputStream.getTracks().forEach(t=>t.stop());return;}
    stream.current=inputStream;
    const mimeType=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
    const recorder=new MediaRecorder(inputStream,mimeType?{mimeType}:undefined);media.current=recorder;const chunks:BlobPart[]=[];
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onerror=()=>{if(voiceEpoch.current===generation){stopRecording(true);setError(lang==='te'?'రికార్డింగ్ ఆగిపోయింది. మళ్లీ ప్రయత్నించండి లేదా టైప్ చేయండి.':'Recording failed. Try again or type your question.');}};
    recorder.onstop=async()=>{
     inputStream.getTracks().forEach(t=>t.stop());if(voiceEpoch.current!==generation)return;if(media.current===recorder)media.current=null;if(recordTimer.current){clearTimeout(recordTimer.current);recordTimer.current=null;}
     setVoicePhase('transcribing');const controller=new AbortController();transcribeController.current=controller;
     try{
      const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});if(!blob.size)throw Error();
      const fd=new FormData();fd.append('audio',blob,blob.type.includes('mp4')?'question.mp4':'question.webm');fd.append('language',lang);
      const r=await fetch('/api/transcribe',{method:'POST',body:fd,signal:controller.signal});const data=await r.json() as {text?:string};
      if(!r.ok||typeof data.text!=='string')throw Error();handleTranscript(data.text,generation);
     }catch{if(voiceEpoch.current===generation){setVoicePhase('idle');setError(lang==='te'?'మాటలను టెక్స్ట్‌గా మార్చలేకపోయాను. మళ్లీ మాట్లాడండి లేదా టైప్ చేయండి.':'Could not transcribe the recording. Try again or type your question.');}}
    };
    recorder.start();setVoicePhase('listening');recordTimer.current=setTimeout(()=>stopRecording(),25000);return;
   }catch{
    if(voiceEpoch.current!==generation)return;stream.current?.getTracks().forEach(t=>t.stop());if(voiceEpoch.current===generation){setVoicePhase('idle');setError(lang==='te'?'మైక్రోఫోన్ అనుమతి రాలేదు. మీ ప్రశ్నను టైప్ చేయవచ్చు.':'Microphone access was unavailable. You can type your question.');}return;
   }
  }
  const w=window as SpeechWindow;const Recognition=w.SpeechRecognition||w.webkitSpeechRecognition;
  if(!Recognition){setVoicePhase('idle');setError(lang==='te'?'ఈ బ్రౌజర్‌లో మాటలు గుర్తించే సదుపాయం లేదు. మీ ప్రశ్నను టైప్ చేయండి.':'Speech recognition is unavailable in this browser. Type your question.');return;}
  const recognition=new Recognition();rec.current=recognition;let received=false;
  recognition.lang=lang==='te'?'te-IN':'en-IN';recognition.continuous=false;recognition.interimResults=false;
  recognition.onstart=()=>{if(voiceEpoch.current!==generation){recognition.stop();return;}setVoicePhase('listening');recordTimer.current=setTimeout(()=>stopRecording(),25000);};
  recognition.onresult=e=>{if(voiceEpoch.current!==generation)return;received=true;if(recordTimer.current){clearTimeout(recordTimer.current);recordTimer.current=null;}handleTranscript(e.results[0][0].transcript,generation);recognition.stop();};
  recognition.onerror=()=>{if(voiceEpoch.current===generation){received=true;setVoicePhase('idle');setError(lang==='te'?'వినిపించలేదు లేదా మైక్రోఫోన్ అనుమతి రాలేదు. మళ్లీ ప్రయత్నించండి లేదా టైప్ చేయండి.':'Could not hear you or microphone permission was denied. Try again or type your question.');}};
  recognition.onend=()=>{if(voiceEpoch.current!==generation)return;if(recordTimer.current){clearTimeout(recordTimer.current);recordTimer.current=null;}if(rec.current===recognition)rec.current=null;if(!received)handleTranscript('',generation);};
  try{recognition.start();}catch{setVoicePhase('idle');setError(lang==='te'?'మైక్రోఫోన్ అందుబాటులో లేదు.':'Microphone is unavailable.');}
 }
 function mic(){if(recording){stopRecording();return;}if(!acceptedVoice)setVoiceConsent(true);else void beginRecording();}
 function reset(){
  askEpoch.current++;askController.current?.abort();asking.current=false;setBusy(false);history.current=[];stopRecording(true);stopSpeech();setDecision(null);setQuestion('');setAnsweredQuestion('');setError('');setRequestError('');setRequestOutcome('');setAudioError('');setTranscript('');setDraft('');
 }

 useEffect(()=>{const ctx=(document as Document&{modelContext?:{registerTool:(t:unknown,o:unknown)=>Promise<void>}}).modelContext;if(!ctx)return;const life=new AbortController();Promise.resolve(ctx.registerTool({name:'start_swayam_guide',title:'Start an everyday task guide',description:'Open a source-backed guide in the visible interface. Does not complete any official task.',inputSchema:{type:'object',properties:{guideId:{type:'string',enum:GUIDES.map(g=>g.id)}},required:['guideId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input:unknown)=>{const i=input as {guideId?:unknown};if(!i||Object.keys(i).length!==1||typeof i.guideId!=='string'||!getGuide(i.guideId))throw Error('Choose an available guide.');selectGuide(i.guideId);await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));return {started:i.guideId,officialTaskCompleted:false};}},{signal:life.signal})).catch(()=>{});return()=>life.abort();},[lang]);
 return <main className="swayam-shell" lang={lang}><header className="topbar"><Link className="brand" href="/" aria-label="Swayam home"><span className="brand-mark" aria-hidden="true">S</span><span className="brand-name">swayam<span className="brand-native">స్వయం</span></span></Link><p className="brand-tagline">{lang==='te'?'మీ మాట. మీ భాష. మీ స్వతంత్రత.':'Your voice. Your language. Your independence.'}</p><div className="header-actions"><span className="india-badge"><IndiaFlag/><span>{lang==='te'?'మనందరి కోసం':'For everyday India'}</span></span><NativeSelect aria-label="Language" disabled={!hydrated||voiceWorking} value={lang} onChange={e=>{reset();setLang(e.target.value as Language);}}><NativeSelectOption value="te">తెలుగు</NativeSelectOption><NativeSelectOption value="en">English</NativeSelectOption></NativeSelect><Button variant="ghost" onClick={reset} className="reset-button" disabled={!hydrated}><RotateCcw/>{c.new}</Button></div></header>
 <div className="workspace"><aside className="ask-side"><div className="sketch-note"><img src="/images/swayam-voice.png" width="1536" height="1024" alt={lang==='te'?'ఫోన్‌లో ప్రశ్న అడుగుతున్న అమ్మ పెన్సిల్ చిత్రం':'Pencil illustration of a mother asking her phone a question'}/><p lang="te">మీ సందేహం, మీ మాటల్లో. ఈ బటన్లకు మించి కూడా అడగవచ్చు.</p></div><section className="intro"><p className="eyebrow">{lang==='te'?'రోజువారీ పనుల్లో మీ ముందడుగు':'EVERYDAY CONFIDENCE'}</p><h1>{c.greeting}<br/><em>{c.together}</em></h1><p>{c.sub}</p><Button className={'voice-main '+(recording?'is-recording':'')} onClick={mic} disabled={!hydrated||busy||voicePhase==='permission'||voicePhase==='transcribing'}>{recording?<Square/>:<Mic/>}{recording?c.stop:c.speak}</Button><Button variant="ghost" className="type-toggle" disabled={!hydrated||voiceWorking} onClick={()=>setShowTyping(v=>!v)}><Keyboard/>{c.type}</Button>
 <Button variant="ghost" className="greeting-button" disabled={!hydrated||busy||voiceWorking} onClick={()=>void speak(true)}>{speaking?<Square/>:<Volume2/>}{speaking?(lang==='te'?'వినడం ఆపండి':'Stop listening'):(lang==='te'?'స్వాగతం వినండి':'Hear a welcome')}</Button>
 {voiceWorking&&<div className="voice-status" role="status">{recording?<Mic/>:<LoaderCircle className="spin"/>}<span>{voicePhase==='permission'?(lang==='te'?'మైక్రోఫోన్ అనుమతి కోసం వేచి ఉన్నాను…':'Waiting for microphone permission…'):recording?(lang==='te'?'వింటున్నాను… పూర్తయ్యాక ఆపండి.':'Listening… stop when you are finished.'):(lang==='te'?'మీ మాటలను టెక్స్ట్‌గా మారుస్తున్నాను…':'Transcribing your recording…')}</span>{!recording&&<Button variant="ghost" onClick={()=>stopRecording(true)}>{c.cancel}</Button>}</div>}
 {showTyping&&<form onSubmit={e=>{e.preventDefault();void ask(draft);}} className="ask-form"><Textarea disabled={!hydrated||voiceWorking} aria-label={c.type} value={draft} onChange={e=>setDraft(e.target.value)} maxLength={1200} placeholder={c.placeholder}/><Button type="submit" disabled={!hydrated||busy||voiceWorking||!draft.trim()}><Send/>{c.ask}</Button></form>}
 {voicePhase==='review'&&<div className="transcript"><label htmlFor="heard-question">{c.heard}</label><p>{lang==='te'?'సరిచూసి, అవసరమైతే మార్చండి. మీరు నిర్ధారించిన తర్వాతే పంపుతాను.':'Check and edit this first. It is sent only after you confirm.'}</p><Textarea id="heard-question" ref={transcriptRef} value={transcript} maxLength={1200} onChange={e=>setTranscript(e.target.value)} disabled={busy}/><div className="inline-actions"><Button disabled={busy||!transcript.trim()} onClick={()=>void ask(transcript)}><Check/>{c.confirm}</Button><Button variant="ghost" onClick={()=>stopRecording(true)}><X/>{c.cancel}</Button></div></div>}
 {statusLoaded&&!status.answersReady&&<p className="service-notice">{lang==='te'?'ప్రస్తుతం సిద్ధమైన మార్గదర్శకాలు అందుబాటులో ఉన్నాయి. విస్తృత వెబ్ సమాధానాలు ఇంకా ప్రారంభం కాలేదు.':'Prepared guides are available. Broader web answers are not connected yet.'}</p>}
 {error&&<p className="error-message" role="alert">{error}</p>}
 </section><div className="ask-reassurance"><span aria-hidden="true">✦</span><p>{lang==='te'?'చిన్న ప్రశ్నైనా అడగండి. మీ వేగంలో నేర్చుకోండి.':'Small questions welcome. Take it at your own pace.'}</p></div></aside>
 <section ref={answerRef} className={'answer-side '+(!decision?'empty-answer':'')} aria-live="polite" aria-busy={busy}>
 {question&&<div className="question-echo confirmed-question"><strong>{lang==='te'?'మీ ప్రశ్న':'Your question'}</strong><p>{question}</p></div>}
 {busy&&<div className="answer-progress" role="status"><LoaderCircle className="spin"/><p>{lang==='te'?'ఆధారాలు చూసి, సమాధానం పరిశీలిస్తున్నాను…':'Finding sources and checking your answer…'}{workSeconds>=15&&<small>{lang==='te'?' ఇంకా పరిశీలిస్తున్నాను. కావాలంటే ఆపవచ్చు.':' Still checking. You can stop this request.'}</small>}</p><Button variant="outline" onClick={cancelAsk}>{lang==='te'?'ఆపండి':'Cancel'}</Button></div>}
 {requestError&&<div className="answer-request-error" data-outcome={requestOutcome} role="alert"><p>{requestError}</p><Button variant="outline" disabled={busy||voiceWorking} onClick={()=>void ask(question)}>{lang==='te'?'మళ్లీ ప్రయత్నించండి':'Try again'}</Button></div>}
 {!busy&&!requestError&&(decision?.kind==='answer'||guide)&&<p className="answer-ready" role="status"><Check size={16}/>{lang==='te'?'సమాధానం సిద్ధంగా ఉంది. ఇక్కడ చదవండి లేదా వినండి.':'Your answer is ready. Read it here or listen.'}</p>}
 {audioPhase!=='idle'&&<p className="playback-status" role="status"><Volume2 size={16}/>{audioPhase==='loading'?(playbackKind==='greeting'?(lang==='te'?'స్వాగత సందేశం సిద్ధమవుతోంది…':'Loading your welcome…'):(lang==='te'?'సమాధానం ఆడియో సిద్ధమవుతోంది…':'Loading answer audio…')):(playbackKind==='greeting'?(lang==='te'?'స్వాగత సందేశం వినిపిస్తోంది.':'Playing your welcome.'):(lang==='te'?'సమాధానం వినిపిస్తోంది.':'Playing your answer.'))}</p>}
 {audioError&&<p className="audio-status" role="status">{audioError}</p>}
 {(busy||requestError)&&decision&&<p className="previous-question">{lang==='te'?'మునుపటి సమాధానం':'Previous answer'} · {answeredQuestion}</p>}
 {guide?<><div className="answer-topline"><span><span aria-hidden="true">{topicArt[guide.id]?.emoji} </span>{guide.kind==='story'?(lang==='te'?'కథల సమయం':'STORY TIME'):guide.kind==='recipe'?(lang==='te'?'వంటింట్లో':'IN THE KITCHEN'):(lang==='te'?'ఒక్కో అడుగుగా':'ONE STEP AT A TIME')}</span><Button variant="ghost" size="icon" aria-label={c.close} onClick={reset}><X/></Button></div><h2>{guide.title[lang]}</h2><p className="answer-summary">{guide.summary[lang]}</p><div className="step-track">{guide.steps.map((_,i)=><span className={i<=step?'done':''} key={i}/>)}</div><p className="step-label"><span className="step-number">{String(step+1).padStart(2,'0')}</span><span>{c.step} {step+1} {c.of} {guide.steps.length}</span></p><p className="step-text">{guide.steps[step][lang]}</p><Button variant="outline" className="listen-button" disabled={busy||voiceWorking} onClick={()=>void speak()}>{speaking?<Square/>:<Volume2/>}{speaking?c.stop:c.listen}</Button><div className="step-nav"><Button variant="ghost" disabled={step===0} onClick={()=>move(step-1)}><ArrowLeft/>{c.back}</Button>{step<guide.steps.length-1?<Button onClick={()=>move(step+1)}>{c.next}<ArrowRight/></Button>:<span className="completed"><Check/>{c.finish}</span>}</div>{step===guide.steps.length-1&&<p className="small-note">{c.finishBody}</p>}<Button variant="ghost" className="all-steps-toggle" onClick={()=>setAllSteps(v=>!v)}>{c.readAll}</Button>{allSteps&&<ol className="all-steps">{guide.steps.map((s,i)=><li key={i}>{s[lang]}</li>)}</ol>}
 {guide.kind==='awareness'&&<p className="awareness-label">{lang==='te'?'సాధారణ న్యాయ అవగాహన • వ్యక్తిగత న్యాయ సలహా కాదు':'General legal awareness • not advice on your particular case'}</p>}<div className="guide-note"><ShieldCheck/><p>{guide.note[lang]}</p></div><Button className="official-button" variant="outline" onClick={()=>setExternal(ACTIONS[guide.actionId].url)}>{ACTIONS[guide.actionId].title[lang]}<ExternalLink/></Button><div className="sources"><h3>{c.source}</h3>{guide.sourceIds.map(id=><a key={id} href={SOURCES[id].url} target="_blank" rel="noopener noreferrer">{SOURCES[id].publisher}<ExternalLink size={14}/></a>)}<p>{c.review}: {guide.reviewed}</p></div></>:decision?.kind==='answer'?<div className="source-answer"><div className="answer-topline"><span>🔎 {lang==='te'?'ఆధారాలతో సమాధానం':'ANSWER WITH SOURCES'}</span><Button variant="ghost" size="icon" aria-label={c.close} onClick={reset}><X/></Button></div><img className="trusted-sketch" src="/images/swayam-sources.png" width="1536" height="1024" alt=""/><h2>{lang==='te'?'సులభంగా తెలుసుకుందాం':'Let’s make it clear'}</h2>{decision.paragraphs?.map((p,i)=><p className="answer-paragraph" key={i}>{p.text}<span className="citation-chips">{p.sourceIds.map(id=><button key={id} aria-label={`${lang==='te'?'ఆధారం':'Source'} ${id}`} onClick={()=>{const src=decision.sources?.find(s=>s.id===id);if(src)setExternal(src.url);}}>{id}</button>)}</span></p>)}<div className="answer-actions"><Button variant="outline" className="listen-button" disabled={busy||voiceWorking} onClick={()=>void speak()}>{speaking?<Square/>:<Volume2/>}{speaking?c.stop:c.listen}</Button><Button variant="outline" disabled={busy||voiceWorking} onClick={mic}><Mic/>{lang==='te'?'ఇంకో సందేహం అడగండి':'Ask a follow-up'}</Button></div><p className="answer-caution">{decision.caution}</p><div className="answer-sources"><h3>{c.source}</h3>{decision.sources?.map(src=><button key={src.id} onClick={()=>setExternal(src.url)}><strong>{src.id} · {src.title}</strong><small>{src.publisher} · {lang==='te'?'చూసిన తేదీ':'Retrieved'} {src.retrievedAt.slice(0,10)}{src.publishedAt?` · ${lang==='te'?'ప్రచురణ':'Published'} ${src.publishedAt}`:''}</small><small>{src.contentKind==='page'?(lang==='te'?'పేజీ నుంచి ఆధారం':'Page excerpt'):(lang==='te'?'సెర్చ్ సంక్షిప్త ఆధారం':'Search excerpt')} · <ExternalLink size={13}/></small></button>)}</div><p className="followup-hint">{lang==='te'?'మరింత సులభంగా చెప్పమని అడగవచ్చు. కొత్త ప్రశ్న నొక్కితే ఈ సంభాషణ తొలగిపోతుంది.':'Ask me to explain it more simply. New question clears this conversation.'}</p></div>:decision?<div className="boundary-answer"><ShieldCheck size={36}/><h2>{decision.kind==='blocked'?(lang==='te'?'సురక్షితంగా ముందుకు వెళ్దాం':'Let’s take a safe next step'):decision.kind==='clarify'?(lang==='te'?'ఇంకొంచెం వివరంగా చెప్పండి':'One more detail, please'):(lang==='te'?'ఇంకా నిర్ధారించలేకపోయాను':'I couldn’t verify an answer yet')}</h2><p>{decision.message}</p><Button variant="outline" className="listen-button" disabled={busy||voiceWorking} onClick={()=>void speak()}><Volume2/>{c.listen}</Button><Button variant="outline" onClick={reset}>{c.new}</Button>{decision.kind==='unsupported'&&<Button variant="outline" disabled={busy} onClick={()=>void ask(question)}>{lang==='te'?'మళ్లీ ప్రయత్నించండి':'Try again'}</Button>}</div>:!busy&&!question?<><div className="welcome-heading"><p className="empty-eyebrow">{lang==='te'?'నమస్కారం! స్వయంకు స్వాగతం':'NAMASTE. MAKE YOURSELF AT HOME.'} <span aria-hidden="true">👋</span></p><h2>{c.empty}</h2><p>{c.emptysub}</p></div><img className="family-art" src="/images/swayam-family.png" width="1536" height="1024" alt={lang==='te'?'ఫోన్ ఉపయోగిస్తూ నమ్మకంగా నవ్వుతున్న అమ్మానాన్నల పెన్సిల్ బొమ్మ':'Pencil illustration of two Indian parents confidently using a phone'}/><div className="quick-starts"><img className="trusted-sketch" src="/images/swayam-sources.png" width="1536" height="1024" alt=""/><span>{lang==='te'?'ఇలా మొదలుపెట్టండి':'A FEW IDEAS TO START'}</span><div><Button variant="outline" onClick={()=>selectGuide('lpg')}>🔥 {lang==='te'?'గ్యాస్ KYC':'Gas KYC'}</Button><Button variant="outline" onClick={()=>selectGuide('chicken-biryani')}>🍲 {lang==='te'?'బిర్యానీ':'Biryani'}</Button><Button variant="outline" onClick={()=>selectGuide('whatsapp')}>💬 {lang==='te'?'వాట్సాప్ స్టేటస్':'WhatsApp status'}</Button></div></div></>:null}
 </section></div><section className="topics"><div className="topics-heading"><div><p className="section-kicker">{lang==='te'?'మీ రోజులో కొంచెం సహాయం':'A LITTLE HELP FOR YOUR EVERYDAY'}</p><h2>{c.choose}</h2><p className="topics-note">{lang==='te'?'ఇవి కొన్ని ఉదాహరణలు మాత్రమే. మీకు కావలసినది మాట్లాడి అడగండి.':'These are just starting points. Speak to ask about something else.'}</p></div><img className="everyday-art" src="/images/swayam-everyday.png" width="1536" height="1024" loading="lazy" alt=""/></div><Tabs defaultValue="all" className="topic-tabs"><TabsList aria-label={lang==='te'?'విషయాలు':'Topic categories'}>{groups.map(g=><TabsTrigger key={g.id} value={g.id}>{g[lang]}</TabsTrigger>)}</TabsList>{groups.map(group=><TabsContent value={group.id} key={group.id}><div className="topic-grid">{topicOrder.map(id=>getGuide(id)).filter(g=>g&&(group.id==='all'||groupOf(g.category)===group.id)).map(g=>{if(!g)return null;const art=topicArt[g.id]||{emoji:'📖',tone:'blue',hint:g.summary};return <Button variant="outline" key={g.id} className={'topic-card tone-'+art.tone+' '+(guide?.id===g.id?'selected':'')} aria-pressed={guide?.id===g.id} onClick={()=>selectGuide(g.id)} disabled={!hydrated||busy||voiceWorking}><span className="topic-icon" aria-hidden="true">{art.emoji}</span><span className="topic-copy"><span className="topic-title">{g.title[lang]}</span><span className="topic-hint">{art.hint[lang]}</span></span><ArrowRight size={18}/></Button>;})}</div></TabsContent>)}</Tabs></section><footer><ShieldCheck size={20}/><span>{c.privacy}<br/><small>{c.notice}</small></span><a href="/evaluation">{lang==='te'?'ప్రాజెక్ట్ పరీక్షలు':'Project tests'}</a></footer>
 <Dialog open={voiceConsent} onOpenChange={setVoiceConsent}><DialogContent><DialogHeader><DialogTitle>{c.voiceTitle}</DialogTitle><DialogDescription>{c.voiceBody}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={()=>setVoiceConsent(false)}>{c.cancel}</Button><Button disabled={!hydrated||busy||voiceWorking} onClick={()=>void beginRecording()}>{c.proceed}</Button></DialogFooter></DialogContent></Dialog>
 <Dialog open={!!external} onOpenChange={v=>!v&&setExternal('')}><DialogContent><DialogHeader><DialogTitle>{guide?.kind==='recipe'?(lang==='te'?'వంటకం మూలాన్ని తెరవండి':'Open the recipe source'):c.open}</DialogTitle><DialogDescription>{guide?.kind==='recipe'?(lang==='te'?'కొలతలు, పూర్తి విధానం కోసం అసలు వంటకం పేజీకి వెళ్తున్నారు.':'You are opening the original recipe for quantities and the complete method.'):guide?.kind==='shopping'?(lang==='te'?'మీరు విక్రేత సైట్ తెరుస్తున్నారు. ధర, స్టాక్, డెలివరీ, రిటర్న్ నిబంధనలు అక్కడ నిర్ధారించండి. స్వయం కొనుగోలు చేయదు.':'You are opening a retailer’s website. Check its current price, availability, delivery and returns. Swayam does not place orders.'):c.openBody}</DialogDescription></DialogHeader><p className="external-host">{external?new URL(external).hostname:''}</p><DialogFooter><Button variant="outline" onClick={()=>setExternal('')}>{c.cancel}</Button><Button asChild><a href={external} target="_blank" rel="noopener noreferrer" onClick={()=>setExternal('')}>{lang==='te'?'సైట్ తెరవండి':'Open website'}<ExternalLink/></a></Button></DialogFooter></DialogContent></Dialog>
 </main>;
}
