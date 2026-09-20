// Small inference experiment only. Uses the existing API account and a public
// serverless model listed as accessible. Never alters .dev.vars. One live search
// bundle per pair stays in memory; it is not exported into evidence.
import fs from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {compileLibraries} from './week6-compile.mjs';
const library=await compileLibraries('week6-model-comparison');const {answerQuestion}=library('answers');const {createAnswerDiagnostics}=library('answer-diagnostics');
const env=parseEnv(await fs.readFile('.dev.vars','utf8'));const candidate='accounts/fireworks/models/deepseek-v4-flash-0731';
const cases=[['B-01','చికెన్ బిర్యానీ వండటమెలా'],['B-03','కాగితంతో పడవ ఎలా చేయాలి?'],['B-07','స్టీల్ నీళ్ల బాటిల్‌ను ఎలా శుభ్రం చేయాలి?']];
const results=[];
if(env.FIREWORKS_MODEL===candidate){console.log('Candidate matches existing configuration; no duplicate comparison.');process.exit(0);}
for(const [caseId,message] of cases){let searchData;
 for(const label of ['configured','candidate']){
  const trace=createAnswerDiagnostics();const started=Date.now();
  const fetcher=async(url,init)=>{if(url.includes('ydc-index')){if(searchData)return Response.json(searchData);const response=await fetch(url,init);if(response.ok)searchData=await response.clone().json();return response;}return fetch(url,init);};
  const answer=await answerQuestion({message,language:'te'},label==='candidate'?{...env,FIREWORKS_MODEL:candidate}:env,fetcher,trace);
  const result={caseId,label,prompt:message,kind:answer.kind,outcome:answer.outcome,reason:answer.reason,actualResponse:answer.message,sourceUrls:answer.sources?.map(s=>s.url)||[],checks:answer.checks||null,elapsedMs:Date.now()-started,diagnostics:trace.snapshot(),usefulAnswer:null};results.push(result);
  await fs.writeFile('docs/evidence/week6-model-comparison.json',JSON.stringify({generatedAt:new Date().toISOString(),mode:'live-provider pipeline experiment, not browser acceptance',candidate,conditions:'Configured model first, candidate second, identical in-memory live retrieval bundle per pair; compare model stages, not total time because only the first call pays retrieval. No app cache or prepared guides. Candidate is not adopted by this script.',results},null,2));console.log(JSON.stringify({caseId,label,kind:result.kind,elapsedMs:result.elapsedMs,inferenceMs:result.diagnostics.events.filter(e=>['planning','draft','review','revision'].includes(e.stage)).reduce((s,e)=>s+e.elapsedMs,0)}));
 }
}
