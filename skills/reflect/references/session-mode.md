# Reflect — Session Mode (harness session-log archaeology)

This reference holds the session-mode procedure. Read it only when the user
asks for session archaeology; the core contract, workflow, output format, and
guardrails in `SKILL.md` still apply.

## Where sessions live

Harness sessions are append-only logs, one directory per session:

```text
<DSH_HOME>/sessions/<workspace-slug>/<session-id>/session.v4.jsonl.zstd
```

- `<DSH_HOME>` — the harness home (the `DSH_HOME` environment variable).
- `<workspace-slug>` — the workspace path with separators replaced by `-`
  (for example `--C-Users-me-projects-app--`).
- `<session-id>` — the session id; webhook-driven sessions are prefixed
  `webhook-`.

Each log is zstd-compressed JSONL. A log can hold **several concatenated zstd
frames**, so decoding only the first frame silently truncates the history.
Scan the buffer for the frame magic `28 B5 2F FD` and decode every frame.

Write the reader to a temp script file and run it with `node <file>`; do not
inline it with `node -e "…"` — nested quoting breaks on PowerShell.

```js
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { zstdDecompressSync } from 'node:zlib';

const root = join(process.env.DSH_HOME ?? '', 'sessions');

function decode(path) {
  const buf = readFileSync(path);
  let text = '';
  for (let i = 0; i <= buf.length - 4; i++) {
    if (buf[i] === 0x28 && buf[i + 1] === 0xb5 && buf[i + 2] === 0x2f && buf[i + 3] === 0xfd) {
      try { text += zstdDecompressSync(buf.subarray(i)).toString('utf8'); } catch {}
    }
  }
  return text.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// walk two levels: <workspace-slug>/<session-id>/session.v4.jsonl.zstd
for (const ws of readdirSync(root, { withFileTypes: true })) {
  if (!ws.isDirectory()) continue;
  const wsDir = join(root, ws.name);
  for (const s of readdirSync(wsDir, { withFileTypes: true })) {
    if (!s.isDirectory()) continue;
    const file = join(wsDir, s.name, 'session.v4.jsonl.zstd');
    let stat;
    try { stat = statSync(file); } catch { continue; }
    const events = decode(file);
    // ... analyze ...
  }
}
```

## Events worth reading

| Event | Use |
|---|---|
| `session` (first line) | header: `id`, `createdAt`, `cwd`, `agentPreset`, `delegationDepth` |
| `user/message` | the human turn text |
| `assistant/message` | the agent turn text (role `assistant`, `content[]` entries of type `text` / `reasoning`) |
| `tool/call` | tool name and arguments — the friction signal |
| `tool/result` | outcome; errors and refusals are high-value friction |
| `agent-preset/selected` | which agent seat was active (`data.agentPreset`) |
| `subagent/catalog` | dispatched lanes (`data.label`, `data.childId`, `data.mode`) |
| `session/title` | the generated session title — a cheap goal summary |

Count repeated tool-call sequences, repeated failures, and repeated
same-shape requests. A workflow that recurs across sessions with the same
inputs is a packaging candidate.

## Per-session summary

Produce one structured summary per session:

```json
{
  "session": "session-5ce089e3-96ae-4b20-8477-add4138df632",
  "workspace": "C:\\Users\\me\\projects\\app",
  "timestamp": "2026-10-20T04:54:08.912Z",
  "goal": "Regenerate the module map",
  "success": true,
  "frictions": [
    "Repeated glob before reading to locate the module map",
    "Two failed lane dispatches before the preset dispatch took effect"
  ],
  "recommendations": [
    "Add a codemap skill step so the orchestrator reads the existing map first"
  ],
  "duration_minutes": 18,
  "agents_used": ["orchestrator", "explorer"],
  "tools_used": ["glob", "read", "subagent"],
  "confidence": 0.85
}
```

**Confidence scoring:**

- 0.9-1.0 — clear success/failure, obvious patterns
- 0.7-0.9 — likely outcome, patterns inferred from tool usage
- 0.5-0.7 — uncertain outcome, limited evidence
- below 0.5 — skip, or mark as "needs more evidence"

## Storage and caching

Store summaries under `<DSH_HOME>/reflections/sessions/<session-id>.json`.

Cache logic:

1. Check whether `<session-id>.json` exists.
2. If yes, load it (saves tokens).
3. If no, analyze the session and save the summary.
4. Aggregate across all summaries for the final report.

## Aggregation

After analyzing the sessions, aggregate findings:

1. **Group by theme** — sessions with similar frictions cluster together.
2. **Count frequency** — "42/50 sessions had a repeated glob before editing".
3. **Rank by impact** — prioritize the recommendations that appear most often.
4. **Filter noise** — skip one-off issues; focus on repeated patterns.
5. **Cross-reference** — see whether patterns correlate with specific agents,
   presets, or workspaces.

**Scope categories:**

- **Global** — applies everywhere (pattern seen in more than half the workspaces)
- **Cross-workspace** — applies to the specific workspaces where it appears
- **Project-specific** — relevant to one workspace only

## Output format for session mode

```text
Session Reflection Report
Analyzing 50 most recent sessions across 8 workspaces.

Workspaces analyzed:
- <workspace> (<N> sessions)
- ... (M more)

Findings
- <pattern>: N/50 sessions across M workspaces.
  - Scope: global | cross-workspace (<workspaces>) | project-specific (<workspace>)
  - Confidence: 0.95
  - Impact: High | Medium | Low

Recommended changes
- <asset>: <purpose>
  - Scope: global | cross-workspace (<workspaces>) | project-specific (<workspace>)
  - Confidence: 0.97
  - Estimated time saved: High | Medium | Low

Skipped
- <candidate>: why not worth packaging now.
  - Scope: <reason>
  - Confidence: <score>

Needs more evidence
- <candidate>: what would make it actionable.
  - Current scope: <what we've seen>
  - Required scope: <what would confirm>
```

## Error handling

- Session log missing or unreadable → skip with a warning; never abort the run.
- Session with no messages → skip: "Session <id> has no messages."
- Log the failure, continue with the remaining sessions, and report failures at
  the end: "3 sessions skipped due to read errors".
