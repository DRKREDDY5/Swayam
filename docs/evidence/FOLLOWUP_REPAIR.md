# Follow-up repair: actual browser journey

This report covers the follow-up work on September 19, 2026 (America/New_York; evidence timestamps are UTC). It supersedes reliance on the earlier passing CLI report.

## Reproduced failures

1. **Actual typed browser submission:** English `How can I make a paper boat?` returned HTTP 200 with `kind: unsupported`, `reason: citation-validation-unsupported-citation`, in 15.9 seconds. Zero answer paragraphs rendered. The stored question was not in the DOM, and the failure appeared under a generic safety heading. See [before metadata](followup-before.json) and [before screen](followup-before.png). This was a citation-validation failure, not a microphone or audio failure.
2. **Voice UI defects:** code auto-submitted the transcript after 900ms despite showing confirmation buttons. It was not editable. Transcription reused the answer-loading state and falsely displayed “Finding sources…”. Browser regression tests now cover the replacement behavior.
3. **Optional audio dependency:** an injected speech-signing failure in the actual ask route discarded an otherwise valid written answer. This was reproduced independently before fixing it; route contracts now verify that signing failure returns the written answer without a speech token.
4. **Additional Telugu live failure:** after the main repair, a real browser run retained the question but returned `review-model-incomplete` after 93.6 seconds. This run is preserved in [incomplete-review metadata](followup-live-typed-te-incomplete.json), not omitted from the results.

## Implemented behavior

- Typed input is visible immediately. Controls wait for hydration before accepting interaction.
- Voice has distinct permission, Listening, Transcribing, and review states. No answer request is sent automatically.
- “Here is what I heard” is editable. **Confirm and ask** sends the edited text exactly once; Cancel discards it. Private-number edits are blocked before the answer request.
- The confirmed question remains visible during generation, after success, and after request failure. The previous written answer remains available while a follow-up loads. Request failure offers a retry using the retained question.
- Written answers render independently of audio. Listen is optional; failed signing, cloud audio, or browser playback cannot remove the answer. Playback is disabled during recording/transcription and answer generation.
- Cancellation invalidates old recording, transcription, answer, and playback callbacks. A delayed callback from an old native recognizer cannot clear a newer recording.
- A safe draft with bad structure/quotes gets at most one correction, shared with the existing semantic correction budget. The corrected draft must still pass strict schema, exact supporting quotes, privacy checks, and a fresh approving safety/support/language review. Private/injected outputs do not retry. Source-domain filtering is unchanged.
- A reviewer response explicitly truncated with `finish_reason: length` gets at most one fresh completion attempt per question, with a bounded 8,192-token/90-second budget. Partial JSON is never accepted. Filtered/unknown/missing completions, malformed JSON, provider errors, and completed negative verdicts do not trigger this retry.
- Existing pencil artwork is visible within the first viewport: family artwork on desktop, speaking-mother artwork above the input on mobile. New low-contrast paper-boat, book, leaf, and cup drawings occupy the background while text stays on readable panels.

## Observed verification

| Check | Result |
| --- | --- |
| Live English typed browser UI | PASS: 49.6s, five rendered paragraphs, retained question, source verification passed, zero page errors. [Metadata](followup-live-typed.json), [screen](followup-live-typed.png). |
| Final live Telugu typed browser UI | PASS: 117.9s, five rendered paragraphs, retained question, source verification passed, zero page errors. [Metadata](followup-live-typed-te.json), [screen](followup-live-typed-te.png). The earlier incomplete-review failure remains separately recorded above. |
| Live English voice browser UI | PASS using a locally generated WAV as Chrome's synthetic microphone. Real MediaRecorder and live transcription returned HTTP 200. Editable transcript, zero ask requests before confirmation, exactly one after editing/confirmation. Five verified paragraphs rendered. Deliberately failed cloud/browser playback left all five visible. [Metadata](followup-live-voice.json), [confirmation screen](followup-live-voice-confirmation.png), [answer screen](followup-live-voice-answer.png). |
| Voice test duration | The answer phase took approximately 124 seconds, including the final forced playback-failure check. This is still slow. |
| Browser state/error regression suite | 6/6 passed; all API/microphone/audio responses are explicitly mocked. Includes audio failure, transcript states/edit/confirmation, canceled late transcription, private transcript edit, request retry, and delayed native callbacks. [Evidence](followup-ui-contract-results.json). |
| Answer pipeline contracts | **43/43 passed**, including bounded citation repair, unchanged privacy/source checks, and reviewer retry limits. [Evidence](../../public/evidence/answer-contract-results.json). |
| Build | Passed `pnpm build`; Vinext retains its static route-classification notice. |
| Lint | Changed-code checks passed. Full lint excluding generated runtime files still fails on pre-existing home anchors in `app/setup/page.tsx` and `app/evaluation/page.tsx`; these unrelated files were preserved. |
| TypeScript | Passed `node node_modules/typescript/bin/tsc --noEmit`. |
| Guided controls | 40/40 plus 4/4 invalid-output fixtures passed. |
| Ask-route contracts | 6/6 passed, including optional signing failure, origin/body validation, and session-bound context. [Evidence](ask-route-contract-results.json). |
| Rendered layout | Six desktop/mobile and English/Telugu combinations passed; no horizontal overflow or page errors. [Geometry](followup-layout-results.json). [390px English](followup-layout-390-en.png), [390px Telugu](followup-layout-390-te.png), [desktop](followup-layout-1365-en.png). |
| First-viewport artwork | Desktop family artwork fully visible; mobile mother artwork at approximately y106–196px. At 320×740 the submit button needs a short normal scroll; it is not clipped. |

