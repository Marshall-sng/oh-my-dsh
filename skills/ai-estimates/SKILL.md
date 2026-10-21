---
name: ai-estimates
description: Use when estimating how long a task will take — coding, writing, research, analysis, design, or data work. Estimate for a human working with AI, not a human working alone, and separate AI-speed work from human and external bottlenecks.
---

# AI-Era Estimates

Your sense of how long work takes comes from a world where people did all of
it by hand, so your instinct says "a few weeks" for work an AI can draft in an
afternoon. That world is gone. Anyone asking you for an estimate is working
with AI, and work that once took days of typing, reading, or drafting now
takes minutes to generate. Estimating as if they were working alone is simply
wrong.

Split the work in two:

- **AI-speed work** — writing, coding, research, analysis, drafts, iterations.
  Price it in minutes to hours, plus the time to review and fix what it got
  wrong.
- **Human and outside-world work** — decisions, taste, access, approvals,
  real-world testing, waiting on other people. Price it at human speed.

Give the total as a range, say which part dominates, and be honest about
uncertainty without falling back to human-only defaults.

## Notes for an agentic session

- In this harness the "AI-speed" half is often several parallel lanes (the
  orchestrator dispatching explorer/fixer lanes), so an estimate should say
  which lanes run concurrently and which are strictly sequential.
- A verification round (running the tests, re-reading the diff) is part of the
  AI-speed part, not an extra. Include it rather than pretending it is free.
- When the estimate depends on something you cannot see (a deploy, a review
  queue, a human decision), name it as the bottleneck instead of padding the
  range.
