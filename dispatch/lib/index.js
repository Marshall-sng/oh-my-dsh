import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { zstdDecompressSync } from 'node:zlib';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { childSessionMeta, parentAgentOptionsForDelegation, resolveChildAgentOptions, resolveChildDepth } from '@deepseek-ai/dsh-subagent';
import { z } from 'zod';
import { loadSeats, rosterView, applySeat, applySeatToSession, releaseSeat, restoreSeat, forgetSeat, foldSeatState } from './seat-runtime.js';
import { loadSeatSnapshot, resolveDispatchRoute } from './seat-models.js';

export const inject = ['agents', 'tools', 'sessionProjections'];
export const name = 'omo-dispatch';

const DESCRIPTOR_VERSION = 3;
const CATALOG_VERSION = 0;

function readSessionLog(path) {
  const buf = readFileSync(path);
  let text = '';
  for (let i = 0; i <= buf.length - 4; i++) {
    if (buf[i] === 0x28 && buf[i + 1] === 0xb5 && buf[i + 2] === 0x2f && buf[i + 3] === 0xfd) {
      try { text += zstdDecompressSync(buf.subarray(i)).toString('utf8'); } catch {}
    }
  }
  return text;
}

function findSessionLog(sessionId) {
  const root = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'sessions');
  let workspaces = [];
  try {
    workspaces = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {}
  for (const workspace of workspaces) {
    const candidate = join(root, workspace, sessionId, 'session.v4.jsonl.zstd');
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function readFinalAnswer(sessionId) {
  const path = findSessionLog(sessionId);
  if (path === undefined) return '';
  let text;
  try {
    text = readSessionLog(path);
  } catch {
    return '';
  }
  let last = '';
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      const ev = JSON.parse(trimmed);
      if (ev.type !== 'assistant/message') continue;
      const content = ev.data?.message?.content ?? [];
      const body = content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();
      if (body.length > 0) last = body;
    } catch {}
  }
  return last;
}

/** The lane's final answer. The log write is asynchronous, so poll until the
 *  text lands (reading straight after whenIdle() can miss the last message).
 *  The window is generous: a slower lane must not be reported as empty. */
async function finalAnswer(sessionId, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    last = readFinalAnswer(sessionId);
    if (last.length > 0) return last;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return last.length > 0 ? last : '(lane produced no final text)';
}

const SEAT_SCHEMA = z.array(z.object({ id: z.string(), label: z.string(), description: z.string() }));
// `pending` is the fold's run/done bookkeeping (commandId -> seat): a switch
// is displayed only after its command settles successfully, so a failed
// apply never shows as the session's seat. It is host-internal — the wire
// view strips it, keeping the client contract at { seats, current }.
const SEAT_STATE_SCHEMA = z.object({
  seats: SEAT_SCHEMA,
  current: z.string(),
  pending: z.record(z.string(), z.string()),
});
const SEAT_VIEW_SCHEMA = z.object({ seats: SEAT_SCHEMA, current: z.string() });

/** The omo dispatch tool.
 *
 *  The output schema is written in the tools service's VALUE schema DSL (the
 *  same notation the parameter block uses): per-property `required: true`, and
 *  `defineTool` compiles it into the enforced raw JSON Schema subset.
 *
 *  `ctx` is the plugin context: the executor creates the lane through
 *  `ctx.agents`, so the tool cannot be built without it. */
