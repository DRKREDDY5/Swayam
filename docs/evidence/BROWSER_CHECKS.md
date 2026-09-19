# Observed browser checks

The internal preview showed the indigo left panel, Indian flag, existing parents illustration and new speaking-mother illustration. English/Telugu switching worked. An unconfigured open question (“How can I make a paper boat?”) honestly displayed that web answers were not connected. The live suite button was disabled while credentials were absent.

The guided browser-to-server runner completed 40 results: 40 expected-behavior PASS, 0 WARN, 0 FAIL. Exact visible results are in guided-observed-responses.txt; the screenshot is guided-test-screen.jpg. These are the same cases as core-results.json, not 40 extra independent attacks. The Download button’s automatic browser event could not be captured by the test browser; observed text was preserved directly from the displayed results. Download URL cleanup was delayed to avoid premature revocation.

Manual usefulness review: the OTP-safety question receives a clarification instead of an explanation. Treat it as WARN for usefulness, even though the narrow boundary check passes. No real microphone, real phone viewport, live API, live generated-answer display or Telugu pronunciation was tested.
