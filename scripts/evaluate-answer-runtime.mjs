// Deterministic synthetic cancellation/deadline contracts. No configuration or network.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await fs.readFile('lib/answer-runtime.ts', 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}});
const compiledModule = {exports: {}};
new vm.Script(compiled.outputText, {filename: 'lib/answer-runtime.ts'}).runInNewContext({
  module: compiledModule, exports: compiledModule.exports, AbortController, AbortSignal, DOMException, Request, URL,
});
const {createAnswerRuntime} = compiledModule.exports;
const results = [];
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const abortError = error => error instanceof DOMException && error.name === 'AbortError' && error.message === 'Answer cancelled.';
const timeoutError = error => error instanceof DOMException && error.name === 'TimeoutError' && error.message === 'Answer deadline exceeded.';
async function test(name, operation) {
  try {await operation(); results.push({name, passed: true});}
  catch {results.push({name, passed: false});}
}

await test('Deadline defaults and configuration are bounded', () => {
  assert.equal(createAnswerRuntime().deadlineMs, 60_000);
  assert.equal(createAnswerRuntime(undefined, 'invalid').deadlineMs, 60_000);
  assert.equal(createAnswerRuntime(undefined, '').deadlineMs, 60_000);
  assert.equal(createAnswerRuntime(undefined, Infinity).deadlineMs, 60_000);
  assert.equal(createAnswerRuntime(undefined, '-1').deadlineMs, 1_000);
  assert.equal(createAnswerRuntime(undefined, '100000').deadlineMs, 90_000);
  assert.equal(createAnswerRuntime(undefined, '1500.8').deadlineMs, 1_500);
});

await test('Nested stages share exactly one additional attempt', () => {
  const runtime = createAnswerRuntime();
  const stage = () => runtime.takeRetry();
  assert.equal(stage(), true);
  assert.equal(stage(), false);
  assert.equal(runtime.takeRetry(), false);
  assert.equal(createAnswerRuntime().takeRetry(), true);
});

await test('Pre-cancelled requests never start provider work or expose abort reasons', async () => {
  const caller = new AbortController();
  caller.abort(new Error('SYNTHETIC_PRIVATE_ABORT_REASON'));
  const runtime = createAnswerRuntime(caller.signal);
  let calls = 0;
  await assert.rejects(runtime.fetch(async () => {calls++; return new Response('{}');}, 'https://provider.invalid'), abortError);
  assert.equal(calls, 0);
  assert.throws(() => runtime.throwIfAborted(), abortError);
  assert.throws(() => runtime.takeRetry(), abortError);
  assert.equal(runtime.signal.reason.message, 'Answer cancelled.');
});

await test('Caller cancellation stops an uncooperative provider and consumes late rejection', async () => {
  const caller = new AbortController();
  const runtime = createAnswerRuntime(caller.signal);
  let fail;
  const pending = runtime.run(() => new Promise((_, reject) => {fail = reject;}));
  caller.abort('SYNTHETIC_PRIVATE_ABORT_REASON');
  await assert.rejects(pending, abortError);
  fail(new Error('SYNTHETIC_LATE_PROVIDER_FAILURE'));
  await delay(0);
});

await test('Cancellation remains distinct when caller supplied a TimeoutError reason', async () => {
  const caller = new AbortController();
  const runtime = createAnswerRuntime(caller.signal);
  caller.abort(new DOMException('SYNTHETIC_CALLER_REASON', 'TimeoutError'));
  await assert.rejects(runtime.run(() => Promise.resolve('stale')), abortError);
});

await test('Fetch receives the shared abort signal and preserves request options', async () => {
  const caller = new AbortController();
  const runtime = createAnswerRuntime(caller.signal);
  let received;
  const response = await runtime.fetch(async (_input, init) => {received = init; return new Response('{}');}, 'https://provider.invalid', {method: 'POST'});
  assert.equal(response.status, 200);
  assert.equal(received.method, 'POST');
  caller.abort();
  assert.equal(received.signal.aborted, true);
  assert.equal(received.signal.reason.name, 'AbortError');
});

await test('Cancellation covers a hanging provider JSON body', async () => {
  const caller = new AbortController();
  const runtime = createAnswerRuntime(caller.signal);
  const response = {json: () => new Promise(() => {})};
  const pending = runtime.run(() => response.json());
  caller.abort();
  await assert.rejects(pending, abortError);
});

await test('One overall deadline covers sequential stages and retry body parsing', async () => {
  const runtime = createAnswerRuntime(undefined, 1_000);
  // AbortSignal.timeout uses an unref timer in Node; this local test-only timer
  // keeps the event loop alive while an intentionally hanging JSON read waits.
  const keeper = setTimeout(() => {}, 1_500);
  const started = Date.now();
  try {
    await runtime.run(() => delay(550));
    assert.equal(runtime.takeRetry(), true);
    const pending = runtime.run(() => ({json: () => new Promise(() => {})}).json());
    await assert.rejects(pending, timeoutError);
    assert.ok(Date.now() - started >= 900);
    assert.equal(runtime.signal.reason.name, 'TimeoutError');
    assert.throws(() => runtime.takeRetry(), timeoutError);
  } finally {clearTimeout(keeper);}
});

await test('A new question remains independent after cancellation and late old completion', async () => {
  const caller = new AbortController();
  const old = createAnswerRuntime(caller.signal);
  let finishOld;
  const previous = old.run(() => new Promise(resolve => {finishOld = resolve;}));
  caller.abort();
  await assert.rejects(previous, abortError);
  const current = createAnswerRuntime();
  assert.equal(await current.run(() => Promise.resolve('new checked answer')), 'new checked answer');
  finishOld('stale answer');
  assert.equal(current.signal.aborted, false);
});

await test('Normal completion and controlled operation failures are preserved', async () => {
  const runtime = createAnswerRuntime();
  assert.equal(await runtime.run(() => 42), 42);
  const expected = new Error('SYNTHETIC_PROVIDER_FAILURE');
  await assert.rejects(runtime.run(() => {throw expected;}), error => error === expected);
});

console.log(JSON.stringify({passed: results.filter(result => result.passed).length, total: results.length, results}, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
