// Content-free telemetry contracts; no provider or browser requests.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {z} from 'zod';
const source=await fs.readFile('lib/answer-diagnostics.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const compiledModule={exports:{}};
new vm.Script(compiled).runInNewContext({module:compiledModule,exports:compiledModule.exports,crypto,Error,Date});
const {createAnswerDiagnostics,diagnosticError,draftValidationFeedback}=compiledModule.exports;
const results=[];
function check(condition){if(!condition)throw Error('contract-failed');}
function test(name,run){try{run();results.push({name,passed:true});}catch{results.push({name,passed:false});}}
test('Only allowlisted synthetic case IDs are retained',()=>{
 check(createAnswerDiagnostics('baseline-te-biryani').snapshot().caseId==='baseline-te-biryani');
 check(!createAnswerDiagnostics('SYNTHETIC_PRIVATE_QUESTION').snapshot().caseId);
});
test('Unknown provider strings and extra payload fields cannot enter diagnostics',()=>{
 const trace=createAnswerDiagnostics();
 trace.begin('review')({providerHTTPStatus:503,finishReason:'SYNTHETIC_PRIVATE_PROVIDER_RESPONSE',controlledError:'SYNTHETIC_PRIVATE_ERROR',question:'SYNTHETIC_PRIVATE_QUESTION',reasoning:'SYNTHETIC_PRIVATE_REASONING',speechToken:'SYNTHETIC_PRIVATE_TOKEN'});
 const output=trace.snapshot();
 check(output.events[0].providerHTTPStatus===503&&output.events[0].finishReason==='other');
 check(!JSON.stringify(output).includes('SYNTHETIC_PRIVATE'));
});
test('Numeric metrics reject strings, negatives and non-finite values',()=>{
 const trace=createAnswerDiagnostics();
 trace.begin('draft')({promptTokens:'SYNTHETIC_PRIVATE',completionTokens:Infinity,totalTokens:-1,reasoningTokens:250});
 const event=trace.snapshot().events[0];
 check(event.promptTokens===null&&event.completionTokens===null&&event.totalTokens===null&&event.reasoningTokens===250);
});
test('Attempts remain separate and completion callbacks cannot duplicate events',()=>{
 const trace=createAnswerDiagnostics();const first=trace.begin('review');first({finishReason:'length'});first({finishReason:'stop'});trace.begin('review')({finishReason:'stop'});
 const events=trace.snapshot().events;
 check(events.length===2&&events[0].attempt===1&&events[1].attempt===2&&events[0].finishReason==='length');
});
test('Provider exceptions become controlled codes without retaining messages',()=>{
 const trace=createAnswerDiagnostics();trace.begin('planning')();trace.failure('planning',new Error('SYNTHETIC_PRIVATE_PROVIDER_ERROR'));
 check(trace.snapshot().events[0].controlledError==='failed');
 check(diagnosticError(new Error('model-incomplete'))==='model-incomplete');
 check(!JSON.stringify(trace.snapshot()).includes('SYNTHETIC_PRIVATE'));
});
test('Snapshots cannot mutate the stored trace',()=>{
 const trace=createAnswerDiagnostics();trace.begin('input')();trace.snapshot().events[0].controlledError='SYNTHETIC_PRIVATE';
 check(trace.snapshot().events[0].controlledError===null);
});
test('Known Zod paths produce fixed length and reference codes',()=>{
 const schema=z.object({paragraphs:z.array(z.object({text:z.string().max(900),evidenceIds:z.array(z.string().regex(/^E[1-9]\d{0,2}$/)).max(3)})).max(12)});
 const draft={paragraphs:[{text:'A safe short answer.',evidenceIds:['E1']}]};
 const cases=[
  [{paragraphs:[{...draft.paragraphs[0],text:'x'.repeat(901)}]},'paragraph-too-long'],
  [{paragraphs:Array.from({length:13},()=>draft.paragraphs[0])},'too-many-paragraphs'],
  [{paragraphs:[{...draft.paragraphs[0],evidenceIds:['E1','E2','E3','E4']}]},'too-many-evidence'],
  [{paragraphs:[{...draft.paragraphs[0],evidenceIds:['SYNTHETIC_PRIVATE_REFERENCE']}]},'invalid-evidence-reference'],
 ];
 for(const [input,code] of cases){const result=schema.safeParse(input);check(!result.success&&diagnosticError(result.error)===code);const trace=createAnswerDiagnostics();trace.failure('citation-validation',result.error);check(trace.snapshot().events[0].controlledError===code);check(!JSON.stringify(trace.snapshot()).includes('SYNTHETIC_PRIVATE'));}
});
test('Unknown schema paths, keys, and messages cannot enter feedback or traces',()=>{
 const error=new Error('SYNTHETIC_PRIVATE_MESSAGE');error.name='ZodError';error.issues=[{code:'too_big',path:['SYNTHETIC_PRIVATE_PATH'],message:'SYNTHETIC_PRIVATE_MESSAGE',input:'SYNTHETIC_PRIVATE_INPUT',keys:['SYNTHETIC_PRIVATE_KEY']}];
 check(diagnosticError(error)==='invalid-schema');
 const trace=createAnswerDiagnostics();trace.failure('citation-validation',error);
 check(!JSON.stringify({trace:trace.snapshot(),feedback:draftValidationFeedback(error)}).includes('SYNTHETIC_PRIVATE'));
});
test('Length repair feedback identifies exact fixed bounds without rejected text',()=>{
 const error=new Error('SYNTHETIC_PRIVATE_MESSAGE');error.name='ZodError';error.issues=[{code:'too_big',path:['paragraphs',0,'text'],input:'SYNTHETIC_PRIVATE_INPUT'}];
 const feedback=draftValidationFeedback(error);
 check(feedback.includes('900')&&feedback.includes('12')&&feedback.includes('2800')&&!feedback.includes('SYNTHETIC_PRIVATE'));
 check(draftValidationFeedback(new Error('output-too-long')).includes('2800'));
});
const report={generatedAt:new Date().toISOString(),scope:'Synthetic diagnostics-only contracts. No user data or live providers.',results};
await fs.mkdir('docs/evidence',{recursive:true});
await fs.writeFile('docs/evidence/diagnostic-contract-results.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({cases:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).map(r=>r.name),liveProvidersTested:false},null,2));
if(results.some(result=>!result.passed))process.exitCode=1;
