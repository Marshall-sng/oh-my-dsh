// oh-my-dsh /preset command.
//
// Human-facing control for the omo seat plane: list the seats this profile
// offers, show the current session's seat, and switch the current session to
// another seat.
//
// The command runs in the UI command plane: its output is rendered by the
// client and never enters a model request.
//
// Since D-3 the omo seats are not agent presets: the roster comes from the
// dispatch module's seat table, and switching to an omo seat goes through the
// seat runtime (applySeat) rather than the Host's agent-preset registry.
// Official presets (standard / ptc / minimal / cordis) still switch through
// the registry, so both planes stay in their own lane.

import { loadSeats, applySeatToSession, rememberedSeat } from '../../dispatch/lib/seat-runtime.js';

export const inject = ['commands', 'agentPresets'];
export const name = 'command-preset';

const USAGE = 'Usage: /preset [<seat-id>]';

function renderRoster(rows, currentId) {
  const lines = ['omo 席位 / 官方模式：'];
  for (const row of rows) {
    const marks = [];
    if (row.id === currentId) marks.push('current');
    const label = row.name ? `${row.id} (${row.name})` : row.id;
    const suffix = marks.length > 0 ? ` [${marks.join(', ')}]` : '';
    lines.push(`- ${label}${suffix}`);
  }
  lines.push('');
  lines.push(USAGE);
  return lines.join('\n');
}

export function apply(ctx) {
  ctx.commands.register({
    definitionId: 'oh-my-dsh/command-preset',
    name: 'preset',
    description: 'List the omo seats and official modes, or switch this session to one',
    input: {
      hint: '[<seat-id>]',
      attachments: false,
    },
    async handler(invocation) {
      const input = invocation.rawInput.trim();
      const agent = invocation.agent;

      // The omo seat table (shipped + user seats).
      const seats = loadSeats();
      let official = [];
      try {
        official = await ctx.agentPresets.list();
      } catch {
        official = [];
      }

      const rows = [
        ...Object.entries(seats).map(([id, seat]) => ({ id, name: seat.label, omo: true })),
        ...official.map((row) => ({ id: row.id, name: row.name, omo: false })),
      ];

      if (input.length === 0) {
        // The omo seat the Host last applied to THIS session, read from the
        // bundle's own store. `composedPreset()` only knows the official mode
        // the omo layer rides on, so it would mark the wrong row.
        const current = rememberedSeat(agent.id) ?? '';
        return { kind: 'success', text: renderRoster(rows, current) };
      }

      const wanted = input.toLowerCase();
      const target = rows.find((row) => row.id.toLowerCase() === wanted);
      if (!target) {
        const known = rows.map((row) => row.id).join(', ');
        return { kind: 'error', text: `Unknown seat: ${input}\nKnown seats: ${known}\n${USAGE}` };
      }

      if (!target.omo) {
        // An official mode: the registry owns it.
        try {
          const applied = await ctx.agentPresets.select(agent, target.id);
          return { kind: 'success', text: `Mode switched to ${applied}.` };
        } catch (error) {
          const code = error?.code ? ` (${error.code})` : '';
          const reason = error?.message ?? String(error);
          return { kind: 'error', text: `Cannot switch to ${target.id}${code}: ${reason}\n${USAGE}` };
        }
      }

      // An omo seat: the seat runtime applies it on top of whatever mode the
      // session runs in.
      const result = await applySeatToSession(ctx, agent, target.id, seats);
      if (!result.ok) {
        return { kind: 'error', text: `Cannot switch to ${target.id}: ${result.reason}\n${USAGE}` };
      }
      return { kind: 'success', text: `omo 席位已切换到 ${target.id}。` };
    },
  });
}
