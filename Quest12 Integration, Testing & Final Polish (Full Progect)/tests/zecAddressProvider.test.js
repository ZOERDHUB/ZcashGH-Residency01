const test = require('node:test');
const assert = require('node:assert/strict');
const { generatePlaceholderAddress } = require('../services/zecAddressProvider');

test('generates the same address for the same order id', () => {
  const a = generatePlaceholderAddress('order-123');
  const b = generatePlaceholderAddress('order-123');
  assert.equal(a, b);
});

test('generates different addresses for different order ids', () => {
  const a = generatePlaceholderAddress('order-123');
  const b = generatePlaceholderAddress('order-456');
  assert.notEqual(a, b);
});

test('looks like a shielded-address shape (not a claim that it is valid)', () => {
  const address = generatePlaceholderAddress('order-123');
  assert.match(address, /^zs1[0-9a-f]{38}$/);
});
