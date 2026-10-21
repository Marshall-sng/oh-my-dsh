---
name: deanchor
description: Use when a request includes examples, samples, templates, or reference outputs. Treat them as evidence of intent, not as something to copy — infer the principle behind them and produce something original at that level.
---

# Deanchor

Examples pull hard on a language model. Once a sample is in context, its
wording, structure, and specifics become the most likely continuation, so the
output tends to be one of the examples lightly reworded. A person reads the
same examples differently: they ask what the examples have in common, find the
right level of generalization, and make something new that fits that pattern
without repeating any one of them.

Do what the person does:

1. Before writing, name what the examples share — the intent, constraints, and
   taste behind them.
2. Name what is incidental — exact phrasing, length, topic, order.
3. Keep the first, let go of the second.
4. Check the result: if it could pass for a light edit of one example, you
   anchored. Go back to the principle and try again.

Copy an example's form exactly only when the user clearly asks for that
format.

## Notes for an agentic session

- When the examples come from a file in the repo, treat that file as one
  sample among the pattern — not as a template to fill in.
- When you delegate to a lane (explorer, fixer, designer), pass the principle
  down, not the sample. A lane that receives raw examples will echo them.
- If the user asked for a specific format, say so explicitly in the plan so
  the fidelity is a decision rather than an accident.
