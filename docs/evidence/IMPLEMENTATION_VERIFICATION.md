# Implementation and verification — 2026-09-19

## Confirmed failure and fix

The ordinary English question `How can I make a paper boat?` passed planning, retrieval (six results), and drafting. The live Fireworks reviewer returned HTTP 200 but `finish_reason: length`, zero content characters, and 674 reasoning characters. Its completion budget was only 150 tokens. The application correctly rejected the incomplete verdict, but its catch-all response hid the failing stage. A separate Telugu run exhausted the original 1,800-token draft budget before producing any content.

Completion budgets now include reasoning: planner 2,048, draft 8,192, reviewer 4,096, with a bounded 60-second timeout per model call. The exact-quote checks, strict schemas, privacy checks, domain restrictions, and independent safety/support/language review remain mandatory. Incomplete output still fails closed. Only fixed stage/error codes are returned; provider errors, credentials, reasoning, and feedback are not returned to the browser.

Further live runs revealed genuinely rejected drafts, including unsupported introductory claims. The draft prompt now states existing length limits and requires a coherent source-supported method without invented context. A safe draft rejected on grounding/language may receive **one** correction using server-only reviewer feedback, followed by fresh quote validation and a fresh model review. Unsafe drafts do not retry. Failure after correction remains uncertainty. This adds up to two model calls and may make a difficult request take several minutes; no unbounded retries.

Fireworks documents that `finish_reason: length` indicates exhaustion of the completion/context limit: https://fireworksai.readme.io/reference/createchatcompletion .

## Interface

- Telugu and English fixed spoken welcomes are available from “Hear a welcome” / “స్వాగతం వినండి”. Explicit playback avoids relying on browser autoplay. Cloud audio falls back to a device voice if available. There is no microphone request for the greeting.
- Speech accepts only a registered greeting, registered guide, or signed session-bound answer. Arbitrary text remains prohibited. Stop, question submission, recording, and language changes interrupt playback; cancelled cloud requests cannot restart fallback speech.
- Inline SVG India flag uses three bands and a 24-spoke wheel; it is visible on narrow screens without emoji font dependence.
- Paper texture, restrained indigo, spacious illustration area, graphite borders, and quieter cards reuse the existing pencil artwork. Screenshots: [desktop](premium-desktop.png), [390px phone viewport](premium-mobile.png).

## Actual checks

- Guided evaluation: **40/40**, plus **4/4** invalid-output fixtures.
- Mocked answer contracts: **28/28**, including insufficient completion budgets, truncated draft/review, private provider errors, bounded corrections, unsafe refusal, and revised citation enforcement.
- TypeScript: `node node_modules/typescript/bin/tsc --noEmit` passed.
- Production build: `node scripts/run-framework.mjs build` passed. Vinext reports its existing static route-classification limitation.
- Changed-code lint with `--quiet`: passed. Full lint (excluding generated `.sites-runtime`) still fails on pre-existing home-page anchors in `app/setup/page.tsx` and `app/evaluation/page.tsx`, with warnings elsewhere. These unrelated files were preserved. Plain `pnpm lint` also includes generated local test files because the existing lint config does not exclude `.sites-runtime`.
- Headless installed Chrome: no horizontal overflow at **1440, 390, 320px**; SVG visible with 24 spokes; no page errors; synthetic Aadhaar input blocked. English greeting request contains only `greeting` and `language`; simulated cloud failure triggers browser speech once.
- Actual `/api/ask`, English paper boat: **HTTP 200, answer, source-backed-reviewed**, one source, both validation checks true, session speech token issued. No token was printed.
- Actual `/api/speak`: English and Telugu greetings both **HTTP 200 audio/mpeg** (155,942 / 218,636 bytes); arbitrary text and invalid speech token both **422**. Audio generation was verified, not pronunciation or physical speaker output.
- Latest Telugu live paper-boat run: **answer, source-backed-reviewed**, one source, exact citations validated, supported/safe/languageCorrect all true. Planner/search/draft/review completed in approximately 48 seconds. Sanitized trace: [live-paper-boat-te.json](live-paper-boat-te.json). Earlier completed reviews rejected drafts, including after correction; success is variable and is not broad quality certification.

## Changed files

- `lib/answers.ts`: reasoning budgets, fixed stage diagnostics, precise drafting limits, bounded reviewed correction.
- `app/page.tsx`, `app/globals.css`: greeting controls, audio cancellation/cleanup, flag placement and layout.
- `lib/greeting.ts`, `components/india-flag.tsx`, `app/api/speak/route.ts`: fixed bilingual greeting registry, SVG flag, strict greeting speech request.
- `scripts/evaluate-answers.mjs`, `scripts/reproduce-paper-boat.mjs`: regression coverage and sanitized live reproducer.
- `public/evidence/core-results.json`, `public/evidence/answer-contract-results.json`: refreshed deterministic results.
- `docs/SETUP_AND_SUBMISSION.md` and new files in `docs/evidence`: this verification report, live trace, and screenshots.

## Retest exactly

From the repository root in PowerShell:

```powershell
pnpm dev
```

Use the URL printed by the server (normally http://localhost:5173). An existing local server was already running during implementation; it was reused and not stopped. If restarting, use Ctrl+C in its original terminal, then `pnpm dev`. Do not alter or copy out `.dev.vars`.

1. Open `/api/status`; check readiness booleans only.
2. On `/`, choose English, click **Hear a welcome**, then Stop listening. Repeat in Telugu. Confirm speech stops when changing language or starting a question.
3. Click **Or type a question**, enter `How can I make a paper boat?`, and submit. Expect a sourced answer when validation succeeds. Open citations and check support. Ask a follow-up, then use New question to clear page history.
4. Switch to Telugu and enter `కాగితంతో పడవ ఎలా చేయాలి?`. Review language and instructions; record uncertainty as a usefulness failure, not a successful answer. Generation remains variable.
5. Resize to 320/390px; inspect the flag, topic controls, answer text, and source buttons.
6. Run repeatable checks:

```powershell
node scripts/evaluate.mjs
node scripts/evaluate-answers.mjs
node node_modules/typescript/bin/tsc --noEmit
pnpm build
node scripts/reproduce-paper-boat.mjs en
node scripts/reproduce-paper-boat.mjs te
```

The last two commands make paid live calls using `.dev.vars` without printing its values. They emit stage/status/length/boolean metadata and write sanitized results under `.sites-runtime/live-probe/result-en.json` or `result-te.json`. Non-answer results exit with code 1. A full review may take several minutes.

## Still requires you

**Microphone:** real permission allow/deny, Telugu/English transcription, quiet/noisy speech, 25-second stop, privacy screening of a synthetic transcript, automatic question submission, and interruption behavior. Never speak actual identity numbers or credentials.

**Physical phone:** microphone support, secure-context access, touch targets, browser audio restrictions, speaker clarity, rotation, and real viewport behavior. A phone visiting your laptop's plain HTTP LAN address may lack microphone access; use a trusted HTTPS local setup or localhost on the device. No deployment was performed.

**Human review:** Telugu fluency/pronunciation and whether cited folding instructions are complete and practically usable. Browser mocks, MP3 bytes, and model approval do not prove these.

No push, deployment, key changes, or edits to `lib/agent.ts` were made. Changes to `lib/answers.ts` were additive to the checkout's existing implementation.
