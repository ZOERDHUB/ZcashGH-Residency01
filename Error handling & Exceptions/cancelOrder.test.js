const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TransactionStatusEngine,
  STATUS,
  InvalidTransitionError,
} = require('../models/transactionStatusEngine');

test('an order can be cancelled while still AWAITING_ZEC', () => {
  const engine = new TransactionStatusEngine();
  const order = engine.create({});
  engine.transition(order.id, STATUS.AWAITING_ZEC);

  const cancelled = engine.transition(order.id, STATUS.CANCELLED, {
    reason: 'Cancelled by user.',
  });

  assert.equal(cancelled.status, STATUS.CANCELLED);
});

test('an order cannot be cancelled once ZEC has been detected', () => {
  const engine = new TransactionStatusEngine();
  const order = engine.create({});
  engine.transition(order.id, STATUS.AWAITING_ZEC);
  engine.transition(order.id, STATUS.ZEC_DETECTED);

  assert.throws(
    () => engine.transition(order.id, STATUS.CANCELLED),
    InvalidTransitionError
  );
});

test('a cancelled order is terminal -- it cannot be revived', () => {
  const engine = new TransactionStatusEngine();
  const order = engine.create({});
  engine.transition(order.id, STATUS.AWAITING_ZEC);
  engine.transition(order.id, STATUS.CANCELLED);

  assert.throws(
    () => engine.transition(order.id, STATUS.AWAITING_ZEC),
    InvalidTransitionError
  );
});
