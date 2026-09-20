// Route-level contracts with synthetic answers/keys. No provider or microphone calls.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';

const require=createRequire(import.meta.url);
async function compile(file,dependencies={},globals={}){
 const source=await fs.readFile(file,'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const compiledModule={exports:{}};
 const context={module:compiledModule,exports:compiledModule.exports,require:id=>id in dependencies?dependencies[id]:require(id),Request,Response,URL,Uint8Array,TextEncoder,TextDecoder,Error,crypto,atob,btoa,fetch,AbortController,AbortSignal,DOMException,...globals};
 new vm.Script(output,{filename:file}).runInNewContext(context);
 return compiledModule.exports;
}
const safety=await compile('lib/server-safety.ts');
const diagnostics=await compile('lib/answer-diagnostics.ts');
const evidenceCache=await compile('lib/followup-evidence.ts',{}, {structuredClone});
const syntheticAnswer={kind:'answer',engine:'search+fireworks',reason:'source-backed-reviewed',message:'Fold a rectangular sheet in half.',paragraphs:[{text:'Fold a rectangular sheet in half.',sourceIds:['S1']}],checks:{citationQuotes:true,modelReview:true}};
const results=[];
const check=(value,message)=>{if(!value)throw Error(message);};
async function test(name,run){try{await run();results.push({name,passed:true});}catch{results.push({name,passed:false});}}
async function route({sign=safety.signSpeech,answer=async()=>({...syntheticAnswer}),env={FIREWORKS_API_KEY:'SYNTHETIC_TEST_KEY'},nodeEnv='production'}={}){
 return compile('app/api/ask/route.ts',{
  'cloudflare:workers':{env},
  '@/lib/agent':{MAX_INPUT:1200},
  '@/lib/answers':{answerQuestion:answer},
  '@/lib/answer-diagnostics':diagnostics,
  '@/lib/server-safety':{...safety,signSpeech:sign},
  '@/lib/followup-evidence':evidenceCache,
 },{process:{env:{NODE_ENV:nodeEnv}}});
}
const request=(body={message:'How can I make a paper boat?',language:'en'},headers={},url='https://swayam.invalid/api/ask')=>new Request(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});

