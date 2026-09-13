/**
 * Private Bill — order store tests
 * ---------------------------------------
 * Run with: node tests/orderStore.test.js
 */

const assert = require("assert");
const { PB_ORDER_STORE, PB_ORDER_STATUS } = require("../js/orderStore.js");
const { PB_CONFIG } = require("../js/config.js");

let passed = 0;

function test(name, fn) {
  try {
    PB_ORDER_STORE.resetStore();
    fn();
    passed++;
    console.log(`  ok  - ${name}`);
  } catch (err) {
    console.error(`FAIL  - ${name}`);
    console.error(`        ${err.message}`);
    process.exitCode = 1;
  }
}

const validPayload = () => ({
  exchange: {
    currencyCode: "NGN",
    fiatAmount: 150000,
    totalZec: 0.09398148,
    effectiveRate: 1620000,
    feeZec: 0.00138889
  },
  recipient: {
    country: "Nigeria",
    bankName: "Guaranty Trust Bank (GTBank)",
    accountNumber: "0016563228",
    accountName: "Chinwe Okafor"
  }
});

console.log("createOrder");

test("creates an order with all required fields", () => {
  const order = PB_ORDER_STORE.createOrder(validPayload());
  assert.ok(order.id);
  assert.strictEqual(order.status, PB_ORDER_STATUS.AWAITING_ZEC);
  assert.ok(order.createdAt instanceof Date);
  assert.ok(order.expiresAt instanceof Date);
  assert.strictEqual(order.currencyCode, "NGN");
  assert.strictEqual(order.fiatAmount, 150000);
  assert.strictEqual(order.zecAmount, 0.09398148);
  assert.strictEqual(order.recipient.bankName, "Guaranty Trust Bank (GTBank)");
  assert.strictEqual(order.recipient.accountNumber, "0016563228");
});

test("new orders start in AWAITING_ZEC", () => {
  const order = PB_ORDER_STORE.createOrder(validPayload());
  assert.strictEqual(order.status, PB_ORDER_STATUS.AWAITING_ZEC);
});

test("expiresAt is createdAt plus the configured window", () => {
  const order = PB_ORDER_STORE.createOrder(validPayload());
  const diffMs = order.expiresAt.getTime() - order.createdAt.getTime();
  assert.strictEqual(diffMs, PB_CONFIG.orderExpiryMs);
});

test("returns null for a payload missing the exchange half", () => {
  const payload = validPayload();
  delete payload.exchange;
  assert.strictEqual(PB_ORDER_STORE.createOrder(payload), null);
});

test("returns null for a payload missing the recipient half", () => {
  const payload = validPayload();
  delete payload.recipient;
  assert.strictEqual(PB_ORDER_STORE.createOrder(payload), null);
});

test("returns null for a null/undefined payload", () => {
  assert.strictEqual(PB_ORDER_STORE.createOrder(null), null);
  assert.strictEqual(PB_ORDER_STORE.createOrder(undefined), null);
});

test("generates a different ID for every order", () => {
  const ids = new Set();
  for (let i = 0; i < 200; i++) {
    ids.add(PB_ORDER_STORE.createOrder(validPayload()).id);
  }
  assert.strictEqual(ids.size, 200);
});

test("order IDs follow the PB- prefix convention", () => {
  const order = PB_ORDER_STORE.createOrder(validPayload());
  assert.ok(/^PB-[A-Z0-9]+$/.test(order.id));
});

console.log("\ngetOrder");

test("retrieves a previously created order by id", () => {
  const created = PB_ORDER_STORE.createOrder(validPayload());
  const fetched = PB_ORDER_STORE.getOrder(created.id);
  assert.strictEqual(fetched.id, created.id);
  assert.strictEqual(fetched.fiatAmount, created.fiatAmount);
});

test("returns null for an unknown id", () => {
  assert.strictEqual(PB_ORDER_STORE.getOrder("PB-DOESNOTEXIST"), null);
});

test("getOrder returns a defensive copy, not a live reference", () => {
  const created = PB_ORDER_STORE.createOrder(validPayload());
  const fetched = PB_ORDER_STORE.getOrder(created.id);
  fetched.fiatAmount = 999999;
  fetched.recipient.accountNumber = "0000000000";
  const refetched = PB_ORDER_STORE.getOrder(created.id);
  assert.strictEqual(refetched.fiatAmount, 150000);
  assert.strictEqual(refetched.recipient.accountNumber, "0016563228");
});

console.log("\nupdateStatus");

