// Run from the repository root. Makes paid provider calls; never logs secrets or payloads.
import ts from 'typescript';
import fs from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const language=process.argv[2]||'en';
if(!['en','te'].includes(language))throw Error('Use en or te');
const dir=new URL('../.sites-runtime/live-probe/',import.meta.url);
await fs.mkdir(dir,{recursive:true});
for(const name of ['guides','fireworks-options','answer-runtime','agent','answer-diagnostics','evidence','followup-evidence','answers']){
 const source=await fs.readFile(`lib/${name}.ts`,'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 await fs.writeFile(new URL(`${name}.cjs`,dir),compiled.replace(/require\("\.\/([^"/]+)"\)/g,'require("./$1.cjs")'));
}
const {answerQuestion}=createRequire(import.meta.url)(fileURLToPath(new URL('answers.cjs',dir)));
const env=parseEnv(await fs.readFile('.dev.vars','utf8'));
const stages=[];
const fetcher=async(url,opts)=>{
 const request=JSON.parse(opts.body);
 const system=request.messages?.[0]?.content||'';
 const stage=url.includes('ydc-index')?'search':system.includes('request planner')?'planner':system.includes('skeptical')?'review':'draft';
 const started=Date.now();
 try{
  const response=await fetch(url,opts);
  const data=await response.clone().json();
  const choice=data.choices?.[0];
  const item={stage,status:response.status,elapsedMs:Date.now()-started};
  if(choice){item.finish=['stop','length'].includes(choice.finish_reason)?choice.finish_reason:'other';item.contentLength=choice.message?.content?.length||0;item.reasoningLength=choice.message?.reasoning_content?.length||0;}
  if(stage==='search')item.results=data.results?.web?.length||0;
  if(stage==='review'&&choice?.finish_reason==='stop'){
   try{const verdict=JSON.parse(choice.message.content);item.verdict=Object.fromEntries(['complete','supported','safe','languageCorrect'].map(k=>[k,verdict[k]===true]));item.missingEssentialActionCount=Array.isArray(verdict.missingEssentialActions)?verdict.missingEssentialActions.length:null;}catch{/* Application validation handles malformed JSON. */}
  }
  stages.push(item);console.log(JSON.stringify(item));return response;
 }catch{const item={stage,networkFailure:true};stages.push(item);console.log(JSON.stringify(item));throw Error('network');}
};
const answer=await answerQuestion({message:language==='te'?'కాగితంతో పడవ ఎలా చేయాలి?':'How can I make a paper boat?',language},env,fetcher);
const result={kind:answer.kind,reason:answer.reason,checks:answer.checks,sources:answer.sources?.length};
console.log(JSON.stringify(result));
await fs.writeFile(new URL(`result-${language}.json`,dir),JSON.stringify({generatedAt:new Date().toISOString(),language,stages,result},null,2));
if(answer.kind!=='answer')process.exitCode=1;
