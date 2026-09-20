// Live provider transport test using only the application's authored greeting.
// Audio stays in browser memory; this does not test a human microphone or ears.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const moduleName=process.env.PLAYWRIGHT_MODULE||'playwright';const {chromium}=await import(/^[A-Za-z]:[\\/]/.test(moduleName)?pathToFileURL(moduleName).href:moduleName);
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});const page=await browser.newPage();
let report;
try{
 await page.addInitScript(()=>{const original=window.fetch.bind(window);window.fetch=async(...args)=>{const started=performance.now();const response=await original(...args);if(String(args[0]).endsWith('/api/speak')&&args[1]?.method==='POST'){response.clone().arrayBuffer().then(bytes=>{window.__swayamAudioProbe={bytes,status:response.status,type:response.headers.get('content-type'),elapsedMs:Math.round(performance.now()-started)};});}return response;};});
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/status')),page.goto(process.env.UI_BASE_URL||'http://localhost:5173')]);
 const started=Date.now();const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/speak')&&r.request().method()==='POST',{timeout:45000});await page.locator('.greeting-button').click();const response=await responsePromise;await page.waitForFunction(()=>window.__swayamAudioProbe,{timeout:45000});
 const audioProbe=await page.evaluate(()=>({status:window.__swayamAudioProbe.status,bytes:window.__swayamAudioProbe.bytes.byteLength,type:window.__swayamAudioProbe.type,elapsedMs:window.__swayamAudioProbe.elapsedMs}));
 report={testedAt:new Date().toISOString(),mode:'actual browser greeting button + live providers; synthetic authored audio, not physical microphone',tts:{status:audioProbe.status,elapsedMs:Date.now()-started,contentType:audioProbe.type,bytes:audioProbe.bytes},physicalMicrophoneTested:false,audibleQualityReviewed:false};
 if(response.ok()&&response.headers()['content-type']?.startsWith('audio/')){
  report.transcription=await page.evaluate(async()=>{const form=new FormData();form.append('audio',new Blob([window.__swayamAudioProbe.bytes],{type:'audio/mpeg'}),'synthetic-authored-greeting.mp3');form.append('language','te');const start=performance.now();const r=await fetch('/api/transcribe',{method:'POST',body:form});const d=await r.json();return {status:r.status,elapsedMs:Math.round(performance.now()-start),syntheticGreetingTranscript:d.text||null,error:d.error||null};});
 }
 report.invalidSpeech=await page.evaluate(async()=>{const r=await fetch('/api/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({speechToken:'synthetic-invalid.token'})});const d=await r.json();return {status:r.status,error:d.error};});
 await page.getByLabel('Language',{exact:true}).selectOption('en');
 const prepared=page.locator('.topic-card').filter({hasText:'Chicken biryani'});if(await prepared.count()){const start=Date.now();await prepared.click();await page.locator('.step-text').first().waitFor({state:'visible',timeout:5000}).catch(()=>{});report.preparedGuide={elapsedMs:Date.now()-start,label:'Authored chicken-biryani shortcut; no AI-answer latency comparison',visible:await page.locator('main').innerText().then(t=>t.includes('Chicken biryani'))};}
}catch(e){report={...report,failure:e.name==='TimeoutError'?'browser-timeout':'browser-failure',physicalMicrophoneTested:false,audibleQualityReviewed:false};}finally{await browser.close();}
await fs.writeFile('docs/evidence/week6-voice-services.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
