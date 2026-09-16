import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { stateFor } from './src/payment-monitor.mjs'
import { canTransition, assertTransition } from './src/status-engine.mjs'
import { JsonStore } from './src/store.mjs'
import { createPayoutProvider } from './src/payout-service.mjs'

const stateTests = [
  ['no payment', stateFor({receivedZec:0,confirmedZec:0,requiredZec:1,pendingPayment:false,expired:false}), 'AWAITING_ZEC'],
  ['detected exact payment', stateFor({receivedZec:1,confirmedZec:0,requiredZec:1,pendingPayment:true,expired:false}), 'CONFIRMING'],
  ['underpaid', stateFor({receivedZec:.5,confirmedZec:.5,requiredZec:1,pendingPayment:false,expired:false}), 'UNDERPAID'],
  ['overpaid', stateFor({receivedZec:1.1,confirmedZec:1.1,requiredZec:1,pendingPayment:false,expired:false}), 'OVERPAID'],
  ['confirmed', stateFor({receivedZec:1,confirmedZec:1,requiredZec:1,pendingPayment:false,expired:false}), 'ZEC_CONFIRMED'],
  ['expired', stateFor({receivedZec:0,confirmedZec:0,requiredZec:1,pendingPayment:false,expired:true}), 'EXPIRED'],
]
for (const [name, actual, expected] of stateTests) assert.equal(actual, expected, name)

const valid = [
  ['CREATED','AWAITING_ZEC'],['AWAITING_ZEC','ZEC_DETECTED'],['ZEC_DETECTED','CONFIRMING'],['CONFIRMING','ZEC_CONFIRMED'],
  ['ZEC_CONFIRMED','PAYOUT_PROCESSING'],['PAYOUT_PROCESSING','FIAT_SENT'],['FIAT_SENT','COMPLETED'],['PAYOUT_FAILED','PAYOUT_PROCESSING']
]
for (const [from,to] of valid) assert.equal(canTransition(from,to), true, `${from} -> ${to}`)
for (const [from,to] of [['ZEC_CONFIRMED','COMPLETED'],['COMPLETED','PAYOUT_PROCESSING'],['CANCELLED','PAYOUT_PROCESSING'],['OVERPAID','PAYOUT_PROCESSING']]) assert.equal(canTransition(from,to), false, `${from} -> ${to} must be blocked`)
assert.throws(() => assertTransition('ZEC_CONFIRMED','COMPLETED'))

const dir = await fs.mkdtemp(path.join(os.tmpdir(),'private-bill-q12-'))
const store = new JsonStore(path.join(dir,'orders.json')); await store.init()
const order = await store.createOrder({id:'PB-Q12-TEST',fiatCurrency:'NGN',fiatAmount:10000,requiredZec:.1,recipient:{providerName:'Sandbox Bank',providerCode:'SB',providerType:'bank',accountNumber:'0123456789',accountName:'Test User',country:'Nigeria',currency:'NGN'},depositAddress:'t1PrivateBillQ12TestAddress123456789',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()})
await store.transitionOrder(order.id,'AWAITING_ZEC','ready')
await store.transitionOrder(order.id,'ZEC_DETECTED','payment detected')
await store.transitionOrder(order.id,'CONFIRMING','confirmations pending')
await store.transitionOrder(order.id,'ZEC_CONFIRMED','confirmed')
await store.transitionOrder(order.id,'PAYOUT_PROCESSING','payout started')
const provider = createPayoutProvider(); const payout = await provider.payout({order:store.getOrder(order.id)})
assert.equal(payout.status,'SUCCESS')
await store.updateOrder(order.id,{payout})
await store.transitionOrder(order.id,'FIAT_SENT','provider confirmed')
await store.transitionOrder(order.id,'COMPLETED','completed')
const completed=store.getOrder(order.id)
assert.equal(completed.status,'COMPLETED')
assert.equal(completed.statusHistory.length,8)
assert.ok(completed.statusTimestamps.COMPLETED)

const errOrder = await store.createOrder({...order,id:'PB-Q12-ERR',status:undefined,statusHistory:undefined,statusTimestamps:undefined,lastError:null,payout:undefined,payoutAttempts:undefined,payment:undefined})
await store.transitionOrder(errOrder.id,'AWAITING_ZEC','ready')
await store.recordError(errOrder.id,{code:'UNDERPAYMENT',message:'Not enough ZEC',retryable:true,at:new Date().toISOString()})
assert.equal(store.getOrder(errOrder.id).lastError.code,'UNDERPAYMENT')
assert.equal(store.getOrder(errOrder.id).errorHistory.length,1)

console.log(`Quest 12 integration tests passed: ${stateTests.length + valid.length + 4} assertions`)
