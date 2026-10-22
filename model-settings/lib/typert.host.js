// Host-face Typert manifest for the omoSeatModels Remote service.
//
// The service is registered manually through `ctx.typert.register()` — the
// sanctioned path for hand-written wire schemas from a non-loader bundle
// (dsh-typert-loader's own doc: "Manual ctx.typert.register() remains
// available for contributions that do not use a ./typert artifact"). The
// Gateway discovers the live methods through the TypertRemoteService markers.
//
// Business outcomes ride in the RESULT, never as thrown RemoteErrors:
// expected failures (validation, conflict, invalid config file, write
// failure) come back as `{status:'error', code, message}` so the UI can
// render them; only unexpected faults throw.
import { z } from 'zod';

const route = () => z.object({ provider: z.string().min(1), model: z.string().min(1) }).strict();
const routeOrNull = () => route().nullable();

const seatSetting = () => z.object({
  seatId: z.string(),
  definitionModel: routeOrNull(),
  override: z.enum(['missing', 'inherit', 'route', 'invalid']),
  effectiveModel: routeOrNull(),
  source: z.enum(['user-override', 'forced-inherit', 'shipped-definition', 'user-definition', 'parent']),
  overrideRevision: z.string(),
}).strict();

const diagnostic = () => z.object({
  code: z.string(),
  seatId: z.string().optional(),
  message: z.string(),
}).strict();

const getStateResult = () => z.object({
  protocolVersion: z.literal(1),
  revision: z.string(),
  seats: z.array(seatSetting()),
  diagnostics: z.array(diagnostic()),
}).strict();

const getCatalogResult = () => z.object({
  protocolVersion: z.literal(1),
  providers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    models: z.array(z.object({
      id: z.string(),
      name: z.string(),
      registered: z.boolean(),
      officialSubagentAllowed: z.union([z.boolean(), z.literal('unknown')]),
    }).strict()),
    failure: z.string().optional(),
  }).strict()),
  note: z.string(),
}).strict();

// `update` settles as a business envelope: ok carries the fresh snapshot,
// error carries the stable code the UI renders.
const updateResult = () => z.discriminatedUnion('status', [
  z.object({
    protocolVersion: z.literal(1),
    status: z.literal('ok'),
    revision: z.string(),
    seats: z.array(seatSetting()),
    diagnostics: z.array(diagnostic()),
  }).strict(),
  z.object({
    protocolVersion: z.literal(1),
    status: z.literal('error'),
    code: z.string(),
    message: z.string(),
  }).strict(),
]);

const invocation = (method, request, result) => ({
  id: `oh-my-dsh#omoSeatModels/${method}`,
  service: 'omoSeatModels',
  namespace: 'omoSeatModels',
  method,
  implementation: method,
  invocation: { kind: 'direct' },
  cancellation: { parameter: 'signal' },
  parameters: [
    {
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: {
        mode: 'strict',
        typeSymbol: `oh-my-dsh#omoSeatModels/${method}:request`,
        create: request,
      },
    },
  ],
  result: {
    mode: 'strict',
    typeSymbol: `oh-my-dsh#omoSeatModels/${method}:result`,
    create: result,
  },
});

export const TYPERT = {
  package: 'oh-my-dsh',
  face: 'host',
  schemas: [],
  invocations: [
    invocation('getState', () => z.object({ sessionId: z.string().optional() }).strict(), getStateResult),
    invocation('getCatalog', () => z.object({ provider: z.string().optional(), sessionId: z.string().optional() }).strict(), getCatalogResult),
    invocation('update', () => z.object({
      seatId: z.string(),
      mode: z.enum(['set', 'inherit', 'reset']),
      route: route().optional(),
      expectedOverrideRevision: z.string().optional(),
    }).strict(), updateResult),
  ],
  model: {
    services: [{
      key: 'omoSeatModels',
      exportName: 'OmoSeatModelsController',
      description: 'omo seat dispatch-default model preferences: read, catalog, and the user override file.',
      tags: [],
      members: [],
      types: [],
    }],
    events: [],
    objects: [],
  },
};

export default TYPERT;
