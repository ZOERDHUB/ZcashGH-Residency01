import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { JsonStore } from './src/store.mjs'
import { createNodeManager } from './src/node-manager.mjs'
import { monitorOrder } from './src/payment-monitor.mjs'
import { TRANSACTION_STATUSES, isValidStatus } from './src/status-engine.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8787)
const DB = process.env.PRIVATE_BILL_DB || path.join(root, 'data/private-bill.json')
const CONFIRMATIONS = Number(process.env.ZCASH_REQUIRED_CONFIRMATIONS || 3)
const ACTIVE_NETWORK = (process.env.PRIVATE_BILL_NETWORK || 'testnet').toLowerCase()
const store = new JsonStore(DB)
await store.init()

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
  if (!Number.isFinite(Number(input.requiredZec)) || Number(input.requiredZec) <= 0) {
    throw new Error('requiredZec must be positive')
  }
  if (typeof input.depositAddress !== 'string' || input.depositAddress.length < 20) {
    throw new Error('depositAddress looks invalid')
  }
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
      validateOrder(input)
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
        statusTimestamps: order.statusTimestamps || {}
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
        return json(res, 503, {
          state: order.status,
          payment: order.payment ?? null,
          checkedAt: new Date().toISOString(),
          source: 'unavailable',
          network: ACTIVE_NETWORK,
          statusHistory: order.statusHistory || [],
          statusTimestamps: order.statusTimestamps || {},
          error: e.message,
          details: e.details
        })
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

http.createServer(routes).listen(PORT, () => {
  console.log(`Private Bill Q8 status engine backend listening on http://127.0.0.1:${PORT}`)
})
