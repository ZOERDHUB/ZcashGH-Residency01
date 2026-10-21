import type { Currency } from './conversion'

export type OrderStatus = 'AWAITING_ZEC' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED'

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
    status: 'AWAITING_ZEC',
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
