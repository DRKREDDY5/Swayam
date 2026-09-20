import {z} from 'zod';
import {inputReason,normalize,privacyReason} from './agent';

export type Evidence={id:string;sourceId:string;text:string};
export type EvidenceSourceInput={id:string;markdown?:string;description?:string;snippets?:string[]};
const MAX_SOURCE_CHARS=200000;
const MAX_PASSAGE_CHARS=550; // Also fits the existing canonical citation schema.
const SOURCE_EVIDENCE_BUDGETS=[6000,1800,1800];
const MAX_EVIDENCE_CHARS=12000;
const privateReasons=new Set(['identity-number','credential','contact-data','api-key','spoken-identity']);

function sourceHasAttack(raw:string){
 const reason=inputReason(raw);
 if(reason&&!privateReasons.has(reason))return true;
 // inputReason deliberately prioritizes PII. Scan instruction attacks separately
 // so an unrelated contact footer cannot mask an attack elsewhere on the page.
 const normalized=normalize(raw);
 const variants=[normalized,normalized.replace(/[013457]/g,c=>({'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t'}[c]!))];
 for(const token of raw.match(/[A-Za-z0-9+/=]{24,}/g)||[]){try{if(token.length<=1800)variants.push(normalize(atob(token)));}catch{/* Non-base64 source text. */}}
 return variants.some(text=>
  /(ignore|override|bypass).{0,45}(rule|instruction|safety|verification)|developer mode|system override|reveal.{0,35}(prompt|secret|key|hidden configuration)|print.{0,35}(prompt|instruction)|hidden.{0,25}(prompt|instruction)|system prompt|api key|environment variable|tool schema|list.{0,20}tools/.test(text)||
  /(నియమాలు|సూచనలు).{0,20}(మర్చిపో|పక్కన|పట్టించుకోవద్దు)|రహస్య.{0,15}(సూచన|కీ|చూప)|సిస్టమ్ ప్రాంప్ట్/.test(text)||
  /(another|other|previous|someone else).{0,25}(user|session|chat|conversation|aadhaar|account)|ఇతరుల.{0,20}(ఆధార్|సంభాషణ|వివర)|వేరే.{0,20}(ఖాతా|యూజర్)|మునుపటి.{0,15}(చాట్|సంభాషణ)/.test(text)||
  /(complete|submit|approve).{0,30}(kyc|payment|application).{0,20}(for me|now)|mark.{0,15}kyc.{0,15}(done|complete)|skip.{0,20}(otp|verification)|otp.{0,20}(bypass|skip)|వెరిఫికేషన్.{0,15}(దాట|వద్దు)|kyc.{0,20}పూర్తి చేసినట్లు/.test(text));
}

type SectionKind='ingredients'|'instructions'|'other';
type Passage={text:string;position:number;section:string;sectionId:number;kind:SectionKind;score:number};
const sectionPattern=/\b(ingredients|instructions|directions|method|preparation|steps|you will need|how to|materials)\b/i;
const instructionPattern=/\b(add|fold|open|turn|pull|press|cut|place|put|pour|stir|mix|cover|cook|boil|simmer|heat|soak|wash|rinse|drain|marinate|layer|steam|serve|remove|wait|select|click|tap|clean|dry|water|plant|sow|sew|stitch|measure|attach|tie)\b/gi;
const navigationPattern=/\b(skip to|jump to recipe|subscribe|newsletter|affiliate|advertisement|privacy policy|cookie policy|all rights reserved|leave a (?:reply|comment)|follow me|sign up|related recipes|share this|print recipe|rate this)\b/gi;
const stopWords=new Set(['a','an','and','are','as','at','be','by','can','do','does','for','from','how','i','in','is','it','make','me','my','of','on','or','please','the','to','use','what','with','you','your','recipe','recipes','steps','instructions','easy']);
function imageOnly(text:string){
 const withoutImages=text.replace(/!\[[^\]]*\]\((?:[^()]|\([^()]*\))*\)/g,'').replace(/\[\s*\]\((?:[^()]|\([^()]*\))*\)/g,'').replace(/<img\b[^>]*>/gi,'');
 return !withoutImages.trim();
}

