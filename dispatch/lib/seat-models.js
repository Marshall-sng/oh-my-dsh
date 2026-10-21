// Seat model settings: the merge of seat-definition default routes, the
// user-level override file, and the per-dispatch route resolution.
//
// Design: docs/seat-model-design.md. Precedence for a dispatched lane:
//   call args (full pair) > user override > seat definition default > parent
// The override file carries three states per seat: missing (use the
// definition default), null (force inherit), or a full route object. Invalid
// entries are ignored with a diagnostic and preserved verbatim on save.
//
// Reads are lock-free — the official atomic replace commits whole files, so
// a reader sees the old or the new complete content. Writes take the official
// cross-process lock, re-read, compare the target entry's revision, change
// only that key, and replace atomically, so a desktop and a web window
// editing different seats cannot lose each other's edits.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
import { loadSeats } from './seat-runtime.js';

/** The user-level override file, shared by every profile of one DSH_HOME. */
export function overrideFile() {
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'omo', 'seat-models.json');
}

/** Strict route pair: both non-empty strings, else null. */
export function parseRoute(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const provider = value.provider;
  const model = value.model;
  if (typeof provider !== 'string' || provider.trim().length === 0) return null;
  if (typeof model !== 'string' || model.trim().length === 0) return null;
  return { provider, model };
}

/** Canonical token of one override entry, for revision hashing. */
function overrideToken(entry) {
  if (entry === undefined || entry.kind === 'missing') return 'missing';
  if (entry.kind === 'inherit') return 'inherit';
  if (entry.kind === 'route') return `route:${entry.route.provider}\u0000${entry.route.model}`;
  return `invalid:${JSON.stringify(entry.raw)}`;
}

/** Stable per-entry revision token; the save CAS compares this. */
export function overrideRevisionOf(entry) {
  return createHash('sha256').update(overrideToken(entry)).digest('hex').slice(0, 16);
}

/**
 * Read + parse the override file. Never throws: a missing file means no
 * overrides, and a corrupt one degrades to no overrides with a diagnostic
 * (a save then refuses to silently flatten it — see saveOverride).
 */
export function readOverrides() {
  const path = overrideFile();
  const result = { entries: new Map(), diagnostics: [], corrupt: false };
  if (!existsSync(path)) return result;
  let text;
  try {
    text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  } catch (error) {
    result.corrupt = true;
    result.diagnostics.push({ code: 'OVERRIDE_READ_FAILED', message: `seat-models.json could not be read: ${error?.message ?? error}` });
    return result;
  }
  if (text.trim().length === 0) return result;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    result.corrupt = true;
    result.diagnostics.push({ code: 'OVERRIDE_FILE_INVALID', message: `seat-models.json is not valid JSON: ${error?.message ?? error}` });
    return result;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    result.corrupt = true;
    result.diagnostics.push({ code: 'OVERRIDE_FILE_INVALID', message: 'seat-models.json must be a JSON object keyed by seat id' });
    return result;
  }
  for (const [seatId, value] of Object.entries(parsed)) {
    if (value === null) {
      result.entries.set(seatId, { kind: 'inherit' });
      continue;
    }
    const route = parseRoute(value);
    if (route === null) {
      result.entries.set(seatId, { kind: 'invalid', raw: value });
      result.diagnostics.push({ code: 'OVERRIDE_ENTRY_INVALID', seatId, message: `override for "${seatId}" is not a full {provider, model} pair; ignored` });
      continue;
    }
    result.entries.set(seatId, { kind: 'route', route });
  }
  return result;
}

/**
 * The merged seat table plus the per-seat model view the GUI reads. The
 * table entries carry the EFFECTIVE default route (provider/model) and its
 * source; every dispatch and every configuration read goes through this one
 * entry point, so the merge rules cannot drift between them.
 */
export function loadSeatSnapshot() {
  const definitions = loadSeats();
  const overrides = readOverrides();
  const seats = {};
  const modelSettings = {};
  const diagnostics = [...overrides.diagnostics];

  for (const [id, definition] of Object.entries(definitions)) {
    const declared = definition.provider !== undefined || definition.model !== undefined;
    const definitionRoute = declared ? parseRoute({ provider: definition.provider, model: definition.model }) : null;
    if (declared && definitionRoute === null) {
      diagnostics.push({ code: 'DEFINITION_ROUTE_INVALID', seatId: id, message: `seat "${id}" declares a provider/model that is not a full pair; ignored` });
    }
    const entry = overrides.entries.get(id) ?? { kind: 'missing' };

    let route;
    let source;
    if (entry.kind === 'inherit') {
      route = undefined; // forced inherit: ignore even a definition default
      source = 'forced-inherit';
    } else if (entry.kind === 'route') {
      route = entry.route;
      source = 'user-override';
    } else if (definitionRoute !== null) {
      route = definitionRoute;
      source = definition.origin === 'user' ? 'user-definition' : 'shipped-definition';
    } else {
      route = undefined; // nothing configured: the dispatch inherits the parent
      source = 'parent';
    }

    const { provider: _definitionProvider, model: _definitionModel, ...rest } = definition;
    seats[id] = {
      ...rest,
      modelSource: source,
      ...(route !== undefined ? { provider: route.provider, model: route.model } : {}),
    };
    modelSettings[id] = {
      seatId: id,
      definitionModel: definitionRoute,
      override: entry.kind,
      effectiveModel: route ?? null,
      source,
      overrideRevision: overrideRevisionOf(entry),
    };
  }

  const revision = createHash('sha256').update(JSON.stringify(modelSettings)).digest('hex').slice(0, 16);
  return { seats, modelSettings, diagnostics, revision };
}

