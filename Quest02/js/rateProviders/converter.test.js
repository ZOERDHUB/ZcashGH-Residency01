/**
 * Private Bill — converter tests
 * -----------------------------------
 * Plain Node, no framework, no DOM, no network. This is the point of
 * separating conversion math from the interface: these tests exercise
 * PB_CONVERTER exactly as app.js does, without a browser in sight.
 *
 * Run with:
 *   node tests/converter.test.js
 */

const assert = require("assert");
const PB_CONVERTER = require("../converter.js");

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

console.log("convertFiatToZec");

test("computes the base ZEC amount correctly for a simple case", () => {
  // 100,000 NGN, 1,000 NGN/USD, $10/ZEC, no fee -> $100 -> 10 ZEC
  const result = PB_CONVERTER.convertFiatToZec({
    fiatAmount: 100000,
    currencyCode: "NGN",
    zecUsd: 10,
    fxRate: 1000,
    feePct: 0
  });
  assert.strictEqual(result.usdAmount, 100);
  assert.strictEqual(result.baseZec, 10);
  assert.strictEqual(result.feeZec, 0);
  assert.strictEqual(result.totalZec, 10);
});

test("adds the service fee on top of the base amount", () => {
  const result = PB_CONVERTER.convertFiatToZec({
    fiatAmount: 100000,
    currencyCode: "NGN",
    zecUsd: 10,
    fxRate: 1000,
    feePct: 1.5
  });
  assert.strictEqual(result.baseZec, 10);
  assert.strictEqual(result.feeZec, 0.15);
  assert.strictEqual(result.totalZec, 10.15);
});

test("computes the effective rate as 1 ZEC in the fiat currency", () => {
  const result = PB_CONVERTER.convertFiatToZec({
    fiatAmount: 50000,
    currencyCode: "GHS",
    zecUsd: 1200,
    fxRate: 11.4,
    feePct: 1.5
  });
  assert.strictEqual(result.effectiveRate, 1200 * 11.4);
});

test("carries the currency code and original fiat amount through unchanged", () => {
  const result = PB_CONVERTER.convertFiatToZec({
    fiatAmount: 2500,
    currencyCode: "GHS",
    zecUsd: 1200,
    fxRate: 11.4,
    feePct: 1.5
  });
  assert.strictEqual(result.currencyCode, "GHS");
  assert.strictEqual(result.fiatAmount, 2500);
});

test("throws on a non-positive fiat amount", () => {
  assert.throws(() => PB_CONVERTER.convertFiatToZec({
    fiatAmount: 0, currencyCode: "NGN", zecUsd: 10, fxRate: 1000, feePct: 0
  }), RangeError);
  assert.throws(() => PB_CONVERTER.convertFiatToZec({
    fiatAmount: -5, currencyCode: "NGN", zecUsd: 10, fxRate: 1000, feePct: 0
  }), RangeError);
});

test("throws on a non-positive zecUsd or fxRate", () => {
  assert.throws(() => PB_CONVERTER.convertFiatToZec({
    fiatAmount: 100, currencyCode: "NGN", zecUsd: 0, fxRate: 1000, feePct: 0
  }), RangeError);
  assert.throws(() => PB_CONVERTER.convertFiatToZec({
    fiatAmount: 100, currencyCode: "NGN", zecUsd: 10, fxRate: -1, feePct: 0
  }), RangeError);
});

test("throws on a negative fee percentage", () => {
  assert.throws(() => PB_CONVERTER.convertFiatToZec({
    fiatAmount: 100, currencyCode: "NGN", zecUsd: 10, fxRate: 1000, feePct: -1
  }), RangeError);
});

console.log("\nvalidateFiatAmount");

test("returns null for an empty value (nothing typed yet is not an error)", () => {
  assert.strictEqual(
    PB_CONVERTER.validateFiatAmount("", { minAmount: 5000, symbol: "₦" }),
    null
  );
});

test("rejects non-numeric input", () => {
  const msg = PB_CONVERTER.validateFiatAmount("abc", { minAmount: 5000, symbol: "₦" });
  assert.ok(msg && msg.includes("valid amount"));
});

test("rejects zero and negative amounts", () => {
  assert.ok(PB_CONVERTER.validateFiatAmount("0", { minAmount: 5000, symbol: "₦" }));
  assert.ok(PB_CONVERTER.validateFiatAmount("-10", { minAmount: 5000, symbol: "₦" }));
});

test("rejects amounts below the currency minimum", () => {
  const msg = PB_CONVERTER.validateFiatAmount("100", { minAmount: 5000, symbol: "₦" });
  assert.ok(msg && msg.includes("5,000"));
});

test("accepts an amount at or above the minimum", () => {
  assert.strictEqual(
    PB_CONVERTER.validateFiatAmount("5000", { minAmount: 5000, symbol: "₦" }),
    null
  );
  assert.strictEqual(
    PB_CONVERTER.validateFiatAmount("150000", { minAmount: 5000, symbol: "₦" }),
    null
  );
});

console.log(`\n${passed} test(s) passed.`);
