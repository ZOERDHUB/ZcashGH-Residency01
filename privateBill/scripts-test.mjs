import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { canTransition, assertValidTransition } from './src/status-engine.mjs'
import { stateFor } from './src/payment-monitor.mjs'
import { MockPayoutProvider } from './src/payout-service.mjs'
import { JsonStore } from './src/store.mjs'

// 1. Status-engine invariants and complete successful lifecycle.
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
  ['CANCELLED', 'PAYOUT_PROCESSING'],
  ['EXPIRED', 'COMPLETED'],
  ['OVERPAID', 'PAYOUT_PROCESSING'],
]) {
  assert.equal(canTransition(from, to), false)
  assert.throws(() => assertValidTransition(from, to), /Invalid transaction status transition/)
}

const recipient = {
  providerName: 'Test Bank', providerCode: 'TESTBANK', providerType: 'bank',
  accountNumber: '0123456789', accountName: 'Test Recipient', country: 'Nigeria', currency: 'NGN'
}
const success = new MockPayoutProvider({ mode: 'success' })
const sent = await success.sendPayout({ orderId: 'PB-Q12-001', currency: 'NGN', amount: 25000, recipient })
assert.equal(sent.status, 'SENT')
assert.match(sent.providerReference, /^MOCK-NGN-/)
assert.equal(sent.recipient.accountNumber, recipient.accountNumber)

const failed = new MockPayoutProvider({ mode: 'failed' })
await assert.rejects(() => failed.sendPayout({ orderId: 'PB-Q12-002', currency: 'GHS', amount: 100, recipient: { ...recipient, currency: 'GHS', country: 'Ghana' } }), /rejected|failed/i)

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'private-bill-q12-'))
const store = new JsonStore(path.join(dir, 'orders.json'))
await store.init()
const created = await store.createOrder({
  id: 'PB-Q12-STORE', fiatCurrency: 'NGN', fiatAmount: 25000, requiredZec: 0.1,
  recipient, depositAddress: 't1PrivateBillQ12TestAddress123456789'
})
for (const [to, reason] of [
  ['AWAITING_ZEC', 'Ready'], ['ZEC_DETECTED', 'Detected'], ['CONFIRMING', 'Confirming'],
  ['ZEC_CONFIRMED', 'Confirmed'], ['PAYOUT_PROCESSING', 'Payout started'], ['FIAT_SENT', 'Sent'], ['COMPLETED', 'Completed']
]) await store.transitionOrder(created.id, to, reason)
const final = store.getOrder(created.id)
assert.equal(final.status, 'COMPLETED')
assert.ok(final.statusTimestamps.PAYOUT_PROCESSING)
assert.ok(final.statusTimestamps.FIAT_SENT)
assert.ok(final.statusTimestamps.COMPLETED)
assert.deepEqual(final.statusHistory.map(item => item.to), [
  'CREATED', 'AWAITING_ZEC', 'ZEC_DETECTED', 'CONFIRMING', 'ZEC_CONFIRMED',
  'PAYOUT_PROCESSING', 'FIAT_SENT', 'COMPLETED'
])

// 2. Payment exception matrix.
assert.equal(stateFor({ receivedZec: 0, confirmedZec: 0, requiredZec: 0.1, pendingPayment: false, expired: false }), 'AWAITING_ZEC')
assert.equal(stateFor({ receivedZec: 0.05, confirmedZec: 0.05, requiredZec: 0.1, pendingPayment: false, expired: false }), 'UNDERPAID')
assert.equal(stateFor({ receivedZec: 0.11, confirmedZec: 0.11, requiredZec: 0.1, pendingPayment: false, expired: false }), 'OVERPAID')
assert.equal(stateFor({ receivedZec: 0.1, confirmedZec: 0, requiredZec: 0.1, pendingPayment: true, expired: false }), 'CONFIRMING')
assert.equal(stateFor({ receivedZec: 0.1, confirmedZec: 0.1, requiredZec: 0.1, pendingPayment: false, expired: false }), 'ZEC_CONFIRMED')
assert.equal(stateFor({ receivedZec: 0.1, confirmedZec: 0.1, requiredZec: 0.1, pendingPayment: false, expired: true }), 'EXPIRED')

const errorStore = new JsonStore(path.join(dir, 'errors.json'))
await errorStore.init()
const errorOrder = await errorStore.createOrder({
  id: 'PB-Q12-ERROR', fiatCurrency: 'NGN', fiatAmount: 10000, requiredZec: 0.1,
  recipient, depositAddress: 't1PrivateBillQ12ErrorAddress123456789'
})
await errorStore.transitionOrder(errorOrder.id, 'AWAITING_ZEC', 'Ready')
await errorStore.recordError(errorOrder.id, { code: 'UNDERPAYMENT', message: 'Not enough ZEC received', retryable: true, at: new Date().toISOString() })
await errorStore.recordError(errorOrder.id, { code: 'UNDERPAYMENT', message: 'Not enough ZEC received', retryable: true, at: new Date().toISOString() })
assert.equal(errorStore.getOrder(errorOrder.id).errorHistory.length, 1, 'repeated identical errors are deduplicated')
await errorStore.clearError(errorOrder.id)
assert.equal(errorStore.getOrder(errorOrder.id).lastError, null)

