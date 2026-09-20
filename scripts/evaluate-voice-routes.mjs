// Real voice-route cancellation/privacy contracts with synthetic providers only.
// No credentials, local configuration, actual audio or network requests are read.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
async function compile(file, dependencies = {}, globals = {}) {
  const source = await fs.readFile(file, 'utf8');
  const output = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const compiledModule = {exports: {}};
  new vm.Script(output, {filename: file}).runInNewContext({
    module: compiledModule, exports: compiledModule.exports,
    require: id => id in dependencies ? dependencies[id] : require(id),
    Request, Response, File, FormData, URL, Uint8Array, TextEncoder, TextDecoder,
    Error, crypto, atob, btoa, AbortController, AbortSignal, DOMException, ...globals,
  });
  return compiledModule.exports;
}
const safety = await compile('lib/server-safety.ts');
const guides = await compile('lib/guides.ts');
const fireworks = await compile('lib/fireworks-options.ts');
const agent = await compile('lib/agent.ts', {'./guides': guides, './fireworks-options': fireworks});
const greeting = await compile('lib/greeting.ts');
const syntheticEnvironment = {ELEVENLABS_API_KEY: 'SYNTHETIC_VOICE_KEY', ELEVENLABS_VOICE_ID: 'SYNTHETIC_VOICE_ID', FIREWORKS_API_KEY: 'SYNTHETIC_SIGNING_KEY'};
const results = [];
async function test(name, operation) {
  try {await operation(); results.push({name, passed: true});}
  catch {results.push({name, passed: false});}
}
function deferred() {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};}
function voiceRequest(kind, signal, json = {greeting: true, language: 'en'}, headers = {}) {
  if (kind === 'speak') return new Request('https://swayam.invalid/api/speak', {method: 'POST', signal, headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(json)});
  const form = new FormData();
  form.append('audio', new File(['SYNTHETIC AUDIO FIXTURE'], 'synthetic.webm', {type: 'audio/webm'}));
  form.append('language', 'en');
  return new Request('https://swayam.invalid/api/transcribe', {method: 'POST', signal, body: form, headers});
}
async function route(kind, fetcher, signalAPI = AbortSignal) {
  return compile(`app/api/${kind}/route.ts`, {
    'cloudflare:workers': {env: syntheticEnvironment},
    '@/lib/agent': agent, '@/lib/guides': guides, '@/lib/greeting': greeting, '@/lib/server-safety': safety,
  }, {fetch: fetcher, AbortSignal: signalAPI});
}

for (const kind of ['speak', 'transcribe']) {
  await test(`${kind}: browser cancellation reaches a pending provider request`, async () => {
    const caller = new AbortController();
    const entered = deferred();
    let providerSignal;
    const api = await route(kind, async (_url, init) => {
      providerSignal = init.signal; entered.resolve();
      return new Promise((_, reject) => providerSignal.addEventListener('abort', () => reject(providerSignal.reason), {once: true}));
    });
    const pending = api.POST(voiceRequest(kind, caller.signal));
    await Promise.race([entered.promise, pending.then(() => {throw Error('Provider did not start');})]);
    assert.equal(providerSignal.aborted, false);
    caller.abort(new Error('SYNTHETIC_PRIVATE_ABORT_REASON'));
    const response = await pending;
    assert.equal(providerSignal.aborted, true);
    assert.equal(response.status, kind === 'speak' ? 422 : 502);
    assert.ok(!(await response.text()).includes('SYNTHETIC'));
  });

  await test(`${kind}: already cancelled input never starts a provider request`, async () => {
    const caller = new AbortController(); caller.abort();
    let calls = 0;
    const api = await route(kind, async () => {calls++; return Response.json({text: 'Synthetic question'});});
    await api.POST(voiceRequest(kind, caller.signal));
    assert.equal(calls, 0);
  });

  await test(`${kind}: the existing thirty-second provider timeout remains active`, async () => {
    const timeout = new AbortController();
    const entered = deferred();
    let timeoutMs, providerSignal;
    const api = await route(kind, async (_url, init) => {
      providerSignal = init.signal; entered.resolve();
      return new Promise((_, reject) => providerSignal.addEventListener('abort', () => reject(providerSignal.reason), {once: true}));
    }, {any: signals => AbortSignal.any(signals), timeout: milliseconds => {timeoutMs = milliseconds; return timeout.signal;}});
    const pending = api.POST(voiceRequest(kind));
    await Promise.race([entered.promise, pending.then(() => {throw Error('Provider did not start');})]);
    assert.equal(timeoutMs, 30_000);
    timeout.abort(new DOMException('Synthetic timeout', 'TimeoutError'));
    await pending;
    assert.equal(providerSignal.aborted, true);
    assert.equal(providerSignal.reason.name, 'TimeoutError');
  });
}

