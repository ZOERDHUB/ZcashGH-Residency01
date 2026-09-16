import type { Currency } from './conversion'

export type OrderStatus = 'CREATED'|'AWAITING_ZEC'|'ZEC_DETECTED'|'CONFIRMING'|'ZEC_CONFIRMED'|'PAYOUT_PROCESSING'|'FIAT_SENT'|'COMPLETED'|'EXPIRED'|'UNDERPAID'|'OVERPAID'|'PAYOUT_FAILED'|'CANCELLED'

export type RecipientPaymentInfo = {
  providerName: string
  providerCode: string
  providerType: string
  accountNumber: string
  accountName: string
  country: string
  currency: Currency
}

export type TransactionOrder = {
  id: string
  fiatCurrency: Currency
  fiatAmount: number
  requiredZec: number
  recipient: RecipientPaymentInfo
  status: OrderStatus
  createdAt: string
  expiresAt: string
  depositAddress?: string
  statusHistory?: Array<{ status: OrderStatus; at: string; reason?: string }>
  statusTimestamps?: Record<string, string>
  lastError?: { code: string; message: string; retryable?: boolean; at?: string } | null
  payout?: { referenceId?: string; provider?: string; status?: string; processedAt?: string; attemptId?: string }
  payoutAttempts?: Array<{ id: string; startedAt: string; provider: string }>
  payment?: {
    txid: string
    receivedZec: number
    confirmations: number
    requiredConfirmations: number
    detectedAt: string
    address?: string
  }
}

const STORAGE_KEY = 'private-bill:orders:v1'
const ORDER_TTL_MS = 30 * 60 * 1000

function createOrderId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `PB-${uuid.replace(/-/g, '').slice(0, 16).toUpperCase()}`
  return `PB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function readOrders(): TransactionOrder[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeOrders(orders: TransactionOrder[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders.slice(-25)))
}

export function createTransactionOrder(input: Omit<TransactionOrder, 'id' | 'status' | 'createdAt' | 'expiresAt'>): TransactionOrder {
  const createdAt = new Date()
  const order: TransactionOrder = {
    ...input,
    id: createOrderId(),
    status: 'CREATED',
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + ORDER_TTL_MS).toISOString(),
  }

  writeOrders([...readOrders(), order])
  return order
}

export function getTransactionOrder(id: string) {
  return readOrders().find(order => order.id === id) ?? null
}

export function listTransactionOrders() {
  return readOrders()
}

export function updateTransactionPayment(id: string, payment: NonNullable<TransactionOrder['payment']>, status: OrderStatus) {
  const orders = readOrders()
  const index = orders.findIndex(order => order.id === id)
  if (index < 0) return null

  const existing = orders[index]
  // Idempotency: do not replace an already-recorded payment with a different
  // observation unless the same txid is being updated with newer confirmations.
  if (existing.payment && existing.payment.txid !== payment.txid) return existing

  const updated = { ...existing, payment, status }
  orders[index] = updated
  writeOrders(orders)
  return updated
}
