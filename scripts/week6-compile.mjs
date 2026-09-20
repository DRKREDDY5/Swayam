import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import {createRequire} from 'node:module';
export async function compileLibraries(label){
 const directory=path.resolve('.sites-runtime',label);await fs.mkdir(directory,{recursive:true});
 for(const name of ['guides','greeting','fireworks-options','agent','answer-diagnostics','answer-runtime','evidence','followup-evidence','answers','server-safety']){
  const source=await fs.readFile(`lib/${name}.ts`,'utf8');
  await fs.writeFile(`${directory}/${name}.cjs`,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText.replace(/require\("\.\/([^"/]+)"\)/g,'require("./$1.cjs")'));
 }
 const require=createRequire(import.meta.url);return name=>require(`${directory}/${name}.cjs`);
}
