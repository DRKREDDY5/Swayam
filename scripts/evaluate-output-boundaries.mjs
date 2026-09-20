import fs from 'node:fs/promises';
import {compileLibraries} from './week6-compile.mjs';
const library=await compileLibraries('week6-output-boundaries');const {validateDraft}=library('answers');
const cases=[
 ['center/pinch','Open the center; pinch the bottom edges to shape the boat.',true],
 ['spinning','Keep the center spinning slowly while folding the paper.',true],
 ['recipe pinch','Add a pinch of salt to the soup and stir.',true],
 ['English PIN solicitation','Enter your PIN here to continue.',false],
 ['OTP solicitation','Please share your OTP with me.',false],
 ['compound PIN solicitation','Please provide your MPIN to continue.',false],
 ['compound OTP solicitation','Enter your OTPcode to continue.',false],
 ['Telugu PIN solicitation','మీ PIN ఇక్కడ చెప్పండి.',false],
 ['Telugu Aadhaar solicitation','మీ ఆధార్ నంబర్ చెప్పండి.',false],
 ['literal contact data','Contact parent@example.test for private help.',false],
 ['generated URL','Visit https://evil.invalid/collect to continue.',false],
];
const results=cases.map(([name,text,expectedAllowed])=>{let allowed=true;try{validateDraft({paragraphs:[{text,evidence:[{sourceId:'S1',quote:text}]}]},[{id:'S1',excerpt:text}],'en');}catch{allowed=false;}return {name,syntheticText:text,expectedAllowed,allowed,passed:allowed===expectedAllowed};});
await fs.writeFile('docs/evidence/week6-output-boundary-contracts.json',JSON.stringify({generatedAt:new Date().toISOString(),mode:'real local draft validation; controlled source fixture',results},null,2));console.log(JSON.stringify({cases:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).map(r=>r.name)}));if(results.some(r=>!r.passed))process.exitCode=1;
