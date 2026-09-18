# Thodu · తోడు

A Telugu-first everyday-task companion for people who prefer speaking to typing. Week 6 Path B: red-team your own agent.

## Product scope

Five deliberately small guides: LPG Aadhaar KYC, UIDAI service entry points, DigiLocker entry points, pension life certificates and lemon rice. Telugu and English, one step at a time, source links and dates, repeat/listen controls, and a confirmation before opening the action link.

The app explains how to approach an official service. It cannot perform KYC, check a personal status, collect documents, submit a form or handle payment. Aadhaar and DigiLocker are entry-point guides, not verified screen-by-screen procedures. The LPG source is a July 2024 official release and does not prove current deadlines or subsidy status. Source scope and limitations live in `lib/guides.ts`.

## Agent design

Voice (with consent) or typed input → privacy/instruction screening → optional Fireworks topic router → exact guide-ID validation → registered bilingual guide → user-controlled navigation/official link.

The model selects a guide ID. It cannot generate service instructions, links or actions. If the provider fails or returns invalid/incomplete output, the app uses its rules-based guide router and records that fallback in evaluation results. With no model credentials, the product operates entirely in guided mode.

Browser speech recognition and speech synthesis are device-dependent fallbacks. Optional ElevenLabs integration uses Scribe v2 for transcription and Eleven v3 for playback. Cloud transcription receives the original audio before transcript privacy screening; the consent notice explicitly discloses transmission. The application does not persist audio or chat messages. Provider retention is governed by provider settings and terms, not by this app.

## Run and configure

Use the committed pnpm lockfile. `pnpm install` then `pnpm dev`; the managed Sites environment uses its supervised preview. Production is a Cloudflare-compatible Vinext worker.

Configure values only as runtime environment settings, never in frontend code or source control:

- `FIREWORKS_API_KEY` (secret) and `FIREWORKS_MODEL` (the exact accessible Fireworks model identifier) enable AI routing.
- `ELEVENLABS_API_KEY` (secret) enables cloud transcription.
- `ELEVENLABS_VOICE_ID` with that key enables cloud playback. Select an available voice and test Telugu pronunciation.

Local Wrangler development uses ignored `.dev.vars`; configure production values separately in Sites and redeploy. Do not paste keys in an issue or test evidence. `/api/status` returns readiness booleans only.

## Security evidence

- `node scripts/evaluate.mjs`: 20 actual application-core cases and four separately labelled mock provider-output fixtures. Writes `public/evidence/core-results.json`.
- `/evaluation`: runs the same 20 prepared cases through the current app endpoint, shows actual response/engine and preliminary PASS/WARN/FAIL, and downloads a findings draft.
- Cases cover jailbreaks, Telugu requests, simple Base64/leetspeak, quoted prompt injection, tool probes, PII handling/extraction, social engineering, a three-stage escalation, normal use, overblocking and freshness boundaries.
- Crescendo carries only a guide ID and step. The app intentionally has no persistent model conversation or cross-user records, so this is not a test of a stateful conversational memory system.
- Mocked provider tests are contract tests, not observed attacks against a live LLM. Rules-engine results must not be presented as live-model robustness.

## Controls and limitations

| Boundary | Control | Remaining risk |
| --- | --- | --- |
| Identity/credential disclosure | Client and server heuristics, no identity-data tools or database | Patterns are incomplete and may overblock; raw spoken audio reaches STT before screening |
| Instruction attacks | Input checks plus exact guide-ID output allowlist | Novel phrasing can evade input checks; model may choose a wrong allowed guide |
| Tool/transaction abuse | No KYC, payment or account lookup capabilities | Official actions must still be completed by the person outside Thodu |
| Untrusted sources | Small reviewed registry; no user URL fetching or arbitrary document retrieval | Guide facts can become stale; maintain dates and recheck procedures |
| Model failure | Timeout, strict JSON/output validation, deterministic fallback | Reduced freeform understanding during fallback |
| Privacy | No application conversation/audio persistence, no raw request logging | Hosting/provider infrastructure has separate policies |

This is a private prototype, not a production security certification. It has no application-level rate limit; add quotas/rate limits before widening access to paid API endpoints. Testing an allowlisted router does not establish the safety of a general browsing agent.

## Week 6 completion

The handout permits an own-agent project. Required evidence: prompts, observed responses, scores, reasons and a short attack-to-defense table in a Google Doc. Defense code is optional; this project includes controls. Finish live model tests after runtime credentials are configured, test microphone and Telugu playback on the intended device, have a Telugu speaker review instructions, then copy reviewed evidence into the submission document. Do not describe the voice or live-model checks as completed until they are run.
