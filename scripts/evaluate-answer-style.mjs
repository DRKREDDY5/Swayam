// Focused answer-completeness/style contracts with synthetic providers only.
// Does not read environment configuration or make network calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';

const directory = path.resolve('.sites-runtime/answer-style-tests');
await fs.mkdir(directory, {recursive: true});
for (const name of ['guides', 'fireworks-options', 'answer-runtime', 'agent', 'answer-diagnostics', 'evidence', 'followup-evidence', 'answers']) {
  const source = await fs.readFile(`lib/${name}.ts`, 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  await fs.writeFile(path.join(directory, `${name}.cjs`), compiled.replace(/require\("\.\/([^"/]+)"\)/g, 'require("./$1.cjs")'));
}
const {answerQuestion, validateDraft} = createRequire(import.meta.url)(path.join(directory, 'answers.cjs'));
const cfg = {FIREWORKS_API_KEY: 'SYNTHETIC_MODEL_KEY', FIREWORKS_MODEL: 'accounts/fireworks/models/qwen3-235b-a22b', YOU_API_KEY: 'SYNTHETIC_SEARCH_KEY'};
const question = 'How can I make a paper boat?';
const source = {url: 'https://www.wikihow.com/Make-a-Paper-Boat', title: 'Paper boat lesson', contents: {markdown: '# Paper boat lesson\n\n## Materials\nA rectangular sheet of paper.\n\n## Instructions\n1. Fold the paper in half.\n2. Fold both corners toward the middle.\n3. Fold the lower flaps upward.\n4. Open the bottom and flatten it into a diamond.\n5. Fold the lower corners upward.\n6. Open and flatten the paper again.\n7. Pull the top corners apart to open the boat.'}};
const approved = {missingEssentialActions: [], complete: true, supported: true, safe: true, languageCorrect: true, feedback: ''};
const results = [];
async function test(id, name, operation) {
  try {await operation(); results.push({id, name, passed: true});}
  catch {results.push({id, name, passed: false});}
}
function providers({drafts, review = approved, language = 'en'} = {}) {
  const requests = [];
  let draftNumber = 0;
  let reviewNumber = 0;
  const fetcher = async (url, options) => {
    const body = JSON.parse(options.body);
    if (String(url).includes('ydc-index')) {requests.push({stage: 'search', body}); return Response.json({results: {web: [source]}});}
    const system = body.messages[0].content;
    const payload = JSON.parse(body.messages[1].content);
    let content, stage;
    if (system.includes('request planner')) {
      stage = 'planning'; content = {query: 'make a paper boat steps', category: 'general', action: 'search', clarification: ''};
    } else if (system.includes('skeptical safety and evidence reviewer')) {
      stage = 'review'; content = Array.isArray(review) ? review[reviewNumber++] : review;
    } else {
      stage = payload.previousDraft ? 'revision' : 'draft';
      const selected = drafts?.[draftNumber++] || (language === 'te' ? 'కాగితాన్ని సగానికి మడవండి.' : 'Fold the paper in half.');
      const texts = Array.isArray(selected) ? selected : [selected];
      assert.ok(payload.evidence?.length, 'Synthetic source was not extracted');
      content = {paragraphs: texts.map(text => ({text, evidenceIds: [payload.evidence[0].id]}))};
    }
    requests.push({stage, body, payload});
    return Response.json({choices: [{finish_reason: 'stop', message: {content: JSON.stringify(content)}}]});
  };
  return {fetcher, requests};
}
const draftRequest = mock => mock.requests.find(request => request.stage === 'draft');
const schemaOf = request => request.body.response_format.json_schema.schema;

await test('STYLE01', 'English trailing conjunction is corrected once and freshly reviewed', async () => {
  const mock = providers({drafts: ['Fold the paper and', 'Fold the paper in half.']});
  const answer = await answerQuestion({message: question, language: 'en'}, cfg, mock.fetcher);
  assert.equal(answer.kind, 'answer');
  assert.deepEqual(mock.requests.map(request => request.stage), ['planning', 'search', 'draft', 'revision', 'review']);
  assert.equal(answer.message, 'Fold the paper in half.');
  assert.equal(answer.checks.modelReview, true);
});
await test('STYLE02', 'Telugu trailing conjunction is corrected once and freshly reviewed', async () => {
  const mock = providers({language: 'te', drafts: ['కాగితాన్ని సగానికి మడవండి మరియు', 'కాగితాన్ని సగానికి మడవండి.']});
  const answer = await answerQuestion({message: 'కాగితంతో పడవ ఎలా చేయాలి?', language: 'te'}, cfg, mock.fetcher);
  assert.equal(answer.kind, 'answer');
  assert.deepEqual(mock.requests.map(request => request.stage), ['planning', 'search', 'draft', 'revision', 'review']);
});
await test('STYLE03', 'A corrected fragment still fails when independent semantic review rejects it', async () => {
  const mock = providers({drafts: ['Fold the paper and', 'Fold the paper in half.'], review: {...approved, supported: false, feedback: 'The passage does not support this claim.'}});
  const answer = await answerQuestion({message: question, language: 'en'}, cfg, mock.fetcher);
  assert.notEqual(answer.kind, 'answer');
  assert.deepEqual(mock.requests.map(request => request.stage), ['planning', 'search', 'draft', 'revision', 'review']);
});
await test('STYLE04', 'A repeated incomplete fragment cannot consume a second correction or receive review', async () => {
  const mock = providers({drafts: ['Fold the paper and', 'Fold the paper or']});
  const answer = await answerQuestion({message: question, language: 'en'}, cfg, mock.fetcher);
  assert.notEqual(answer.kind, 'answer');
  assert.equal(answer.reason, 'citation-validation-incomplete-text');
  assert.deepEqual(mock.requests.map(request => request.stage), ['planning', 'search', 'draft', 'revision']);
});
await test('STYLE05', 'A private fragment cannot be resubmitted for correction or review', async () => {
  const mock = providers({drafts: ['My Aadhaar is 0000 0000 0000 and']});
  const answer = await answerQuestion({message: question, language: 'en'}, cfg, mock.fetcher);
  assert.notEqual(answer.kind, 'answer');
  assert.deepEqual(mock.requests.map(request => request.stage), ['planning', 'search', 'draft']);
  assert.ok(!JSON.stringify(answer).includes('0000 0000 0000'));
});

for (const [id, language, message] of [['STYLE06', 'en', 'Explain it in simpler words.'], ['STYLE07', 'te', 'ఇంకా సులభంగా చెప్పండి']]) {
  await test(id, `${language}: confirmed simplification uses three paragraphs and trusted method-preserving style`, async () => {
    const normal = providers({language});
    await answerQuestion({message: question, language}, cfg, normal.fetcher);
    const mock = providers({language});
    const answer = await answerQuestion({message, language, priorAnswer: {text: language === 'te' ? 'కాగితాన్ని సగానికి మడవండి.' : 'Fold the paper in half.', language}}, cfg, mock.fetcher);
    assert.equal(answer.kind, 'answer');
    const request = draftRequest(mock);
    assert.equal(schemaOf(request).properties.paragraphs.maxItems, 3);
    assert.equal(request.payload.simplifyFollowup, true);
    const normalSystem = draftRequest(normal).body.messages[0].content;
    const system = request.body.messages[0].content;
    assert.ok(system.startsWith(normalSystem) && system.length > normalSystem.length);
    const trustedStyle = system.slice(normalSystem.length);
    assert.match(trustedStyle, /three|\b3\b/i);
    assert.match(trustedStyle, /paragraph/i);
    assert.match(trustedStyle, /method/i);
  });
}
await test('STYLE08', 'A new ordinary method can retain twelve ordered steps without a model string cutoff', async () => {
  const mock = providers({drafts: [Array.from({length: 12}, (_, index) => `Step ${index + 1}: Fold the paper in half.`)]});
  const answer = await answerQuestion({message: question, language: 'en'}, cfg, mock.fetcher);
  assert.equal(answer.kind, 'answer'); assert.equal(answer.paragraphs.length, 12);
  const request = draftRequest(mock), schema = schemaOf(request);
  assert.equal(schema.properties.paragraphs.maxItems, 12);
  assert.ok(!('maxLength' in schema.properties.paragraphs.items.properties.text));
  assert.equal(request.body.max_tokens, 3200);
});
await test('STYLE09', 'Simplification wording without a trusted previous answer does not restrict a new task to three slots', async () => {
  const mock = providers();
  await answerQuestion({message: 'Show a simpler paper boat method.', language: 'en'}, cfg, mock.fetcher);
  assert.equal(schemaOf(draftRequest(mock)).properties.paragraphs.maxItems, 12);
  assert.equal(draftRequest(mock).payload.simplifyFollowup, false);
});
await test('STYLE10', 'Local paragraph length validation still rejects text exceeding nine hundred characters', () => {
  const source = {id: 'S1', excerpt: 'Fold the paper in half.'};
  assert.throws(() => validateDraft({paragraphs: [{text: `${'A'.repeat(900)}.`, evidence: [{sourceId: 'S1', quote: source.excerpt}]}]}, [source], 'en'));
});
await test('STYLE11', 'Local combined length validation still rejects text exceeding twenty-eight hundred characters', () => {
  const source = {id: 'S1', excerpt: 'Fold the paper in half.'};
  const paragraphs = Array.from({length: 4}, () => ({text: `${'A'.repeat(700)}.`, evidence: [{sourceId: 'S1', quote: source.excerpt}]}));
  assert.throws(() => validateDraft({paragraphs}, [source], 'en'), error => error.message === 'output-too-long');
});
await test('STYLE12', 'An overlong paragraph receives fixed targeted correction and must pass fresh review', async () => {
  const mock = providers({drafts: ['Fold the paper. '.repeat(65), 'Fold the paper in half.']});
  const answer = await answerQuestion({message: question, language: 'en'}, cfg, mock.fetcher);
  assert.equal(answer.kind, 'answer');
  assert.deepEqual(mock.requests.map(request => request.stage), ['planning', 'search', 'draft', 'revision', 'review']);
  const revision = mock.requests.find(request => request.stage === 'revision');
  assert.equal(revision.payload.validationFeedback, 'A paragraph exceeded 900 characters. Split it into shorter complete paragraphs; keep at most 12 paragraphs and at most 2800 characters across all paragraph text.');
  assert.equal(answer.message, 'Fold the paper in half.');
  assert.equal(answer.checks.modelReview, true);
});
await test('STYLE13', 'A repeatedly overlong paragraph is rejected without a second correction or review', async () => {
  const overlong = 'Fold the paper. '.repeat(65);
  const mock = providers({drafts: [overlong, overlong]});
  const answer = await answerQuestion({message: question, language: 'en'}, cfg, mock.fetcher);
  assert.notEqual(answer.kind, 'answer');
  assert.deepEqual(mock.requests.map(request => request.stage), ['planning', 'search', 'draft', 'revision']);
});
await test('STYLE14', 'Trusted summary review scope requires both a prior answer and simplification wording', async () => {
  const normal = providers(), withoutPrior = providers(), ordinaryPrior = providers(), simplified = providers();
  const priorAnswer = {text: 'Fold the paper in half.', language: 'en'};
  await answerQuestion({message: question, language: 'en'}, cfg, normal.fetcher);
  await answerQuestion({message: 'Show a simpler paper boat method.', language: 'en'}, cfg, withoutPrior.fetcher);
  await answerQuestion({message: question, language: 'en', priorAnswer}, cfg, ordinaryPrior.fetcher);
  const answer = await answerQuestion({message: 'Explain it in simpler words.', language: 'en', priorAnswer}, cfg, simplified.fetcher);
  assert.equal(answer.kind, 'answer');
  const reviewSystem = mock => mock.requests.find(request => request.stage === 'review').body.messages[0].content;
  const normalSystem = reviewSystem(normal);
  assert.equal(reviewSystem(withoutPrior), normalSystem);
  assert.equal(reviewSystem(ordinaryPrior), normalSystem);
  const system = reviewSystem(simplified);
  assert.ok(system.startsWith(normalSystem) && system.length > normalSystem.length);
  const scope = system.slice(normalSystem.length);
  assert.match(scope, /TRUSTED REQUEST SCOPE/);
  assert.match(scope, /essential beginning, action, and finish/);
  assert.match(scope, /every included claim to be supported by its cited evidence/);
  assert.match(scope, /preserve the previous method without contradictions/);
  assert.match(scope, /reject unsafe content/);
  assert.match(scope, /require the correct language/);
});
await test('STYLE15', 'A simplification correction retains the same scoped independent review on its fresh attempt', async () => {
  const mock = providers({review: [{...approved, complete: false, missingEssentialActions: ['Open the boat at the finish.']}, approved], drafts: ['Fold the paper in half.', 'Fold the paper in half and open the boat.']});
  const answer = await answerQuestion({message: 'Explain it in simpler words.', language: 'en', priorAnswer: {text: 'Fold the paper in half, then open the boat.', language: 'en'}}, cfg, mock.fetcher);
  assert.equal(answer.kind, 'answer');
  assert.deepEqual(mock.requests.map(request => request.stage), ['planning', 'search', 'draft', 'review', 'revision', 'review']);
  const reviews = mock.requests.filter(request => request.stage === 'review');
  assert.equal(reviews[0].body.messages[0].content, reviews[1].body.messages[0].content);
  assert.match(reviews[0].body.messages[0].content, /TRUSTED REQUEST SCOPE/);
  assert.deepEqual(reviews.map(request => request.body.max_tokens), [1024, 1024]);
  assert.equal(answer.checks.modelReview, true);
});

await fs.mkdir('docs/evidence', {recursive: true});
await fs.writeFile('docs/evidence/answer-style-contract-results.json', JSON.stringify({generatedAt: new Date().toISOString(), scope: 'Actual answer pipeline with synthetic provider responses and public fixture material. Verifies fragment repair, independent review, trusted simplification, schema capacity, and local output limits; no live providers or private configuration.', results}, null, 2));
console.log(JSON.stringify({cases: results.length, passed: results.filter(result => result.passed).length, failed: results.filter(result => !result.passed), liveProvidersTested: false}, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
