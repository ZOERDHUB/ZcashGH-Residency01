/**
 * Private Bill — deposit address generator tests
 * -------------------------------------------------------
 * Run with: node tests/depositAddress.test.js
 */

const assert = require("assert");
const PB_DEPOSIT_ADDRESS = require("../js/depositAddress.js");

let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  - ${name}`);
  } catch (err) {
    console.error(`FAIL  - ${name}`);
    console.error(`        ${err.message}`);
    process.exitCode = 1;
  }
}

test("produces a string starting with the Sapling-style zs1 prefix", () => {
  const addr = PB_DEPOSIT_ADDRESS.generateDepositAddress("PB-TESTORDER1");
  assert.ok(addr.startsWith("zs1"));
});

test("produces a plausible Sapling-length address", () => {
  const addr = PB_DEPOSIT_ADDRESS.generateDepositAddress("PB-TESTORDER1");
  assert.ok(addr.length >= 70 && addr.length <= 85, `unexpected length: ${addr.length}`);
});

test("only uses characters from the bech32 alphabet after the prefix", () => {
  const addr = PB_DEPOSIT_ADDRESS.generateDepositAddress("PB-TESTORDER1");
  const body = addr.slice(3);
  assert.ok(/^[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/.test(body));
});

test("is deterministic: the same order id always yields the same address", () => {
  const a = PB_DEPOSIT_ADDRESS.generateDepositAddress("PB-ABC123");
  const b = PB_DEPOSIT_ADDRESS.generateDepositAddress("PB-ABC123");
  assert.strictEqual(a, b);
});

test("different order ids yield different addresses", () => {
  const a = PB_DEPOSIT_ADDRESS.generateDepositAddress("PB-ABC123");
  const b = PB_DEPOSIT_ADDRESS.generateDepositAddress("PB-XYZ789");
  assert.notStrictEqual(a, b);
});

test("many distinct order ids produce no collisions in practice", () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    seen.add(PB_DEPOSIT_ADDRESS.generateDepositAddress("PB-ORDER-" + i));
  }
  assert.strictEqual(seen.size, 2000);
});

test("throws on a missing or empty order id", () => {
  assert.throws(() => PB_DEPOSIT_ADDRESS.generateDepositAddress(""), RangeError);
  assert.throws(() => PB_DEPOSIT_ADDRESS.generateDepositAddress(undefined), RangeError);
});

console.log(`\n${passed} test(s) passed.`);
