# Swayam · స్వయం

Swayam helps parents ask everyday questions in Telugu or English and understand a written answer with supporting sources. Type a question, or speak, edit **What I heard**, and explicitly confirm it. The confirmed question and answer remain visible; optional audio cannot block the written answer.

The interface includes pencil artwork, an SVG Indian flag, a spoken-welcome button, responsive layouts and thirteen authored guide shortcuts. Ordinary questions—including questions outside those guides—use retrieval and AI. Prepared guides are labeled separately.

- Repository: https://github.com/DRKREDDY5/Swayam (private).
- Existing Sites address: https://swayam.drkreddy.chatgpt.site (access preserved).
- [Current release and hosted verification](docs/evidence/WEEK6_FINAL_STATUS.md).
- [Architecture](docs/ARCHITECTURE.md), [performance](docs/evidence/WEEK6_PERFORMANCE.md), [security findings](docs/evidence/WEEK6_FINDINGS.md), [demo script](docs/evidence/WEEK6_DEMO_SCRIPT.md).

## Run locally

Use Node 22.13 or newer and the pinned pnpm version in package.json.

```powershell
pnpm install --frozen-lockfile
# Create .dev.vars from .env.example ONLY if you do not already have it.
# Enter values locally; never commit, paste, or print this file.
pnpm dev
```

Open the URL printed by Vinext, normally http://localhost:5173. Preserve existing .dev.vars settings. Required server settings: FIREWORKS_API_KEY, FIREWORKS_MODEL and YOU_API_KEY. Cloud speech adds ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID. Optional ANSWER_DEADLINE_MS is bounded to 1–90 seconds, default 60 seconds. /api/status reports presence, not credential validity or credits. Local settings do not configure the hosted server.

## Services and limits

Vinext/Vite builds the React interface and Cloudflare-compatible server. Fireworks plans a search, drafts an evidence-bound answer and independently reviews it. You.com retrieves public sources. ElevenLabs optionally transcribes audio and synthesizes approved text. A bounded ten-minute cache can reuse reviewed public evidence for a same-session simplification; the new answer still passes validation and review.

There is no private-record database, identity lookup, payment or KYC-submission tool. The app does not persist audio; external speech services have their own policies. Pattern checks and model review are imperfect. Real microphone, physical phone and independent Telugu pronunciation review require a person. Failed trials and remaining limitations are retained in the findings.

## Verify

```powershell
pnpm exec tsc --noEmit
pnpm lint
pnpm build
node scripts/evaluate.mjs
node scripts/evaluate-answers.mjs
node scripts/evaluate-evidence.mjs
node scripts/evaluate-privacy.mjs
node scripts/evaluate-answer-style.mjs
node scripts/evaluate-answer-runtime.mjs
node scripts/evaluate-diagnostics.mjs
node scripts/evaluate-ask-route.mjs
node scripts/evaluate-voice-routes.mjs
node scripts/evaluate-followup-evidence.mjs
node scripts/evaluate-output-boundaries.mjs
```

Browser scripts require Playwright and Chromium. Set PLAYWRIGHT_MODULE to the installed module path and, if necessary, CHROME_PATH to Chrome. UI_BASE_URL defaults to the local app. `node scripts/week6-browser.mjs <run-name>` makes paid live-provider calls. `verify-ui.mjs` and `verify-artwork.mjs` use controlled API fixtures. Preserve failed evidence before repeating a run name. Exact retest commands are in the status report.

## Hosting and submission

This is a server application. Preserve .openai/hosting.json, the existing Sites project and its audience. A GitHub push is not a Sites deployment; do not publish only dist/client or substitute another host. Deploy a saved version tied to the pushed application commit and verify the actual HTTPS UI. Never bundle .dev.vars, credentials, recordings, dependency caches or generated builds into the source repository.

The Week 6 CSV separates execution status from PASS/WARN/FAIL and distinguishes live-provider, controlled-fixture and simulated-browser evidence. The findings and demo are preparation for the owner's submission; no cohort form is submitted automatically. Additional setup detail: [START_HERE.md](START_HERE.md) and [SETUP_AND_SUBMISSION.md](docs/SETUP_AND_SUBMISSION.md).
