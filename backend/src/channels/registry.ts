import type { Channel } from './types.js';

export interface ChannelRegistry {
  get(type: string): Channel | undefined;
  list(): Channel[];
}

export function createRegistry(channels: Channel[]): ChannelRegistry {
  const byType = new Map<string, Channel>();
  for (const c of channels) {
    if (byType.has(c.type)) throw new Error(`Duplicate channel type: ${c.type}`);
    byType.set(c.type, c);
  }
  return {
    get: (type) => byType.get(type),
    list: () => [...byType.values()],
  };
}