test("transitions to a valid status", () => {
  const created = PB_ORDER_STORE.createOrder(validPayload());
  const updated = PB_ORDER_STORE.updateStatus(created.id, PB_ORDER_STATUS.ZEC_RECEIVED);
  assert.strictEqual(updated.status, PB_ORDER_STATUS.ZEC_RECEIVED);
  assert.strictEqual(PB_ORDER_STORE.getOrder(created.id).status, PB_ORDER_STATUS.ZEC_RECEIVED);
});

test("rejects an unrecognized status value", () => {
  const created = PB_ORDER_STORE.createOrder(validPayload());
  const result = PB_ORDER_STORE.updateStatus(created.id, "NOT_A_REAL_STATUS");
  assert.strictEqual(result, null);
  assert.strictEqual(PB_ORDER_STORE.getOrder(created.id).status, PB_ORDER_STATUS.AWAITING_ZEC);
});

test("returns null for an unknown order id", () => {
  assert.strictEqual(PB_ORDER_STORE.updateStatus("PB-NOPE", PB_ORDER_STATUS.COMPLETED), null);
});

test("refuses to transition an order that's already in a terminal state", () => {
  const created = PB_ORDER_STORE.createOrder(validPayload());
  PB_ORDER_STORE.updateStatus(created.id, PB_ORDER_STATUS.CANCELLED);
  const result = PB_ORDER_STORE.updateStatus(created.id, PB_ORDER_STATUS.ZEC_RECEIVED);
  assert.strictEqual(result, null);
  assert.strictEqual(PB_ORDER_STORE.getOrder(created.id).status, PB_ORDER_STATUS.CANCELLED);
});

console.log("\nisExpired / expireIfDue");

test("a fresh order is not expired", () => {
  const order = PB_ORDER_STORE.createOrder(validPayload());
  assert.strictEqual(PB_ORDER_STORE.isExpired(order), false);
});

test("an order is expired once `now` passes its expiresAt", () => {
  const order = PB_ORDER_STORE.createOrder(validPayload());
  const future = new Date(order.expiresAt.getTime() + 1000);
  assert.strictEqual(PB_ORDER_STORE.isExpired(order, future), true);
});

test("expireIfDue transitions an overdue order to EXPIRED", () => {
  const created = PB_ORDER_STORE.createOrder(validPayload());
  const future = new Date(created.expiresAt.getTime() + 1000);
  const result = PB_ORDER_STORE.expireIfDue(created.id, future);
  assert.strictEqual(result.status, PB_ORDER_STATUS.EXPIRED);
});

test("expireIfDue leaves a not-yet-due order untouched", () => {
  const created = PB_ORDER_STORE.createOrder(validPayload());
  const result = PB_ORDER_STORE.expireIfDue(created.id, created.createdAt);
  assert.strictEqual(result.status, PB_ORDER_STATUS.AWAITING_ZEC);
});

test("expireIfDue never overrides an existing terminal status", () => {
  const created = PB_ORDER_STORE.createOrder(validPayload());
  PB_ORDER_STORE.updateStatus(created.id, PB_ORDER_STATUS.COMPLETED);
  const future = new Date(created.expiresAt.getTime() + 1000);
  const result = PB_ORDER_STORE.expireIfDue(created.id, future);
  assert.strictEqual(result.status, PB_ORDER_STATUS.COMPLETED);
});

console.log("\ngetMaskedOrder");

test("masks the account number, leaves everything else intact", () => {
  const created = PB_ORDER_STORE.createOrder(validPayload());
  const masked = PB_ORDER_STORE.getMaskedOrder(created.id);
  assert.notStrictEqual(masked.recipient.accountNumber, "0016563228");
  assert.ok(masked.recipient.accountNumber.endsWith("3228"));
  assert.strictEqual(masked.recipient.bankName, "Guaranty Trust Bank (GTBank)");
  assert.strictEqual(masked.fiatAmount, 150000);
});

test("returns null for an unknown id", () => {
  assert.strictEqual(PB_ORDER_STORE.getMaskedOrder("PB-NOPE"), null);
});

console.log("\nisTerminalStatus");

test("identifies terminal and non-terminal statuses correctly", () => {
  assert.strictEqual(PB_ORDER_STORE.isTerminalStatus(PB_ORDER_STATUS.AWAITING_ZEC), false);
  assert.strictEqual(PB_ORDER_STORE.isTerminalStatus(PB_ORDER_STATUS.ZEC_RECEIVED), false);
  assert.strictEqual(PB_ORDER_STORE.isTerminalStatus(PB_ORDER_STATUS.COMPLETED), true);
  assert.strictEqual(PB_ORDER_STORE.isTerminalStatus(PB_ORDER_STATUS.EXPIRED), true);
  assert.strictEqual(PB_ORDER_STORE.isTerminalStatus(PB_ORDER_STATUS.CANCELLED), true);
});

console.log(`\n${passed} test(s) passed.`);
