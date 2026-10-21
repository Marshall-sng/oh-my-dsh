---
name: simplify
description: Simplify code for clarity without changing behavior. Use for readability, maintainability, and complexity reduction after the behavior is understood.
---

# Code Simplification

## Overview

Simplify code by reducing complexity while preserving exact behavior. The goal
is not fewer lines — it is code that is easier to read, understand, modify, and
debug. Every simplification must pass one test: "Would a new teammate
understand this faster than the original?"

## When to Use

- A feature works and tests pass, but the implementation feels heavier than it
  needs to be.
- A review flagged readability or complexity.
- You hit deeply nested logic, long functions, or unclear names.
- You are consolidating logic scattered across files.
- A merge introduced duplication or inconsistency.

**When NOT to use:**

- The code is already clean — do not simplify for its own sake.
- You do not yet understand what the code does — comprehend before you
  simplify.
- The code is performance-critical and the "simpler" version would be
  measurably slower.
- You are about to rewrite the module anyway.

## The Five Principles

### 1. Preserve Behavior Exactly

Change how the code expresses itself, never what it does. Inputs, outputs,
side effects, error behavior, and edge cases must stay identical. If you are
not sure a simplification preserves behavior, do not make it.

Before every change, ask:

- Does this produce the same output for every input?
- Does it keep the same error behavior?
- Does it preserve the same side effects and their ordering?
- What proportionate final-state verification would reveal a behavior change?

### 2. Follow Project Conventions

Simplification means making code more consistent with the codebase, not
imposing external preferences.

1. Read the project conventions (`AGENTS.md`, or the project skill) first.
2. Study how neighboring code handles the same pattern.
3. Match the project's import, naming, function, and error-handling style.

Simplification that breaks project consistency is not simplification — it is
churn.

### 3. Prefer Clarity Over Cleverness

Explicit code beats compact code whenever the compact version requires a
mental pause to parse.

- Replace nested ternaries with readable control flow.
- Replace dense inline transforms with named intermediate steps when they
  clarify intent.
- Keep helpful names even when they cost a few extra lines.

### 4. Maintain Balance

Watch for over-simplification:

- Do not inline away names that carry meaning.
- Do not merge unrelated logic into one larger function.
- Do not remove abstractions that serve testability or extensibility.
- Do not optimize for line count over comprehension.

### 5. Scope to What Changed

Default to simplifying recently modified code. Avoid unrelated drive-by
refactors unless explicitly asked.

## Process

### Step 1: Understand Before Touching

Answer before changing anything:

- What is this code's responsibility?
- What calls it, and what does it call?
- What are the edge cases and error paths?
- Are there tests that define expected behavior?
- Why might it have been written this way?

If you cannot answer these, read more context first.

### Step 2: Look for Opportunities

Deep nesting · long functions with mixed responsibilities · nested ternaries ·
boolean flag arguments · repeated conditionals · generic or misleading names ·
duplicated logic · dead code · wrappers that add no value.

### Step 3: Apply Incrementally

One simplification at a time: make the change, run the proportionate
verification, and keep it only when the evidence supports behavior
preservation. Keep refactoring separate from feature work whenever possible.

### Step 4: Verify the Result

- The code is genuinely easier to understand.
- The diff is clean and reviewable.
- Project conventions still match.
- No behavior, error handling, or side effect changed.

## Working in this harness

- Simplification is a good `fixer` task once the behavior is pinned down, but
  the orchestrator must state the behavior contract in the dispatch — a lane
  that has never seen the tests will guess.
- Prefer a read-only seat (`oracle`) to decide *what* should be simplified
  before a write-capable lane changes it.
- End the task with a final-state check of the changed scope (the project's
  own test or build command, or a targeted re-read), not a general claim.

## Final-state verification

Use a proportionate final-state verification plan for the final diff: run the
checks the repository requires, and add evidence only when the changed scope
or a stated uncertainty warrants it.
