// The omoSeatModels Host service: seat dispatch-default model preferences.
//
// Human-GUI only — deliberately NOT a model-facing tool. Three methods:
//   getState   the merged per-seat model snapshot (definitions + overrides)
//   getCatalog the Host's raw LLM catalog, with the official-subagent
//              policy marked as advisory context (never a save/dispatch gate)
//   update     one seat's preference under the cross-process lock
//
// The service is a TypertRemoteService, so the Gateway discovers it through
// source-mode claims; the wire contract lives in typert.host.js, registered
// manually through ctx.typert.register (hand-written schemas path).
//
// Reads never create or resume an Agent and never touch the session's own
// model: configuration queries must stay invisible to the conversation.
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { TYPERT } from './typert.host.js';
import { loadSeatSnapshot, saveOverride } from '../../dispatch/lib/seat-models.js';

export const inject = ['typert', 'llm', 'sessionProjections'];
export const name = 'omo-model-settings';

/** Advisory copy for the catalog: the official policy is context, not a gate. */
const CATALOG_NOTE = 'officialSubagentAllowed reflects the current session’s captured official subagent policy; it never gates omo dispatch or saving.';

/**
 * The official subagent route policy captured for one session, or undefined
 * when it cannot be read (no session, no live session, or no captured
 * policy yet). Never guessed as false — an uncaptured policy is unknown.
 */
function officialSubagentPolicy(ctx, sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return undefined;
  const sessions = ctx.get('sessions');
  const session = sessions?.get(sessionId);
  if (session === undefined) return undefined;
  try {
    return ctx.sessionProjections.stateOf(session, 'subagentModelSelectionPolicy') ?? undefined;
  } catch {
    return undefined;
  }
}

export class OmoSeatModelsController extends TypertRemoteService {
  constructor(ctx) {
    super(ctx, 'omoSeatModels', { namespace: 'omoSeatModels' });
  }

  getState(request, signal) {
    const snapshot = loadSeatSnapshot();
    return {
      protocolVersion: 1,
      revision: snapshot.revision,
      seats: Object.values(snapshot.modelSettings),
      diagnostics: snapshot.diagnostics,
    };
  }

  async getCatalog(request, signal) {
    const llm = this.ctx.get('llm');
    if (llm === undefined) {
      throw new RemoteError('gateway/internal', 'the llm service is unavailable, so no model catalog can be listed', {});
    }
    const policy = officialSubagentPolicy(this.ctx, request?.sessionId);
    const wanted = typeof request?.provider === 'string' && request.provider.length > 0 ? request.provider : undefined;
    const providers = llm.listProviders();
    const selected = wanted === undefined ? providers : providers.filter((provider) => provider.id === wanted);
    const entries = [];
    for (const provider of selected) {
      let models = [];
      let failure;
      try {
        // One provider's discovery failure must not hide the others, and
        // must not block hand-entered routes (design §4.1).
        models = await llm.listModels(provider.id);
      } catch (error) {
        failure = String(error?.message ?? error);
      }
      entries.push({
        id: provider.id,
        name: typeof provider.name === 'string' && provider.name.length > 0 ? provider.name : provider.id,
        models: models.map((model) => ({
          id: model.id,
          name: typeof model.name === 'string' && model.name.length > 0 ? model.name : model.id,
          registered: true,
          officialSubagentAllowed: policy === undefined
            ? 'unknown'
            : policy.some((route) => route.provider === provider.id && route.model === model.id),
        })),
        ...(failure === undefined ? {} : { failure }),
      });
    }
    return { protocolVersion: 1, providers: entries, note: CATALOG_NOTE };
  }

  async update(request, signal) {
    const outcome = await saveOverride(request ?? {});
    if (!outcome.ok) {
      // Expected business failures ride in the envelope (design §5).
      return { protocolVersion: 1, status: 'error', code: outcome.code, message: outcome.message };
    }
    const snapshot = outcome.snapshot;
    return {
      protocolVersion: 1,
      status: 'ok',
      revision: snapshot.revision,
      seats: Object.values(snapshot.modelSettings),
      diagnostics: snapshot.diagnostics,
    };
  }
}

/**
 * Apply the Remote method markers without a transpiler. The decorator's
 * initializer normally runs at class-decoration time with `this` bound to
 * the instance; calling it against a prototype-derived receiver marks the
 * class prototype exactly once, using only the public Remote function.
 */
function markRemoteMethod(prototype, method) {
  const receiver = Object.create(prototype);
  Remote(method)(prototype[method], {
    kind: 'method',
    name: method,
    static: false,
    private: false,
    access: {
      has: (target) => method in target,
      get: (target) => target[method],
    },
    addInitializer: (initializer) => initializer.call(receiver),
  });
}
markRemoteMethod(OmoSeatModelsController.prototype, 'getState');
markRemoteMethod(OmoSeatModelsController.prototype, 'getCatalog');
markRemoteMethod(OmoSeatModelsController.prototype, 'update');

export function apply(ctx) {
  new OmoSeatModelsController(ctx);
  // The registration effect rides this plugin's fiber: unloading the row
  // unregisters the contribution.
  ctx.typert.register(TYPERT);
}

export default apply;
