// Hybrid test: synthetic microphone/transcription, actual rendered confirmation,
// then the real local ask route and configured search/model providers. No env
// files, physical microphone, provider bodies, cookies or tokens are logged.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const moduleName = process.env.PLAYWRIGHT_MODULE || 'playwright';
const {chromium} = await import(/^[A-Za-z]:[\\/]/.test(moduleName) ? pathToFileURL(moduleName).href : moduleName);
const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
const baseURL = process.env.UI_BASE_URL || 'http://localhost:5173';
const directory = 'docs/evidence';
await fs.mkdir(directory, {recursive: true});
const archiveTag = new Date().toISOString().replace(/[:.]/g, '-');
for (const [suffix, extension] of [['', 'json'], ['-transcript', 'png'], ['-answer', 'png'], ['-failure', 'png']]) {
  try {await fs.copyFile(`${directory}/latency-confirmed-voice${suffix}.${extension}`, `${directory}/latency-confirmed-voice-previous-${archiveTag}${suffix}.${extension}`);}
  catch (error) {if (error.code !== 'ENOENT') throw error;}
}
const report = {
  caseId: 'hybrid-confirmed-telugu-boat', generatedAt: new Date().toISOString(),
  scope: 'Actual browser UI; microphone capture and transcription response simulated with a public synthetic Telugu craft question; real search/model providers after explicit confirmation; no speech generation.',
  physicalMicrophoneTested: false, physicalPhoneTested: false, liveAskProvidersTested: false,
  askRequests: 0, askBeforeConfirmation: null, transcriptionRequests: 0, pageErrors: 0,
  elapsedMs: null, renderedAnswer: false, usefulAnswer: false, usefulnessReview: 'no-generated-answer', failedStage: null,
};
let stage = 'open-ui';
const context = await browser.newContext({viewport: {width: 1280, height: 900}});
const question = 'కాగితంతో పడవ ఎలా చేయాలి';
const confirmedQuestion = `${question}?`;
await context.route('**/api/transcribe', route => {
  report.transcriptionRequests++;
  return route.fulfill({json: {text: question}});
});
await context.addInitScript(() => {
  const stream = {getTracks: () => [{stop() {}}]};
  Object.defineProperty(navigator, 'mediaDevices', {configurable: true, value: {getUserMedia: async () => stream}});
  class SyntheticRecorder {
    static isTypeSupported(type) {return type === 'audio/webm;codecs=opus';}
    constructor(_stream, options) {this.mimeType = options?.mimeType || 'audio/webm'; this.state = 'inactive';}
    start() {this.state = 'recording';}
    stop() {
      if (this.state !== 'recording') return;
      this.state = 'inactive';
      queueMicrotask(() => {this.ondataavailable?.({data: new Blob(['SYNTHETIC AUDIO'], {type: this.mimeType})}); this.onstop?.();});
    }
  }
  Object.defineProperty(window, 'MediaRecorder', {configurable: true, value: SyntheticRecorder});
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);
page.on('pageerror', () => report.pageErrors++);
page.on('request', request => {if (request.url().endsWith('/api/ask')) report.askRequests++;});
const nonnegativeCount = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
function safeDiagnostics(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const stages = ['input', 'planning', 'search', 'extraction', 'draft', 'citation-validation', 'revision', 'review', 'response'];
  const codes = ['failed', 'timeout', 'cancelled', 'model-unavailable', 'model-incomplete', 'search-unavailable', 'unsafe-output', 'unsupported-citation', 'invalid-json', 'invalid-schema', 'answer-review-rejected', 'no-acceptable-sources', 'blocked-input'];
  return {
    elapsedMs: nonnegativeCount(raw.elapsedMs),
    events: (Array.isArray(raw.events) ? raw.events : []).slice(0, 30).map(event => ({
      stage: stages.includes(event.stage) ? event.stage : 'other', elapsedMs: nonnegativeCount(event.elapsedMs), attempt: nonnegativeCount(event.attempt),
      controlledError: codes.includes(event.controlledError) ? event.controlledError : null,
      providerHTTPStatus: nonnegativeCount(event.providerHTTPStatus), finishReason: ['stop', 'length', 'content_filter', 'tool_calls', 'function_call', 'other'].includes(event.finishReason) ? event.finishReason : null,
      promptTokens: nonnegativeCount(event.promptTokens), completionTokens: nonnegativeCount(event.completionTokens), reasoningTokens: nonnegativeCount(event.reasoningTokens), totalTokens: nonnegativeCount(event.totalTokens),
      sourceCount: nonnegativeCount(event.sourceCount), usableSourceCount: nonnegativeCount(event.usableSourceCount),
    })),
  };
}
try {
  const readiness = page.waitForResponse(response => response.url().endsWith('/api/status'));
  await page.goto(baseURL, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => {const select = document.querySelector('select[aria-label="Language"]'); return select && !select.disabled;});
  const status = await (await readiness).json();
  assert.equal(status.transcriptionReady, true);
  await page.getByLabel('Language', {exact: true}).selectOption('te');
  // The real readiness endpoint remains untouched. Wait for its effect before
  // choosing the cloud-transcription UI path.
  await page.waitForTimeout(350);
  stage = 'recording';
  await page.locator('.voice-main').click();
  await page.getByRole('button', {name: 'సరే, మాట్లాడతాను', exact: true}).click();
  await page.locator('.voice-status').filter({hasText: 'వింటున్నాను'}).waitFor({state: 'visible'});
  await page.locator('.voice-main').click();
  stage = 'editable-transcript';
  const transcript = page.locator('#heard-question');
  await transcript.waitFor({state: 'visible'});
  assert.equal(await transcript.inputValue(), question);
  await page.waitForTimeout(1_200);
  report.askBeforeConfirmation = report.askRequests;
  assert.equal(report.askRequests, 0);
  await transcript.fill(confirmedQuestion);
  assert.equal(await transcript.inputValue(), confirmedQuestion);
  await page.screenshot({path: `${directory}/latency-confirmed-voice-transcript.png`, fullPage: true});
  stage = 'confirmed-live-answer';
  const responsePending = page.waitForResponse(response => response.url().endsWith('/api/ask'), {timeout: 120_000});
  const started = Date.now();
  await page.getByRole('button', {name: 'ఇదే నా ప్రశ్న', exact: true}).click();
  const response = await responsePending;
  const data = await response.json();
  report.elapsedMs = Date.now() - started;
  report.liveAskProvidersTested = true;
  report.httpStatus = response.status();
  report.kind = ['answer', 'guide', 'clarify', 'blocked', 'unsupported'].includes(data.kind) ? data.kind : 'other';
  report.outcome = ['answer', 'clarification', 'insufficient-evidence', 'service-error', 'timeout', 'safety-refusal', 'cancelled'].includes(data.outcome) ? data.outcome : null;
  report.paragraphCount = Array.isArray(data.paragraphs) ? data.paragraphs.length : 0;
  report.sourceCount = Array.isArray(data.sources) ? data.sources.length : 0;
  report.checks = {citationQuotes: data.checks?.citationQuotes === true, modelReview: data.checks?.modelReview === true};
  report.diagnostics = safeDiagnostics(data.diagnostics);
  assert.equal(response.status(), 200);
  assert.equal(data.kind, 'answer');
  assert.equal(data.engine, 'search+fireworks');
  assert.ok(report.paragraphCount > 0 && report.sourceCount > 0);
  assert.ok(report.checks.citationQuotes && report.checks.modelReview);
  stage = 'rendered-answer';
  await page.locator('.answer-ready').waitFor({state: 'visible'});
  assert.equal((await page.locator('.confirmed-question p').innerText()).trim(), confirmedQuestion);
  assert.equal(await page.locator('.answer-paragraph').count(), report.paragraphCount);
  assert.equal(await page.locator('.answer-sources button').count(), report.sourceCount);
  assert.equal(report.askRequests, 1);
  assert.equal(report.transcriptionRequests, 1);
  assert.equal(report.pageErrors, 0);
  await page.screenshot({path: `${directory}/latency-confirmed-voice-answer.png`, fullPage: true});
  report.renderedAnswer = true;
  report.usefulAnswer = null;
  report.usefulnessReview = 'pending-content-audit';
} catch {
  report.failedStage = stage;
  try {await page.screenshot({path: `${directory}/latency-confirmed-voice-failure.png`, fullPage: true});} catch {/* Closed browser. */}
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
  await fs.writeFile(`${directory}/latency-confirmed-voice.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({caseId: report.caseId, renderedAnswer: report.renderedAnswer, usefulAnswer: report.usefulAnswer, usefulnessReview: report.usefulnessReview, failedStage: report.failedStage, askBeforeConfirmation: report.askBeforeConfirmation, askRequests: report.askRequests, elapsedMs: report.elapsedMs, liveAskProvidersTested: report.liveAskProvidersTested, physicalMicrophoneTested: false}, null, 2));
}
