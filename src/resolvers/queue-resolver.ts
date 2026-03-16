// ============================================================
// FILE: queue-resolver.ts
// PATH: src/resolvers/queue-resolver.ts
// PROJECT: DataQualityGuard
// PURPOSE: Resolver for async event queue consumer
// ============================================================

import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('getQueueStatus', async () => {
  return { status: 'ok' };
});

export const handler = resolver.getDefinitions();
