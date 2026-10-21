---
name: loop-engineering
description: Use to retry a task until tests, builds, or lint pass — an interview to pin the success criterion, then a bounded loop that executes and verifies, with a human gate when judgment is required.
---

# Loop Engineering

A loop without a pinned success criterion is just repeated failure. Get the
criterion first, then loop with a hard attempt cap.

## Part 1 — The Interview

Ask the user only what you cannot infer; propose defaults and let them correct
you.

1. **Goal** — what are you trying to accomplish?
2. **Success criterion** — how do we know the loop succeeded?
3. **Success type** — one of:
   - `test` — the project's test suite passes
   - `build` — the project's build succeeds
   - `lint` — the linter is clean
   - `command` — a specific command exits zero
   - `fileExists` — a specific path exists with the expected content
   - `oracle` — a read-only review seat judges the result correct
   - `observer` — a visual check of the rendered result
   - `manual` — a human decides
4. **Execution seat** — who does the work (`fixer` for bounded implementation,
   `designer` for visual work, `explorer` when the answer is still unknown).
5. **Verification seat** — who checks it (`oracle` for logic, `observer` for
   visuals, the test command for mechanical checks).
6. **Max attempts** — default 3.
7. **Context files** — which files or directories must be read before each
   attempt.

For `command` give the exact command; for `fileExists` give the exact path
and the condition that counts as present.

## Part 2 — The Loop

1. State the current attempt count and the criterion before each attempt.
2. Execute through the execution seat with the criterion and the failure
   output in the dispatch.
3. Verify against the success type — never infer success from the absence of
   an error message.
4. On failure, feed the *verification output* back into the next attempt.
   Repeating the same dispatch without the new evidence is the failure mode
   this protocol exists to prevent.
5. On success, report the final outcome with the evidence that proved it.

## Escalation and human gates

- `manual` verification is the minimal on-ramp: it pauses the loop until the
  user answers pass/fail. Do not auto-resolve it, and show the failure reason
  before asking.
- Escalate to the human when the attempt cap is reached, when the criterion
  itself is disputed, or when a fix would require changing something outside
  the agreed scope.
- If the user cancels, stop the loop immediately and report the state.

## Notes for an agentic session

- Use the harness's own machinery rather than inventing one: a goal to hold
  the criterion, the todo board to hold the attempt list, and lanes for
  execution and verification.
- A lane that fails returns its failure output; the orchestrator's job is to
  turn that output into the next dispatch, not to re-execute the work inline.
- The attempt counter is part of the state you show the user. A loop that
  silently retries three times reads as a hang.
