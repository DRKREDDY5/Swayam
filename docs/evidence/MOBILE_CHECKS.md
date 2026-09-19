# Responsive UI checks — September 19, 2026

Scope: the local app rendered in real browser iframes with narrow CSS viewport widths. These are responsive-layout checks, not a physical phone, mobile Safari, touchscreen, microphone, speech-provider or mobile-keyboard test.

## Observations and fixes

- Home view checked at 320, 360 and 390px frame widths. It stacks into one column with the microphone near the top. Browser scrollbars consume part of the frame width; the 320px frame reported 305px content width and 305px document scroll width, with no horizontal overflow.
- Telugu typing was submitted through the actual UI at 360px and returned the LPG guide through the server. Next step worked; guide text, source information and navigation remained readable.
- The language selector switched to English at 320px. The voice-consent dialog was opened and inspected; no microphone permission or recording was attempted.
- The LPG external-source confirmation was opened at 360px. A low-contrast link-button label was found and fixed. The corrected label is light on indigo. The external site was not opened as part of this layout test.
- Setup originally had sideways scrolling. Long commands, environment variable names and instructions now wrap; the 360px setup frame reported 345px content width and 345px scroll width.
- Setup section spacing and code-block presentation were improved. Phone controls have larger touch targets; text input uses a 16px font; safe-area spacing and narrow dialogs were added.
- The evaluation page was opened in the 360px frame to inspect its width and controls. Live-provider testing was not run.

Screenshot: [mobile-layout-checks.jpg](mobile-layout-checks.jpg), showing the two confirmation dialogs and the corrected setup layout.

## Still required on the user's devices

Actual Android/iPhone portrait and landscape; on-screen keyboard and focus; microphone allow/deny; quiet/noisy Telugu transcription; Telugu pronunciation; audio interruption and autoplay restrictions; slow network; configured source-backed answer layout and source accuracy. Follow START_HERE.md and record real results rather than treating these checks as completed.

## Application verification

The existing guided checks passed 40/40, invalid-output fixtures 4/4, and simulated-provider checks 20/20. TypeScript validation passed. See public/evidence for the exact separate reports. These results do not establish live LLM safety or factual accuracy.
