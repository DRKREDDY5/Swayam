# Browser reproduction, latency and answer-quality repair

Verification date: September 19–20, 2026 (local EDT / UTC). Local repository and local Chrome only. No push or deployment. Existing `.dev.vars` values were used server-side without printing or changing them.

## Confirmed failure before behavior changes

The three requested questions were submitted through the actual rendered form with the configured providers. Only content-free development instrumentation was added before this baseline. Each question had its own browser session; the first three requests ran concurrently. The visible question was correct and `/api/ask` returned HTTP 200 even for the failed answer. Authentication, transcription, and rendering were not the failing stage in this typed reproduction.

| Baseline browser case | Planning | Search | Draft | Correction | Review attempts | UI total | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Telugu chicken biryani | 1.63 s | 0.54 s | 26.50 s | 39.57 s | 27.83 + 24.00 s | 120.76 s | No answer: initial citation mismatch, correction, truncated reviewer, then complete negative semantic verdict |
| English chicken biryani | 1.00 s | 1.02 s | 21.25 s | — | 10.94 s | 34.89 s | Written answer rendered |
| Telugu paper boat | 1.34 s | 0.67 s | 22.18 s | — | 26.61 + 14.44 s | 65.96 s | Written answer rendered only after reviewer retry |

The first paper-boat review spent **all 4,096 completion tokens on reasoning**, returned `finish_reason=length`, and had no complete approving verdict. The first biryani review also hit its completion limit. Telugu biryani initially failed exact quotation reproduction; its correction used up the separate correction allowance before the reviewer finally rejected it. These were actual browser traces, not deductions from an earlier passing report.

Evidence: [baseline metadata](latency-baseline.json), [Telugu biryani failure](latency-baseline-te-biryani.png), [English baseline](latency-baseline-en-biryani.png), [paper-boat baseline](latency-baseline-te-boat.png).

## Repairs

- The server selects bounded, relevant passages from the full crawl, assigns evidence IDs, and reconstructs exact quotations itself. The model cannot invent a quote or destination. Unknown IDs, invalid URLs, unsafe content and unsupported claims still fail closed.
- Passage extraction prioritizes coherent instructions and their ingredients/materials, rather than the first page prefix or scattered high-keyword sentences. Selected context remains bounded. Whole-block and aggregate privacy screening prevent identifiers or credential cues being split across otherwise innocent-looking passages.
- An actual-source audit found that selecting only the nearest ingredient subsection retained garnish but dropped the preceding marinade/rice ingredient groups. The selector now retains the complete adjacent ingredient cluster. Image-only blocks cannot consume instruction slots, and an alternative method is included whole within its budget rather than clipped into an incomplete procedure.
- Drafts must explain one coherent method and preserve essential intermediate operations. The reviewer checks both cited support and completeness against the bounded method context. Uncited context may reveal missing steps but cannot establish support for an uncited claim.
- The configured model's documented `reasoning_effort: none` and JSON-schema format are used without changing the configured model. Unknown/private model paths keep conservative options. These choices follow [Fireworks reasoning controls](https://docs.fireworks.ai/api-reference/post-chatcompletions#body-reasoning-effort) and [structured responses](https://docs.fireworks.ai/structured-responses/structured-response-formatting). Validation and independent review remain required after constrained generation.
- Normal completion budgets are planner 768, draft 3,200 and review 1,024. A length-truncated review may use 2,048 once. This recovery shares **one global allowance** with safe structural/length/language correction and semantic correction. A corrected draft always needs fresh validation and review. There is no nested second retry allowance.
- `ANSWER_DEADLINE_MS` defaults to 60,000 and is bounded to 1,000–90,000. It covers all answer stages, attempts, fetches and response-body parsing. Caller cancellation propagates, and late results cannot replace a newer question.
- A new explicit topic does not inherit unrelated official-source restrictions from history. Government/legal/financial and health source restrictions remain. Cooking failures no longer direct people to an official department.
- Response outcomes distinguish answers, clarifications, insufficient evidence, temporary service errors, timeouts and safety refusals. The UI keeps the confirmed question and previous answer visible, supports Cancel/Retry and editable typed input, and separates written answers from optional audio.
- Greeting, microphone permission, listening, transcribing, editable transcript confirmation, generic working, answer-ready, playback and recoverable errors have distinct visible states. Progress does not claim unobserved backend stages or show an unchecked draft.
- The single existing mother-with-phone image is now before the left heading in DOM order. The exact Telugu caption appears beneath it in both languages. Full aspect ratio, SVG flag, indigo/ivory/gold styling and background sketches are preserved.

