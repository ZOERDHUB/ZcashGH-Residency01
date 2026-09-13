/**
 * Run with: node --test tests/
 * Requires Node 18+ (uses the built-in node:test runner — no extra deps).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TransactionStatusEngine,
  STATUS,
  InvalidTransitionError,
  TransactionNotFoundError,
} = require('../models/transactionStatusEngine');

test('create() starts a transaction in CREATED status with a timestamp', () => {
  const engine = new TransactionStatusEngine();
  const tx = engine.create({ amountZec: 0.5 });

  assert.equal(tx.status, STATUS.CREATED);
  assert.ok(tx.id);
  assert.ok(tx.timestamps[STATUS.CREATED]);
  assert.equal(tx.history.length, 1);
});

test('valid transitions succeed and are recorded with timestamps', () => {
  const engine = new TransactionStatusEngine();
  const tx = engine.create({});

  const updated = engine.transition(tx.id, STATUS.AWAITING_ZEC);
  assert.equal(updated.status, STATUS.AWAITING_ZEC);
  assert.ok(updated.timestamps[STATUS.AWAITING_ZEC]);
  assert.equal(updated.history.length, 2);
});

test('invalid transitions are rejected', () => {
  const engine = new TransactionStatusEngine();
  const tx = engine.create({});

  // CREATED -> COMPLETED is not a valid direct jump
  assert.throws(
    () => engine.transition(tx.id, STATUS.COMPLETED),
    InvalidTransitionError
  );
});

test('terminal states cannot transition further', () => {
  const engine = new TransactionStatusEngine();
  const tx = engine.create({});
  engine.transition(tx.id, STATUS.CANCELLED);

  assert.throws(
    () => engine.transition(tx.id, STATUS.AWAITING_ZEC),
    InvalidTransitionError
  );
});

test('unknown transaction id throws TransactionNotFoundError', () => {
  const engine = new TransactionStatusEngine();
  assert.throws(
    () => engine.transition('does-not-exist', STATUS.AWAITING_ZEC),
    TransactionNotFoundError
  );
});

test('the full happy-path lifecycle works end to end', () => {
  const engine = new TransactionStatusEngine();
  const tx = engine.create({});

  const path = [
    STATUS.AWAITING_ZEC,
    STATUS.ZEC_DETECTED,
    STATUS.CONFIRMING,
    STATUS.ZEC_CONFIRMED,
    STATUS.PAYOUT_PROCESSING,
    STATUS.FIAT_SENT,
    STATUS.COMPLETED,
  ];

  let current = tx;
  for (const next of path) {
    current = engine.transition(current.id, next);
  }

  assert.equal(current.status, STATUS.COMPLETED);
  assert.equal(current.history.length, path.length + 1); // +1 for CREATED
});

test('canTransition() reports validity without throwing', () => {
  const engine = new TransactionStatusEngine();
  const tx = engine.create({});

  assert.equal(engine.canTransition(tx.id, STATUS.AWAITING_ZEC), true);
  assert.equal(engine.canTransition(tx.id, STATUS.COMPLETED), false);
});
