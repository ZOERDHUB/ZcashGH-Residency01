/**
 * Tests for exchangeService.js.
 *
 * These mock global.fetch instead of hitting CoinGecko / the forex API for
 * real, so the suite runs offline and deterministically. Each test gets a
 * fresh copy of exchangeService (and its cache) via freshExchangeService().
 */

const test = require('node:test');
const assert = require('node:assert/strict');

function freshExchangeService() {
  delete require.cache[require.resolve('../services/rateCache')];
  delete require.cache[require.resolve('../services/exchangeService')];
  return require('../services/exchangeService');
}

test('NGN uses the direct CoinGecko rate', async () => {
  global.fetch = async (url) => {
    assert.match(url, /vs_currencies=ngn/);
    return { ok: true, json: async () => ({ zcash: { ngn: 50000 } }) };
  };

  const exchangeService = freshExchangeService();
  const result = await exchangeService.convertFiatToZec(100000, 'NGN');

  assert.equal(result.rate, 50000);
  assert.equal(result.zecAmount, 2); // 100000 / 50000
  assert.equal(result.source, 'live');
});

test('GHS goes through USD, since CoinGecko has no direct GHS quote', async () => {
  global.fetch = async (url) => {
    if (url.includes('vs_currencies=usd')) {
      return { ok: true, json: async () => ({ zcash: { usd: 30 } }) };
    }
    if (url.includes('open.er-api.com')) {
      return { ok: true, json: async () => ({ rates: { GHS: 15 } }) };
    }
    throw new Error(`Unexpected URL in test: ${url}`);
  };

  const exchangeService = freshExchangeService();
  const result = await exchangeService.convertFiatToZec(450, 'GHS');

  assert.equal(result.rate, 450); // 30 USD/ZEC * 15 GHS/USD
  assert.equal(result.zecAmount, 1); // 450 / 450
  assert.equal(result.source, 'live');
});

test('a fresh cached rate is reused without calling fetch again', async () => {
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls++;
    return { ok: true, json: async () => ({ zcash: { ngn: 1000 } }) };
  };

  const exchangeService = freshExchangeService();
  await exchangeService.getZecRate('NGN');
  const second = await exchangeService.getZecRate('NGN');

  assert.equal(fetchCalls, 1);
  assert.equal(second.source, 'cache');
});

test('falls back to a stale cached rate if the live fetch fails', async () => {
  const originalDateNow = Date.now;
  try {
    global.fetch = async () => ({ ok: true, json: async () => ({ zcash: { ngn: 1000 } }) });
    const exchangeService = freshExchangeService();
    const first = await exchangeService.getZecRate('NGN');
    assert.equal(first.source, 'live');

    // Simulate the cache entry aging past its TTL.
    Date.now = () => originalDateNow() + 61_000;
    global.fetch = async () => {
      throw new Error('network down');
    };

    const second = await exchangeService.getZecRate('NGN');
    assert.equal(second.source, 'stale-cache');
    assert.equal(second.value, first.value);
  } finally {
    Date.now = originalDateNow;
  }
});

test('throws RateUnavailableError when there is no cache and the fetch fails', async () => {
  global.fetch = async () => {
    throw new Error('network down');
  };
  const exchangeService = freshExchangeService();

  await assert.rejects(
    () => exchangeService.convertFiatToZec(100, 'NGN'),
    exchangeService.RateUnavailableError
  );
});

test('rejects unsupported currencies', async () => {
  const exchangeService = freshExchangeService();
  await assert.rejects(
    () => exchangeService.convertFiatToZec(100, 'USD'),
    exchangeService.UnsupportedCurrencyError
  );
});

test('rejects a non-positive fiat amount', async () => {
  const exchangeService = freshExchangeService();
  await assert.rejects(() => exchangeService.convertFiatToZec(0, 'NGN'));
  await assert.rejects(() => exchangeService.convertFiatToZec(-5, 'NGN'));
});
