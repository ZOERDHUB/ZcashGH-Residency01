import assert from 'node:assert/strict'
import { canTransition, assertValidTransition, TRANSACTION_STATUSES } from './src/status-engine.mjs'
import { stateFor } from './src/payment-monitor.mjs'
import { JsonStore } from './src/store.mjs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

assert.equal(TRANSACTION_STATUSES.length, 13)

const valid = [
  ['CREATED', 'AWAITING_ZEC'],
  ['AWAITING_ZEC', 'ZEC_DETECTED'],
  ['ZEC_DETECTED', 'CONFIRMING'],
  ['CONFIRMING', 'ZEC_CONFIRMED'],
  ['ZEC_CONFIRMED', 'PAYOUT_PROCESSING'],
  ['PAYOUT_PROCESSING', 'FIAT_SENT'],
  ['FIAT_SENT', 'COMPLETED'],
  ['PAYOUT_PROCESSING', 'PAYOUT_FAILED'],
  ['PAYOUT_FAILED', 'PAYOUT_PROCESSING'],
]
for (const [from, to] of valid) assert.equal(canTransition(from, to), true, `${from} -> ${to} should be valid`)

for (const [from, to] of [
  ['CREATED', 'COMPLETED'],
  ['AWAITING_ZEC', 'FIAT_SENT'],
  ['ZEC_CONFIRMED', 'COMPLETED'],
  ['FIAT_SENT', 'PAYOUT_PROCESSING'],
  ['COMPLETED', 'AWAITING_ZEC'],
]) {
  assert.equal(canTransition(from, to), false, `${from} -> ${to} should be invalid`)
  assert.throws(() => assertValidTransition(from, to), /Invalid transaction status transition/)
}

assert.equal(stateFor({ receivedZec: 0, confirmedZec: 0, requiredZec: 1, pendingPayment: false, expired: false }), 'AWAITING_ZEC')
assert.equal(stateFor({ receivedZec: 0.5, confirmedZec: 0, requiredZec: 1, pendingPayment: false, expired: false }), 'UNDERPAID')
assert.equal(stateFor({ receivedZec: 1, confirmedZec: 0, requiredZec: 1, pendingPayment: true, expired: false }), 'CONFIRMING')
assert.equal(stateFor({ receivedZec: 1, confirmedZec: 1, requiredZec: 1, pendingPayment: false, expired: false }), 'ZEC_CONFIRMED')
assert.equal(stateFor({ receivedZec: 1.1, confirmedZec: 1.1, requiredZec: 1, pendingPayment: false, expired: false }), 'OVERPAID')
assert.equal(stateFor({ receivedZec: 0, confirmedZec: 0, requiredZec: 1, pendingPayment: false, expired: true }), 'EXPIRED')

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'private-bill-q8-'))
const db = path.join(dir, 'orders.json')
const store = new JsonStore(db)
await store.init()
const created = await store.createOrder({
  id: 'PB-Q8-TEST-001',
  fiatCurrency: 'NGN',
  fiatAmount: 10000,
  requiredZec: 0.1,
  recipient: { providerName: 'Test', providerCode: 'TEST', providerType: 'bank', accountNumber: '1234567890', accountName: 'Test User', country: 'Nigeria', currency: 'NGN' },
  depositAddress: 't1PrivateBillQ8TestAddress123456789'
})
assert.equal(created.status, 'CREATED')
assert.equal(created.statusHistory.length, 1)
const awaiting = await store.transitionOrder(created.id, 'AWAITING_ZEC', 'Ready for payment')
assert.equal(awaiting.status, 'AWAITING_ZEC')
const detected = await store.transitionOrder(created.id, 'ZEC_DETECTED', 'Payment detected')
assert.equal(detected.status, 'ZEC_DETECTED')
assert.ok(detected.statusTimestamps.ZEC_DETECTED)
await assert.rejects(
  store.transitionOrder(created.id, 'COMPLETED', 'Skip lifecycle'),
  /Invalid transaction status transition/
)
assert.equal(store.getOrder(created.id).statusHistory.length, 3)

console.log('Q8 transaction status engine tests passed: 6')