// 3. Cancellation and payout safety at the persistence layer.
const cancelledOrder = await errorStore.createOrder({
  id: 'PB-Q12-CANCEL', fiatCurrency: 'NGN', fiatAmount: 10000, requiredZec: 0.1,
  recipient, depositAddress: 't1PrivateBillQ12CancelAddress123456789'
})
await errorStore.transitionOrder(cancelledOrder.id, 'AWAITING_ZEC', 'Ready')
await errorStore.transitionOrder(cancelledOrder.id, 'CANCELLED', 'Cancelled by user')
assert.equal(errorStore.getOrder(cancelledOrder.id).status, 'CANCELLED')
assert.equal(canTransition('CANCELLED', 'PAYOUT_PROCESSING'), false)

// 4. Static final-polish/security checks: no accidental debug logging in app code,
// responsive rules exist, and secrets/runtime files are ignored.
const sourceFiles = ['src/App.tsx', 'src/orders.ts', 'src/payment-monitor.ts', 'src/payout.ts', 'src/tracking.ts', 'src/status-engine.ts']
for (const file of sourceFiles) {
  const text = await fs.readFile(file, 'utf8')
  assert.equal(/console\.(log|debug|warn|error)\s*\(/.test(text), false, `${file} contains debug console output`)
  assert.equal(/BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY/.test(text), false, `${file} contains a private key marker`)
}
const gitignore = await fs.readFile('.gitignore', 'utf8')
assert.match(gitignore, /^\.env\*?$/m)
assert.match(gitignore, /^data\/\*\.json$/m)
assert.match(await fs.readFile('src/styles.css', 'utf8'), /@media\(max-width:640px\)/)
assert.match(await fs.readFile('src/styles.css', 'utf8'), /@media\(max-width:700px\)/)
const app = await fs.readFile('src/App.tsx', 'utf8')
for (const marker of ['Select', 'recipient', 'Track transaction', 'Cancel transaction', 'Process fiat payout']) {
  assert.ok(app.toLowerCase().includes(marker.toLowerCase()), `missing final flow marker: ${marker}`)
}

// 5. Live HTTP integration smoke test with an isolated temporary DB.
const port = 18787 + Math.floor(Math.random() * 1000)
const httpDb = path.join(dir, 'http-orders.json')
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), PRIVATE_BILL_DB: httpDb, PRIVATE_BILL_NETWORK: 'testnet', MOCK_PAYOUT_MODE: 'success' },
  stdio: ['ignore', 'pipe', 'pipe']
})
let serverOutput = ''
server.stdout.on('data', chunk => { serverOutput += chunk.toString() })
server.stderr.on('data', chunk => { serverOutput += chunk.toString() })
try {
  const base = `http://127.0.0.1:${port}`
  for (let i = 0; i < 40; i++) {
    try { await fetch(`${base}/api/orders`) ; break } catch { await new Promise(r => setTimeout(r, 50)) }
  }
  const validOrder = {
    id: 'PB-Q12-HTTP', fiatCurrency: 'NGN', fiatAmount: 25000, requiredZec: 0.1,
    recipient, depositAddress: 't1PrivateBillQ12HttpAddress123456789'
  }
  let response = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validOrder) })
  assert.equal(response.status, 201)
  let payload = await response.json()
  assert.equal(payload.status, 'AWAITING_ZEC')

  response = await fetch(`${base}/api/orders/PB-Q12-HTTP/payout`, { method: 'POST' })
  assert.equal(response.status, 409, 'payout must be blocked before ZEC confirmation')

  response = await fetch(`${base}/api/orders/PB-Q12-HTTP/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'ZEC_DETECTED', reason: 'integration test' }) })
  assert.equal(response.status, 200)
  response = await fetch(`${base}/api/orders/PB-Q12-HTTP/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'CONFIRMING', reason: 'integration test' }) })
  assert.equal(response.status, 200)
  response = await fetch(`${base}/api/orders/PB-Q12-HTTP/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'ZEC_CONFIRMED', reason: 'integration test' }) })
  assert.equal(response.status, 200)

  response = await fetch(`${base}/api/orders/PB-Q12-HTTP/payout`, { method: 'POST' })
  assert.equal(response.status, 200)
  payload = await response.json()
  assert.equal(payload.order.status, 'COMPLETED')
  assert.equal(payload.order.payout.status, 'SENT')

  response = await fetch(`${base}/api/orders/PB-Q12-HTTP/payout`, { method: 'POST' })
  assert.equal(response.status, 409, 'completed transaction cannot be paid twice')

  const invalid = { ...validOrder, id: 'PB-Q12-INVALID', recipient: { ...recipient, accountNumber: '123' } }
  response = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(invalid) })
  assert.equal(response.status, 422)
  payload = await response.json()
  assert.equal(payload.errorCode, 'INVALID_RECIPIENT')
} finally {
  server.kill('SIGTERM')
  await new Promise(resolve => server.once('exit', resolve))
}

console.log('Q12 integration, reliability, security and lifecycle tests passed: 31')