function headingInfo(block:string){
 const first=block.trim().split('\n')[0];const label=first.replace(/^#{1,6}\s*/, '').replace(/[*_]/g,'').trim();
 const kind:SectionKind=/\b(?:ingredients|materials|supplies|you(?: will|'ll|’ll) need|what you need)\b/i.test(label)?'ingredients':/\b(?:instructions|directions|method|preparation|how to)\b|^steps?\s*:?$/i.test(label)?'instructions':'other';
 const step=/^\d{1,2}[.)]\s|^step\s+\d/i.test(label)||/^#{1,6}\s+\d{1,2}\s/.test(first);
 const heading=/^#{1,6}\s/.test(first)||/^\*\*[^*]+\*\*\s*$/.test(first)||(block.trim()===first&&first.length<100&&kind!=='other'&&!/[.!?]$/.test(first));
 return {first,label,kind,step,heading,level:/^(#{1,6})\s/.exec(first)?.[1].length||6};
}

function passages(raw:string,terms:string[]){
 const result:Passage[]=[];let section='';let position=0;let sectionId=0;let kind:SectionKind='other';let sectionLevel=0;
 const blocks:{text:string;start:number;end:number}[]=[];let start=0;
 for(const separator of raw.matchAll(/\n\s*\n/g)){const end=separator.index!;blocks.push({text:raw.slice(start,end),start,end});start=end+separator[0].length;}
 blocks.push({text:raw.slice(start),start,end:raw.length});
 for(let blockIndex=0;blockIndex<blocks.length;blockIndex++){
  let block=blocks[blockIndex].text;
  // Screen the complete paragraph before chunking: otherwise a private number
  // or encoded credential can be split into individually innocuous fragments.
  if(inputReason(block)||imageOnly(block))continue;
  const heading=headingInfo(block);
  if(heading.heading){
   // Numbered substeps and ingredient subheadings remain part of one method.
   if(!(heading.step&&kind==='instructions')&&!(heading.kind==='other'&&heading.level>sectionLevel&&kind!=='other')){
    section=heading.label;sectionId++;kind=heading.kind;sectionLevel=heading.level;
   }
  }else if(heading.step&&kind!=='instructions'){
   section='Numbered instructions';sectionId++;kind='instructions';sectionLevel=6;
  }
  // A section label supplies context for nearby instructions, but alone does
  // not support a factual answer and must not consume an evidence reference.
  if(block.trim()===heading.first&&heading.heading&&!(heading.step&&(heading.label.match(instructionPattern)||[]).length))continue;
  if(kind==='ingredients'&&block.trim().length<120){
   // Short ingredient rows separated by blank lines must not disappear merely
   // because a quantity such as "1 egg" is shorter than a citation. Join only
   // contiguous source text, without crossing another heading or private row.
   const ingredientStart=blocks[blockIndex].start;
   while(blockIndex+1<blocks.length){
    const next=blocks[blockIndex+1];if(headingInfo(next.text).heading||next.text.trim().length>=120||inputReason(next.text)||next.end-ingredientStart>MAX_PASSAGE_CHARS)break;
    const combined=raw.slice(ingredientStart,next.end);
    if(combined.length>MAX_PASSAGE_CHARS||inputReason(combined))break;
    block=combined;blockIndex++;
   }
  }
  let offset=0;
  while(offset<block.length){
   let end=Math.min(block.length,offset+MAX_PASSAGE_CHARS);
   if(end<block.length){
    const slice=block.slice(offset,end);const newline=slice.lastIndexOf('\n');
    const sentence=Math.max(slice.lastIndexOf('. '),slice.lastIndexOf('! '),slice.lastIndexOf('? '));
    const boundary=newline>=150?newline:sentence>=150?sentence+1:slice.lastIndexOf(' ');
    if(boundary>=100)end=offset+boundary;
   }
   const text=block.slice(offset,end).trim();offset=end;
   if(text.length<12||imageOnly(text))continue;
   const normalized=normalize(text);
   const topicHits=terms.filter(term=>normalized.includes(term)).length;
   const instructions=(text.match(instructionPattern)||[]).length;
   const navigation=(text.match(navigationPattern)||[]).length;
   const links=(text.match(/\]\(https?:\/\//g)||[]).length;
   const measures=/\b\d+(?:[./]\d+)?\s*(?:cups?|tablespoons?|teaspoons?|tsp|tbsp|grams?|kg|ml|litres?|minutes?|hours?|sheets?)\b/i.test(text);
   const score=topicHits*3+Math.min(instructions,5)*2+(sectionPattern.test(section)?4:0)+(measures?4:0)-navigation*9-links*3;
   if((score>0||kind!=='other')&&!privacyReason(text)&&!inputReason(text)&&!/<\/?(?:script|iframe|form)\b/i.test(text)&&navigation===0)result.push({text,position:position++,section,sectionId,kind,score});
  }
 }
 return result;
}

function coherentPassages(passages:Passage[],procedural:boolean){
 if(!procedural)return passages;
 const groups=new Map<number,Passage[]>();
 for(const passage of passages)if(passage.kind==='instructions')groups.set(passage.sectionId,[...(groups.get(passage.sectionId)||[]),passage]);
 const methods=[...groups.values()];
 if(!methods.length)return passages;
 const methodIds=[...groups.keys()].sort((a,b)=>a-b);
 const candidates=methods.map(method=>{
  const methodId=method[0].sectionId;
  const previousMethod=methodIds.filter(id=>id<methodId).at(-1)??-1;
  const nextMethod=methodIds.find(id=>id>methodId)??Infinity;
  // Recipe cards often split ingredients into adjacent marinade/rice/garnish
  // subsections. Retaining only the nearest subsection loses the main amounts.
  const preceding=passages.filter(p=>p.kind==='ingredients'&&p.sectionId>previousMethod&&p.sectionId<methodId);
  // Ingredients between this overview and a later method belong to that later
  // recipe card; do not borrow its quantities to inflate the overview's score.
  const ingredients=preceding.length?preceding:nextMethod===Infinity?passages.filter(p=>p.kind==='ingredients'&&p.sectionId>methodId):[];
  // Prefer the measured recipe card to a longer illustrated overview on the
  // same page. A greater number of short photo steps is not better evidence.
  const amounts=(ingredients.map(p=>p.text).join('\n').match(/(?:\d+(?:[./]\d+)?(?:\s*[½¼¾])?|[½¼¾])\s*(?:cups?|tablespoons?|teaspoons?|tsp|tbsp|grams?|kilograms?|kg|g|ml|litres?|pounds?|lbs?|cm|mm|inches?|yards?)\b/gi)||[]).length;
  const score=method.reduce((sum,p)=>sum+Math.max(0,p.score)+4,0)+Math.min(amounts,20)*24;
  return {score,measuredIngredients:amounts>0,passages:[...ingredients,...method].sort((a,b)=>a.position-b.position)};
 });
 return candidates.sort((a,b)=>Number(b.measuredIngredients)-Number(a.measuredIngredients)||b.score-a.score)[0].passages;
}

/** Select contiguous passages from already URL-validated sources. No fetches,
 * cache, answer acceptance or semantic-support approval happen in this helper. */
export function extractEvidence(sources:EvidenceSourceInput[],query:string):Evidence[]{
 if(inputReason(query))return [];
 const procedural=/\b(?:how|make|cook|recipe|fold|prepare|plant|grow|steps|instructions)\b/i.test(query);
 const terms=[...new Set(normalize(query).match(/[a-z]{3,}/g)||[])].filter(term=>!stopWords.has(term)).slice(0,20);
 const candidates:{sourceId:string;passages:Passage[];score:number;coherent:boolean}[]=[];
 for(const source of sources.slice(0,8)){
  if(!/^S[1-9]\d{0,2}$/.test(source.id)||candidates.some(candidate=>candidate.sourceId===source.id))continue;
  const parts=[source.markdown,source.description,...(source.snippets||[])].filter((part):part is string=>typeof part==='string'&&part.trim().length>0);
  const raw=parts.join('\n\n');
  if(!raw||raw.length>MAX_SOURCE_CHARS||sourceHasAttack(raw))continue;
  const seen=new Set<string>();
  const all=passages(raw,terms).filter(passage=>{if(seen.has(passage.text))return false;seen.add(passage.text);return true;});
  const selected=coherentPassages(all,procedural);
  const coherent=procedural&&selected.some(p=>p.kind==='instructions');
  const ranked=coherent?selected:selected.sort((a,b)=>b.score-a.score||a.position-b.position);
  if(ranked.length)candidates.push({sourceId:source.id,passages:ranked,score:[...ranked].sort((a,b)=>b.score-a.score).slice(0,3).reduce((sum,passage)=>sum+passage.score,0)+(coherent?12:0),coherent});
 }
 const result:Evidence[]=[];let total=0;
 let acceptedSources=0;
 for(const source of candidates.sort((a,b)=>b.score-a.score)){
  if(acceptedSources>=3)break;
  const sourceBudget=source.coherent?6000:SOURCE_EVIDENCE_BUDGETS[acceptedSources];
  const passageLimit=source.coherent||acceptedSources===0?24:12;
  const completeChars=source.passages.reduce((sum,passage)=>sum+passage.text.length,0);
  // A clipped tutorial is not a complete alternative method. Offer its whole
  // selected method and ingredient cluster, or try the next suitable source.
  if(source.coherent&&(completeChars>sourceBudget||source.passages.length>passageLimit||total+completeChars>MAX_EVIDENCE_CHARS))continue;
  const chosen:Passage[]=[];let sourceTotal=0;
  for(const passage of source.passages){
   if(sourceTotal+passage.text.length>sourceBudget||total+passage.text.length>MAX_EVIDENCE_CHARS||chosen.length>=passageLimit)continue;
   chosen.push(passage);sourceTotal+=passage.text.length;total+=passage.text.length;
  }
  // Preserve the source's sequence after selecting the relevant paragraphs.
  const ordered=chosen.sort((a,b)=>a.position-b.position);
  // Privacy cues and their values can occur in separate paragraphs. Recheck
  // the selected source context before any of it reaches a model.
  if(privacyReason(ordered.map(passage=>passage.text).join(' '))){total-=sourceTotal;continue;}
  for(const passage of ordered)result.push({id:`E${result.length+1}`,sourceId:source.sourceId,text:passage.text});
  if(ordered.length)acceptedSources++;
 }
 return result;
}

const referenceDraftSchema=z.object({paragraphs:z.array(z.object({text:z.string().min(1).max(900),evidenceIds:z.array(z.string().regex(/^E[1-9]\d{0,2}$/)).min(1).max(3)}).strict()).min(1).max(12)}).strict();

/** Resolve IDs to server-owned exact quotations. This validates structure and
 * reference integrity only. The caller MUST still validate language/privacy,
 * source URLs and every claim's semantic support before returning an answer. */
export function reconstructEvidenceDraft(raw:unknown,evidence:Evidence[]){
 const parsed=referenceDraftSchema.parse(raw);
 if(parsed.paragraphs.map(paragraph=>paragraph.text).join(' ').length>2800)throw Error('output-too-long');
 const registry=new Map<string,Evidence>();
 for(const item of evidence){
  if(!/^E[1-9]\d{0,2}$/.test(item.id)||!/^S[1-9]\d{0,2}$/.test(item.sourceId)||registry.has(item.id)||item.text.length<12||item.text.length>MAX_PASSAGE_CHARS||inputReason(item.text))throw Error('invalid-evidence-registry');
  registry.set(item.id,item);
 }
 return {paragraphs:parsed.paragraphs.map(paragraph=>({text:paragraph.text,evidence:[...new Set(paragraph.evidenceIds)].map(id=>{const item=registry.get(id);if(!item)throw Error('unsupported-citation');return {sourceId:item.sourceId,quote:item.text};})}))};
}
