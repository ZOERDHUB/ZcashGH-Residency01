/**
 * rateCache.js
 *
 * Tiny in-memory cache so we don't call the exchange-rate APIs on every
 * single request. Also doubles as a safety net: if a live fetch fails,
 * exchangeService can fall back to whatever we last saw (marked "stale")
 * instead of just breaking.
 */

const store = new Map();

function get(key) {
  return store.get(key) || null;
}

function set(key, value) {
  store.set(key, { ...value, fetchedAt: new Date().toISOString() });
}

function isFresh(entry, maxAgeMs) {
  if (!entry) return false;
  const age = Date.now() - new Date(entry.fetchedAt).getTime();
  return age <= maxAgeMs;
}

module.exports = { get, set, isFresh };
