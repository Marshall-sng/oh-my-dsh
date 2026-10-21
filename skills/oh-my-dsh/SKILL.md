---
name: oh-my-dsh
description: Configure and improve the oh-my-dsh profile — seats, personas, skills, model routing, and the Agent button. Use when the user wants to tune the multi-agent setup, add a custom seat, adjust a persona, or when recurring friction suggests a safe configuration change.
---

# oh-my-dsh Configuration Skill

You help users configure and safely improve the oh-my-dsh profile: the seat
roster, their personas, the skill layer, the model routes, and the Agent
button.

## When to Use

Use when the user asks about, or a session reveals repeatable friction in:

- seats and their personas (which seat, what it may do, how it talks)
- the model routes behind the orchestrator's dispatch
- skills: the bundled ones, user skills, project skills
- custom seats and the `/preset` command
- the Agent button's roster

Suggest configuration changes only for recurring behavior, not one-offs.

## The Files That Matter

| What | Where |
|---|---|
| Custom seats (user presets) | `<DSH_HOME>/omo/presets.json` |
| User skills | `<DSH_HOME>/skills/<skill-name>/SKILL.md` |
| Project skills | `<projectRoot>/.dsh/skills/<skill-name>/SKILL.md` |
| Seat roster + personas + routing | the bundle's `cordis.patch.yml` (rows `preset-*`, `subagent-model-selection-settings`) |
| Agent button roster | the bundle's `agent-button/client.js` (`OMO_AGENTS`, display names) |
| Verification record | the bundle's `docs/p0-verify.md` |

Seat names: `orchestrator | explorer | fixer | oracle | designer | council |
councillor | observer`.

`<DSH_HOME>` is the Harness home directory (the directory that holds
`profiles/`).

## Custom Seat Pattern

A custom seat is one entry in `<DSH_HOME>/omo/presets.json`:

```json
{
  "id": "user-reviewer",
  "name": "Reviewer",
  "description": "What this seat is for, in one line.",
  "order": 30,
  "plugins": [
    {
      "id": "persona",
      "name": "@deepseek-ai/dsh-persona",
      "config": { "prefix": "You are Reviewer — ..." }
    },
    {
      "id": "tool-fs",
      "name": "@deepseek-ai/dsh-tool-fs",
      "config": { "write": false, "edit": false }
    }
  ]
}
```

A good custom seat has: a specific job, a persona that names what it refuses
to do, and only the tools it actually needs. Avoid seats that duplicate the
shipped specialists:

- codebase scouting, external research → `explorer`
- architecture, debugging, review → `oracle`
- UI/UX polish → `designer`
- scoped mechanical implementation → `fixer`
- multi-model deliberation → `council`

## Persona Tuning Pattern

Persona edits suit recurring behavior across many sessions.

Good reasons to tune a persona:

- The orchestrator repeatedly over- or under-delegates for this workflow.
- A specialist repeatedly misses a project convention.
- The user wants a stable communication or verification style.

Poor reasons:

- A one-off task failed once.
- The problem can be solved by normal instruction in this session.
- The change would make the seat worse for general use.

When suggesting a persona improvement, say:

```text
I noticed this is recurring. I can add a small rule to <file path> so future
runs handle it automatically. Want me to make that change?
```

## Safe Improvement Rules

Configuration changes affect future behavior, so treat them as user-owned.

1. **Ask before changing config or personas.** Explain the improvement briefly,
   state which file would change, and confirm — unless the user explicitly
   requested that exact edit.
2. **Prefer narrow changes.** Do not rewrite a large persona when a small rule
   solves the problem. Do not add a custom seat for a one-off task.
3. **Preserve existing user settings.** Merge with what is there; keep
   unrelated rules and formatting intact.
4. **Avoid hidden behavior changes.** Mention cost, permission, or delegation
   changes before applying them. Be explicit if a model change may increase
   spend.
5. **Say what needs a restart.** Custom seats are read at host start-up, so a
   new seat appears after a restart. User and project skills are picked up
   live and need no restart. Personas in the bundle change on the next host
   start.

## Workflow

1. **Inspect** — read the current config, the active seat, the relevant rows.
2. **Minimize** — pick the smallest change (seat, persona rule, skill, route).
3. **Confirm** — show a concise proposal with the target file path.
4. **Edit** — preserve unrelated settings and exact names.
5. **Validate** — ensure the file still parses (`node --check` for scripts,
   JSON parse for config) and, for a bundle change, reinstall and re-verify.
6. **Activate** — state whether it applies immediately or after a restart.

## Final Checklist

- [ ] Did the user confirm the edit, unless they explicitly requested it?
- [ ] Are unrelated settings preserved?
- [ ] Does the change need a host restart, and did you say so?
- [ ] Is there first-party evidence — a roster, a session log, a file — that the
      change took effect?
