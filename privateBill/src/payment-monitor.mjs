import { appError, ERROR_CODES } from './error-codes.mjs'

const EPSILON = 1e-12
export const STATES = ['AWAITING_ZEC','ZEC_DETECTED','CONFIRMING','ZEC_CONFIRMED','UNDERPAID','OVERPAID','EXPIRED']
export function stateFor({ receivedZec, requiredZec, pendingPayment, confirmedZec, expired }) {
  if (receivedZec <= EPSILON) return expired ? 'EXPIRED' : 'AWAITING_ZEC'
  if (receivedZec + EPSILON < requiredZec) return expired ? 'EXPIRED' : 'UNDERPAID'
  if (receivedZec - requiredZec > EPSILON) return 'OVERPAID'
  if (confirmedZec + EPSILON >= requiredZec) return 'ZEC_CONFIRMED'
  return pendingPayment ? 'CONFIRMING' : 'ZEC_DETECTED'
}
export async function monitorOrder(store, manager, order, requiredConfirmations) {
  const selected = await manager.findPayments(order.depositAddress)
  const relevant = selected.payments.filter(p=>p.address===order.depositAddress).sort((a,b)=>(b.blockHeight??-1)-(a.blockHeight??-1))
  for (const p of relevant) await store.recordPayment(`${order.id}:${p.txid}`, { orderId:order.id, txid:p.txid, amountZec:p.amountZec, confirmations:p.confirmations, address:p.address, detectedAt:new Date().toISOString(), node:selected.name })
  const receivedZec = relevant.reduce((s,p)=>s+Number(p.amountZec||0),0)
  const confirmedZec = relevant.filter(p=>Number(p.confirmations||0)>=requiredConfirmations).reduce((s,p)=>s+Number(p.amountZec||0),0)
  const pendingPayment = relevant.some(p=>Number(p.confirmations||0)<requiredConfirmations)
  const expired = Date.now()>Date.parse(order.expiresAt)
  const state = stateFor({ receivedZec, requiredZec:Number(order.requiredZec), pendingPayment, confirmedZec, expired })
  let current = store.getOrder(order.id)
  const transitionable = current.status === state || ['AWAITING_ZEC','ZEC_DETECTED','CONFIRMING','UNDERPAID'].includes(state)
  if (transitionable && current.status !== state) {
    try { current = await store.transitionOrder(order.id,state,`Blockchain monitor: ${state}`) } catch {}
  }
  if (state === 'EXPIRED' && current.status !== 'EXPIRED') { try { current = await store.transitionOrder(order.id,'EXPIRED','Order expired before valid funding') } catch {} }
  await store.updateOrder(order.id,{ payment: relevant[0] ? { txid:relevant[0].txid, receivedZec, confirmations:relevant[0].confirmations, requiredConfirmations, detectedAt:new Date().toISOString(), address:relevant[0].address, node:selected.name } : current.payment })
  const error = state==='UNDERPAID' ? appError(ERROR_CODES.UNDERPAYMENT,`Received ${receivedZec.toFixed(6)} ZEC; ${Number(order.requiredZec).toFixed(6)} ZEC is required.`,true) : state==='OVERPAID' ? appError(ERROR_CODES.OVERPAYMENT,`Received ${receivedZec.toFixed(6)} ZEC, above the required amount.`,false) : state==='AWAITING_ZEC' ? appError(ERROR_CODES.PAYMENT_NOT_DETECTED,'No qualifying ZEC payment has been detected yet.',true) : state==='EXPIRED' ? appError(ERROR_CODES.EXPIRED,'This transaction expired before valid funding was confirmed.',false) : null
  if(error) await store.recordError(order.id,error); else await store.clearError(order.id)
  return { state, payment: relevant[0] ? { ...relevant[0], amountZec:receivedZec, confirmedZec } : null, checkedAt:new Date().toISOString(), source:selected.name, network:manager.network, nodeErrors:selected.errors?.length?selected.errors:undefined, error:error?.message, errorCode:error?.code, retryable:error?.retryable }
}
