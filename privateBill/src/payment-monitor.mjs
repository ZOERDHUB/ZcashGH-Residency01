export const STATES = [
  'AWAITING_ZEC',
  'PAYMENT_DETECTED',
  'CONFIRMING',
  'CONFIRMED',
  'PAYMENT_UNDERPAID',
  'EXPIRED'
]

const EPSILON = 1e-12

export function stateFor({ receivedZec, confirmedZec, requiredZec, pendingPayment, requiredConfirmations, expired }) {
  if (receivedZec <= EPSILON && expired) return 'EXPIRED'
  if (receivedZec <= EPSILON) return 'AWAITING_ZEC'
  if (confirmedZec + EPSILON >= requiredZec) return 'CONFIRMED'
  if (pendingPayment && receivedZec + EPSILON >= requiredZec) return 'CONFIRMING'
  if (receivedZec + EPSILON < requiredZec) return 'PAYMENT_UNDERPAID'
  return 'CONFIRMING'
}

export async function monitorOrder(store, manager, order, requiredConfirmations) {
  const selected = await manager.findPayments(order.depositAddress)
  const relevant = selected.payments
    .filter(payment => payment.address === order.depositAddress)
    .sort((a, b) => (b.blockHeight ?? -1) - (a.blockHeight ?? -1))

  for (const payment of relevant) {
    await store.recordPayment(`${order.id}:${payment.txid}`, {
      orderId: order.id,
      txid: payment.txid,
      amountZec: payment.amountZec,
      confirmations: payment.confirmations,
      address: payment.address,
      detectedAt: new Date().toISOString(),
      node: selected.name
    })
  }

  const receivedZec = relevant.reduce((sum, payment) => sum + Number(payment.amountZec || 0), 0)
  const confirmedZec = relevant
    .filter(payment => Number(payment.confirmations || 0) >= requiredConfirmations)
    .reduce((sum, payment) => sum + Number(payment.amountZec || 0), 0)
  const pendingPayment = relevant.some(payment => Number(payment.confirmations || 0) < requiredConfirmations)
  const latest = relevant[0] ?? null
  const expired = order.expiresAt ? Date.now() > Date.parse(order.expiresAt) : false
  const state = stateFor({
    receivedZec,
    confirmedZec,
    requiredZec: Number(order.requiredZec),
    pendingPayment,
    requiredConfirmations,
    expired
  })

  const orderStatus = state === 'CONFIRMED' ? 'COMPLETED' : state
  await store.updateOrder(order.id, {
    status: orderStatus,
    payment: latest
      ? {
          txid: latest.txid,
          receivedZec,
          confirmations: latest.confirmations,
          requiredConfirmations,
          detectedAt: new Date().toISOString(),
          address: latest.address,
          node: selected.name
        }
      : order.payment
  })

  return {
    state,
    payment: latest
      ? {
          ...latest,
          amountZec: receivedZec,
          confirmedZec
        }
      : null,
    checkedAt: new Date().toISOString(),
    source: selected.name,
    network: manager.network,
    nodeErrors: selected.errors.length ? selected.errors : undefined
  }
}
