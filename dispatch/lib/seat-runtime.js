// The omo seat table and the seat runtime, shared by the dispatch tool and the
// /preset command.
//
// Two hard-won constraints shape this file:
//
// 1. `tools.restrict()` can only mask INHERITED tools. A tool the session
//    registered into its own scope (the model-selection policy installs
//    `subagent` that way) is visible but NOT restrictable, and naming it makes
//    restrict() throw — which is what broke every read-only seat. So the deny
//    list is probed against `tools.view(agent).restrictableNames`, and the
//    self-registered delegation tools are denied through `tools.guard()`
//    instead (execution is refused; the schema stays visible).
//
// 2. `tools.guard()` hands its callback the EXECUTION OBJECT, not a name:
//    `guard((exec) => exec.name === 'x' ? 'reason' : undefined)`. Comparing the
//    object itself against a name list never matches, so the guard silently
//    denies nothing — that was a live hole (Explorer's local `subagent` still
//    executed). The check must also run PER CALL rather than off an
//    apply-time snapshot, and it must test the NAME against the seat rule
//    for every still-visible tool — not just the ones that existed when the
//    seat landed. Two escapes make the snapshot approach unsound: a tool
//    registered into ANY layer after apply was never in the compiled
//    restrict() filter (a late global `write` sails through a deny list
//    probed before it existed), and a scope-local definition shadows
//    whatever the global layer holds, so "the name is restrictable" says
//    nothing about which definition would actually run. Council's zero-tool
//    `allow: []` seat must therefore refuse a late local `write` AND a late
//    global one, not just the delegation trio.
//
// 3. A custom session event (`omo/seat-selected`) is rejected by the official
//    persistence reader ("unknown to this harness and not marked ignorable"),
//    which corrupts the log. Seat state for the client therefore rides the
//    `omoSeats` projection folded from OFFICIAL events only (the command
//    lifecycle `/preset` already writes, plus `agent-preset/selected`), while
//    the host's cold-restart recovery keeps its own store and re-applies on
//    `agent/created`; nothing custom is ever appended.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUNDLE_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

// Tool policy, derived once:
//   readOnly -> deny write/edit/pwsh (the shell can write files)
//   canSpawn -> when false, deny the delegation tools
//   council  -> allow-list [] : zero tools, like the shipped council seat
const NO_WRITE = ['write', 'edit', 'pwsh'];
// Delegation entry points. `subagent`/`subagent_fork` are self-registered by
// the model-selection policy (restrict cannot touch them); omo_dispatch is ours.
const DELEGATION = ['subagent', 'subagent_fork', 'omo_dispatch'];

const STATE_FILE = () => join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'omo', 'session-seats.json');

/** The seat table: shipped seats (dispatch/seats.json) + user seats.
 *
 *  Optional `provider`/`model` fields ride through UNVALIDATED (validation and
 *  diagnostics live in seat-models.js, the single merge entry point); `origin`
 *  marks shipped vs user so the merged snapshot can name the source. Every
 *  existing consumer only reads label/description/order/persona/allow/deny,
 *  so the extra fields are inert to them. */
export function loadSeats() {
  let shipped = {};
  try {
    shipped = JSON.parse(readFileSync(join(BUNDLE_DIR, 'dispatch', 'seats.json'), 'utf8'));
  } catch {
    shipped = {};
  }
  const table = {};
  for (const [id, seat] of Object.entries(shipped)) {
    const deny = [];
    if (seat.readOnly) deny.push(...NO_WRITE);
    if (seat.canSpawn === false) deny.push(...DELEGATION);
    table[id] = {
      label: seat.label ?? id,
      description: seat.description ?? '',
      order: seat.order ?? 100,
      persona: seat.persona ?? '',
      origin: 'shipped',
      ...(id === 'council' ? { allow: [] } : {}),
      ...(deny.length > 0 ? { deny } : {}),
      ...(seat.provider !== undefined || seat.model !== undefined ? { provider: seat.provider, model: seat.model } : {}),
    };
  }

  const userPath = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'omo', 'presets.json');
  if (existsSync(userPath)) {
    try {
      const parsed = JSON.parse(readFileSync(userPath, 'utf8').replace(/^﻿/, ''));
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (entry === null || typeof entry !== 'object') continue;
          if (typeof entry.id !== 'string' || !Array.isArray(entry.plugins)) continue;
          const persona = entry.plugins.find((row) => row?.id === 'persona')?.config?.prefix;
          const fs = entry.plugins.find((row) => row?.id === 'tool-fs')?.config ?? {};
          const readOnly = fs.write === false || fs.edit === false;
          table[entry.id] = {
            label: entry.name ?? entry.id,
            description: entry.description ?? '',
            order: entry.order ?? 200,
            persona: typeof persona === 'string' && persona.length > 0 ? persona : (entry.description ?? entry.id),
            origin: 'user',
            ...(readOnly ? { deny: [...NO_WRITE, ...DELEGATION] } : {}),
            ...(entry.provider !== undefined || entry.model !== undefined ? { provider: entry.provider, model: entry.model } : {}),
          };
        }
      }
    } catch {
      // a malformed user file must never break composition
    }
  }
  return table;
}