export function buildDispatchTool(seats, ctx) {
  return defineTool({
    name: 'omo_dispatch',
    description: [
      'Dispatch one omo seat as an isolated lane. The seat owns the lane’s persona,',
      'its tool policy (a read-only seat physically has no write/edit/shell tools) and',
      'its model route. Returns the lane id immediately; you are notified with the',
      'lane’s final answer when it finishes. Use one seat per dispatch, give a',
      'complete brief, and dispatch independent lanes in parallel in one message.',
    ].join(' '),
    parameters: {
      seat: {
        type: 'string',
        required: true,
        description: `Seat id: ${Object.keys(seats).join(' | ')}.`,
      },
      task: {
        type: 'string',
        required: true,
        description: 'The complete brief for the lane: goal, scope, paths to read, and what to report back.',
      },
      provider: {
        type: 'string',
        description: 'Optional LLM provider for this lane (with model). When both are omitted the seat default applies; with no seat default the lane inherits your current route. Pass them together or not at all.',
      },
      model: {
        type: 'string',
        description: 'Optional LLM model for this lane (with provider). Must be passed together with provider; a lone value is ignored.',
      },
      label: {
        type: 'string',
        description: 'Optional short display label for this lane (shown in the session lineage).',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          laneId: { type: 'string', required: true },
          seat: { type: 'string', required: true },
          label: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `Dispatched ${value.seat} lane ${value.label} (${value.laneId})` }],
    },

    async execute(args, exec) {
      const parent = exec.agent;
      if (parent === undefined) throw new Error('omo_dispatch requires an agent session');

      // A FRESH merged snapshot per dispatch: seat-definition defaults and the
      // user override file can change between dispatches, and a cached table
      // would silently pin an old default (design §3.2). The plugin-load
      // `seats` stays for the roster, the projection, and session-seat
      // recovery — only the executor reads here.
      const snapshot = loadSeatSnapshot();
      const seat = snapshot.seats[args.seat];
      if (seat === undefined) {
        throw new Error(`omo_dispatch: unknown seat "${args.seat}" (known: ${Object.keys(snapshot.seats).join(', ')})`);
      }
      if (typeof args.task !== 'string' || args.task.trim().length === 0) {
        throw new Error('omo_dispatch: task must be a non-empty brief');
      }

      // Route precedence (design §3.1): call args > user override > seat
      // definition default > parent's effective route. `route === undefined`
      // means inherit, resolved below through the official child-option
      // helpers — never by assuming agents.create reads the parent's model.
      const resolution = resolveDispatchRoute({ provider: args.provider, model: args.model }, seat);
      const route = resolution.route;
      const label = (args.label && args.label.trim()) || `${seat.label} lane`;
      const laneId = randomUUID();

      // The lane works in the parent's working directory (the service is
      // agent-scoped, so read it from the parent's own context).
      const workingDirectory = parent.ctx.get('workingDirectory');
      const cwd = workingDirectory === undefined ? undefined : await workingDirectory.ensure(parent, exec.signal);

      // The route actually recorded: the resolved one, or — when inheriting —
      // the parent's latest effective route, so the descriptor and the
      // completion notice name the model the lane really runs on (design
      // §3.4). Before the parent's first request this can still be absent.
      const parentOptions = parentAgentOptionsForDelegation(parent);
      const recordRoute = route ?? (
        parentOptions.provider !== undefined && parentOptions.model !== undefined
          ? { provider: parentOptions.provider, model: parentOptions.model }
          : undefined
      );
      const routeNote = recordRoute !== undefined ? ` · ${recordRoute.provider}/${recordRoute.model}` : '';
      const halfPairNote = resolution.source === 'call-halfpair'
        ? '\n[omo] provider 与 model 必须成对传入；本次调用参数未采用。'
        : '';

      const setup = async (childCtx, child) => {
        await applySeat(childCtx, child, seat, parent.ctx);

        const laneWorkingDirectory = childCtx.get('workingDirectory');
        if (laneWorkingDirectory !== undefined && cwd !== undefined) {
          await laneWorkingDirectory.set(child, cwd, exec.signal);
        }
        child.session.append('subagent/descriptor', {
          version: DESCRIPTOR_VERSION,
          mode: 'continuable',
          provider: 'omo',
          label,
          ...recordRoute !== undefined ? { agentProvider: recordRoute.provider, agentModel: recordRoute.model } : {},
          persona: seat.persona,
          ...seat.allow !== undefined ? { toolFilter: { allow: seat.allow } } : {},
          ...Array.isArray(seat.deny) && seat.deny.length > 0 ? { toolFilter: { deny: seat.deny } } : {},
        });
      };

      // Official child-option resolution: the parent's provider/model,
      // reasoning-effort and maxTokens unless overridden, stamped with the
      // child's delegation depth, with a stale route-owned reasoningEffort
      // cleared on a route change (design §3.3). Passing the resolved route
      // as `requested` is what makes "inherit" mean the parent's LATEST
      // effective route rather than its creation-time one.
      const childDepth = resolveChildDepth(parent);
      const agentOptions = resolveChildAgentOptions(
        parent,
        route !== undefined ? { provider: route.provider, model: route.model } : undefined,
        childDepth,
      );

      // The lane is a subagent-origin child session. The official history and
      // trajectory APIs address a child through its session header
      // (`origin: 'subagent'` + `parentSession` + the delegation depth), the
      // same way the official subagent tool creates its children. Without this
      // meta the lane is invisible to them and the UI reports
      // "subagent is unavailable (subagent/not-found)".
      const meta = childSessionMeta(parent, childDepth, false);

      const handle = await ctx.agents.create({
        sessionId: laneId,
        parentAgent: parent,
        meta,
        agentOptions,
        signal: exec.signal,
        setup,
      });

      // The parent's lineage view reads this event.
      parent.session.append('subagent/catalog', {
        version: CATALOG_VERSION,
        childId: laneId,
        childCreatedAt: handle.agent.session.header?.createdAt ?? Date.now(),
        mode: 'continuable',
        label,
      });

      handle.agent.send(
        createUserMessage({ content: [{ type: 'text', text: args.task }], source: { kind: 'user' } }),
        'next-turn',
        true,
      );

      // Notify the PARENT when the lane finishes (the official tool's
      // completion notice, reproduced for the omo path). The notice always
      // names the resolved route — it must not depend on whether the caller
      // hand-filled the parameters.
      void (async () => {
        try {
          await handle.agent.whenIdle();
          const answer = await finalAnswer(laneId);
          parent.send(
            createUserMessage({
              content: [{
                type: 'text',
                text: `Agent ${laneId} sent a message: [omo lane ${label} · seat ${args.seat}${routeNote}] finished.${halfPairNote}\n\n`,
              }, { type: 'text', text: answer }],
              source: { kind: 'agent-message', form: 'relay', senderSessionId: laneId },
            }),
            'next-turn',
            true,
          );
        } catch {
          // a failed lane must never take the parent down
        }
      })();

      return { laneId, seat: args.seat, label };
    },
  });
}

