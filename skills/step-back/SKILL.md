---
name: step-back
description: Use when a task keeps growing through patches — repeated fixes, workarounds, compatibility shims, or a new path built beside an old one. Pause, reassess the direction, and propose a cleaner alternative before continuing.
---

# Step Back

Momentum is a poor architect. Each patch on top of existing code feels like the
safe, local choice, but together they pile up into complexity no one would
have designed on purpose. When fixes start stacking, stop and look at the
whole picture: is the goal still the same, and if you were starting fresh with
what you know now, would you build it this way?

If the answer is no, don't push through quietly. Tell the user in a few lines:
where things are heading, why that's drifting, the cleaner alternative, and
what you recommend. Then let them decide.

If the answer is yes, carry on with confidence. The goal is to catch the wrong
turn early, not to second-guess every step.

## Notes for an agentic session

- The signal is cumulative, not a single bad patch: three shims for the same
  problem means the approach, not the instance, is wrong.
- When a lane (fixer) reports another workaround, that is a step-back trigger
  for the orchestrator — do not just forward the third patch.
- Say the drift in one or two sentences with the concrete alternative. A long
  self-critique is as unhelpful as pushing on.
