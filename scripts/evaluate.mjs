import ts from 'typescript';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'thodu-eval-'));
try{
 for(const name of ['guides','agent','evaluation-cases']){
  const source=await fs.readFile(`lib/${name}.ts`,'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText.replace(/require\("\.\/([^"/]+)"\)/g,'require("./$1.cjs")');
  await fs.writeFile(path.join(temp,`${name}.cjs`),output);
 }
 const require=createRequire(import.meta.url),{runAgent}=require(path.join(temp,'agent.cjs')),{CASES,checkCase}=require(path.join(temp,'evaluation-cases.cjs'));
 const results=[];
 for(const c of CASES){
  const actual=await runAgent({message:c.prompt,language:c.language,...c.context});
  results.push({...c,actual,score:checkCase(c,actual)?'PASS':'FAIL',scope:'Actual application core; rules engine; no model API call'});
 }
 const fixtures=[
  {name:'Extra output field',content:'{"guideId":"lpg","url":"https://example.invalid"}',finish:'stop'},
  {name:'Unknown guide ID',content:'{"guideId":"submit-kyc"}',finish:'stop'},
  {name:'Truncated output',content:'{"guideId":"lpg"}',finish:'length'},
  {name:'Non-JSON HTML',content:'<script>alert(1)</script>',finish:'stop'},
 ];
 const contracts=[];
 for(const f of fixtures){
  const fetcher=async()=>new Response(JSON.stringify({choices:[{finish_reason:f.finish,message:{content:f.content}}]}));
  const actual=await runAgent({message:'How do I do gas KYC?',language:'en'},{FIREWORKS_API_KEY:'TEST_ONLY_NOT_A_SECRET',FIREWORKS_MODEL:'TEST_ONLY'},fetcher);
  contracts.push({name:f.name,scope:'Mocked provider response; NOT a live model attack',actual,score:actual.engine==='rules'&&actual.guideId==='lpg'&&actual.reason.startsWith('provider-fallback:')?'PASS':'FAIL'});
 }
 const report={generatedAt:new Date().toISOString(),mode:'deterministic-application-core',liveModelTested:false,voiceTested:false,scope:'Observed application-core outputs and separate mocked provider-contract tests. Does not establish live-model, browser, speech or production security.',results,contracts};
 await fs.mkdir('public/evidence',{recursive:true});await fs.writeFile('public/evidence/core-results.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({cases:results.length,passed:results.filter(r=>r.score==='PASS').length,contractFixtures:contracts.length,contractsPassed:contracts.filter(r=>r.score==='PASS').length,liveModelTested:false},null,2));
 for(const r of results.filter(r=>r.score==='FAIL'))console.log(r.id,r.actual);
 if([...results,...contracts].some(r=>r.score==='FAIL'))process.exitCode=1;
}finally{await fs.rm(temp,{recursive:true,force:true});}
