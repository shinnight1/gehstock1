/* Multi-key, compare-and-swap store for isolated local authentication tests. */
export function memoryStore() {
  const values = new Map(); let version = 0;
  return {
    async get(key) { return structuredClone(values.get(key)?.data ?? null); },
    async getWithMetadata(key) { return structuredClone(values.get(key) ?? null); },
    async setJSON(key, data, options = {}) {
      const old = values.get(key);
      if (options.onlyIfNew && old || options.onlyIfMatch !== undefined && old?.etag !== options.onlyIfMatch) return { modified: false };
      values.set(key, { data: structuredClone(data), etag: String(++version) }); return { modified: true };
    },
    async delete(key) { values.delete(key); }
  };
}