/**
 * Resolve the route one dispatch will use (design §3.1 decision table).
 * A half pair (only provider or only model) deliberately does NOT fall to
 * the seat default: the call is malformed, so the lane inherits the parent's
 * route and the caller is warned — silently substituting a default would
 * hide the mistake.
 *
 * @param call - the raw {provider?, model?} from the tool call.
 * @param seat - the merged snapshot entry (effective route on provider/model).
 * @returns { route, source, diagnostics } — route undefined means inherit.
 */
export function resolveDispatchRoute(call, seat) {
  const diagnostics = [];
  const hasProvider = typeof call?.provider === 'string';
  const hasModel = typeof call?.model === 'string';
  if (hasProvider && hasModel) {
    return { route: { provider: call.provider, model: call.model }, source: 'call', diagnostics };
  }
  if (hasProvider !== hasModel) {
    diagnostics.push({
      code: 'CALL_HALF_PAIR',
      message: 'provider and model must be passed together; the call arguments were ignored and the lane inherits its default route',
    });
    return { route: undefined, source: 'call-halfpair', diagnostics };
  }
  if (seat?.provider !== undefined && seat?.model !== undefined) {
    return { route: { provider: seat.provider, model: seat.model }, source: seat.modelSource ?? 'seat', diagnostics };
  }
  return { route: undefined, source: 'parent', diagnostics };
}

/** Serialize one entry map back to file content (preserving invalid entries). */
function serializeOverrides(entries) {
  const next = {};
  for (const [id, entry] of entries) {
    if (entry.kind === 'inherit') next[id] = null;
    else if (entry.kind === 'route') next[id] = { provider: entry.route.provider, model: entry.route.model };
    else if (entry.kind === 'invalid') next[id] = entry.raw;
  }
  return `${JSON.stringify(next, null, 2)}\n`;
}

/**
 * Apply one seat's model preference under the cross-process lock: read the
 * latest file, refuse when it is corrupt, CAS the target entry's revision,
 * change only that key, and replace atomically. Other seats — including
 * unknown-seat and invalid entries — are preserved verbatim.
 *
 * @returns { ok: true, snapshot } or { ok: false, code, message } where code
 *   is VALIDATION | CONFLICT | CONFIG_FILE_INVALID | WRITE_FAILED | LOCK_TIMEOUT.
 */
export async function saveOverride(request) {
  const seatId = request?.seatId;
  const mode = request?.mode;
  const route = request?.route;
  const expected = request?.expectedOverrideRevision;

  const definitions = loadSeats();
  if (typeof seatId !== 'string' || definitions[seatId] === undefined) {
    return { ok: false, code: 'VALIDATION', message: `unknown seat "${String(seatId)}"` };
  }
  if (mode !== 'set' && mode !== 'inherit' && mode !== 'reset') {
    return { ok: false, code: 'VALIDATION', message: `mode must be set, inherit, or reset (got "${String(mode)}")` };
  }
  let nextRoute;
  if (mode === 'set') {
    nextRoute = parseRoute(route);
    if (nextRoute === null) {
      return { ok: false, code: 'VALIDATION', message: 'mode "set" requires a full {provider, model} pair' };
    }
  }

  const path = overrideFile();
  try {
    mkdirSync(dirname(path), { recursive: true });
    const outcome = await withFileLock(path, async () => {
      const current = readOverrides();
      if (current.corrupt) {
        return { ok: false, code: 'CONFIG_FILE_INVALID', message: current.diagnostics[0]?.message ?? 'seat-models.json is invalid; fix or remove it before saving' };
      }
      const entry = current.entries.get(seatId) ?? { kind: 'missing' };
      if (expected !== undefined && overrideRevisionOf(entry) !== expected) {
        return { ok: false, code: 'CONFLICT', message: `the override for "${seatId}" changed since it was loaded; refresh and retry` };
      }
      const next = new Map(current.entries);
      if (mode === 'reset') next.delete(seatId);
      else if (mode === 'inherit') next.set(seatId, { kind: 'inherit' });
      else next.set(seatId, { kind: 'route', route: nextRoute });
      await writeFileAtomic(path, serializeOverrides(next), { mode: 0o600 });
      return { ok: true };
    });
    if (!outcome.ok) return outcome;
    return { ok: true, snapshot: loadSeatSnapshot() };
  } catch (error) {
    const message = String(error?.message ?? error);
    if (message.includes('timed out waiting for the writer lock')) {
      return { ok: false, code: 'LOCK_TIMEOUT', message };
    }
    return { ok: false, code: 'WRITE_FAILED', message };
  }
}
