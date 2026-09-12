/**
 * Private Bill — transaction state tests
 * ---------------------------------------------
 * Run with: node tests/transactionState.test.js
 */

const assert = require("assert");
const PB_TRANSACTION = require("../js/transactionState.js");

let passed = 0;

function test(name, fn) {
  try {
    PB_TRANSACTION.reset();
    fn();
    passed++;
    console.log(`  ok  - ${name}`);
  } catch (err) {
    console.error(`FAIL  - ${name}`);
    console.error(`        ${err.message}`);
    process.exitCode = 1;
  }
}

test("getPayload returns null until both exchange and recipient are set", () => {
  assert.strictEqual(PB_TRANSACTION.getPayload(), null);
  PB_TRANSACTION.setExchange({ fiatAmount: 150000, currencyCode: "NGN", totalZec: 0.094 });
  assert.strictEqual(PB_TRANSACTION.getPayload(), null); // recipient still missing
});

test("getPayload returns both pieces once set", () => {
  PB_TRANSACTION.setExchange({ fiatAmount: 150000, currencyCode: "NGN", totalZec: 0.094 });
  PB_TRANSACTION.setRecipient({
    country: "Nigeria",
    bankName: "Zenith Bank",
    accountNumber: "0016563228",
    accountName: "Chinwe Okafor"
  });
  const payload = PB_TRANSACTION.getPayload();
  assert.strictEqual(payload.exchange.fiatAmount, 150000);
  assert.strictEqual(payload.recipient.accountNumber, "0016563228");
});

test("getPayload exposes the real, unmasked account number (the next stage needs it)", () => {
  PB_TRANSACTION.setExchange({ fiatAmount: 1000, currencyCode: "GHS", totalZec: 0.01 });
  PB_TRANSACTION.setRecipient({ country: "Ghana", bankName: "GCB Bank", accountNumber: "1234567", accountName: "Kojo Mensah" });
  assert.strictEqual(PB_TRANSACTION.getPayload().recipient.accountNumber, "1234567");
});

test("getMaskedSummary masks the account number", () => {
  PB_TRANSACTION.setExchange({ fiatAmount: 1000, currencyCode: "GHS", totalZec: 0.01 });
  PB_TRANSACTION.setRecipient({ country: "Ghana", bankName: "GCB Bank", accountNumber: "1234567", accountName: "Kojo Mensah" });
  const summary = PB_TRANSACTION.getMaskedSummary();
  assert.notStrictEqual(summary.recipient.accountNumber, "1234567");
  assert.ok(summary.recipient.accountNumber.endsWith("4567"));
  assert.ok(summary.recipient.accountNumber.startsWith("•"));
});

test("getMaskedSummary returns null before both pieces are set", () => {
  assert.strictEqual(PB_TRANSACTION.getMaskedSummary(), null);
});

test("toSafeLogString never contains the raw account number", () => {
  PB_TRANSACTION.setExchange({ fiatAmount: 1000, currencyCode: "GHS", totalZec: 0.01 });
  PB_TRANSACTION.setRecipient({ country: "Ghana", bankName: "GCB Bank", accountNumber: "1234567", accountName: "Kojo Mensah" });
  const logLine = PB_TRANSACTION.toSafeLogString();
  assert.ok(!logLine.includes("1234567"));
});

test("setters don't mutate the caller's original object (defensive copy)", () => {
  const original = { fiatAmount: 100, currencyCode: "NGN" };
  PB_TRANSACTION.setExchange(original);
  original.fiatAmount = 999;
  assert.strictEqual(PB_TRANSACTION.getExchange().fiatAmount, 100);
});

test("reset() clears both pieces", () => {
  PB_TRANSACTION.setExchange({ fiatAmount: 1, currencyCode: "NGN" });
  PB_TRANSACTION.setRecipient({ country: "Nigeria", bankName: "Access Bank", accountNumber: "1", accountName: "A" });
  PB_TRANSACTION.reset();
  assert.strictEqual(PB_TRANSACTION.getExchange(), null);
  assert.strictEqual(PB_TRANSACTION.getRecipient(), null);
});

console.log(`\n${passed} test(s) passed.`);
