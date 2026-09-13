const test = require('node:test');
const assert = require('node:assert/strict');
const { TransactionStatusEngine, TransactionNotFoundError } = require('../models/transactionStatusEngine');

test('updateData merges new fields into an existing transaction', () => {
  const engine = new TransactionStatusEngine();
  const tx = engine.create({ fiatAmount: 100 });

  const updated = engine.updateData(tx.id, { receivingAddress: 'zs1abc' });

  assert.equal(updated.data.receivingAddress, 'zs1abc');
  assert.equal(updated.data.fiatAmount, 100); // existing fields are preserved
});

test('updateData does not change status or history', () => {
  const engine = new TransactionStatusEngine();
  const tx = engine.create({});

  const updated = engine.updateData(tx.id, { note: 'hello' });

  assert.equal(updated.status, tx.status);
  assert.equal(updated.history.length, tx.history.length);
});

test('updateData throws for an unknown transaction id', () => {
  const engine = new TransactionStatusEngine();
  assert.throws(
    () => engine.updateData('does-not-exist', { foo: 'bar' }),
    TransactionNotFoundError
  );
});