await test('Audio signing failure preserves the written answer and validation flags',async()=>{
 const api=await route({sign:async()=>{throw Error('SYNTHETIC_PRIVATE_SIGNER_FAILURE');}});
 const response=await api.POST(request());const data=await response.json();
 check(response.status===200,'Written answer was discarded');
 check(data.kind==='answer'&&data.message===syntheticAnswer.message&&data.paragraphs.length===1,'Written answer changed');
 check(data.checks.citationQuotes&&data.checks.modelReview,'Validation flags changed');
 check(!data.speechToken&&!JSON.stringify(data).includes('SYNTHETIC'),'Signing details leaked');
 check(response.headers.get('Cache-Control')==='no-store','Response caching changed');
});
await test('Successful signing remains bound to the browser session',async()=>{
 const api=await route();const response=await api.POST(request());const data=await response.json();
 const session=response.headers.get('Set-Cookie')?.match(/swayam_session=([^;]+)/)?.[1];
 check(response.status===200&&session&&data.speechToken,'Speech capability missing');
 const signed=await safety.verifySpeech(data.speechToken,session,'SYNTHETIC_TEST_KEY');
 check(signed.text===syntheticAnswer.message&&signed.language==='en','Signed content changed');
 let rejected=false;try{await safety.verifySpeech(data.speechToken,'different-session','SYNTHETIC_TEST_KEY');}catch{rejected=true;}
 check(rejected,'Cross-session token accepted');
});
await test('Invalid input is rejected before answer generation',async()=>{
 let calls=0;const api=await route({answer:async()=>{calls++;return syntheticAnswer;}});
 const response=await api.POST(request({message:'',language:'en'}));
 check(response.status===400&&calls===0,'Invalid input reached answer generation');
});
await test('Cross-origin input is rejected before answer generation',async()=>{
 let calls=0;const api=await route({answer:async()=>{calls++;return syntheticAnswer;}});
 const response=await api.POST(request(undefined,{Origin:'https://another.invalid'}));
 check(response.status===403&&calls===0,'Cross-origin input reached answer generation');
});
await test('Unsigned context cannot reach the answer pipeline',async()=>{
 let observed;const api=await route({answer:async input=>{observed=input;return {...syntheticAnswer};}});
 const response=await api.POST(request({message:'Explain the first step.',language:'en',contextToken:'forged.context'}));
 check(response.status===200&&!observed.priorAnswer,'Forged context was trusted');
});
await test('Oversized request is rejected before answer generation',async()=>{
 let calls=0;const api=await route({answer:async()=>{calls++;return syntheticAnswer;}});
 const response=await api.POST(request({message:'x'.repeat(42001),language:'en'}));
 check(response.status===413&&calls===0,'Oversized request reached answer generation');
});
await test('Ask route forwards the original request signal as the fifth pipeline argument',async()=>{
 let received;const api=await route({answer:async(...args)=>{received=args;return {...syntheticAnswer};}});
 const req=request();const response=await api.POST(req);
 check(response.status===200&&received?.[4]===req.signal,'Request cancellation did not reach the pipeline');
 check(typeof received[2]==='function','Provider fetch argument changed');
});
await test('Production and nonlocal requests never expose development diagnostics',async()=>{
 for(const [nodeEnv,url] of [['production','http://localhost/api/ask'],['development','https://swayam.invalid/api/ask']]){
  let received;const api=await route({nodeEnv,answer:async(...args)=>{received=args;return {...syntheticAnswer};}});
  const response=await api.POST(request(undefined,{'X-Swayam-Test-Case':'live-en-biryani'},url));const data=await response.json();
  check(response.status===200&&!('diagnostics' in data)&&received[3]===undefined,'Private diagnostic surface escaped local development');
 }
});
await test('Local development diagnostics only contain approved counts and fixed codes',async()=>{
 const api=await route({nodeEnv:'development',answer:async(_input,_env,_fetch,trace)=>{
  check(trace,'Local development trace missing');
  trace.begin('planning')({providerHTTPStatus:200,finishReason:'SYNTHETIC_PRIVATE_RESPONSE',promptTokens:12,completionTokens:3,totalTokens:15,reasoningTokens:0,sourceCount:2,controlledError:'SYNTHETIC_PRIVATE_ERROR',question:'SYNTHETIC_PRIVATE_QUESTION',credential:'SYNTHETIC_PRIVATE_KEY',token:'SYNTHETIC_SIGNED_TOKEN'});
  return {...syntheticAnswer};
 }});
 const response=await api.POST(request(undefined,{'X-Swayam-Test-Case':'SYNTHETIC_PRIVATE_CASE'},'http://localhost/api/ask'));const data=await response.json();
 const trace=data.diagnostics;check(response.status===200&&trace&&trace.requestId,'Development trace missing');
 const traceKeys=new Set(['requestId','caseId','elapsedMs','events']);
 const eventKeys=new Set(['stage','elapsedMs','attempt','controlledError','providerHTTPStatus','finishReason','promptTokens','completionTokens','totalTokens','reasoningTokens','sourceCount','usableSourceCount']);
 check(Object.keys(trace).every(key=>traceKeys.has(key)),'Unexpected top-level trace field');
 check(trace.events.every(event=>Object.keys(event).every(key=>eventKeys.has(key))),'Unexpected event field');
 check(!JSON.stringify(trace).includes('SYNTHETIC')&&!trace.caseId,'Untrusted content entered trace');
 check(trace.events[0].finishReason==='other'&&trace.events[0].controlledError===null,'Uncontrolled provider/error text leaked');
 check(trace.events[0].promptTokens===12&&trace.events[0].providerHTTPStatus===200,'Useful numeric diagnostics missing');
});

const report={generatedAt:new Date().toISOString(),scope:'Real ask route and session/body/origin controls; synthetic answer generation and synthetic secrets. Signing-failure test injects a throwing signer. No live providers, microphone, or browser tested by this script.',results};
await fs.mkdir('docs/evidence',{recursive:true});
await fs.writeFile('docs/evidence/ask-route-contract-results.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({cases:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).map(r=>r.name),liveProvidersTested:false},null,2));
if(results.some(r=>!r.passed))process.exitCode=1;