## Intermediate failures retained

The first repaired sample is saved in [latency-after.json](latency-after.json), including every failure. Its first five questions rendered answers in 10–18 seconds, but rendering and model approval were **not** accepted as proof of usefulness. Independent inspection found:

- Telugu boat omitted both intermediate opening/flattening transitions present in its tutorial.
- Telugu biryani omitted rice parboiling and ingredient quantities.
- English biryani followed a coherent method but omitted ingredient quantities and serving scale.

Those results are marked incomplete/overview-only in the evidence. They motivated the procedure-completeness and passage-selection changes above. The gardening question in that sample failed `citation-validation-unsafe-output`; the combined old guard did not retain enough content-free detail to establish its exact subcause. Its raw rejected content was deliberately not saved. A diagnostic rerun answered gardening and its follow-up in 10.54 and 13.16 seconds; [both results are retained](latency-diagnosis.json). Output length and wrong-language failures now have separate controlled codes, and safe overlength correction must still pass the unchanged maximum length, privacy checks and fresh review.

The next intermediate iteration is retained as [latency-final.json](latency-final.json); despite that run label, it was **not accepted as final verification**. Six answers rendered, vegetarian biryani failed semantic review, and content inspection still found missing marinade details and folding transitions. These failures led to the actual-source coverage audit and complete-ingredient-group fix. See [source coverage](source-coverage-audit.json), [targeted coverage](source-coverage-targeted-audit.json), and [ingredient coverage before/after](source-coverage-repair-comparison.json), which contain counts/booleans/public URLs, never source or provider bodies.

The [next seven-case run](latency-verified.json) rendered all seven responses in 9.52–22.58 seconds, but content inspection found a cut-off English phrase, an unclear transliterated folding transition, and vegetable instructions ending at layering. A constrained per-string maximum could finish valid JSON midway through a sentence. The provider schema now leaves sentences unrestricted; the server retains its 900-character paragraph and 2,800-character total limits, with at most twelve paragraphs and bounded correction. Bare trailing conjunctions are rejected locally.

The [following intermediate run](latency-final-verified.json) still had an English schema rejection in 16.64 seconds and an incomplete vegetable answer in 44.75 seconds. Both failures remain recorded. Telugu chicken, both boat cases, gardening, and its three-paragraph follow-up rendered useful procedures. The follow-up retained the topic but changed some source-specific growing/harvest details; exact method continuity is a remaining quality limitation. A [fresh vegetable-source audit](source-coverage-veg-final-audit.json) confirmed the selected recipe card already contained final covered cooking and rest. An earlier check for the literal word “dum” was an inconclusive proxy, **not evidence of extraction loss**. The visible omission occurred downstream during drafting/review.

These observations prompted phase-based drafting with no more than two ingredient/material paragraphs, explicit allocation of space to the end of the procedure, and a separate required completeness verdict in review. Schema failures now have fixed, content-free subcodes and deterministic correction instructions; raw rejected text and schema error messages are never logged.

The [focused completeness run](latency-completeness.json) identified the English schema subtype: a paragraph exceeded 900 characters; its correction then exceeded 2,800 total characters. The stricter reviewer rejected incomplete vegetable output rather than approving it. The [compact-method run](latency-concise.json) produced a vegetable explanation with both layers, final cooking and rest, but sparse ingredient quantities; English still failed without attempting correction.

A [real-UI repair diagnostic](latency-repair-diagnosis.json) then confirmed `repair-spoken-identity`: the privacy gate prevented correction of the overlong English recipe. Independent synthetic reproduction isolated the existing unbounded English `pin` cue, which matched “pinch” together with written-out numbers (and also misclassified “pinch” with a four-digit water quantity). The credential-cue expressions now use English letter boundaries and explicit compound labels, including MPIN, TPIN, UPIPIN, ATMPIN, bankPIN, pincode and OTPcode. Boundary matching alone would have missed those legitimate labels; that regression was caught and repaired before completion. Actual PIN/OTP cues, Telugu cues, identity/contact/API-key patterns, encoded/obfuscated attacks and source validation remain enforced. [Privacy regression evidence](privacy-contract-results.json) records the positive and negative tests. No raw rejected answer was logged to establish this finding.

## Final live sample and source audit

Latest **per-case** browser verification covers all seven requested cases. The first five are from [acceptance](latency-acceptance.json); gardening and its same-session follow-up are from [measurement-fidelity](latency-measurement-fidelity.json). This is not presented as one uninterrupted seven-pass run. Every case used the real rendered Chrome form and configured search/model providers, with no app-side answer/source cache or prepared-guide substitution.

