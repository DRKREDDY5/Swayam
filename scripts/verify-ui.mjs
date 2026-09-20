// Rendered-browser contracts against the running local app, with all API routes mocked.
// Requires Playwright (PLAYWRIGHT_MODULE may be a file URL) and optionally CHROME_PATH.
// No configuration files, real microphone, live providers, or private data are read.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const moduleName=process.env.PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(/^[A-Za-z]:[\\/]/.test(moduleName)?pathToFileURL(moduleName).href:moduleName);
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const baseURL=process.env.UI_BASE_URL||'http://localhost:5173';
const answerText='Fold a rectangular sheet of paper in half.';
const paperQuestion='How can I make a paper boat?';
const syntheticAnswer={kind:'answer',engine:'search+fireworks',reason:'source-backed-reviewed',message:answerText,language:'en',speechToken:'SYNTHETIC_UI_AUDIO_CAPABILITY',paragraphs:[{text:answerText,sourceIds:['S1']}],sources:[{id:'S1',title:'Paper folding lesson',url:'https://www.wikihow.com/Make-a-Paper-Boat',publisher:'wikihow.com',retrievedAt:'2026-09-19T00:00:00.000Z',excerpt:answerText,contentKind:'page'}],checks:{citationQuotes:true,modelReview:true}};
const results=[];
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}

