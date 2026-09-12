import type { TransactionOrder } from './orders'

export type PaymentState =
  | 'AWAITING_ZEC'
  | 'PAYMENT_DETECTED'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'PAYMENT_UNDERPAID'
  | 'EXPIRED'

export type NodeName = 'zebra' | 'zakura'
export type NetworkName = 'mainnet' | 'testnet' | 'regtest'

export type DetectedPayment = {
  txid: string
  amountZec: number
  confirmations: number
  requiredConfirmations: number
  detectedAt?: string
  address: string
  blockHeight?: number | null
}

export type PaymentCheck = {
  state: PaymentState
  payment: DetectedPayment | null
  checkedAt: string
  source: NodeName | 'unavailable'
  network: NetworkName
  error?: string
}

export interface PaymentMonitor {
  check(order: TransactionOrder): Promise<PaymentCheck>
}

export class BackendPaymentMonitor implements PaymentMonitor {
  constructor(private readonly baseUrl = import.meta.env.VITE_PAYMENT_MONITOR_URL || '/api/payment-monitor') {}

  async check(order: TransactionOrder): Promise<PaymentCheck> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/${encodeURIComponent(order.id)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const data = await response.json() as Partial<PaymentCheck>
    if (!response.ok && response.status !== 503) {
      throw new Error(data.error || `Payment monitor returned ${response.status}`)
    }
    const validStates: PaymentState[] = ['AWAITING_ZEC', 'PAYMENT_DETECTED', 'CONFIRMING', 'CONFIRMED', 'PAYMENT_UNDERPAID', 'EXPIRED']
    if (!data.state || !validStates.includes(data.state)) throw new Error('Payment monitor returned an invalid state.')
    return {
      state: data.state,
      payment: data.payment ?? null,
      checkedAt: data.checkedAt ?? new Date().toISOString(),
      source: data.source === 'zebra' || data.source === 'zakura' ? data.source : 'unavailable',
      network: data.network === 'mainnet' || data.network === 'regtest' ? data.network : 'testnet',
      error: data.error,
    }
  }
}

export function paymentStatusLabel(state: PaymentState | TransactionOrder['status']) {
  switch (state) {
    case 'PAYMENT_DETECTED': return 'Payment detected'
    case 'CONFIRMING': return 'Confirming on-chain'
    case 'CONFIRMED':
    case 'COMPLETED': return 'Payment confirmed'
    case 'PAYMENT_UNDERPAID': return 'Payment amount incomplete'
    case 'EXPIRED': return 'Order expired'
    default: return 'Awaiting ZEC'
  }
}
