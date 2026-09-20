// Synthetic privacy boundaries: no user data, configuration, or provider calls.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const directory=path.resolve('.sites-runtime/privacy-contracts');await fs.mkdir(directory,{recursive:true});
for(const name of ['guides','fireworks-options','agent']){
 const source=await fs.readFile(`lib/${name}.ts`,'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText.replace(/require\("\.\/([^"/]+)"\)/g,'require("./$1.cjs")');
 await fs.writeFile(`${directory}/${name}.cjs`,compiled);
}
const {inputReason}=createRequire(import.meta.url)(`${directory}/agent.cjs`);
const spoken='zero one two three four five';
const cases=[
 ['recipe-pinch-six-number-words','Use one onion, two cloves, three cups of rice, four pods, five mint leaves, six peppercorns, and a pinch of salt.',null],
 ['recipe-pinch-four-digit-water','Add a pinch of salt to 1000 ml water.',null],
 ['shopping-six-number-words',`For shopping, compare ${spoken} labels.`,null],
 ['spinning-four-digit-context','Stop spinning after 1000 turns.',null],
 ['pin-digits','My PIN is 0000.','credential'],
 ['otp-digits','My OTP is 000000.','credential'],
 ['pin-spoken',`My PIN is ${spoken}.`,'spoken-identity'],
 ['otp-plural-spoken',`The OTPs are ${spoken}.`,'spoken-identity'],
 ['pin-plural-spoken',`The PINs are ${spoken}.`,'spoken-identity'],
 ['pin-underscore',`private_pin: ${spoken}`,'spoken-identity'],
 ['pin-zero-width',`My p\u200bin is ${spoken}.`,'spoken-identity'],
 ['pin-full-width',`My ＰＩＮ is ${spoken}.`,'spoken-identity'],
 ['pin-leetspeak',`My p1n is ${spoken}.`,'spoken-identity'],
 ['telugu-pin','నా పిన్ సున్నా ఒకటి రెండు మూడు నాలుగు ఐదు','spoken-identity'],
 ['telugu-otp-digits','నా ఓటీపీ ౦౦౦౦౦౦','credential'],
 ['aadhaar-spoken',`My Aadhaar is ${spoken}.`,'spoken-identity'],
 ['telugu-aadhaar-spoken','నా ఆధార్ సున్నా ఒకటి రెండు మూడు నాలుగు ఐదు','spoken-identity'],
 ['identity-number','The number is 0000 0000 0000.','identity-number'],
 ['encoded-pin',Buffer.from('My private PIN is 0000.').toString('base64'),'credential'],
 ...['MPIN','TPIN','UPIPIN','ATMPIN','bankPIN','pincode','OTPcode'].flatMap(label=>[
  [`compound-${label.toLowerCase()}-digits`,`My ${label} is 0000.`,'credential'],
  [`compound-${label.toLowerCase()}-spoken`,`My ${label} is ${spoken}.`,'spoken-identity'],
 ]),
 ['compound-zero-width',`My m\u200bpin is ${spoken}.`,'spoken-identity'],
 ['compound-full-width',`My ＭＰＩＮ is ${spoken}.`,'spoken-identity'],
 ['compound-leetspeak',`My upip1n is ${spoken}.`,'spoken-identity'],
 ['password-label-preserved','My bankPassword is 0000.','credential'],
 ['aadhaar-label-preserved',`My AadhaarNumber is ${spoken}.`,'spoken-identity'],
];
const results=cases.map(([caseId,text,expected])=>{const actual=inputReason(text);return {caseId,expected,actual,passed:actual===expected};});
const report={generatedAt:new Date().toISOString(),scope:'Synthetic privacy contracts against actual agent code. No private inputs or live providers.',results};
await fs.writeFile('docs/evidence/privacy-contract-results.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({cases:results.length,passed:results.filter(result=>result.passed).length,failed:results.filter(result=>!result.passed).map(result=>result.caseId),liveProvidersTested:false}));
if(results.some(result=>!result.passed))process.exitCode=1;
