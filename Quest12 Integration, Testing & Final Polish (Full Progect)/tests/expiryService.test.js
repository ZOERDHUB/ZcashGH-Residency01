const test = require('node:test');
const assert = require('node:assert/strict');
const { TransactionStatusEngine, STATUS } = require('../models/transactionStatusEngine');
const { expireIfNeeded } = require('../services/expiryService');

function createOrderWithExpiry(engine, expiresAt) {
  const order = engine.create({ fiatAmount: 100, expiresAt });
  return engine.transition(order.id, STATUS.AWAITING_ZEC);
}

test('an AWAITING_ZEC order past its expiresAt is expired on read', () => {
  const engine = new TransactionStatusEngine();
  const pastDate = new Date(Date.now() - 60_000).toISOString(); // 1 minute ago
  const order = createOrderWithExpiry(engine, pastDate);

  const result = expireIfNeeded(engine, order.id);

  assert.equal(result.status, STATUS.EXPIRED);
});

test('an AWAITING_ZEC order not yet past its expiresAt is left alone', () => {
  const engine = new TransactionStatusEngine();
  const futureDate = new Date(Date.now() + 60_000).toISOString(); // 1 minute from now
  const order = createOrderWithExpiry(engine, futureDate);

  const result = expireIfNeeded(engine, order.id);

  assert.equal(result.status, STATUS.AWAITING_ZEC);
});

test('an order that has already moved past AWAITING_ZEC is never expired', () => {
  const engine = new TransactionStatusEngine();
  const pastDate = new Date(Date.now() - 60_000).toISOString();
  const order = createOrderWithExpiry(engine, pastDate);
  engine.transition(order.id, STATUS.ZEC_DETECTED); // payment showed up before expiry check ran

  const result = expireIfNeeded(engine, order.id);

  assert.equal(result.status, STATUS.ZEC_DETECTED);
});
