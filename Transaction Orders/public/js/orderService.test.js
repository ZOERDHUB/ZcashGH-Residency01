const test = require('node:test');
const assert = require('node:assert/strict');
const { TransactionStatusEngine, STATUS } = require('../models/transactionStatusEngine');
const { createOrder, ORDER_EXPIRY_MINUTES } = require('../services/orderService');

function validOrderInput(overrides = {}) {
  return {
    fiatCurrency: 'NGN',
    fiatAmount: 50000,
    zecAmount: 0.032,
    rate: 1562500,
    recipient: {
      bankName: 'GTBank',
      accountNumber: '0123456789',
      accountName: 'Ada Lovelace',
    },
    ...overrides,
  };
}

test('creates an order that starts in AWAITING_ZEC, not CREATED', () => {
  const engine = new TransactionStatusEngine();
  const order = createOrder(engine, validOrderInput());

  assert.equal(order.status, STATUS.AWAITING_ZEC);
  // The history should still show it passed through CREATED on the way in.
  assert.equal(order.history[0].status, STATUS.CREATED);
  assert.equal(order.history[1].status, STATUS.AWAITING_ZEC);
});

test('stores all the required order fields', () => {
  const engine = new TransactionStatusEngine();
  const order = createOrder(engine, validOrderInput());

  assert.ok(order.id);
  assert.ok(order.createdAt);
  assert.ok(order.data.expiresAt);
  assert.equal(order.data.fiatCurrency, 'NGN');
  assert.equal(order.data.fiatAmount, 50000);
  assert.equal(order.data.zecAmount, 0.032);
  assert.equal(order.data.recipient.bankName, 'GTBank');
  assert.ok(order.data.receivingAddress);
  assert.match(order.data.receivingAddress, /^zs1[0-9a-f]{38}$/);
});

test('the same order always shows the same receiving address', () => {
  const engine = new TransactionStatusEngine();
  const order = createOrder(engine, validOrderInput());

  const fetchedTwice = engine.get(order.id);
  assert.equal(fetchedTwice.data.receivingAddress, order.data.receivingAddress);
});

test('sets an expiration roughly ORDER_EXPIRY_MINUTES in the future', () => {
  const engine = new TransactionStatusEngine();
  const before = Date.now();
  const order = createOrder(engine, validOrderInput());

  const expiresAt = new Date(order.data.expiresAt).getTime();
  const expectedMs = ORDER_EXPIRY_MINUTES * 60 * 1000;

  assert.ok(expiresAt >= before + expectedMs - 1000); // small tolerance
  assert.ok(expiresAt <= before + expectedMs + 1000);
});

test('rejects an order missing required fields', () => {
  const engine = new TransactionStatusEngine();

  assert.throws(() => createOrder(engine, validOrderInput({ fiatCurrency: undefined })));
  assert.throws(() => createOrder(engine, validOrderInput({ zecAmount: undefined })));
  assert.throws(() => createOrder(engine, validOrderInput({ recipient: undefined })));
});

test('the created order can be fetched back from the engine by id', () => {
  const engine = new TransactionStatusEngine();
  const order = createOrder(engine, validOrderInput());

  const fetched = engine.get(order.id);
  assert.equal(fetched.status, STATUS.AWAITING_ZEC);
});
