/**
 * exchangeService.js — Quest 02: ZEC conversion.
 *
 * This is the one place that knows "how much ZEC does the user need to
 * pay for a given fiat amount." Everything above this file (routes,
 * frontend) just calls convertFiatToZec() — none of them need to know
 * where the rate came from, or that GHS needs an extra hop through USD.
 *
 * That separation is what makes the rate source swappable: if CoinGecko
 * ever needs to be replaced, only zecRateProvider.js changes.
 */

const rateCache = require('./rateCache');
const { fetchZecPrice } = require('./zecRateProvider');
const { fetchUsdToRate } = require('./forexRateProvider');

const CACHE_TTL_MS = 60 * 1000; // 1 minute — ZEC prices move, but not THAT fast.
const SUPPORTED_CURRENCIES = ['NGN', 'GHS'];

class RateUnavailableError extends Error {
  constructor(currency) {
    super(`Exchange rate unavailable for ${currency}`);
    this.name = 'RateUnavailableError';
    this.currency = currency;
  }
}

class UnsupportedCurrencyError extends Error {
  constructor(currency) {
    super(`Unsupported currency: ${currency}`);
    this.name = 'UnsupportedCurrencyError';
    this.currency = currency;
  }
}

/**
 * Fetch a *live* ZEC price in the given currency (no caching here --
 * getZecRate() below handles that layer).
 */
async function fetchLiveZecPriceIn(currency) {
  if (currency === 'NGN') {
    // CoinGecko quotes ZEC in NGN directly.
    return fetchZecPrice('ngn');
  }

  if (currency === 'GHS') {
    // CoinGecko doesn't support GHS, so: ZEC -> USD -> GHS.
    const zecInUsd = await fetchZecPrice('usd');
    const usdToGhs = await fetchUsdToRate('GHS');
    return zecInUsd * usdToGhs;
  }

  throw new UnsupportedCurrencyError(currency);
}

/**
 * Get the current price of 1 ZEC in `currency`, using the cache when it's
 * fresh, and falling back to a stale cached value (clearly labeled) if the
 * live fetch fails. Only throws if there's truly nothing to return.
 */
async function getZecRate(currency) {
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new UnsupportedCurrencyError(currency);
  }

  const cacheKey = `zec-${currency}`;
  const cached = rateCache.get(cacheKey);

  if (rateCache.isFresh(cached, CACHE_TTL_MS)) {
    return { value: cached.value, source: 'cache', fetchedAt: cached.fetchedAt };
  }

  // Explicit, opt-in escape hatch for local development/demoing without a
  // network connection. Never used unless USE_MOCK_RATES is set, so the
  // real (production) code path never depends on a hardcoded number.
  if (process.env.USE_MOCK_RATES === 'true') {
    const illustrativeValue = currency === 'NGN' ? 1650 : 15.2;
    return {
      value: illustrativeValue,
      source: 'mock',
      fetchedAt: new Date().toISOString(),
    };
  }

  try {
    const liveValue = await fetchLiveZecPriceIn(currency);
    rateCache.set(cacheKey, { value: liveValue });
    return { value: liveValue, source: 'live', fetchedAt: new Date().toISOString() };
  } catch (err) {
    if (cached) {
      // Better to serve a slightly-stale rate than to break the flow.
      return { value: cached.value, source: 'stale-cache', fetchedAt: cached.fetchedAt };
    }
    throw new RateUnavailableError(currency);
  }
}

/**
 * Convert a fiat amount into the ZEC the user needs to send.
 * @returns {Promise<{fiatAmount:number, currency:string, zecAmount:number, rate:number, source:string, fetchedAt:string}>}
 */
async function convertFiatToZec(fiatAmount, currency) {
  if (typeof fiatAmount !== 'number' || Number.isNaN(fiatAmount) || fiatAmount <= 0) {
    throw new Error('fiatAmount must be a positive number');
  }

  const rate = await getZecRate(currency); // ZEC's price, in `currency`
  const zecAmount = fiatAmount / rate.value;

  return {
    fiatAmount,
    currency,
    zecAmount,
    rate: rate.value,
    source: rate.source,
    fetchedAt: rate.fetchedAt,
  };
}

module.exports = {
  getZecRate,
  convertFiatToZec,
  SUPPORTED_CURRENCIES,
  RateUnavailableError,
  UnsupportedCurrencyError,
};