export function apply(ctx) {
  const seats = loadSeats();

  // The seat roster AND the current seat, readable by the client chip through
  // this session projection. Both ride OFFICIAL events only — the command
  // lifecycle every `/preset` run writes, plus `agent-preset/selected` — so
  // the client can re-sync the current seat after a refresh, a session
  // switch, or a `/preset` typed in the composer. A custom event type is
  // refused by the official persistence reader and would corrupt the log,
  // which is why the fold never sees one; the host's own cold-restart
  // recovery stays in the bundle store (agent/created, below).
  ctx.sessionProjections.register({
    key: 'omoSeats',
    stateSchema: SEAT_STATE_SCHEMA,
    init: () => ({ seats: rosterView(seats), current: '', pending: {} }),
    apply: (state, event) => foldSeatState(state, event, seats),
    wire: {
      viewSchema: SEAT_VIEW_SCHEMA,
      view: (state) => ({ seats: state.seats, current: state.current }),
    },
    stateVersion: 3,
  });

  ctx.tools.register(buildDispatchTool(seats, ctx));

  // ── session seat runtime ───────────────────────────────────────────────
  // Seat state lives in the bundle's own store, never in the session log: a
  // custom event type is rejected by the official persistence reader and would
  // corrupt the log. Recovery therefore happens on `agent/created` (a resumed
  // session does not replay session events), and an official mode selected in
  // the picker lifts the omo layer.
  ctx.on('agent/created', async ({ agent }) => {
    if (agent === undefined) return;
    await restoreSeat(ctx, agent, seats);
  });

  ctx.on('session/event', (_session, event) => {
    if (event?.type !== 'agent-preset/selected') return;
    const agents = ctx.get('agents');
    const agent = agents?.get(_session.id);
    if (agent === undefined) return;
    if (seats[event.data?.agentPreset] !== undefined) return; // not an official mode
    releaseSeat(agent.id); // switched to an official mode: lift the omo layer
    forgetSeat(agent.id);
  });
}