await test('Speech still rejects arbitrary client text before provider access', async () => {
  let calls = 0;
  const api = await route('speak', async () => {calls++; return new Response('SYNTHETIC AUDIO');});
  const response = await api.POST(voiceRequest('speak', undefined, {text: 'Arbitrary text', language: 'en'}));
  assert.equal(response.status, 422); assert.equal(calls, 0);
});
await test('Speech still rejects a valid capability from a different session', async () => {
  let calls = 0;
  const api = await route('speak', async () => {calls++; return new Response('SYNTHETIC AUDIO');});
  const firstSession = crypto.randomUUID(), secondSession = crypto.randomUUID();
  const speechToken = await safety.signSpeech('A synthetic public answer.', 'en', firstSession, syntheticEnvironment.FIREWORKS_API_KEY);
  const response = await api.POST(voiceRequest('speak', undefined, {speechToken}, {Cookie: `swayam_session=${secondSession}`}));
  assert.equal(response.status, 422); assert.equal(calls, 0);
});
await test('Transcription still rejects synthetic identity numbers before returning text', async () => {
  const api = await route('transcribe', async () => Response.json({text: 'My Aadhaar is 0000 0000 0000.'}));
  const response = await api.POST(voiceRequest('transcribe'));
  assert.equal(response.status, 422); assert.ok(!(await response.text()).includes('0000 0000 0000'));
});

await test('Speech returns complete nonempty audio bytes rather than a detached stream', async () => {
  const api = await route('speak', async () => new Response(new Uint8Array([73,68,51,1,2,3]), {headers:{'Content-Type':'audio/mpeg'}}));
  const response = await api.POST(voiceRequest('speak'));
  assert.equal(response.status,200);assert.equal(response.headers.get('Content-Length'),'6');
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[73,68,51,1,2,3]);
});
await test('An empty successful provider response becomes an explicit audio error', async () => {
  const api = await route('speak', async () => new Response(new Uint8Array(), {headers:{'Content-Type':'audio/mpeg'}}));
  const response = await api.POST(voiceRequest('speak'));assert.equal(response.status,422);
});
await test('Oversized or nonaudio provider bodies never masquerade as valid speech', async () => {
  for(const headers of [{'Content-Type':'audio/mpeg','Content-Length':'8000001'},{'Content-Type':'application/json'}]){
   const api=await route('speak',async()=>new Response('synthetic', {headers}));assert.equal((await api.POST(voiceRequest('speak'))).status,422);
  }
});
await test('Empty recordings are rejected before transcription provider access', async () => {
  let calls=0;const api=await route('transcribe',async()=>{calls++;return Response.json({text:'unused'});});
  const form=new FormData();form.append('audio',new File([],'empty.mp3',{type:'audio/mpeg'}));
  const response=await api.POST(new Request('https://swayam.invalid/api/transcribe',{method:'POST',body:form}));assert.equal(response.status,400);assert.equal(calls,0);
});

await fs.mkdir('docs/evidence', {recursive: true});
await fs.writeFile('docs/evidence/voice-route-contract-results.json', JSON.stringify({generatedAt: new Date().toISOString(), scope: 'Real speech/transcription routes; synthetic provider callbacks, audio fixture, credentials, sessions, and timer signals. No network or actual microphone.', results}, null, 2));
console.log(JSON.stringify({cases: results.length, passed: results.filter(result => result.passed).length, failed: results.filter(result => !result.passed), liveProvidersTested: false}, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
