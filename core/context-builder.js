import { buildContextPack } from './context-engine-v2.js';

// Compatibility adapter for older execution paths. Build 64 keeps the public
// function name while moving selection authority to Context Engine v2.
export async function buildProjectContext(adapter, command, options = {}) {
  return buildContextPack(adapter, command, options);
}
