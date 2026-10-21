// oh-my-dsh user preset loader.
//
// Reads `<DSH_HOME>/omo/presets.json` and registers every entry as an agent
// preset on the Host's `agentPresets` registry, so user-defined seats appear
// in the same roster as the shipped omo presets — and therefore in the Agent
// button's list.
//
// File format: an array of preset definitions, the same shape a declarative
// agent-preset row carries:
//
//   [
//     {
//       "id": "user-reviewer",
//       "name": "Reviewer",
//       "description": "Reviews a change set before it lands.",
//       "order": 30,
//       "plugins": [
//         { "id": "persona", "name": "@deepseek-ai/dsh-persona",
//           "config": { "prefix": "You are a meticulous reviewer…" } },
//         { "id": "tool-fs", "name": "@deepseek-ai/dsh-tool-fs" }
//       ]
//     }
//   ]
//
// Robustness: a missing file, unreadable JSON, or a malformed entry never
// breaks the composition. Each preset is registered on its own; one bad entry
// is logged and skipped, and the shipped roster stays intact.
//
// The file is read at start-up. Restart the host (or toggle the bundle) to
// pick up edits.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const inject = ['agentPresets'];
export const name = 'omo-user-presets';

const FILE_NAME = 'presets.json';

// This file lives at <bundle>/user-presets/lib/index.js, so the bundle's own
// skills directory is three levels up. User seats get the same skill layer as
// the shipped omo presets unless the user declared their own.
const BUNDLE_SKILLS_DIR = join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), 'skills');

function dshHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh');
}

function userConfigPath() {
  return join(dshHome(), 'omo', FILE_NAME);
}

function readUserPresets() {
  const path = userConfigPath();
  if (!existsSync(path)) return { path, presets: [] };
  let parsed;
  try {
    // Editors on Windows love to write a UTF-8 BOM; JSON.parse rejects it.
    const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
    parsed = JSON.parse(raw);
  } catch (error) {
    return { path, presets: [], error: `unreadable JSON: ${error?.message ?? error}` };
  }
  if (!Array.isArray(parsed)) {
    return { path, presets: [], error: 'expected a JSON array of preset definitions' };
  }
  return { path, presets: parsed };
}

function isUsableDefinition(value) {
  if (value === null || typeof value !== 'object') return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (!Array.isArray(value.plugins)) return false;
  return value.plugins.every((row) => row && typeof row.id === 'string' && typeof row.name === 'string');
}

/** Give a user seat the same skill layer the shipped omo presets carry. */
function withSkillLayer(plugins) {
  const has = (id) => plugins.some((row) => row.id === id);
  const rows = [...plugins];
  if (!has('skill-filesystem')) {
    rows.push({
      id: 'skill-filesystem',
      name: '@deepseek-ai/dsh-skill-filesystem',
      config: { customSkillDirs: [BUNDLE_SKILLS_DIR] },
    });
  }
  if (!has('tool-skill')) {
    rows.push({ id: 'tool-skill', name: '@deepseek-ai/dsh-tool-skill' });
  }
  return rows;
}

export function apply(ctx) {
  const { path, presets, error } = readUserPresets();
  if (error) {
    ctx.logger?.warn('omo-user-presets: %s ignored (%s)', path, error);
    return;
  }
  if (presets.length === 0) return;

  for (const definition of presets) {
    if (!isUsableDefinition(definition)) {
      ctx.logger?.warn('omo-user-presets: skipped a malformed entry in %s', path);
      continue;
    }
    const registration = {
      id: definition.id,
      ...definition.name === undefined ? {} : { name: definition.name },
      ...definition.description === undefined ? {} : { description: definition.description },
      ...definition.order === undefined ? {} : { order: definition.order },
      plugins: withSkillLayer(definition.plugins),
    };
    ctx.agentPresets.register(registration).catch((error) => {
      ctx.logger?.warn('omo-user-presets: could not register %s (%s)', definition.id, error?.message ?? error);
    });
  }
  ctx.logger?.info('omo-user-presets: registered %d user preset(s) from %s', presets.length, path);
}
