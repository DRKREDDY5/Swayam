// Reports locations/counts only. Never emits matched values, snippets or keys.
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {parseEnv} from 'node:util';
const git=(...args)=>execFileSync('git',['-c','safe.directory='+process.cwd().replaceAll('\\','/'),...args],{maxBuffer:100*1024*1024,stdio:['ignore','pipe','pipe']});
const config=parseEnv(await fs.readFile('.dev.vars','utf8'));
const values=[...new Set(Object.entries(config).filter(([k,v])=>/(API_KEY|SECRET|PASSWORD|ACCESS_TOKEN|AUTH_TOKEN)$/.test(k)&&v.length>=12).map(([,v])=>v))];
const needles=values.flatMap(v=>[v,encodeURIComponent(v),JSON.stringify(v).slice(1,-1)]).map(v=>Buffer.from(v));
function inspect(data){
 const text=data.toString('utf8');
 const known=needles.some(v=>data.includes(v));
 const tokenPattern=/(?:fw_[A-Za-z0-9_-]{20,}|sk[-_][A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,})/.test(text);
 const assignments=text.split(/\r?\n/).filter(line=>/^(?:export\s+)?[A-Z0-9_]*(?:API_KEY|SECRET|PASSWORD|ACCESS_TOKEN|AUTH_TOKEN)\s*=/.test(line)).some(line=>{
  const v=line.slice(line.indexOf('=')+1).trim().replace(/^['"]|['"]$/g,'');
  return v.length>=12&&!/^(?:your[-_ ]|replace|example|placeholder|test|synthetic|changeme|<|\$)/i.test(v)&&!/^(?:true|false)$/.test(v);
 });
 return {knownConfiguredSecret:known,credentialPattern:tokenPattern,nonPlaceholderAssignment:assignments};
}
const flagged=[];let blobs=0;
const objects=git('rev-list','--objects','--all').toString('utf8').trim().split('\n');
for(const line of objects){const [oid,...name]=line.split(' ');if(!name.length)continue;const file=name.join(' ');if(git('cat-file','-t',oid).toString().trim()!=='blob')continue;blobs++;const result=inspect(git('cat-file','blob',oid));if(Object.values(result).some(Boolean))flagged.push({scope:'outgoing-history',object:oid,file,...result});}
const files=git('ls-files','--cached','--others','--exclude-standard','-z').toString().split('\0').filter(Boolean);let checked=0;
for(const file of files){try{const data=await fs.readFile(file);checked++;const result=inspect(data);if(Object.values(result).some(Boolean))flagged.push({scope:'working-tree',file,...result});}catch{}}
const report={generatedAt:new Date().toISOString(),historyBlobs:blobs,workingFiles:checked,configuredSecretCount:values.length,flagged,passed:!flagged.length,limitations:'Literal configured-value, credential-prefix and env-assignment checks; not an exhaustive secret detector or image OCR. All reachable history inspected, not only current tree.'};
await fs.writeFile('docs/evidence/week6-release-secret-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));if(flagged.length)process.exitCode=1;
