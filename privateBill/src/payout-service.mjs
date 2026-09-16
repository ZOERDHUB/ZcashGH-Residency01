export function createPayoutProvider() {
  return {
    name: 'private-bill-sandbox',
    async payout({ order }) {
      await new Promise(r => setTimeout(r, 350))
      if (process.env.PRIVATE_BILL_PAYOUT_MODE === 'fail') throw Object.assign(new Error('Sandbox payout provider rejected the payout.'), { providerCode: 'SANDBOX_REJECTED' })
      return { provider: 'private-bill-sandbox', referenceId: `PAYOUT-${order.id}`, status: 'SUCCESS', processedAt: new Date().toISOString() }
    }
  }
}
