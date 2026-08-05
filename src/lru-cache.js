// Generic capacity-bound LRU cache (§12.5 thumbnail cache limit 300 /
// preview cache limit 60, both LRU-evicted). `onEvict(key, value)` is where
// callers hook the §12.6 memory-release rules (revokeObjectURL, canvas 0x0,
// ImageBitmap.close(), ...) — this module only tracks recency and capacity,
// it never touches DOM/Canvas/URL APIs itself.
//
// Built on Map because Map iteration order is insertion order, and
// delete+re-set moves a key to the end — that's exactly "most recently
// used" bookkeeping with no extra data structure.

export function createLruCache({ limit, onEvict } = {}) {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`createLruCache requires a positive integer limit, got ${limit}`);
  }
  const map = new Map();

  function get(key) {
    if (!map.has(key)) return undefined;
    const value = map.get(key);
    map.delete(key);
    map.set(key, value); // touch: move to most-recently-used position
    return value;
  }

  function has(key) {
    return map.has(key);
  }

  function set(key, value) {
    if (map.has(key)) map.delete(key);
    map.set(key, value);
    while (map.size > limit) {
      const oldestKey = map.keys().next().value;
      const oldestValue = map.get(oldestKey);
      map.delete(oldestKey);
      onEvict?.(oldestKey, oldestValue);
    }
  }

  // Explicit removal (e.g. the Source itself was deleted). Does NOT call
  // onEvict — the caller already knows it's releasing this entry and is
  // expected to release it itself; onEvict is only for cache-driven,
  // automatic eviction the caller didn't ask for.
  function del(key) {
    return map.delete(key);
  }

  // Evicts every remaining entry through onEvict, e.g. "delete all Sources"
  // (§23.5.3: memory must fall back near baseline afterward).
  function clear() {
    for (const [key, value] of map) onEvict?.(key, value);
    map.clear();
  }

  function size() {
    return map.size;
  }

  // Oldest (least-recently-used) first.
  function keys() {
    return Array.from(map.keys());
  }

  return { get, set, has, delete: del, clear, size, keys };
}