async function fixture({native=false,holdTranscription=false,failFirstAsk=false,holdAskNumbers=[],ignoreAskAbortNumbers=[],askReplies=[],holdSpeech=false}={}){
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 const counts={askRequests:0,abortedAskRequests:0,transcriptionRequests:0,speechRequests:0,abortedSpeechRequests:0,pageErrors:0};
 const submittedQuestions=[];
 const gate=deferred();if(!holdTranscription)gate.resolve();
 const askGates=new Map(holdAskNumbers.map(number=>[number,deferred()]));
 const speechGate=deferred();if(!holdSpeech)speechGate.resolve();
 await context.route('**/api/**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Unmocked test endpoint'})}));
 await context.route('**/api/status',route=>route.fulfill({json:{modelReady:true,searchReady:true,answersReady:true,transcriptionReady:!native,speechReady:true}}));
 await context.route('**/api/ask',async route=>{
  const number=++counts.askRequests;
  submittedQuestions.push(route.request().postDataJSON().message);
  await askGates.get(number)?.promise;
  try{await route.fulfill(askReplies[number-1]||(failFirstAsk&&number===1?{status:503,json:{error:'Synthetic unavailable response'}}:{json:syntheticAnswer}));}catch{/* Aborted browser request. */}
 });
 await context.route('**/api/speak',async route=>{counts.speechRequests++;await speechGate.promise;try{await route.fulfill({status:503,json:{error:'Synthetic audio failure'}});}catch{/* Aborted playback. */}});
 await context.route('**/api/transcribe',async route=>{
  counts.transcriptionRequests++;await gate.promise;
  try{await route.fulfill({json:{text:'How do I fold paper?'}});}catch{/* A canceled browser request may already be gone. */}
 });
 await context.addInitScript(({native,ignoreAskAbortNumbers})=>{
  const harness={permissions:[],streams:[],native:{instances:[]},synthSpeakCalls:0};
  window.__uiHarness=harness;
  if(ignoreAskAbortNumbers.length){
   const originalFetch=window.fetch.bind(window);let askNumber=0;
   window.fetch=(input,init)=>{
    if(String(input).endsWith('/api/ask')&&ignoreAskAbortNumbers.includes(++askNumber))return originalFetch(input,{...init,signal:undefined});
    return originalFetch(input,init);
   };
  }
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{lang:'en-US'}],cancel(){},speak(utterance){harness.synthSpeakCalls++;queueMicrotask(()=>utterance.onerror?.({error:'synthetic-audio-error'}));}}});
  Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{constructor(){}}});
  const getUserMedia=()=>new Promise(resolve=>harness.permissions.push(resolve));
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia}});
  harness.allowMicrophone=()=>{
   const inputStream={tracks:[{stopped:false,stop(){this.stopped=true;}}],getTracks(){return this.tracks;}};
   harness.streams.push(inputStream);harness.permissions.shift()?.(inputStream);
  };
  class FakeRecorder{
   static isTypeSupported(type){return type==='audio/webm;codecs=opus';}
   constructor(stream,options){this.stream=stream;this.mimeType=options?.mimeType||'audio/webm';this.state='inactive';}
   start(){this.state='recording';}
   stop(){
    if(this.state!=='recording')return;this.state='inactive';
    queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['SYNTHETIC AUDIO'],{type:this.mimeType})});this.onstop?.();});
   }
  }
  Object.defineProperty(window,'MediaRecorder',{configurable:true,value:FakeRecorder});
  if(native){
   class FakeRecognition{
    constructor(){this.stopCalls=0;harness.native.instances.push(this);}
    start(){setTimeout(()=>this.onstart?.(),0);}
    stop(){
     if(this.stopCalls)return;this.stopCalls++;
     const ended=this.onend;setTimeout(()=>ended?.(),300);
    }
   }
   Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:FakeRecognition});
  }
 },{native,ignoreAskAbortNumbers});
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',()=>counts.pageErrors++);
 page.on('requestfailed',request=>{if(request.url().endsWith('/api/ask'))counts.abortedAskRequests++;if(request.url().endsWith('/api/speak'))counts.abortedSpeechRequests++;});
 await page.goto(baseURL,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>{const select=document.querySelector('select[aria-label="Language"]');return select&&!select.disabled;});
 await page.getByLabel('Language',{exact:true}).selectOption('en');
 // Let the mocked readiness response commit before choosing a voice implementation.
 await page.waitForTimeout(150);
 return {context,page,counts,submittedQuestions,releaseTranscription:gate.resolve,releaseAsk:number=>askGates.get(number)?.resolve(),releaseSpeech:speechGate.resolve,async close(){gate.resolve();speechGate.resolve();for(const held of askGates.values())held.resolve();await context.close();}};
}
async function typed(page,text=paperQuestion){await page.getByLabel('Or type a question',{exact:true}).fill(text);await page.getByRole('button',{name:'Ask Swayam',exact:true}).click();}
async function written(page,text=answerText){await page.locator('.answer-paragraph').filter({hasText:text}).waitFor({state:'visible'});}
async function confirmed(page,text=paperQuestion){assert.equal((await page.locator('.confirmed-question p').innerText()).trim(),text);}
async function startVoice(page,{consent=true}={}){
 await page.getByRole('button',{name:'Speak your question',exact:true}).click();
 if(consent)await page.getByRole('button',{name:'Continue and speak',exact:true}).click();
}
async function allowVoice(page){
 await page.getByText('Waiting for microphone permission…',{exact:true}).waitFor({state:'visible'});
 await page.evaluate(()=>window.__uiHarness.allowMicrophone());
 await page.getByText('Listening… stop when you are finished.',{exact:true}).waitFor({state:'visible'});
}
async function stopVoice(page){await page.getByRole('button',{name:'Stop recording',exact:true}).click();}
async function review(page){await page.locator('#heard-question').waitFor({state:'visible'});}
async function run(id,name,options,body){
 let app;let failedAt='Open hydrated app';
 const step=async(label,work)=>{failedAt=label;await work();};
 try{
  app=await fixture(options);await body(app,step);
  assert.equal(app.counts.pageErrors,0);
  results.push({id,name,passed:true,...app.counts});
 }catch{
  results.push({id,name,passed:false,failedAt,...app?.counts});
 }finally{await app?.close();}
}
try{
 await run('UI01','Typed question and written answer survive cloud and browser audio failure',{},async({page,counts},step)=>{
  await step('Submit typed question and render written answer',async()=>{await typed(page);await written(page);await confirmed(page);});
  await step('Fail optional playback while retaining text',async()=>{
   await page.getByRole('button',{name:'Listen',exact:true}).click();
   await page.locator('.audio-status').filter({hasText:'Audio is unavailable'}).waitFor({state:'visible'});
   await written(page);await confirmed(page);assert.equal(counts.askRequests,1);assert.equal(counts.speechRequests,1);
  });
 });
 await run('UI02','Voice phases, editable transcript, and explicit confirmation before one submission',{holdTranscription:true},async({page,counts,submittedQuestions,releaseTranscription},step)=>{
  await step('Show permission then listening',async()=>{await startVoice(page);await allowVoice(page);});
  await step('Show transcription without answer-search status',async()=>{
   await stopVoice(page);await page.getByText('Transcribing your recording…',{exact:true}).waitFor({state:'visible'});
   assert.equal(await page.locator('.answer-progress').count(),0);assert.equal(counts.askRequests,0);releaseTranscription();await review(page);
  });
  await step('Wait beyond former auto-submit delay and edit heard text',async()=>{
   await page.waitForTimeout(1200);assert.equal(counts.askRequests,0);
   await page.locator('#heard-question').fill(paperQuestion);
   await page.getByRole('button',{name:'Confirm and ask',exact:true}).click();await written(page);await confirmed(page);
   await page.waitForTimeout(250);assert.equal(counts.askRequests,1);assert.equal(counts.transcriptionRequests,1);assert.deepEqual(submittedQuestions,[paperQuestion]);
  });
 });
 await run('UI03','Cancel transcription ignores its late result and never submits',{holdTranscription:true},async({page,counts,releaseTranscription},step)=>{
  await step('Begin pending transcription',async()=>{await startVoice(page);await allowVoice(page);await stopVoice(page);await page.getByText('Transcribing your recording…',{exact:true}).waitFor({state:'visible'});});
  await step('Cancel and ignore late response',async()=>{
   await page.getByRole('button',{name:'Cancel',exact:true}).click();releaseTranscription();await page.waitForTimeout(1200);
   assert.equal(await page.locator('#heard-question').count(),0);assert.equal(await page.locator('.voice-status').count(),0);assert.equal(counts.askRequests,0);assert.equal(counts.transcriptionRequests,1);
  });
 });
 await run('UI04','Private details added to transcript are blocked before ask request',{},async({page,counts},step)=>{
  await step('Capture an editable transcript',async()=>{await startVoice(page);await allowVoice(page);await stopVoice(page);await review(page);});
  await step('Block private edit and redact confirmed question',async()=>{
   await page.locator('#heard-question').fill('My Aadhaar is 0000 0000 0000.');
   await page.getByRole('button',{name:'Confirm and ask',exact:true}).click();
   await page.locator('.boundary-answer').waitFor({state:'visible'});assert.equal(counts.askRequests,0);
   await confirmed(page,'[Private details removed]');assert.ok(!(await page.locator('body').innerText()).includes('0000 0000 0000'));
  });
 });
 await run('UI05','Answer request failure preserves question and offers a working retry',{failFirstAsk:true},async({page,counts},step)=>{
  await step('Retain question on request failure',async()=>{await typed(page);await page.locator('.answer-request-error').waitFor({state:'visible'});await confirmed(page);});
  await step('Retry retained question successfully',async()=>{await page.getByRole('button',{name:'Try again',exact:true}).click();await written(page);await confirmed(page);assert.equal(counts.askRequests,2);});
 });
 await run('UI06','Canceled native recognizer cannot clear a newer recording reference',{native:true},async({page,counts},step)=>{
  await step('Cancel first native recording',async()=>{await startVoice(page);await page.getByText('Listening… stop when you are finished.',{exact:true}).waitFor({state:'visible'});await page.getByRole('button',{name:'New question',exact:true}).click();});
  await step('Start new native recording before stale onend arrives',async()=>{await startVoice(page,{consent:false});await page.getByText('Listening… stop when you are finished.',{exact:true}).waitFor({state:'visible'});await page.waitForTimeout(450);});
  await step('Stop current recognizer after stale callback',async()=>{
   await stopVoice(page);await page.waitForFunction(()=>window.__uiHarness.native.instances[1]?.stopCalls===1);
   await page.getByText('No speech was heard. Try again or type your question.',{exact:true}).waitFor({state:'visible'});assert.equal(counts.askRequests,0);
  });
 });
 await run('UI07','Cancel aborts a pending question while preserving its text, prior answer, and editable draft',{holdAskNumbers:[2]},async({page,counts,releaseAsk},step)=>{
  await step('Show an initial valid written answer',async()=>{await typed(page);await written(page);await page.locator('.answer-ready').waitFor({state:'visible'});});
  await step('Keep previous answer and allow typing during pending request',async()=>{
   await typed(page,'How do I fold a paper hat?');await page.locator('.answer-progress').waitFor({state:'visible'});await written(page);await confirmed(page,'How do I fold a paper hat?');
   const input=page.getByLabel('Or type a question',{exact:true});assert.equal(await input.isDisabled(),false);await input.fill('How do I grow coriander?');
   assert.equal(await page.getByRole('button',{name:'Ask Swayam',exact:true}).isDisabled(),true);assert.equal(counts.askRequests,2);
  });
  await step('Cancel pending fetch without erasing question or previous answer',async()=>{
   await page.locator('.answer-progress').getByRole('button',{name:'Cancel',exact:true}).click();await page.locator('.answer-progress').waitFor({state:'hidden'});
   await written(page);await confirmed(page,'How do I fold a paper hat?');assert.equal(await page.getByLabel('Or type a question',{exact:true}).inputValue(),'How do I grow coriander?');
   releaseAsk(2);await page.waitForTimeout(250);assert.ok(counts.abortedAskRequests>=1);assert.equal(counts.askRequests,2);
  });
 });
 const newAnswer={...syntheticAnswer,message:'Sow coriander seeds in moist soil.',paragraphs:[{text:'Sow coriander seeds in moist soil.',sourceIds:['S1']}]};
 await run('UI08','Late old response cannot overwrite a new question after cancellation',{holdAskNumbers:[1],ignoreAskAbortNumbers:[1],askReplies:[{json:syntheticAnswer},{json:newAnswer}]},async({page,counts,releaseAsk},step)=>{
  await step('Cancel an old request whose transport ignores abort',async()=>{await typed(page);await page.locator('.answer-progress').waitFor({state:'visible'});await page.locator('.answer-progress').getByRole('button',{name:'Cancel',exact:true}).click();});
  await step('Render the newer answer before the old response arrives',async()=>{await typed(page,'How do I grow coriander?');await written(page,newAnswer.message);await confirmed(page,'How do I grow coriander?');});
  await step('Discard the delayed old answer',async()=>{releaseAsk(1);await page.waitForTimeout(400);await written(page,newAnswer.message);await confirmed(page,'How do I grow coriander?');assert.equal(await page.locator('.answer-paragraph').filter({hasText:answerText}).count(),0);assert.equal(counts.askRequests,2);});
 });
 await run('UI09','Greeting reports its own playback state without pretending to answer a question',{holdSpeech:true},async({page,counts,releaseSpeech},step)=>{
  await step('Display greeting playback status',async()=>{await page.getByRole('button',{name:'Hear a welcome',exact:true}).click();await page.locator('.playback-status').waitFor({state:'visible'});assert.match(await page.locator('.playback-status').innerText(),/greeting|welcome/i);assert.equal(counts.askRequests,0);assert.equal(await page.locator('.answer-progress').count(),0);});
  await step('Recover from greeting audio failure',async()=>{releaseSpeech();await page.locator('.audio-status').filter({hasText:'Audio is unavailable'}).waitFor({state:'visible'});assert.equal(counts.askRequests,0);});
 });
 await run('UI10','Answer-ready status and optional playback remain separate from written content',{holdSpeech:true},async({page,releaseSpeech},step)=>{
  await step('Render answer-ready and retain confirmed question',async()=>{await typed(page);await written(page);await confirmed(page);await page.locator('.answer-ready').waitFor({state:'visible'});});
  await step('Display optional answer playback while text remains visible',async()=>{await page.getByRole('button',{name:'Listen',exact:true}).click();await page.locator('.playback-status').waitFor({state:'visible'});assert.match(await page.locator('.playback-status').innerText(),/answer|playing|playback/i);await written(page);assert.equal(await page.locator('.answer-progress').count(),0);});
  await step('Preserve answer after both playback mechanisms fail',async()=>{releaseSpeech();await page.locator('.audio-status').filter({hasText:'Audio is unavailable'}).waitFor({state:'visible'});await written(page);await confirmed(page);});
 });
 await run('UI11','Reset discards an uncooperative delayed answer',{holdAskNumbers:[1],ignoreAskAbortNumbers:[1]},async({page,releaseAsk},step)=>{
  await step('Reset while answer is pending',async()=>{await typed(page);await page.locator('.answer-progress').waitFor({state:'visible'});await page.getByRole('button',{name:'New question',exact:true}).click();});
  await step('Ignore the pre-reset answer',async()=>{releaseAsk(1);await page.waitForTimeout(400);assert.equal(await page.locator('.answer-paragraph').count(),0);assert.equal(await page.locator('.confirmed-question').count(),0);assert.equal(await page.locator('.answer-progress').count(),0);});
 });
 await run('UI12','Language change cancels pending work and discards its stale response',{holdAskNumbers:[1],ignoreAskAbortNumbers:[1]},async({page,releaseAsk},step)=>{
  await step('Change language while request is pending',async()=>{await typed(page);await page.locator('.answer-progress').waitFor({state:'visible'});assert.equal(await page.getByLabel('Language',{exact:true}).isDisabled(),false);await page.getByLabel('Language',{exact:true}).selectOption('te');});
  await step('Ignore the old-language answer',async()=>{releaseAsk(1);await page.waitForTimeout(400);assert.equal(await page.locator('.answer-paragraph').count(),0);assert.equal(await page.locator('.confirmed-question').count(),0);assert.equal(await page.locator('.answer-progress').count(),0);});
 });
 const timeoutDecision={kind:'unsupported',outcome:'timeout',engine:'rules',reason:'review-timeout',message:'The answer took too long. Your question is still here. Please try again.'};
 const serviceDecision={kind:'unsupported',outcome:'service-error',engine:'rules',reason:'draft-model-unavailable',message:'The answer service is temporarily unavailable. Your question is still here. Please try again.'};
 await run('UI13','Timeout displays a recoverable timeout message and retries the confirmed question',{askReplies:[{json:timeoutDecision}]},async({page,counts,submittedQuestions},step)=>{
  await step('Distinguish timeout from insufficient supporting evidence',async()=>{await typed(page);await page.locator('.answer-request-error').waitFor({state:'visible'});assert.match(await page.locator('.answer-request-error').innerText(),/too long/i);assert.equal(await page.locator('.boundary-answer').count(),0);await confirmed(page);});
  await step('Retry timed-out question successfully',async()=>{await page.getByRole('button',{name:'Try again',exact:true}).click();await written(page);await confirmed(page);await page.locator('.answer-ready').waitFor({state:'visible'});assert.equal(counts.askRequests,2);assert.deepEqual(submittedQuestions,[paperQuestion,paperQuestion]);});
 });
 await run('UI14','Temporary provider failure preserves previous useful answer and offers retry',{askReplies:[{json:syntheticAnswer},{json:serviceDecision}]},async({page,counts},step)=>{
  await step('Render an initial useful answer',async()=>{await typed(page);await written(page);});
  await step('Display outage without replacing prior answer with a fallback',async()=>{await typed(page,'How do I fold a paper hat?');await page.locator('.answer-request-error').waitFor({state:'visible'});assert.match(await page.locator('.answer-request-error').innerText(),/temporarily unavailable/i);await written(page);await confirmed(page,'How do I fold a paper hat?');assert.equal(await page.locator('.boundary-answer').count(),0);assert.equal(await page.locator('.previous-question').count(),1);});
  await step('Retry after provider recovers',async()=>{await page.getByRole('button',{name:'Try again',exact:true}).click();await page.locator('.answer-request-error').waitFor({state:'hidden'});await written(page);await confirmed(page,'How do I fold a paper hat?');assert.equal(counts.askRequests,3);});
 });
 await run('UI15','Stopping pending answer audio aborts generation without hiding the written answer',{holdSpeech:true},async({page,counts,releaseSpeech},step)=>{
  await step('Begin optional audio for a valid answer',async()=>{await typed(page);await written(page);const requested=page.waitForRequest(request=>request.url().endsWith('/api/speak'));await page.getByRole('button',{name:'Listen',exact:true}).click();await requested;await page.locator('.playback-status').waitFor({state:'visible'});});
  await step('Stop pending audio and keep text without starting fallback speech',async()=>{await page.locator('.source-answer .listen-button').click();releaseSpeech();await page.locator('.playback-status').waitFor({state:'hidden'});await page.waitForTimeout(250);await written(page);await confirmed(page);assert.ok(counts.abortedSpeechRequests>=1);assert.equal(await page.locator('.audio-status').count(),0);assert.equal(await page.evaluate(()=>window.__uiHarness.synthSpeakCalls),0);});
 });
 await run('UI16','Starting microphone recording cancels a pending greeting before listening',{holdSpeech:true},async({page,counts,releaseSpeech},step)=>{
  await step('Begin pending spoken greeting',async()=>{const requested=page.waitForRequest(request=>request.url().endsWith('/api/speak'));await page.getByRole('button',{name:'Hear a welcome',exact:true}).click();await requested;await page.locator('.playback-status').waitFor({state:'visible'});});
  await step('Cancel greeting generation as microphone starts',async()=>{await startVoice(page);await allowVoice(page);releaseSpeech();await page.waitForTimeout(250);assert.ok(counts.abortedSpeechRequests>=1);assert.equal(await page.locator('.playback-status').count(),0);assert.equal(await page.evaluate(()=>window.__uiHarness.synthSpeakCalls),0);assert.equal(counts.askRequests,0);});
 });
 const evidenceDecision={kind:'unsupported',outcome:'insufficient-evidence',engine:'rules',reason:'answer-review-rejected',message:'I could not verify enough supporting information for this question. Please try again.'};
 const simplifiedAnswer={...syntheticAnswer,message:'Fold the paper in half and press the crease.',paragraphs:[{text:'Fold the paper in half and press the crease.',sourceIds:['S1']}]};
 const refusalDecision={kind:'blocked',outcome:'safety-refusal',engine:'rules',reason:'safety',message:'I cannot help with that request.'};
 await run('UI17','Insufficient evidence preserves the previous answer and retries the new question without changing safety refusal behavior',{askReplies:[{json:syntheticAnswer},{json:evidenceDecision},{json:simplifiedAnswer},{json:refusalDecision}]},async({page,counts,submittedQuestions},step)=>{
  const followup='Can you make the paper boat instructions simpler?';
  await step('Render an initial useful answer',async()=>{await typed(page);await written(page);});
  await step('Keep previous answer and confirmed follow-up after insufficient evidence',async()=>{
   await typed(page,followup);const notice=page.locator('.answer-request-error');await notice.waitFor({state:'visible'});
   assert.equal(await notice.getAttribute('data-outcome'),'insufficient-evidence');assert.match(await notice.innerText(),/supporting information/i);
   await written(page);await confirmed(page,followup);assert.match(await page.locator('.previous-question').innerText(),/How can I make a paper boat\?/);
   assert.equal(await page.locator('.boundary-answer').count(),0);assert.equal(await page.locator('.answer-ready').count(),0);assert.equal(await page.getByRole('button',{name:'Try again',exact:true}).isEnabled(),true);
  });
  await step('Retry the retained follow-up and replace the old answer after success',async()=>{
   await page.getByRole('button',{name:'Try again',exact:true}).click();await written(page,simplifiedAnswer.message);await confirmed(page,followup);
   assert.equal(await page.locator('.answer-request-error').count(),0);assert.equal(await page.locator('.previous-question').count(),0);assert.deepEqual(submittedQuestions,[paperQuestion,followup,followup]);
  });
  await step('Continue to show genuine safety refusal instead of keeping an old answer',async()=>{
   await typed(page,'Synthetic refused question');await page.locator('.boundary-answer').waitFor({state:'visible'});
   assert.match(await page.locator('.boundary-answer').innerText(),/cannot help/i);assert.equal(await page.locator('.answer-paragraph').count(),0);assert.equal(await page.locator('.answer-request-error').count(),0);assert.equal(counts.askRequests,4);
  });
 });
}finally{await browser.close();}
const report={generatedAt:new Date().toISOString(),scope:'Actual rendered Chromium UI against the local app; all API responses, microphone capture, recognition, and playback mocked. No live providers or physical microphone/phone tested. Only case results and request/error counts are recorded.',results};
await fs.mkdir('docs/evidence',{recursive:true});
await fs.writeFile('docs/evidence/latency-ui-contract-results.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({cases:results.length,passed:results.filter(result=>result.passed).length,failed:results.filter(result=>!result.passed),liveProvidersTested:false,physicalMicrophoneTested:false},null,2));
if(results.some(result=>!result.passed))process.exitCode=1;
