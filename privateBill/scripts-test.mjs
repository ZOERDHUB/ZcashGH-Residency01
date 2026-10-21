import { stateFor } from './src/payment-monitor.mjs'
const tests = [
  ['no payment', stateFor({ receivedZec: 0, confirmedZec: 0, requiredZec: 1, pendingPayment: false, requiredConfirmations: 3, expired: false }), 'AWAITING_ZEC'],
  ['zero-conf payment', stateFor({ receivedZec: 1, confirmedZec: 0, requiredZec: 1, pendingPayment: true, requiredConfirmations: 3, expired: false }), 'CONFIRMING'],
  ['underpaid', stateFor({ receivedZec: 0.5, confirmedZec: 0.5, requiredZec: 1, pendingPayment: false, requiredConfirmations: 3, expired: false }), 'PAYMENT_UNDERPAID'],
  ['confirmed', stateFor({ receivedZec: 1, confirmedZec: 1, requiredZec: 1, pendingPayment: false, requiredConfirmations: 3, expired: false }), 'CONFIRMED'],
  ['expired', stateFor({ receivedZec: 0, confirmedZec: 0, requiredZec: 1, pendingPayment: false, requiredConfirmations: 3, expired: true }), 'EXPIRED'],
]
for (const [name, actual, expected] of tests) if (actual !== expected) throw new Error(`${name}: expected ${expected}, got ${actual}`)
console.log(`Q7 v3 state tests passed: ${tests.length}`)