| Case | Language | Route | Latest UI time | Audited result |
| --- | --- | --- | ---: | --- |
| Chicken biryani | Telugu | Uncached AI | 24.19 s | Main quantities, rice preparation, chicken cooking, layering, final cooking and rest |
| Chicken biryani | English | Uncached AI | 10.15 s | Complete sentences, coherent measured main recipe and finishing steps |
| Paper boat | Telugu | Uncached AI | 17.24 s | Both opening/flattening transitions and final boat opening |
| `kagitham tho padava ela cheyali` | Telugu response | Uncached AI | 24.03 s | Complete folding sequence |
| Vegetable biryani | Telugu | Uncached AI | 23.84 s | Main quantities, both layers, final covered cooking and rest; no chicken substitution |
| Potted coriander, outside the guides | Telugu | Uncached AI | 25.41 s | Planting, care and harvesting; pot measurement labels match the directly checked source |
| “ఇంకా సులభంగా చెప్పండి” | Telugu | Uncached AI | 10.96 s | Three paragraphs retaining the gardening topic, with planting, care and harvest |

The initial acceptance follow-up failed in 25.04 seconds. A [diagnostic repeat](latency-followup-diagnosis.json) failed in 19.29 seconds and established that both verdicts rejected **completeness only**; factual support, safety and language passed. A request to simplify was being judged against full-tutorial detail. The trusted review scope now judges a simplification's essential beginning/action/finish while retaining factual, citation, safety and language checks. Ordinary recipe review still requires the measured main ingredients and all essential operations. The successful repeat above is separately recorded, not substituted into the failed run.

| Case | Before planning/search/draft | Before review | Latest planning/search/draft | Latest review |
| --- | --- | --- | --- | --- |
| Telugu chicken | 1.63 / 0.54 / 26.50 s, plus 39.57 s correction | 27.83 + 24.00 s, rejected | 0.84 / 0.22 / 21.81 s | 0.82 s |
| English chicken | 1.00 / 1.02 / 21.25 s | 10.94 s | 1.46 / 0.11 / 7.37 s | 0.77 s |
| Telugu boat | 1.34 / 0.67 / 22.18 s | 26.61 + 14.44 s | 0.97 / 0.15 / 15.05 s | 0.63 s |

All model calls in the latest per-case samples finished with `stop` and zero reported reasoning tokens. An earlier successful gardening correction took 40.43 seconds, illustrating why this is a measured sample, not a response-time promise. Across the thirteen retained typed-browser runs there were **51 submissions: 40 rendered generated answers and 11 non-answer outcomes (including one clarification)**. Several rendered intermediate answers were incomplete, as documented above; 40 is not a useful-answer success count. Older unreviewed intermediate outputs are not claimed as useful.

Source checks compared the visible methods with My Food Story, Swasthi's Recipes, One Little Project, and Dassana's Veg Recipes. A [bounded WikiHow crawl audit](wikihow-source-claim-audit.json) checked the folding and earlier gardening claims when the web reader could not open those pages. The secondary Instructables boat link was relevant but could not be independently checked line by line. The gardening publisher is a general lifestyle site whose horticultural expertise was not independently established. Source support does not itself establish expert authority.

**Source-audit correction:** the first gardening audit used broad proximity checks that paired the pot dimensions incorrectly. A [tight paired-label recheck](gardening-dimension-audit.json) established **20 cm depth and 15 cm opening**, which matches the latest rendered Telugu answer. The old [audit metadata](gardening-source-claim-audit.json) is retained and marked superseded for dimension associations. The earlier acceptance gardening screenshot said 20 cm width/15 cm depth and is marked as a source-fidelity failure. Numerical presence alone was not adequate evidence of correct translation. Drafting and review now explicitly require numbers to retain their source meaning, units and measurement labels; no source-specific measurements are hardcoded.

Remaining content limits: some spice/oil/garnish quantities are abbreviated. Simplification retains the topic and basic method but can retrieve different sources and change source-specific dimensions/timings; exact preservation of every numerical detail is not guaranteed. No physical cooking, folding or gardening validation, or independent fluent-speaker Telugu review, is claimed.

Screenshots: [Telugu chicken](latency-acceptance-live-te-biryani.png), [English chicken](latency-acceptance-live-en-biryani.png), [Telugu boat](latency-acceptance-live-te-boat.png), [transliterated boat](latency-acceptance-live-transliterated-boat.png), [vegetable biryani](latency-acceptance-live-te-veg-biryani.png), [gardening](latency-measurement-fidelity-live-new-benign.png), [simplified follow-up](latency-measurement-fidelity-live-followup.png).