/** The seat roster as the client chip reads it. */
export function rosterView(table) {
  return Object.entries(table)
    .map(([id, seat]) => ({ id, label: seat.label, description: seat.description }))
    .sort((a, b) => (table[a.id].order ?? 100) - (table[b.id].order ?? 100));
}

// ── the bundle's own seat store (never the session log) ──────────────────
function readStore() {
  try {
    return JSON.parse(readFileSync(STATE_FILE(), 'utf8'));
  } catch {
    return {};
  }
}

function writeStore(state) {
  try {
    mkdirSync(dirname(STATE_FILE()), { recursive: true });
    writeFileSync(STATE_FILE(), JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // the store is a convenience; failing to persist must not break a switch
  }
}

/** The seat a session last ran under, for cold-restart recovery. */
export function rememberedSeat(sessionId) {
  return readStore()[sessionId];
}

export function rememberSeat(sessionId, seatId) {
  const state = readStore();
  state[sessionId] = seatId;
  writeStore(state);
}

export function forgetSeat(sessionId) {
  const state = readStore();
  if (state[sessionId] === undefined) return;
  delete state[sessionId];
  writeStore(state);
}

/**
 * Fold one session event into the seat-display state carried by the
 * `omoSeats` projection, so the client chip has a host-authoritative
 * "current seat" after a refresh, a session switch, or a `/preset` typed in
 * the composer. Only OFFICIAL event types are read — a custom event type is
 * refused by the persistence reader — so the fold keys on the command
 * lifecycle every `/preset` run already writes, and on the official preset
 * selection that moves a session off the omo plane:
 *
 * - `command/run` naming `preset` with a known omo seat  -> pending[cmd] = seat
 * - `command/done` settling that command with success     -> current = seat
 * - `command/done` settling that command with an error    -> current untouched
 * - `agent-preset/selected` with an omo seat id (only
 *   pre-D-3 sessions carry those)                        -> current = seat
 * - `agent-preset/selected` with an official mode id    -> current = ''
 *
 * The run/done pairing is load-bearing: `command/run` is committed BEFORE
 * the handler runs, so folding it straight into `current` showed a seat the
 * session never actually took when the apply failed — and the wrong value
 * survived every later read, including a cold replay of the same log. The
 * seat moves only once the command settles successfully; a failed switch
 * leaves `current` at whatever the last SUCCESSFUL switch selected.
 *
 * @param state - the projection state ({ seats, current, pending }).
 * @param event - one committed session event.
 * @param table - the seat table (shipped + user seats).
 * @returns the next state (the same reference when nothing changed).
 */
export function foldSeatState(state, event, table) {
  const data = event?.data;
  if (event?.type === 'command/run' && data?.name === 'preset') {
    const wanted = typeof data.args === 'string' ? data.args.trim().toLowerCase() : '';
    const commandId = typeof data.commandId === 'string' ? data.commandId : undefined;
    if (wanted.length === 0 || table[wanted] === undefined || commandId === undefined) return state;
    return { ...state, pending: { ...(state.pending ?? {}), [commandId]: wanted } };
  }
  if (event?.type === 'command/done') {
    const pending = state.pending ?? {};
    const commandId = typeof data?.commandId === 'string' ? data.commandId : undefined;
    const seat = commandId === undefined ? undefined : pending[commandId];
    if (seat === undefined) return state;
    const rest = { ...pending };
    delete rest[commandId];
    if (data?.kind !== 'success') return { ...state, pending: rest };
    return { ...state, pending: rest, current: seat };
  }
  if (event?.type === 'agent-preset/selected') {
    const id = data?.agentPreset;
    // An official-plane selection also voids any in-flight omo switch: the
    // session has moved planes, so a late success must not reseat it.
    return {
      ...state,
      current: typeof id === 'string' && table[id] !== undefined ? id : '',
      pending: {},
    };
  }
  return state;
}

// ── the seat layer on one agent scope ────────────────────────────────────
const LAYERS = new Map(); // agentId -> disposer[] (inverse-order teardown)

/** Names restrict() accepts in this scope: inherited tools only. */
function restrictableNames(agentCtx, agent) {
  const view = agentCtx.tools?.view?.(agent);
  return view?.restrictableNames ?? new Set();
}

/**
 * Apply one seat's persona + tool policy to an agent's scope. Returns a
 * teardown that lifts every layer in reverse order. `parentCtx` is passed for
 * lanes (which must first inherit the parent's composition); it is omitted for
 * a session seat, whose own composition is already mounted.
 *
 * Every step is rolled back if a later one throws, so a failed switch leaves
 * no residue.
 */
export async function applySeat(agentCtx, agent, seat, parentCtx) {
  if (parentCtx !== undefined) agentCtx.get('agentPresets')?.composeFrom(agentCtx, parentCtx);

  const installed = [];
  const rollback = () => {
    for (const dispose of installed.reverse()) {
      try { dispose(); } catch { /* teardown is best-effort */ }
    }
  };

  // Tool policy. Only restrictable names may go through restrict(); the
  // self-registered delegation tools are refused at execution time instead.
  const restrictable = restrictableNames(agentCtx, agent);
  let filter;
  if (seat.allow !== undefined) {
    filter = { allow: [...seat.allow].filter((name) => restrictable.has(name)) };
  } else if (Array.isArray(seat.deny) && seat.deny.length > 0) {
    const deny = seat.deny.filter((name) => restrictable.has(name));
    filter = deny.length > 0 ? { deny } : undefined;
  }
  try {
    if (filter !== undefined) installed.push(agentCtx.tools.restrict(filter));

    // Tools that escape restrict() are refused at execution time instead.
    // The guard reads the execution object (`exec.name`) and applies the
    // seat rule to EVERY still-visible tool, per call: a tool registered
    // into any layer after the seat landed was never in the compiled
    // filter (a late global `write` is invisible to a deny list that was
    // probed before it existed), and a scope-local definition shadows
    // whatever the global layer holds. An allow-list seat (Council: zero
    // tools) therefore refuses everything the list does not name, and a
    // deny-list seat refuses exactly its list — nothing else.
    const hasPolicy = seat.allow !== undefined || (Array.isArray(seat.deny) && seat.deny.length > 0);
    if (hasPolicy) {
      const seatLabel = seat.label ?? 'this seat';
      const allowed = seat.allow;
      const denied = Array.isArray(seat.deny) ? seat.deny : [];
      const refusal = (name) => `${name} is not available to ${seatLabel}.`;
      installed.push(agentCtx.tools.guard((exec) => {
        const name = exec?.name;
        if (typeof name !== 'string') return undefined;
        // Invisible: the filter already removed it (or it was never
        // registered) and execute fails on its own — leave that failure
        // alone rather than restating it as a seat refusal.
        if (agentCtx.tools.get(name, agent) === undefined) return undefined;
        if (allowed !== undefined) {
          return allowed.includes(name) ? undefined : refusal(name);
        }
        return denied.includes(name) ? refusal(name) : undefined;
      }));
    }

    // Persona: overriding the same section name replaces a previous seat's.
    const personaDisposer = agentCtx.systemPrompt.section({
      name: 'deployment:persona-prefix',
      order: agentCtx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),
      text: seat.persona,
    });
    if (typeof personaDisposer === 'function') installed.push(personaDisposer);
  } catch (error) {
    rollback();
    throw error;
  }

  return () => {
    for (const dispose of installed.reverse()) {
      try { dispose(); } catch { /* teardown is best-effort */ }
    }
  };
}

