// Client-face Typert contribution for the omoSeatModels Remote service.
//
// Browser-safe by construction: NO imports. The Host face validates every
// argument and result with real zod schemas (typert.host.js); the client
// registry only needs a `create` factory per codec and never invokes it
// (no codec declares decode/encode, so strict results pass through
// unchanged — the Gateway's own client path). The stub parse keeps the
// registry's structural validation honest without pulling zod into the
// browser module graph.
const passthrough = () => ({ parse: (value) => value });

const invocation = (method) => ({
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
        create: passthrough,
      },
    },
  ],
  result: {
    mode: 'strict',
    typeSymbol: `oh-my-dsh#omoSeatModels/${method}:result`,
    create: passthrough,
  },
});

export const TYPERT_REMOTE = {
  package: 'oh-my-dsh',
  descriptors: [
    invocation('getState'),
    invocation('getCatalog'),
    invocation('update'),
  ],
};

export default TYPERT_REMOTE;
