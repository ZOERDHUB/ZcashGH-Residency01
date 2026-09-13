const test = require('node:test');
const assert = require('node:assert/strict');
const { TransactionStatusEngine, STATUS, InvalidTransitionError } = require('../models/transactionStatusEngine');
const { processPayout, PayoutError } = require('../services/payoutService');

/**
 * Fast-forwards a fresh transaction through to ZEC_CONFIRMED by hand,
 * standing in for what Quest 07 (ZEC detection) would normally do
 * automatically. This mirrors the manual /transition endpoint that exists
 * in routes/transactions.js for exactly this reason.
 */
function createConfirmedOrder(engine, overrides = {}) {
  const order = engine.create({
    fiatCurrency: 'NGN',
    fiatAmount: 50000,
    zecAmount: 0.032,
    recipient: {
      bankName: 'GTBank',
      accountNumber: '0123456789',
      accountName: 'Ada Lovelace',
    },
    ...overrides,
  });

  engine.transition(order.id, STATUS.AWAITING_ZEC);
  engine.transition(order.id, STATUS.ZEC_DETECTED);
  engine.transition(order.id, STATUS.CONFIRMING);
  return engine.transition(order.id, STATUS.ZEC_CONFIRMED);
}

test('a successful payout moves the order to FIAT_SENT and records the attempt', async () => {
  const engine = new TransactionStatusEngine();
  const order = createConfirmedOrder(engine);

  const result = await processPayout(engine, order.id);

  assert.equal(result.status, STATUS.FIAT_SENT);
  assert.equal(result.data.payoutAttempts.length, 1);
  assert.equal(result.data.payoutAttempts[0].outcome, 'success');
  assert.ok(result.data.payoutAttempts[0].providerReference);
});

test('a failed payout moves the order to PAYOUT_FAILED and records why', async () => {
  const engine = new TransactionStatusEngine();
  // '0000000000' is the mock provider's built-in guaranteed-failure case.
  const order = createConfirmedOrder(engine, {
    recipient: { bankName: 'GTBank', accountNumber: '0000000000', accountName: 'Ada Lovelace' },
  });

  await assert.rejects(() => processPayout(engine, order.id), PayoutError);

  const updated = engine.get(order.id);
  assert.equal(updated.status, STATUS.PAYOUT_FAILED);
  // The core Quest 11 requirement: a failure must never look like a success.
  assert.notEqual(updated.status, STATUS.FIAT_SENT);
  assert.notEqual(updated.status, STATUS.COMPLETED);
  assert.equal(updated.data.payoutAttempts.length, 1);
  assert.equal(updated.data.payoutAttempts[0].outcome, 'failed');
  assert.ok(updated.data.payoutAttempts[0].failureReason);
});

test('two simultaneous payout attempts on the same order do not both go through', async () => {
  const engine = new TransactionStatusEngine();
  const order = createConfirmedOrder(engine);

  const results = await Promise.allSettled([
    processPayout(engine, order.id),
    processPayout(engine, order.id),
  ]);

  const succeeded = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  // Exactly one of the two should have gone through -- the other should
  // have been blocked by the engine's transition guard, not silently
  // processed a second time.
  assert.equal(succeeded.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.name, 'InvalidTransitionError');

  const finalOrder = engine.get(order.id);
  assert.equal(finalOrder.data.payoutAttempts.length, 1);
});

test('an order can be retried after a failed payout, and succeeds on attempt 2', async () => {
  const engine = new TransactionStatusEngine();
  const order = createConfirmedOrder(engine, {
    recipient: { bankName: 'GTBank', accountNumber: '0000000000', accountName: 'Ada Lovelace' },
  });

  await assert.rejects(() => processPayout(engine, order.id), PayoutError);

  // Fix the "bad" account number, as if the recipient details were corrected,
  // then retry -- the engine allows PAYOUT_FAILED -> PAYOUT_PROCESSING.
  engine.updateData(order.id, {
    recipient: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Ada Lovelace' },
  });

  const result = await processPayout(engine, order.id);

  assert.equal(result.status, STATUS.FIAT_SENT);
  assert.equal(result.data.payoutAttempts.length, 2);
  assert.equal(result.data.payoutAttempts[0].outcome, 'failed');
  assert.equal(result.data.payoutAttempts[1].outcome, 'success');
});

test('an order that has already been paid out cannot be processed again', async () => {
  const engine = new TransactionStatusEngine();
  const order = createConfirmedOrder(engine);

  await processPayout(engine, order.id); // succeeds, order is now FIAT_SENT

  await assert.rejects(() => processPayout(engine, order.id), InvalidTransitionError);
});

test('an order that has not reached ZEC_CONFIRMED yet cannot be paid out', async () => {
  const engine = new TransactionStatusEngine();
  const order = engine.create({
    fiatCurrency: 'NGN',
    fiatAmount: 50000,
    zecAmount: 0.032,
    recipient: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Ada Lovelace' },
  });
  // Still just CREATED -- never even reached AWAITING_ZEC.

  await assert.rejects(() => processPayout(engine, order.id), InvalidTransitionError);
});

test('the provider is swappable via dependency injection', async () => {
  const engine = new TransactionStatusEngine();
  const order = createConfirmedOrder(engine);

  const customProvider = {
    providerName: 'test-provider',
    initiatePayout: async () => ({ success: true, providerReference: 'custom-ref-123' }),
  };

  const result = await processPayout(engine, order.id, customProvider);

  assert.equal(result.data.payoutAttempts[0].provider, 'test-provider');
  assert.equal(result.data.payoutAttempts[0].providerReference, 'custom-ref-123');
});