/** Lift whatever seat layer an agent currently carries. */
export function releaseSeat(agentId) {
  const disposers = LAYERS.get(agentId);
  if (disposers === undefined) return;
  for (const dispose of disposers.reverse()) {
    try { dispose(); } catch { /* best-effort */ }
  }
  LAYERS.delete(agentId);
}

/** Apply a seat to a live session agent and remember it for cold restarts. */
export async function applySeatToSession(ctx, agent, seatId, table) {
  const seat = table[seatId];
  if (seat === undefined) return { ok: false, reason: 'unknown seat' };
  try {
    releaseSeat(agent.id);
    const teardown = await applySeat(agent.ctx, agent, seat, undefined);
    LAYERS.set(agent.id, [teardown]);
    rememberSeat(agent.id, seatId);
    return { ok: true };
  } catch (error) {
    releaseSeat(agent.id);
    return { ok: false, reason: String(error?.message ?? error) };
  }
}

/** Re-apply the remembered seat after a cold start (no event is recorded). */
export async function restoreSeat(ctx, agent, table) {
  const seatId = rememberedSeat(agent.id);
  if (seatId === undefined || table[seatId] === undefined) return false;
  try {
    const teardown = await applySeat(agent.ctx, agent, table[seatId], undefined);
    LAYERS.set(agent.id, [teardown]);
    return true;
  } catch {
    return false;
  }
}