## Rendered layout and controlled tests

Layout checks exercise actual Chrome at **1440×900, 390×844 and 320×568**, in Telugu and English, across initial/loading/answer/recoverable-error states. APIs are mocked for these layout checks. Full image and Speak fit the opening viewport; no horizontal overflow or page errors were observed. “Visible in every state” means the image remains in normal page flow; it is not pinned over the answer after scrolling down.

[Desktop](latency-layout-1440-te.png) · [390 px phone layout](latency-layout-390-te.png) · [320 px phone layout](latency-layout-320-te.png) · [layout geometry](latency-layout-results.json).

| Command | Actual result | Scope |
| --- | --- | --- |
| `node scripts/evaluate.mjs` | 40/40 cases and 4/4 fixtures passed | Existing guided/security evaluation |
| `node scripts/evaluate-answers.mjs` | 65/65 passed | Mocked providers; source restrictions, semantic/completeness enforcement, invalid/missing verdicts, retries, privacy/injection |
| `node scripts/evaluate-evidence.mjs` | 27/27 passed | Bounded extraction, ingredient groups, evidence IDs and privacy |
| `node scripts/evaluate-privacy.mjs` | 38/38 passed | Benign recipe words versus real/compound/obfuscated credentials |
| `node scripts/evaluate-answer-style.mjs` | 15/15 passed | Fragment repair, length limits, trusted summary scope and fresh review |
| `node scripts/evaluate-answer-runtime.mjs` | 10/10 passed | Deadline, body-read timeout, cancellation, one global retry |
| `node scripts/evaluate-diagnostics.mjs` | 9/9 passed | No content-bearing fields or arbitrary provider errors retained |
| `node scripts/evaluate-ask-route.mjs` | 9/9 passed | Origin/body/session isolation and written answer surviving audio-signing failure |
| `node scripts/evaluate-voice-routes.mjs` | 9/9 passed | Voice cancellation and retained timeout/privacy/signature controls |
| `node scripts/verify-ui.mjs` | 17/17 passed | Mocked providers/microphone/playback in actual Chrome; insufficient evidence also preserves the prior written answer |
| `node scripts/verify-artwork.mjs` | 6/6 layouts, 24 states passed | Actual rendered desktop/mobile geometry; 210 button observations met 44×44 targets |
| `npx tsc --noEmit` | Passed | Full TypeScript check |
| `npm run build` | Passed | Production build, no deployment |
| Focused ESLint on changed files | 0 errors; 9 warnings | Existing page hook/image warnings |

Full `npm run lint` was also attempted: it includes ignored generated `.sites-runtime` compilation artifacts and failed. With that directory excluded, two unrelated existing internal-anchor errors remain in `app/evaluation/page.tsx:17` and `app/setup/page.tsx:1`; these pages were not changed. The changed implementation passes focused lint. See the sanitized [build](final-build-results.json), [TypeScript](final-typecheck-results.json), and [focused lint](final-focused-lint-results.json) results.

One earlier 17-case browser run had 16 passes and a failure while opening the UI16 fixture. The [failed run is preserved](latency-ui-contract-results-contention.json); its underlying cause was not established. The complete rerun passed 17/17. Concurrent work was occurring during the failed run, but that is not proof of its cause.

The deterministic tests enforce review verdicts; they do not prove that the external reviewer detects every inaccurate claim or omission. That is why rendered content was audited separately and failed intermediate answers were retained.

The final [artifact sanitization scan](artifact-sanitization-audit.json) checked 323 evidence/runtime/client-build files against configured secret values held only in memory and retained credential/token fields: zero matches, zero skipped files. Dependency caches were excluded. This was byte/structured-data scanning, not image OCR; screenshots were separately inspected and contain synthetic public questions.

The final [hybrid voice-confirmation check](latency-confirmed-voice.json) passed: **zero answer requests before confirmation, one after editing and confirming the transcript**, with a complete source-backed boat answer visible in **17.07 seconds**. [Editable transcript](latency-confirmed-voice-transcript.png) and [written answer](latency-confirmed-voice-answer.png) were captured. Recording and transcription were simulated; search and answer generation were real. No physical microphone, real recognition, or audible playback was tested by this run.

## Changed files