Screenshots contain only public/synthetic example questions and responses. Metadata excludes API keys, provider payloads, session cookies, and speech tokens. No real microphone recording was captured, persisted, or published.

## Changed code

- `app/page.tsx`: visible journey, explicit transcript confirmation, separate status/error states, retained question/answer, cancellation and playback isolation.
- `app/api/ask/route.ts`: optional audio-signing isolation.
- `lib/answers.ts`: bounded repair of safe citation/schema mistakes and one retry for an explicitly truncated reviewer completion; all acceptance checks preserved.
- `app/globals.css`, `public/images/everyday-sketches.svg`: first-viewport pencil artwork, background drawings, workflow readability.
- `scripts/evaluate-answers.mjs`, new `scripts/evaluate-ask-route.mjs`, new `scripts/verify-ui.mjs`: regression coverage.
- `START_HERE.md`, `docs/SETUP_AND_SUBMISSION.md`, this report, screenshots, and sanitized result JSONs: updated workflow and observed evidence.

Existing edits were preserved. `lib/agent.ts` and `.dev.vars` were not changed. No keys were printed. No push or deployment occurred.

## Exact retest

1. In the repository terminal, run `pnpm dev` or use the already running local server. Hard-refresh the printed URL (normally http://localhost:5173). Wait until controls are enabled.
2. Select English. Type `How can I make a paper boat?` in the visible field and press **Ask Swayam**. Confirm the question stays visible during the wait, and that the final answer includes citations. Open the cited source and review whether it supports the instructions.
3. Click **Speak your question**, accept the consent dialog, and allow microphone access. Confirm Listening. Speak a short ordinary question, then Stop recording. Confirm Transcribing, then an editable transcript. Wait at least two seconds: nothing should submit. Edit the text and press **Confirm and ask**. Confirm that the edited question stays visible with the written answer.
4. Click Listen only after reading the answer. If playback fails or the device lacks a voice, the written answer must remain visible. New question cancels pending work and clears page-local context.
5. Repeat steps 2–4 in Telugu. Suggested typed question: `కాగితంతో పడవ ఎలా చేయాలి?`. Count uncertainty or rejection as a usefulness failure; never count it as a successful answer.
6. To run deterministic checks:

```powershell
node scripts/evaluate.mjs
node scripts/evaluate-answers.mjs
node scripts/evaluate-ask-route.mjs
node node_modules/typescript/bin/tsc --noEmit
pnpm build
```

The optional rendered mock suite is `node scripts/verify-ui.mjs` with Playwright installed and the dev server running. It accepts `PLAYWRIGHT_MODULE` (module name or file URL), `CHROME_PATH` (installed Chrome path), and `UI_BASE_URL`. It intercepts all API routes and makes no paid provider calls. Do not replace the manual/live UI check with a successful CLI answer alone.

## Remaining limits

- Live generation remains variable. Observed successful UI journeys took roughly 50–124 seconds; the Telugu run before the final adjustment failed, while the final run succeeded. Requests can still time out, fail verification, or be slow. Never display a rejected answer as a success. Confirmed questions remain available for a retry.
- **Your microphone still needs testing:** actual permission denial/allow, noisy speech, Telugu recognition quality, automatic 25-second stop, and voice interruption. Synthetic microphone tests do not establish physical microphone quality.
- **Your physical phone still needs testing:** browser permission behavior, recording format, speaker output, touch/rotation behavior, and HTTPS microphone access. Viewport emulation is not a physical phone test.
- Human Telugu fluency/pronunciation and practical source support remain to be reviewed. A model-approved answer is not proof of correctness.
