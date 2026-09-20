# Week 6 performance — measured browser results

## Final release after hosted verification repair

Final application: `d6ac6cbe9c1a0a2de3865a51da463422210116d6`. The first deployed revision failed English biryani at the output-length check (16.839 s; week6-hosted-first.json). Its generation schema allowed unbounded text strings. Generation now allows twelve strings of at most 230 characters; the server still enforces its existing 900/2800-character limits, privacy/citations and independent completeness review. Telugu token budgets are unchanged. Fireworks documents minLength/maxLength support in its structured-output schema. No text is sliced after generation. An eight-paragraph trial failed B-04 and B-05 completeness and was rejected (week6-schema-repair.json).

Final full local browser run, week6-generation-bound.json: B-01 14.788 s, B-03 13.561 s, B-07 12.891 s, follow-up 5.407 s, B-02 10.517 s, B-04 16.129 s, B-05 17.963 s, B-06 13.615 s. All rendered reviewed answers. The same three baseline questions now have observed median **40.381 → 13.561 seconds**, range **16.056–45.845 → 12.891–14.788 seconds**. Baseline biryani quantity caveat and uncontrolled provider conditions still apply. Final verification overlapped some build/attack checks; do not treat it as a controlled benchmark. Follow-up **7.801 → 5.407 seconds**, while retaining validation/review; provider variability remains. Twelve short paragraphs can still produce awkward breaks; CR-01 records this as a quality warning.

The earlier measured stages and unsuccessful trials below are retained as release history. They refer to the first application revision, not the final deployed revision.

## Initial release measurements

Application revision: `1f8a05258c524b23a7fccd7aa58dc8a740e7f259`. Tests used the configured model; no provider values are published. Same synthetic questions, selected languages and fresh browser context per independent case, run sequentially. No prepared guide selected. Provider-side search/model caches, network and load are uncontrolled. Before/after are single samples, not a controlled causal benchmark or p95.

| Actual browser question | Before written answer | After written answer | Observation |
| --- | ---: | ---: | --- |
| B-01 Telugu chicken biryani | 16.056 s | 20.424 s | Slower; final answer includes 700 g chicken, 2 cups rice, 6 cups boiling water and full chosen method. Baseline useful overview omitted the rice-boiling water quantity. |
| B-03 Telugu paper boat | 40.381 s | 13.771 s | Both rendered validated answers; most reduction came from variable retrieval time. |
| B-07 steel water bottle, outside guides | 45.845 s | 12.775 s | Both useful; baseline required an incompleteness repair. |
| B-07 same-session simplification | 7.801 s | 6.493 s | Final skipped planning and retrieval, retaining validation/review. |

Three ordinary response samples: range 16.056–45.845 s before / 12.775–20.424 s after; median 40.381 / 13.771 s. The biryani completeness caveat above applies to the baseline; these are observed validated-response medians, not proof of equal answer quality or a universal 66% speedup. Restricting to fully complete boat/bottle baseline controls gives 43.113 / 13.273 s (only two samples). No faster refusal/timeout is counted as success. Follow-up improved by 1.308 s (16.8%) in this sample, with two fewer external calls by construction.

## Confirmed bottlenecks and stage timings

Milliseconds; repeated review/validation values are summed. Browser time includes transport/render overhead, so stage totals need not equal browser elapsed time. Extraction is local; search is one You.com search/live-crawl request. No independent second retrieval request existed to parallelize.

