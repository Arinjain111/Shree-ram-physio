type CacheEntry<T> = { data: T; timestamp: number };

const store = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 10_000; // 10-second TTL for reads

export function getCached<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T): void {
  store.set(key, { data, timestamp: Date.now() });
}

/** Clear cache for a specific key or prefix (e.g., 'invoices' clears 'invoices', 'invoices:page1', etc.) */
export function clearCache(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Wipe the entire cache — call after sync or any write */
export function clearAllCache(): void {
  store.clear();
}
