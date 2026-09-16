import http from 'node:http'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { JsonStore } from './src/store.mjs'
import { createNodeManager } from './src/node-manager.mjs'
import { monitorOrder } from './src/payment-monitor.mjs'
import { TRANSACTION_STATUSES, isValidStatus } from './src/status-engine.mjs'
import { createPayoutProvider } from './src/payout-service.mjs'
import { ERROR_CODES, makeError } from './src/error-codes.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8787)
const DB = process.env.PRIVATE_BILL_DB || path.join(root, 'data/private-bill.json')
const CONFIRMATIONS = Number(process.env.ZCASH_REQUIRED_CONFIRMATIONS || 3)
const ACTIVE_NETWORK = (process.env.PRIVATE_BILL_NETWORK || 'testnet').toLowerCase()
const store = new JsonStore(DB)
await store.init()
const payoutLocks = new Set()

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  })
  res.end(JSON.stringify(body))
}

function body(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', c => raw += c)
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) }
      catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

function validateOrder(input) {
  for (const key of ['id', 'fiatCurrency', 'fiatAmount', 'requiredZec', 'recipient', 'depositAddress']) {
    if (!input[key]) throw new Error(`Missing order field: ${key}`)
  }
  if (!['NGN', 'GHS'].includes(input.fiatCurrency)) throw new Error('Unsupported fiat currency')
  if (!Number.isFinite(Number(input.fiatAmount)) || Number(input.fiatAmount) <= 0) throw new Error('fiatAmount must be positive')
  if (!Number.isFinite(Number(input.requiredZec)) || Number(input.requiredZec) <= 0) throw new Error('requiredZec must be positive')
  if (typeof input.depositAddress !== 'string' || input.depositAddress.length < 20) throw new Error('depositAddress looks invalid')
  const r = input.recipient
  if (!r || typeof r !== 'object') throw new Error('recipient information is required')
  for (const key of ['providerName', 'providerCode', 'accountNumber', 'accountName', 'country', 'currency']) {
    if (!String(r[key] ?? '').trim()) throw new Error(`Invalid recipient information: ${key}`)
  }
  if (!['NGN', 'GHS'].includes(r.currency) || r.currency !== input.fiatCurrency) throw new Error('Recipient currency does not match payout currency')
  if (r.country !== (input.fiatCurrency === 'NGN' ? 'Nigeria' : 'Ghana')) throw new Error('Recipient country does not match payout currency')
  if (!/^[A-Za-z0-9\- ]{6,20}$/.test(String(r.accountNumber).trim())) throw new Error('Invalid recipient account number')
  if (String(r.accountName).trim().length < 2) throw new Error('Invalid recipient account name')
}

function validateTransitionBody(input) {
  if (!input || typeof input.status !== 'string' || !isValidStatus(input.status)) {
    throw new Error(`status must be one of: ${TRANSACTION_STATUSES.join(', ')}`)
  }
  const reason = input.reason == null ? 'Status updated by system' : String(input.reason).trim()
  if (reason.length > 240) throw new Error('reason must be 240 characters or fewer')
  return { status: input.status, reason: reason || 'Status updated by system' }
}

