/**
 * Private Bill — transaction state tests
 * ---------------------------------------------
 * Run with: node tests/transactionState.test.js
 */

const assert = require("assert");
const PB_TRANSACTION = require("./transactionState.js");

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

test("clearRecipient removes only the recipient, leaving the exchange intact", () => {
  PB_TRANSACTION.setExchange({ fiatAmount: 1, currencyCode: "GHS" });
  PB_TRANSACTION.setRecipient({ country: "Ghana", bankName: "GCB Bank", accountNumber: "1234567", accountName: "Kojo" });
  PB_TRANSACTION.clearRecipient();
  assert.strictEqual(PB_TRANSACTION.getRecipient(), null);
  assert.notStrictEqual(PB_TRANSACTION.getExchange(), null);
});

test("clearRecipient also invalidates an existing review confirmation", () => {
  PB_TRANSACTION.setExchange({ fiatAmount: 1, currencyCode: "GHS" });
  PB_TRANSACTION.setRecipient({ country: "Ghana", bankName: "GCB Bank", accountNumber: "1234567", accountName: "Kojo" });
  PB_TRANSACTION.confirmReview();
  PB_TRANSACTION.clearRecipient();
  assert.strictEqual(PB_TRANSACTION.isReviewConfirmed(), false);
});

test("confirmReview fails until both exchange and recipient are set", () => {
  assert.strictEqual(PB_TRANSACTION.confirmReview(), false);
  assert.strictEqual(PB_TRANSACTION.isReviewConfirmed(), false);
  PB_TRANSACTION.setExchange({ fiatAmount: 1, currencyCode: "NGN" });
  assert.strictEqual(PB_TRANSACTION.confirmReview(), false); // recipient still missing
});

test("confirmReview succeeds once both pieces exist", () => {
  PB_TRANSACTION.setExchange({ fiatAmount: 1, currencyCode: "NGN" });
  PB_TRANSACTION.setRecipient({ country: "Nigeria", bankName: "Access Bank", accountNumber: "1", accountName: "A" });
  assert.strictEqual(PB_TRANSACTION.confirmReview(), true);
  assert.strictEqual(PB_TRANSACTION.isReviewConfirmed(), true);
});

test("editing the exchange after confirming invalidates the review", () => {
  PB_TRANSACTION.setExchange({ fiatAmount: 1, currencyCode: "NGN" });
  PB_TRANSACTION.setRecipient({ country: "Nigeria", bankName: "Access Bank", accountNumber: "1", accountName: "A" });
  PB_TRANSACTION.confirmReview();
  assert.strictEqual(PB_TRANSACTION.isReviewConfirmed(), true);
  PB_TRANSACTION.setExchange({ fiatAmount: 2, currencyCode: "NGN" });
  assert.strictEqual(PB_TRANSACTION.isReviewConfirmed(), false);
});

test("editing the recipient after confirming invalidates the review", () => {
  PB_TRANSACTION.setExchange({ fiatAmount: 1, currencyCode: "NGN" });
  PB_TRANSACTION.setRecipient({ country: "Nigeria", bankName: "Access Bank", accountNumber: "1", accountName: "A" });
  PB_TRANSACTION.confirmReview();
  PB_TRANSACTION.setRecipient({ country: "Nigeria", bankName: "Zenith Bank", accountNumber: "2", accountName: "B" });
  assert.strictEqual(PB_TRANSACTION.isReviewConfirmed(), false);
});

test("getPayload and getMaskedSummary both include reviewConfirmedAt", () => {
  PB_TRANSACTION.setExchange({ fiatAmount: 1, currencyCode: "NGN" });
  PB_TRANSACTION.setRecipient({ country: "Nigeria", bankName: "Access Bank", accountNumber: "1234567890", accountName: "A" });
  assert.strictEqual(PB_TRANSACTION.getPayload().reviewConfirmedAt, null);
  PB_TRANSACTION.confirmReview();
  assert.ok(PB_TRANSACTION.getPayload().reviewConfirmedAt instanceof Date);
  assert.ok(PB_TRANSACTION.getMaskedSummary().reviewConfirmedAt instanceof Date);
});

console.log(`\n${passed} test(s) passed.`);
