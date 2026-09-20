// Render the existing artwork at the requested sizes. All APIs are mocked.
// Records geometry and synthetic screenshots only; no credentials or provider calls.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const moduleName=process.env.PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(/^[A-Za-z]:[\\/]/.test(moduleName)?pathToFileURL(moduleName).href:moduleName);
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const baseURL=process.env.UI_BASE_URL||'http://localhost:5173';
const caption='మీ సందేహం, మీ మాటల్లో. ఈ బటన్లకు మించి కూడా అడగవచ్చు.';
const answer={kind:'answer',engine:'search+fireworks',reason:'source-backed-reviewed',language:'en',message:'Fold the paper carefully.',paragraphs:[{text:'Fold the paper carefully.',sourceIds:['S1']}],sources:[{id:'S1',title:'Synthetic layout source',publisher:'example.org',url:'https://example.org/folding',retrievedAt:'2026-09-19T00:00:00.000Z',excerpt:'Fold the paper carefully.',contentKind:'page'}],checks:{citationQuotes:true,modelReview:true}};
const results=[];
await fs.mkdir('docs/evidence',{recursive:true});
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:568}]){
  for(const language of ['te','en']){
   const context=await browser.newContext({viewport});
   const page=await context.newPage();page.setDefaultTimeout(15000);
   let pageErrors=0,requests=0,release;
   page.on('pageerror',()=>pageErrors++);
   const gate=new Promise(resolve=>{release=resolve;});
   await context.route('**/api/**',route=>route.fulfill({status:503,json:{error:'Unmocked layout endpoint'}}));
   await context.route('**/api/status',route=>route.fulfill({json:{modelReady:true,searchReady:true,answersReady:true,transcriptionReady:true,speechReady:true}}));
   await context.route('**/api/ask',async route=>{
    requests++;
    if(requests===1){await gate;await route.fulfill({json:answer});}
    else await route.fulfill({status:503,json:{error:'Synthetic provider outage'}});
   });
   const result={viewport,language,states:[],pageErrors:0,passed:false};
   try{
    await page.goto(baseURL,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>{const select=document.querySelector('select[aria-label="Language"]');return select&&!select.disabled;});
    await page.getByLabel('Language',{exact:true}).selectOption(language);
    await page.locator('.sketch-note img').evaluate(image=>image.decode());
    async function inspect(state){
     // Let the app's smooth scroll to the answer finish, then inspect the top.
     // The artwork stays in normal document flow; it is not a sticky overlay.
     if(state!=='initial')await page.waitForTimeout(800);
     await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
     await page.waitForTimeout(120);
     const geometry=await page.evaluate(()=>{
      const image=document.querySelector('.sketch-note img'),note=image.parentElement,heading=document.querySelector('.intro h1'),speak=document.querySelector('.voice-main'),flag=document.querySelector('.india-flag'),label=note.querySelector('p');
      const bounds=element=>{const rect=element.getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,bottom:rect.bottom};};
      const coreButtons=[...document.querySelectorAll('.topbar button,.intro button,.answer-side button')].map(button=>({location:button.closest('.answer-progress')?'answer-progress':button.closest('.citation-chips')?'citation':button.closest('.answer-request-error')?'retry':button.closest('.intro')?'intro':button.closest('.topbar')?'header':'answer-control',...bounds(button)})).filter(button=>button.width>0&&button.height>0);
      return {image:bounds(image),caption:bounds(label),heading:bounds(heading),speak:bounds(speak),header:bounds(document.querySelector('.topbar')),naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,src:image.getAttribute('src'),captionText:label.textContent,captionLanguage:label.lang,duplicates:document.querySelectorAll('img[src="/images/swayam-voice.png"]').length,domBeforeHeading:!!(note.compareDocumentPosition(heading)&Node.DOCUMENT_POSITION_FOLLOWING),display:getComputedStyle(note).display,objectFit:getComputedStyle(image).objectFit,flagVisible:flag.getBoundingClientRect().width>0,overflow:document.documentElement.scrollWidth>innerWidth,viewportHeight:innerHeight,coreButtons};
     });
     result.states.push({state,...geometry});
     assert.equal(geometry.duplicates,1);assert.ok(geometry.domBeforeHeading);assert.equal(geometry.src,'/images/swayam-voice.png');
     assert.ok(geometry.naturalWidth>0);assert.equal(geometry.captionText,caption);assert.equal(geometry.captionLanguage,'te');
     assert.ok(geometry.image.y>=0);assert.ok(geometry.image.y>=geometry.header.bottom);assert.ok(geometry.caption.y>=geometry.image.bottom-1);assert.ok(geometry.heading.y>=geometry.caption.bottom);
     assert.ok(Math.abs(geometry.image.width/geometry.image.height-geometry.naturalWidth/geometry.naturalHeight)<0.02);
     assert.ok(geometry.image.bottom<=viewport.height);assert.ok(geometry.speak.bottom<=viewport.height,`Speak below ${viewport.height}px opening viewport`);
     assert.ok(geometry.speak.height>=44);assert.equal(geometry.display,'flex');assert.equal(geometry.objectFit,'contain');assert.ok(geometry.flagVisible);assert.equal(geometry.overflow,false);
     assert.ok(geometry.coreButtons.every(button=>button.height>=44&&button.width>=44),`Core button below 44px: ${geometry.coreButtons.filter(button=>button.height<44||button.width<44).map(button=>button.location).join(',')}`);
     if(state==='loading')assert.ok(geometry.coreButtons.some(button=>button.location==='answer-progress'),'Cancel control is present during loading');
     if(state==='answer')assert.ok(geometry.coreButtons.some(button=>button.location==='citation'),'Citation control is present with the answer');
     const screenshot=`docs/evidence/latency-layout-${viewport.width}-${language}${state==='initial'?'':`-${state}`}.png`;
     if(state==='initial'||(viewport.width===1440&&language==='te'))await page.screenshot({path:screenshot,fullPage:false});
    }
    await inspect('initial');
    await page.locator('.ask-form textarea').fill('How do I fold paper?');await page.locator('.ask-form button').click();
    await page.locator('.answer-progress').waitFor({state:'visible'});await inspect('loading');release();
    await page.locator('.answer-paragraph').waitFor({state:'visible'});await inspect('answer');
    await page.locator('.ask-form textarea').fill('How do I fold another sheet?');await page.locator('.ask-form button').click();
    await page.locator('.answer-request-error').waitFor({state:'visible'});await inspect('recoverable-error');
    assert.equal(pageErrors,0);result.passed=true;
   }catch(error){result.error=String(error.message).slice(0,250);}
   finally{release();result.pageErrors=pageErrors;results.push(result);await context.close();}
  }
 }
}finally{await browser.close();}
await fs.writeFile('docs/evidence/latency-layout-results.json',JSON.stringify({generatedAt:new Date().toISOString(),scope:'Actual rendered Chromium; all API responses mocked; screenshots contain synthetic public questions and answers. No live provider or physical phone checks.',results},null,2));
console.log(JSON.stringify({layouts:results.length,passed:results.filter(result=>result.passed).length,failures:results.filter(result=>!result.passed).map(({viewport,language,error})=>({viewport,language,error})),statesInspected:results.reduce((total,result)=>total+result.states.length,0)},null,2));
if(results.some(result=>!result.passed))process.exitCode=1;
