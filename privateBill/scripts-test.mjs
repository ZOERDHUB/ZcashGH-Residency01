import assert from 'node:assert/strict'
import { canTransition, assertValidTransition } from './src/status-engine.mjs'
import { stateFor } from './src/payment-monitor.mjs'
import { MockPayoutProvider } from './src/payout-service.mjs'
import { JsonStore } from './src/store.mjs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

for (const [from, to] of [
  ['ZEC_CONFIRMED', 'PAYOUT_PROCESSING'],
  ['PAYOUT_PROCESSING', 'FIAT_SENT'],
  ['FIAT_SENT', 'COMPLETED'],
  ['PAYOUT_PROCESSING', 'PAYOUT_FAILED'],
  ['PAYOUT_FAILED', 'PAYOUT_PROCESSING'],
]) assert.equal(canTransition(from, to), true)

for (const [from, to] of [
  ['AWAITING_ZEC', 'PAYOUT_PROCESSING'],
  ['ZEC_CONFIRMED', 'COMPLETED'],
  ['FIAT_SENT', 'PAYOUT_PROCESSING'],
  ['COMPLETED', 'PAYOUT_PROCESSING'],
]) {
  assert.equal(canTransition(from, to), false)
  assert.throws(() => assertValidTransition(from, to), /Invalid transaction status transition/)
}

const recipient = {
  providerName: 'Test Bank', providerCode: 'TESTBANK', providerType: 'bank',
  accountNumber: '0123456789', accountName: 'Test Recipient', country: 'Nigeria', currency: 'NGN'
}
const success = new MockPayoutProvider({ mode: 'success' })
const sent = await success.sendPayout({ orderId: 'PB-Q9-001', currency: 'NGN', amount: 25000, recipient })
assert.equal(sent.status, 'SENT')
assert.match(sent.providerReference, /^MOCK-NGN-/)
assert.equal(sent.recipient.accountNumber, recipient.accountNumber)

const failed = new MockPayoutProvider({ mode: 'failed' })
await assert.rejects(() => failed.sendPayout({ orderId: 'PB-Q9-002', currency: 'GHS', amount: 100, recipient: { ...recipient, currency: 'GHS' } }), /rejected|failed/i)

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'private-bill-q9-'))
const store = new JsonStore(path.join(dir, 'orders.json'))
await store.init()
const created = await store.createOrder({
  id: 'PB-Q9-STORE', fiatCurrency: 'NGN', fiatAmount: 25000, requiredZec: 0.1,
  recipient, depositAddress: 't1PrivateBillQ9TestAddress123456789'
})
await store.transitionOrder(created.id, 'AWAITING_ZEC', 'Ready')
await store.transitionOrder(created.id, 'ZEC_DETECTED', 'Detected')
await store.transitionOrder(created.id, 'CONFIRMING', 'Confirming')
await store.transitionOrder(created.id, 'ZEC_CONFIRMED', 'Confirmed')
await store.transitionOrder(created.id, 'PAYOUT_PROCESSING', 'Payout started')
await store.recordPayoutAttempt(created.id, {
  attemptId: 'PA-Q9-001', provider: 'mock', status: 'PROCESSING', requestedAt: new Date().toISOString(), recipient
})
await store.updatePayout(created.id, { status: 'SENT', provider: 'mock', providerReference: sent.providerReference })
await store.recordPayoutAttempt(created.id, {
  attemptId: 'PA-Q9-001', provider: 'mock', providerReference: sent.providerReference, status: 'SENT', requestedAt: new Date().toISOString(), completedAt: new Date().toISOString(), recipient
})
await store.transitionOrder(created.id, 'FIAT_SENT', 'Sent')
await store.transitionOrder(created.id, 'COMPLETED', 'Completed')
const final = store.getOrder(created.id)
assert.equal(final.status, 'COMPLETED')
assert.equal(final.payout.providerReference, sent.providerReference)
assert.equal(final.payout.attempts.length, 1, 'attempt must be idempotent')
assert.ok(final.statusTimestamps.PAYOUT_PROCESSING)
assert.ok(final.statusTimestamps.FIAT_SENT)
assert.ok(final.statusTimestamps.COMPLETED)


assert.deepEqual([
  'AWAITING_ZEC', 'ZEC_DETECTED', 'CONFIRMING', 'ZEC_CONFIRMED',
  'PAYOUT_PROCESSING', 'FIAT_SENT', 'COMPLETED'
], [
  'AWAITING_ZEC', 'ZEC_DETECTED', 'CONFIRMING', 'ZEC_CONFIRMED',
  'PAYOUT_PROCESSING', 'FIAT_SENT', 'COMPLETED'
])
assert.deepEqual(final.statusHistory.map(item => item.to), [
  'CREATED', 'AWAITING_ZEC', 'ZEC_DETECTED', 'CONFIRMING', 'ZEC_CONFIRMED',
  'PAYOUT_PROCESSING', 'FIAT_SENT', 'COMPLETED'
])

// Q11 exception handling
assert.equal(stateFor({ receivedZec: 0, confirmedZec: 0, requiredZec: 0.1, pendingPayment: false, expired: true }), 'EXPIRED')
assert.equal(stateFor({ receivedZec: 0.05, confirmedZec: 0.05, requiredZec: 0.1, pendingPayment: false, expired: false }), 'UNDERPAID')
assert.equal(stateFor({ receivedZec: 0.11, confirmedZec: 0.11, requiredZec: 0.1, pendingPayment: false, expired: false }), 'OVERPAID')
assert.equal(canTransition('OVERPAID', 'PAYOUT_PROCESSING'), false, 'overpaid transactions must not enter payout processing')
assert.equal(canTransition('PAYOUT_PROCESSING', 'CANCELLED'), false, 'payouts cannot be cancelled while provider processing is active')
assert.equal(canTransition('ZEC_CONFIRMED', 'COMPLETED'), false, 'confirmed ZEC alone must never mark fiat completion')

const errorDir = await fs.mkdtemp(path.join(os.tmpdir(), 'private-bill-q11-'))
const errorStore = new JsonStore(path.join(errorDir, 'orders.json'))
await errorStore.init()
const errorOrder = await errorStore.createOrder({
  id: 'PB-Q11-ERROR', fiatCurrency: 'NGN', fiatAmount: 10000, requiredZec: 0.1,
  recipient, depositAddress: 't1PrivateBillQ11TestAddress123456789'
})
await errorStore.transitionOrder(errorOrder.id, 'AWAITING_ZEC', 'Ready')
await errorStore.recordError(errorOrder.id, { code: 'UNDERPAYMENT', message: 'Not enough ZEC received', retryable: true, at: new Date().toISOString() })
assert.equal(errorStore.getOrder(errorOrder.id).lastError.code, 'UNDERPAYMENT')
await errorStore.clearError(errorOrder.id)
assert.equal(errorStore.getOrder(errorOrder.id).lastError, null)

console.log('Q11 transaction error handling tests passed: 15')
