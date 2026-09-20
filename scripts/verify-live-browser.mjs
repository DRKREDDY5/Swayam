// Real browser submissions; only public synthetic case IDs and controlled metadata are logged.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const moduleName=process.env.PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(/^[A-Za-z]:[\\/]/.test(moduleName)?pathToFileURL(moduleName).href:moduleName);
const phase=process.argv[2]||'after';
const cases=[
 {id:'te-biryani',language:'te',question:'చికెన్ బిర్యానీ వండటమెలా'},
 {id:'en-biryani',language:'en',question:'How do I cook chicken biryani?'},
 {id:'te-boat',language:'te',question:'కాగితంతో పడవ ఎలా చేయాలి?'},
 ...(phase==='baseline'?[]:[
 {id:'transliterated-boat',language:'te',question:'kagitham tho padava ela cheyali'},
 {id:'te-veg-biryani',language:'te',question:'వెజ్ బిర్యానీ ఎలా చేయాలి?'},
 {id:'new-benign',language:'te',question:'కుండీలో కొత్తిమీరను ఎలా పెంచాలి?',followup:true}])
].filter(item=>process.argv.length<4||process.argv.slice(3).includes(item.id));
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const results=[];
async function submit(page,item,errors){
 const caseId=`${phase==='baseline'?'baseline':'live'}-${item.id}`;
 await page.setExtraHTTPHeaders({'X-Swayam-Test-Case':caseId});
 await page.locator('.ask-form textarea').fill(item.question);
 const started=Date.now();const pending=page.waitForResponse(r=>r.url().endsWith('/api/ask'),{timeout:450000});
 await page.locator('.ask-form button[type=submit]').click();
 const r=await pending;const answer=await r.json();
 await page.waitForFunction(()=>document.querySelector('[aria-busy="true"]')===null);
 const rendered=await page.locator('.answer-paragraph').count();
 const questionVisible=(await page.locator('.question-echo').innerText()).includes(item.question);
 const renderedAnswer=answer.kind==='answer'&&rendered>0&&questionVisible&&answer.sources?.length>0&&answer.checks?.citationQuotes===true&&answer.checks?.modelReview===true;
 const result={caseId,language:item.language,route:answer.kind==='guide'?'prepared-guide':answer.engine==='search+fireworks'?'uncached-ai':'failed-ai',elapsedMs:Date.now()-started,httpStatus:r.status(),kind:answer.kind,reason:answer.reason,outcome:answer.outcome||null,renderedAnswer:!!renderedAnswer,usefulAnswer:renderedAnswer?null:false,usefulnessReview:renderedAnswer?'pending-content-audit':'no-generated-answer',renderedParagraphs:rendered,questionVisible,sourceUrls:answer.sources?.map(s=>s.url)||[],checks:answer.checks||null,diagnostics:answer.diagnostics||null,pageErrorCount:errors.length};
 await page.screenshot({path:`docs/evidence/latency-${phase}-${caseId}.png`,fullPage:true});
 results.push(result);await fs.writeFile(`docs/evidence/latency-${phase}.json`,JSON.stringify({testedAt:new Date().toISOString(),scope:'Actual rendered Chrome UI, real configured providers; first three cases run concurrently; no answer/source bodies, secrets, cookies, or tokens logged.',results},null,2));
 console.log(JSON.stringify(result));
}
async function run(item){
 const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.name));
 try{await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/status')),page.goto(process.env.UI_BASE_URL||'http://localhost:5173')]);await page.getByLabel('Language',{exact:true}).selectOption(item.language);await submit(page,item,errors);if(item.followup)await submit(page,{id:'followup',language:'te',question:'ఇంకా సులభంగా చెప్పండి'},errors);}catch(error){results.push({caseId:`${phase==='baseline'?'baseline':'live'}-${item.id}`,language:item.language,usefulAnswer:false,error:error.name==='TimeoutError'?'browser-timeout':'browser-failure'});console.log(JSON.stringify(results.at(-1)));}finally{await context.close();}
}
try{await Promise.all(cases.slice(0,3).map(run));for(const item of cases.slice(3))await run(item);}finally{await browser.close();}
await fs.writeFile(`docs/evidence/latency-${phase}.json`,JSON.stringify({testedAt:new Date().toISOString(),scope:'Actual rendered Chrome UI, live configured providers. First three cases concurrent, remaining sequential. All failures retained. No question/transcript/answer/source bodies, provider payloads, secrets, cookies, or tokens logged.',results},null,2));
// Rendering and model approval are necessary but are not proof of usefulness.
// Audit the saved rendered procedures against their sources before reporting it.
if(results.some(r=>!r.renderedAnswer))process.exitCode=1;