| Files | Reason |
| --- | --- |
| `lib/answers.ts` | Structured generation, evidence resolution, mandatory support/completeness review, bounded recovery, outcomes and history scope |
| `lib/evidence.ts` | Relevant bounded passages, coherent method selection, ID reconstruction and privacy checks |
| `lib/fireworks-options.ts` | Documented model-compatible reasoning and schema options |
| `lib/answer-runtime.ts` | Shared deadline, cancellation and one retry allowance |
| `lib/answer-diagnostics.ts` | Allowlisted, content-free local-development stage measurements |
| `lib/agent.ts` | Optional deadline type, compatible options at the existing guided router call, and narrow English credential-cue boundary repair |
| `app/api/ask/route.ts` | Forward request cancellation and local-only diagnostics; preserve signed context and independent optional audio signing |
| `app/api/speak/route.ts`, `app/api/transcribe/route.ts` | Propagate caller cancellation while retaining existing voice timeouts and privacy/signature checks |
| `app/page.tsx`, `app/globals.css` | Cancel/retry/status handling, retained text, optional playback, top artwork and compact mobile layout |
| `components/india-flag.tsx`, `lib/greeting.ts`, `public/images/everyday-sketches.svg` | SVG flag, registered spoken greeting and subtle background artwork from the earlier repair, retained in this follow-up |
| `.env.example` | Document the optional non-secret deadline setting |
| `scripts/evaluate*.mjs`, `scripts/verify*.mjs`, `scripts/reproduce-paper-boat.mjs` | Focused contracts, real-browser runs, layout verification and updated local compilation dependencies |
| `docs/SETUP_AND_SUBMISSION.md`, `START_HERE.md`, evidence JSON/screenshots | Current instructions and measured results |

Existing edits and artwork were preserved. Older unrelated reports and project files remain present.

## Restart and retest

1. In `C:\Users\donur\Downloads\Swayam`, stop the existing development terminal with Ctrl+C, then run `npm run dev` (or `pnpm dev`). Keep the existing `.dev.vars`; do not replace it with the example. Open the local address printed by the server, normally `http://localhost:5173`, and reload the page.
2. Type and submit, separately: `చికెన్ బిర్యానీ వండటమెలా`, `How do I cook chicken biryani?`, `కాగితంతో పడవ ఎలా చేయాలి?`, `kagitham tho padava ela cheyali`, `వెజ్ బిర్యానీ ఎలా చేయాలి?`, and `కుండీలో కొత్తిమీరను ఎలా పెంచాలి?`. Choose English for the English question. Use New question between unrelated cases.
3. After the gardening answer, ask `ఇంకా సులభంగా చెప్పండి` without resetting. Verify that it simplifies the same topic. Check complete steps and source links, not just an HTTP success or citation badge. Vegetarian biryani must not become chicken instructions.
4. Submit another question, edit the typed input while it is pending, press Cancel, then submit a new question. The confirmed question remains visible; old work must not overwrite the new answer. New question and changing language also discard old work.
5. Tap Hear a welcome. For a spoken question: Speak → consent → allow microphone → speak a harmless question → Stop → edit “What I heard” → Confirm and ask. Nothing should submit before confirmation. Try Listen only after the written answer appears. An audio error must leave the text readable.
6. Optional timeout setting: set the public `ANSWER_DEADLINE_MS` setting to `1000` locally, restart and ask an uncached question; expect a retryable timeout rather than unchecked text. Remove the override or restore `60000`, restart and retry. Real provider speed varies, so the deterministic timeout contract is the repeatable automated check.

To repeat the real-browser script on this machine, keep the development server running and use the existing Playwright cache and Chrome installation used for verification:

```powershell
$env:PLAYWRIGHT_MODULE='file:///C:/Users/donur/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'
$env:CHROME_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:UI_BASE_URL='http://localhost:5173'
node scripts/verify-live-browser.mjs retest
```

This creates separate `latency-retest*` evidence and makes real provider requests. The cache path is machine-specific; if that cache is removed, point `PLAYWRIGHT_MODULE` at an installed Playwright module. The script checks rendering and leaves usefulness pending manual source/content review. Use the same environment variables with `node scripts/verify-ui.mjs` or `node scripts/verify-artwork.mjs` for the controlled browser checks.

**Still requires your microphone/phone:** real recording permissions, quiet/noisy Telugu recognition, transcript accuracy, audible greeting/answer pronunciation, interruption through the phone speaker, mobile keyboard behavior and physical-device ergonomics. Desktop viewport emulation and mocked microphone/audio events do not establish those results. A fluent Telugu speaker should also review naturalness and practical usability; no physical cooking or paper-folding test is claimed.

No app-side answer or source cache was added. The live test questions use the general retrieval/generation path, not prepared guides; upstream search providers may cache their own results. Semantic review and PII heuristics are fallible, and this small sample is not a guarantee for arbitrary future questions.