| Run/case | Planning | Retrieval | Extraction | Draft + revision | Citation checks | Review | Response bookkeeping | Browser useful-answer time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| before/B-01 | 947 | 736 | 57 | 13089 | 15 | 917 | 2 | 16056 |
| before/B-03 | 856 | 29425 | 23 | 8714 | 5 | 1148 | 1 | 40381 |
| before/B-07 | 642 | 11399 | 36 | 26415 | 9 | 7042 | 1 | 45845 |
| before/B-07-followup | 1051 | 989 | 34 | 4787 | 3 | 811 | 1 | 7801 |
| final/B-01 | 1543 | 371 | 49 | 17212 | 3 | 598 | 5 | 20424 |
| final/B-03 | 528 | 141 | 23 | 11892 | 3 | 1016 | 1 | 13771 |
| final/B-07 | 1011 | 326 | 22 | 10569 | 3 | 681 | 0 | 12775 |
| final/B-07-followup | 0 | 0 | 0 | 5142 | 1 | 737 | 0 | 6493 |

Draft inference dominates after variable retrieval and repair overhead are removed. The baseline boat spent 29.425 s retrieving; bottle spent 14.581 s in a corrective draft after its first review. The final vegetarian case still took 40.150 s with a necessary completeness repair. Slower validated answers remain preferable to presenting unchecked text.

## Changes retained

Bounded public-evidence reuse removes planning/retrieval only for an exact same-session simplification with verified prior capability. A 64-entry cache expires ten minutes from original retrieval; new topics, official/health topics, expired or missing entries retrieve normally. Every answer still passes output/citation checks and semantic review. Cache faults cannot suppress the written answer.

Prompts now request concise definitions and complete 5–8-phase procedures, including initial quantities. Evidence remains bounded and method-coherent. Existing cancellation, 60-second overall deadline, one shared recovery allowance, sufficient Telugu/reviewer budgets and written-before-speech behavior are preserved. Configured public-model reasoning options were checked against [official Fireworks chat documentation](https://docs.fireworks.ai/api-reference/post-chatcompletions) and [structured outputs](https://docs.fireworks.ai/structured-responses/structured-response-formatting); observed reasoning tokens were zero. No blind token-budget cuts or speculative private-model options.

## Failures and rejected experiments

- First prompt optimization: B-02 failed output-length validation at 18.222 s (week6-after.json). The more precise concision prompt restored the full seven-case batch (week6-concise.json).
- Final B-04 failed output safety at 16.438 s (week6-final.json). A focused real-validator reproduction confirmed unbounded enter/pin matching center/pinch. Word boundaries repair that expression; B-04 retest 20.624 s and B-06 retest 12.227 s pass (week6-boundary-retest.json). The exact discarded provider draft was not logged, so its specific trigger is unproven.
- Startup run failed before provider requests while the dev server compiled (week6-final-startup.json); all failures retained and excluded from timings.
- Already accessible DeepSeek V4 Flash candidate: identical-source model-stage comparisons were 21.655→17.421 s, 12.727→8.498 s and 9.647→9.897 s. Rejected despite reviewer approvals: missing chicken quantity, a defective extra boat unfolding and evidence IDs in visible text. Original model restored and dev server restarted. The interrupted candidate browser run is not acceptance evidence. See week6-model-comparison.json and week6-candidate.json.
- Latest useful benign results combine week6-final.json with B-04/B-06 targeted retests; they are not one newly repeated full batch after the boundary-only fix.

## Optional speech and prepared content, measured separately

Actual local greeting button: 200 audio/mpeg, 240,370 bytes, 8.750 s. Its authored audio, kept only in browser memory, transcribed through the real endpoint in 0.885 s. This tests transport, not a human microphone or pronunciation; transcript includes a minor extra fragment. Invalid speech capability returns 422. Prepared chicken-guide selection took 0.296 s and is not AI-answer latency.

Initial Playwright response-body capture incorrectly reported zero bytes. A direct provider probe and corrected in-page fetch-clone capture confirmed audio delivery. Keep week6-voice-services-before.json and week6-voice-services-capture-trial.json as measurement failures; do not call bounded-body hardening the proven cause of their resolution. Final evidence: week6-voice-services.json.

Hosted tests are separately reported in WEEK6_FINAL_STATUS.md and week6-hosted.json when available. No physical voice/phone or independent Telugu review is implied.
