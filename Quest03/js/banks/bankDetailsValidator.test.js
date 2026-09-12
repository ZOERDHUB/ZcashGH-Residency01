/**
 * Private Bill — bank-details validator tests
 * -------------------------------------------------
 * Plain Node, no framework, no DOM, no network.
 * Run with: node tests/bankDetailsValidator.test.js
 */

const assert = require("assert");
const PB_BANK_VALIDATOR = require("../js/bankDetailsValidator.js");

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

console.log("NUBAN checksum");

test("computes the known-correct check digit for a real example", () => {
  // bank code 058 (GTBank) + serial 001656322 -> check digit 8
  // (worked example from the CBN NUBAN specification)
  assert.strictEqual(PB_BANK_VALIDATOR.computeNubanCheckDigit("058", "001656322"), 8);
});

test("validates a correct NUBAN against its bank code", () => {
  assert.strictEqual(PB_BANK_VALIDATOR.isValidNuban("0016563228", "058"), true);
});

test("rejects the same serial with a wrong check digit", () => {
  assert.strictEqual(PB_BANK_VALIDATOR.isValidNuban("0016563220", "058"), false);
});

test("rejects a correct NUBAN checked against the wrong bank", () => {
  // valid for 058 (GTBank), should fail for a different bank code
  assert.strictEqual(PB_BANK_VALIDATOR.isValidNuban("0016563228", "044"), false);
});

test("rejects anything that isn't exactly 10 digits", () => {
  assert.strictEqual(PB_BANK_VALIDATOR.isValidNuban("12345", "058"), false);
  assert.strictEqual(PB_BANK_VALIDATOR.isValidNuban("12345678901", "058"), false);
  assert.strictEqual(PB_BANK_VALIDATOR.isValidNuban("00165632a8", "058"), false);
});

console.log("\nvalidateAccountNumber");

test("accepts a valid NUBAN for NGN", () => {
  assert.strictEqual(PB_BANK_VALIDATOR.validateAccountNumber("0016563228", "NGN", "058"), null);
});

test("rejects an NGN account number of the wrong length", () => {
  const msg = PB_BANK_VALIDATOR.validateAccountNumber("12345", "NGN", "058");
  assert.ok(msg && msg.includes("10 digits"));
});

test("rejects an NGN account number that fails the checksum", () => {
  const msg = PB_BANK_VALIDATOR.validateAccountNumber("0016563220", "NGN", "058");
  assert.ok(msg && msg.toLowerCase().includes("doesn't check out"));
});

test("requires a bank to be selected before validating an NGN account number", () => {
  const msg = PB_BANK_VALIDATOR.validateAccountNumber("0016563228", "NGN", undefined);
  assert.ok(msg && msg.includes("Select a bank"));
});

test("accepts a plausible GHS account number with no checksum required", () => {
  assert.strictEqual(PB_BANK_VALIDATOR.validateAccountNumber("1234567", "GHS"), null);
  assert.strictEqual(PB_BANK_VALIDATOR.validateAccountNumber("12345678901234567", "GHS"), null);
});

test("rejects a GHS account number outside the plausible length range", () => {
  assert.ok(PB_BANK_VALIDATOR.validateAccountNumber("123", "GHS"));
  assert.ok(PB_BANK_VALIDATOR.validateAccountNumber("123456789012345678", "GHS"));
});

test("rejects non-numeric account numbers for either currency", () => {
  assert.ok(PB_BANK_VALIDATOR.validateAccountNumber("ABCDEFGHIJ", "NGN", "058"));
  assert.ok(PB_BANK_VALIDATOR.validateAccountNumber("12345abc", "GHS"));
});

test("rejects an empty account number", () => {
  assert.ok(PB_BANK_VALIDATOR.validateAccountNumber("", "NGN", "058"));
  assert.ok(PB_BANK_VALIDATOR.validateAccountNumber("   ", "GHS"));
});

console.log("\nvalidateAccountName");

test("accepts an ordinary full name", () => {
  assert.strictEqual(PB_BANK_VALIDATOR.validateAccountName("Chinwe Okafor"), null);
});

test("accepts names with hyphens and apostrophes", () => {
  assert.strictEqual(PB_BANK_VALIDATOR.validateAccountName("Mary-Jane O'Brien"), null);
});

test("rejects an empty name", () => {
  assert.ok(PB_BANK_VALIDATOR.validateAccountName(""));
});

test("rejects a name that's too short", () => {
  assert.ok(PB_BANK_VALIDATOR.validateAccountName("Jo"));
});

test("rejects a name containing digits or symbols", () => {
  assert.ok(PB_BANK_VALIDATOR.validateAccountName("John123"));
  assert.ok(PB_BANK_VALIDATOR.validateAccountName("John@Doe"));
});

console.log("\nvalidateBank");

test("accepts a bank that exists for the given currency", () => {
  assert.strictEqual(PB_BANK_VALIDATOR.validateBank("Zenith Bank", "NGN"), null);
  assert.strictEqual(PB_BANK_VALIDATOR.validateBank("GCB Bank", "GHS"), null);
});

test("rejects an empty bank selection", () => {
  assert.ok(PB_BANK_VALIDATOR.validateBank("", "NGN"));
});

test("rejects a bank name that isn't in the list for that currency", () => {
  assert.ok(PB_BANK_VALIDATOR.validateBank("Not A Real Bank", "NGN"));
  // "Zenith Bank" (NGN entry) is a different list entry than
  // "Zenith Bank Ghana" (GHS entry) — the exact name must match.
  assert.ok(PB_BANK_VALIDATOR.validateBank("Zenith Bank", "GHS"));
});

console.log("\nvalidateBankDetails (whole form)");

test("passes with a fully valid NGN form", () => {
  const result = PB_BANK_VALIDATOR.validateBankDetails({
    bankName: "Guaranty Trust Bank (GTBank)",
    accountNumber: "0016563228",
    accountName: "Chinwe Okafor",
    currencyCode: "NGN"
  });
  assert.strictEqual(result.valid, true);
  assert.deepStrictEqual(result.errors, {});
});

test("collects multiple field errors at once", () => {
  const result = PB_BANK_VALIDATOR.validateBankDetails({
    bankName: "",
    accountNumber: "abc",
    accountName: "",
    currencyCode: "NGN"
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.bankName);
  assert.ok(result.errors.accountNumber);
  assert.ok(result.errors.accountName);
});

console.log("\nmaskAccountNumber");

test("masks all but the last 4 digits", () => {
  assert.strictEqual(PB_BANK_VALIDATOR.maskAccountNumber("0016563228"), "••••••3228");
});

test("leaves short values unmasked (nothing meaningful to hide)", () => {
  assert.strictEqual(PB_BANK_VALIDATOR.maskAccountNumber("123"), "123");
});

console.log(`\n${passed} test(s) passed.`);
