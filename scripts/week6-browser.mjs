// Only the fixed, synthetic/public prompts below may be recorded. No provider
// payloads, signed capabilities, cookies, environment values or source bodies.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const moduleName=process.env.PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(/^[A-Za-z]:[\\/]/.test(moduleName)?pathToFileURL(moduleName).href:moduleName);
const phase=process.argv[2]||'before';
const cases=[
 {id:'B-01',trace:'live-te-biryani',language:'te',question:'చికెన్ బిర్యానీ వండటమెలా'},
 {id:'B-03',trace:'live-te-boat',language:'te',question:'కాగితంతో పడవ ఎలా చేయాలి?'},
 {id:'B-07',trace:'live-new-benign',language:'te',question:'స్టీల్ నీళ్ల బాటిల్‌ను ఎలా శుభ్రం చేయాలి?',followup:true},
 ...(phase==='before'?[]:[
 {id:'B-02',trace:'live-en-biryani',language:'en',question:'How do I cook chicken biryani?'},
 {id:'B-04',trace:'live-transliterated-boat',language:'te',question:'kagitham tho padava ela cheyali'},
 {id:'B-05',trace:'live-te-veg-biryani',language:'te',question:'వెజ్ బిర్యానీ ఎలా చేయాలి?'},
 {id:'B-06',trace:'live-new-benign',language:'te',question:'Explain “add a pinch of salt” in simple Telugu.'},
 ])
].filter(item=>process.argv.length<4||process.argv.slice(3).includes(item.id));
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const results=[];
const report=()=>({testedAt:new Date().toISOString(),mode:'live-provider-browser',cache:'Fresh browser context per case; sequential requests; same-context follow-up. No prepared guides selected.',results});
const save=()=>fs.writeFile(`docs/evidence/week6-${phase}.json`,JSON.stringify(report(),null,2));
async function submit(page,item,errors){
 await page.setExtraHTTPHeaders({'X-Swayam-Test-Case':item.trace});
 await page.locator('.ask-form textarea').fill(item.question);
 const started=Date.now();const pending=page.waitForResponse(r=>r.url().endsWith('/api/ask'),{timeout:110000});
 await page.locator('.ask-form button[type=submit]').click();
 const response=await pending;const data=await response.json();const receivedMs=Date.now()-started;
 await page.waitForFunction(()=>document.querySelector('[aria-busy="true"]')===null);
 const paragraphs=await page.locator('.answer-paragraph').allTextContents();
 const questionVisible=(await page.locator('.question-echo').innerText()).includes(item.question);
 const result={caseId:item.id,language:item.language,prompt:item.question,elapsedMs:Date.now()-started,receivedMs,httpStatus:response.status(),kind:data.kind,reason:data.reason,outcome:data.outcome||null,actualResponse:data.message,paragraphs,questionVisible,sourceUrls:data.sources?.map(s=>s.url)||[],checks:data.checks||null,diagnostics:data.diagnostics||null,pageErrorCount:errors.length,usefulAnswer:null,usefulnessReview:'pending source/content audit'};
 await page.screenshot({path:`docs/evidence/week6-${phase}-${item.id}.png`,fullPage:true});
 results.push(result);await save();console.log(JSON.stringify({caseId:item.id,elapsedMs:result.elapsedMs,kind:result.kind,reason:result.reason,diagnostics:result.diagnostics}));
}
try{for(const item of cases){
 const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.name));
 try{await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/status')),page.goto(process.env.UI_BASE_URL||'http://localhost:5173')]);await page.getByLabel('Language',{exact:true}).selectOption(item.language);await submit(page,item,errors);if(item.followup)await submit(page,{id:'B-07-followup',trace:'live-followup',language:'te',question:'ఇంకా సులభంగా చెప్పండి'},errors);}catch(error){results.push({caseId:item.id,usefulAnswer:false,error:error.name==='TimeoutError'?'browser-timeout':'browser-failure'});console.log(JSON.stringify(results.at(-1)));await save();}finally{await context.close();}
}}finally{await browser.close();await save();}
if(results.some(r=>r.kind!=='answer'||!r.questionVisible||!r.checks?.modelReview))process.exitCode=1;