async function routes(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  if (req.method === 'OPTIONS') return json(res, 204, {})

  try {
    if (req.method === 'GET' && url.pathname === '/api/config') {
      const manager = createNodeManager()
      return json(res, 200, {
        network: manager.network,
        nodePreference: manager.preference,
        requiredConfirmations: CONFIRMATIONS,
        statuses: TRANSACTION_STATUSES
      })
    }

    if (req.method === 'GET' && url.pathname === '/api/health') {
      const manager = createNodeManager()
      try {
        const node = await manager.select()
        return json(res, 200, { ok: true, network: manager.network, selectedNode: node.name })
      } catch (e) {
        return json(res, 503, { ok: false, network: manager.network, error: e.message, details: e.details })
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/orders') {
      const input = await body(req)
      try {
        validateOrder(input)
      } catch (e) {
        const invalid = makeError(ERROR_CODES.INVALID_RECIPIENT, e.message, { retryable: false })
        return json(res, 422, { ok: false, error: invalid.message, errorCode: invalid.code, retryable: invalid.retryable })
      }
      const createdAt = input.createdAt || new Date().toISOString()
      const order = await store.createOrder({
        ...input,
        network: input.network || ACTIVE_NETWORK,
        createdAt,
        expiresAt: input.expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString()
      })

      // The transaction is born as CREATED, then explicitly enters the payment lifecycle.
      const awaiting = await store.transitionOrder(
        order.id,
        'AWAITING_ZEC',
        'Transaction created and ready to receive ZEC'
      )
      return json(res, 201, awaiting)
    }

    const statusMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/status$/)
    if (req.method === 'GET' && statusMatch) {
      const order = store.getOrder(decodeURIComponent(statusMatch[1]))
      if (!order) return json(res, 404, { error: 'Order not found' })
      return json(res, 200, {
        id: order.id,
        status: order.status,
        statusHistory: order.statusHistory || [],
        statusTimestamps: order.statusTimestamps || {},
        lastError: order.lastError || null,
        errorHistory: order.errorHistory || []
      })
    }

    if (req.method === 'POST' && statusMatch) {
      const order = store.getOrder(decodeURIComponent(statusMatch[1]))
      if (!order) return json(res, 404, { error: 'Order not found' })
      const input = validateTransitionBody(await body(req))
      const updated = await store.transitionOrder(order.id, input.status, input.reason)
      return json(res, 200, {
        id: updated.id,
        status: updated.status,
        statusHistory: updated.statusHistory,
        statusTimestamps: updated.statusTimestamps
      })
    }

    const match = url.pathname.match(/^\/api\/payment-monitor\/([^/]+)$/)
    if (req.method === 'GET' && match) {
      const order = store.getOrder(decodeURIComponent(match[1]))
      if (!order) return json(res, 404, { error: 'Order not found' })
      try {
        const manager = createNodeManager()
        if (order.network && order.network !== manager.network) {
          return json(res, 409, {
            error: `Order network ${order.network} does not match active backend network ${manager.network}`
          })
        }
        const result = await monitorOrder(store, manager, order, CONFIRMATIONS)
        return json(res, 200, result)
      } catch (e) {
        const transient = makeError(ERROR_CODES.ZCASH_NETWORK_UNAVAILABLE, 'Zcash node or network is temporarily unavailable. The transaction state was not advanced.', { retryable: true, details: e.details })
        return json(res, 503, {
          state: order.status,
          payment: order.payment ?? null,
          checkedAt: new Date().toISOString(),
          source: 'unavailable',
          network: ACTIVE_NETWORK,
          statusHistory: order.statusHistory || [],
          statusTimestamps: order.statusTimestamps || {},
          error: transient.message,
          errorCode: transient.code,
          retryable: transient.retryable,
          details: e.details
        })
      }
    }

    const cancelMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/cancel$/)
    if (req.method === 'POST' && cancelMatch) {
      const orderId = decodeURIComponent(cancelMatch[1])
      const order = store.getOrder(orderId)
      if (!order) return json(res, 404, { error: 'Order not found' })
      if (!['CREATED', 'AWAITING_ZEC', 'ZEC_DETECTED', 'CONFIRMING', 'UNDERPAID', 'OVERPAID'].includes(order.status)) {
        return json(res, 409, { error: `Transaction cannot be cancelled from ${order.status}`, status: order.status })
      }
      const updated = await store.transitionOrder(orderId, 'CANCELLED', 'Cancelled by user')
      const cancelled = makeError(ERROR_CODES.CANCELLED, 'This transaction was cancelled. No payout can be initiated.', { retryable: false })
      await store.recordError(orderId, cancelled)
      return json(res, 200, { ok: true, order: updated })
    }

    const payoutMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/payout$/)
    if (req.method === 'GET' && payoutMatch) {
      const order = store.getOrder(decodeURIComponent(payoutMatch[1]))
      if (!order) return json(res, 404, { error: 'Order not found' })
      return json(res, 200, { id: order.id, status: order.status, payout: order.payout ?? null, lastError: order.lastError || null })
    }

    if (req.method === 'POST' && payoutMatch) {
      const orderId = decodeURIComponent(payoutMatch[1])
      let order = store.getOrder(orderId)
      if (!order) return json(res, 404, { error: 'Order not found' })

      if (payoutLocks.has(orderId) || order.status === 'PAYOUT_PROCESSING') {
        const duplicate = makeError(ERROR_CODES.DUPLICATE_PROCESSING, 'A payout attempt is already being processed for this transaction. Do not submit another payout request.', { retryable: true })
        await store.recordError(orderId, duplicate)
        return json(res, 409, { ok: false, error: duplicate.message, errorCode: duplicate.code, retryable: duplicate.retryable, status: order.status })
      }

      // Payouts can only start after blockchain confirmation. A retry is allowed
      // only from PAYOUT_FAILED and creates a new attempt.
      if (!['ZEC_CONFIRMED', 'PAYOUT_FAILED'].includes(order.status)) {
        return json(res, 409, {
          error: `Payout cannot start while transaction status is ${order.status}`,
          status: order.status
        })
      }
      try { validateOrder({ ...order, id: order.id }) } catch (e) {
        const invalid = makeError(ERROR_CODES.INVALID_RECIPIENT, e.message, { retryable: false })
        await store.recordError(orderId, invalid)
        return json(res, 422, { ok: false, error: invalid.message, errorCode: invalid.code, retryable: invalid.retryable, status: order.status })
      }
      if (Number(order.fiatAmount) <= 0) {
        const invalid = makeError(ERROR_CODES.INVALID_RECIPIENT, 'Payout amount must be positive.', { retryable: false })
        await store.recordError(orderId, invalid)
        return json(res, 422, { ok: false, error: invalid.message, errorCode: invalid.code, retryable: invalid.retryable, status: order.status })
      }

      payoutLocks.add(orderId)
      try {
      if (order.status === 'ZEC_CONFIRMED') {
        order = await store.transitionOrder(order.id, 'PAYOUT_PROCESSING', 'Required ZEC confirmed; payout processing started')
      } else {
        order = await store.transitionOrder(order.id, 'PAYOUT_PROCESSING', 'Retrying failed fiat payout')
      }

      const attemptId = `PA-${crypto.randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`
      const requestedAt = new Date().toISOString()
      const provider = createPayoutProvider()
      await store.recordPayoutAttempt(order.id, {
        attemptId,
        provider: process.env.PAYOUT_PROVIDER || 'mock',
        status: 'PROCESSING',
        requestedAt,
        recipient: order.recipient
      })

      try {
        const result = await provider.sendPayout({
          orderId: order.id,
          currency: order.fiatCurrency,
          amount: order.fiatAmount,
          recipient: order.recipient
        })
        const completedAt = new Date().toISOString()
        await store.updatePayout(order.id, {
          status: 'SENT',
          provider: result.provider,
          providerReference: result.providerReference,
          lastAttemptId: attemptId,
          sentAt: completedAt
        })
        await store.recordPayoutAttempt(order.id, {
          attemptId,
          provider: result.provider,
          providerReference: result.providerReference,
          status: 'SENT',
          requestedAt,
          completedAt,
          recipient: order.recipient
        })
        order = await store.transitionOrder(order.id, 'FIAT_SENT', `Payout sent by ${result.provider}`)
        order = await store.transitionOrder(order.id, 'COMPLETED', 'Fiat payout confirmed by provider')
        await store.clearError(order.id)
        return json(res, 200, { ok: true, order })
      } catch (e) {
        const failedAt = new Date().toISOString()
        await store.updatePayout(order.id, {
          status: 'FAILED',
          provider: process.env.PAYOUT_PROVIDER || 'mock',
          lastAttemptId: attemptId,
          failedAt,
          error: e.message
        })
        await store.recordPayoutAttempt(order.id, {
          attemptId,
          provider: process.env.PAYOUT_PROVIDER || 'mock',
          providerReference: e.details?.providerReference,
          status: 'FAILED',
          requestedAt,
          completedAt: failedAt,
          error: e.message,
          recipient: order.recipient
        })
        const payoutError = makeError(ERROR_CODES.PAYOUT_FAILED, e.message, { retryable: true, details: e.details })
        await store.recordError(order.id, payoutError)
        order = await store.transitionOrder(order.id, 'PAYOUT_FAILED', 'Fiat payout provider rejected or failed the payout')
        return json(res, 502, { ok: false, order, error: e.message, errorCode: payoutError.code, retryable: payoutError.retryable, details: e.details })
      } finally {
        payoutLocks.delete(orderId)
      }
      } catch (e) {
        payoutLocks.delete(orderId)
        throw e
      } finally {
        payoutLocks.delete(orderId)
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/orders') {
      return json(res, 200, store.listOrders())
    }

    return json(res, 404, { error: 'Not found' })
  } catch (e) {
    return json(res, 400, { error: e instanceof Error ? e.message : String(e) })
  }
}

http.createServer(routes).listen(PORT, '127.0.0.1', () => {
  console.log(`Private Bill backend listening on http://127.0.0.1:${PORT}`)
})
