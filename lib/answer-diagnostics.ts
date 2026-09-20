// Development-only, content-free diagnostics. Never pass request/provider bodies here.
export type AnswerStage='input'|'planning'|'search'|'extraction'|'evidence-reuse'|'draft'|'citation-validation'|'revision'|'review'|'response';
export type DiagnosticMetrics={providerHTTPStatus?:number;finishReason?:unknown;promptTokens?:number;completionTokens?:number;totalTokens?:number;reasoningTokens?:number;sourceCount?:number;usableSourceCount?:number;controlledError?:string};
export type DiagnosticEvent={stage:AnswerStage;elapsedMs:number;attempt:number;controlledError:string|null;providerHTTPStatus:number|null;finishReason:string|null;promptTokens:number|null;completionTokens:number|null;totalTokens:number|null;reasoningTokens:number|null;sourceCount:number|null;usableSourceCount:number|null};
const errors=new Set(['failed','timeout','cancelled','model-unavailable','model-incomplete','search-unavailable','unsafe-output','output-too-long','wrong-language','incomplete-text','unsupported-citation','invalid-json','invalid-schema','paragraph-too-long','too-many-paragraphs','too-many-evidence','invalid-evidence-reference','answer-review-rejected','no-acceptable-sources','blocked-input','repair-identity-number','repair-credential','repair-contact-data','repair-api-key','repair-spoken-identity','review-unsafe','review-wrong-language','review-incomplete','review-incomplete-and-unsupported','review-unsupported']);
function schemaError(error:Error){
 const issues=(error as Error&{issues?:unknown}).issues;
 if(!Array.isArray(issues))return 'invalid-schema';
 for(const issue of issues){
  if(!issue||typeof issue!=='object')continue;
  const {path,code}=issue as {path?:unknown;code?:unknown};
  if(!Array.isArray(path)||path[0]!=='paragraphs')continue;
  const paragraphIndex=typeof path[1]==='number'&&Number.isSafeInteger(path[1])&&path[1]>=0;
  if(code==='too_big'&&path.length===1)return 'too-many-paragraphs';
  if(code==='too_big'&&path.length===3&&paragraphIndex&&path[2]==='text')return 'paragraph-too-long';
  if(code==='too_big'&&path.length===3&&paragraphIndex&&(path[2]==='evidenceIds'||path[2]==='evidence'))return 'too-many-evidence';
  if((code==='invalid_string'||code==='invalid_format')&&path.length===4&&paragraphIndex&&path[2]==='evidenceIds'&&typeof path[3]==='number'&&Number.isSafeInteger(path[3])&&path[3]>=0)return 'invalid-evidence-reference';
 }
 return 'invalid-schema';
}
export function diagnosticError(error:unknown){if(error instanceof Error){if(error.name==='TimeoutError')return 'timeout';if(error.name==='AbortError')return 'cancelled';if(error.name==='SyntaxError')return 'invalid-json';if(error.name==='ZodError')return schemaError(error);if(errors.has(error.message))return error.message;}return 'failed';}
/** Fixed repair instructions only: never include Zod messages, unknown keys,
 * source/provider values, arbitrary schema paths, or rejected content. */
export function draftValidationFeedback(error:unknown){
 const feedback:Record<string,string>={
  'paragraph-too-long':'A paragraph exceeded 900 characters. Split it into shorter complete paragraphs; keep at most 12 paragraphs and at most 2800 characters across all paragraph text.',
  'too-many-paragraphs':'The draft exceeded 12 paragraphs. Combine adjacent actions into at most 12 complete paragraphs while preserving essential preparation and the final operation; each paragraph must stay within 900 characters and all text within 2800 characters.',
  'too-many-evidence':'A paragraph cited more than 3 evidence IDs. Keep 1 to 3 existing evidence IDs that directly support that paragraph; split claims only if needed within the 12-paragraph and 2800-character limits.',
  'invalid-evidence-reference':'An evidence reference had an invalid format. Use only existing evidence IDs supplied in the registry, such as E1; do not supply quotes or source IDs.',
  'unsupported-citation':'An evidence reference was not supported by the supplied registry. Cite only existing evidence IDs that support the paragraph; do not supply quotes or source IDs.',
  'output-too-long':'The combined paragraph text exceeded 2800 characters. Shorten it to at most 2800 characters while preserving required materials, essential transitions, and the final operation.',
  'wrong-language':'Write the corrected answer in the requested language.',
  'incomplete-text':'A paragraph ended in an unfinished phrase. Finish every sentence and preserve the final operation that completes the procedure.',
 };
 return feedback[diagnosticError(error)]||'Return only the required paragraphs object with text and evidenceIds in each paragraph. Obey all schema and length limits; do not supply additional fields.';
}
const count=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
export function createAnswerDiagnostics(caseId?:string){
 const started=Date.now();const events:DiagnosticEvent[]=[];const attempts:Partial<Record<AnswerStage,number>>={};
 const requestId=crypto.randomUUID();
 // These labels identify only public synthetic examples, never arbitrary input.
 const allowedCases=['baseline-te-biryani','baseline-en-biryani','baseline-te-boat','live-te-biryani','live-en-biryani','live-te-boat','live-transliterated-boat','live-te-veg-biryani','live-new-benign','live-followup'];
 const safeCaseId=caseId&&allowedCases.includes(caseId)?caseId:undefined;
 function begin(stage:AnswerStage){
  const startedAt=Date.now();const attempt=(attempts[stage]||0)+1;attempts[stage]=attempt;let completed=false;
  return (metrics:DiagnosticMetrics={})=>{if(completed)return;completed=true;events.push({stage,elapsedMs:Math.max(0,Date.now()-startedAt),attempt,controlledError:metrics.controlledError&&errors.has(metrics.controlledError)?metrics.controlledError:null,providerHTTPStatus:count(metrics.providerHTTPStatus),finishReason:['stop','length','content_filter','tool_calls','function_call'].includes(String(metrics.finishReason))?String(metrics.finishReason):metrics.finishReason===undefined?null:'other',promptTokens:count(metrics.promptTokens),completionTokens:count(metrics.completionTokens),totalTokens:count(metrics.totalTokens),reasoningTokens:count(metrics.reasoningTokens),sourceCount:count(metrics.sourceCount),usableSourceCount:count(metrics.usableSourceCount)});};
 }
 function failure(stage:AnswerStage,error:unknown){const event=events.findLast(e=>e.stage===stage);if(event){if(!event.controlledError?.startsWith('repair-'))event.controlledError=diagnosticError(error);}else begin(stage)({controlledError:diagnosticError(error)});}
 return {begin,failure,snapshot:()=>({requestId,...(safeCaseId?{caseId:safeCaseId}:{}),elapsedMs:Math.max(0,Date.now()-started),events:events.map(event=>({...event}))})};
}
export type AnswerDiagnostics=ReturnType<typeof createAnswerDiagnostics>;
