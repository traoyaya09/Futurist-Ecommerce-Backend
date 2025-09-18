const cache = new Map(); // In-memory cache using JavaScript Map

module.exports = {
  // Get cache data by key
  get: async (key) => {
    if (cache.has(key)) {
      return cache.get(key);
    }
    return null;
  },

  // Set cache data with a key and expiration time
  set: async (key, value, ttlInSeconds) => {
    cache.set(key, value);
    setTimeout(() => {
      cache.delete(key); // Auto-delete after TTL (time-to-live)
    }, ttlInSeconds * 1000);
  },

  // Clear all cache entries (optional utility function)
  clear: async () => {
    cache.clear();
  }
};