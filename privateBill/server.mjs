import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { JsonStore } from './src/store.mjs'
import { createNodeManager } from './src/node-manager.mjs'
import { monitorOrder } from './src/payment-monitor.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8787)
const DB = process.env.PRIVATE_BILL_DB || path.join(root, 'data/private-bill.json')
const CONFIRMATIONS = Number(process.env.ZCASH_REQUIRED_CONFIRMATIONS || 3)
const ACTIVE_NETWORK = (process.env.PRIVATE_BILL_NETWORK || 'testnet').toLowerCase()
const store = new JsonStore(DB)
await store.init()

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' })
  res.end(JSON.stringify(body))
}
function body(req) {
  return new Promise((resolve, reject) => { let raw=''; req.on('data', c => raw += c); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}) } catch(e) { reject(e) } }); req.on('error', reject) })
}

function validateOrder(input) {
  for (const key of ['id','fiatCurrency','fiatAmount','requiredZec','recipient','depositAddress']) if (!input[key]) throw new Error(`Missing order field: ${key}`)
  if (!Number.isFinite(Number(input.requiredZec)) || Number(input.requiredZec) <= 0) throw new Error('requiredZec must be positive')
  if (typeof input.depositAddress !== 'string' || input.depositAddress.length < 20) throw new Error('depositAddress looks invalid')
}

async function routes(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type' }); return res.end() }
  try {
    if (req.method === 'GET' && url.pathname === '/api/config') {
      const manager = createNodeManager()
      return json(res, 200, { network: manager.network, nodePreference: manager.preference, requiredConfirmations: CONFIRMATIONS })
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      const manager = createNodeManager()
      let node = null
      try { node = await manager.select() } catch (e) { return json(res, 503, { ok:false, network:manager.network, error:e.message, details:e.details }) }
      return json(res, 200, { ok:true, network:manager.network, selectedNode:node.name })
    }
    if (req.method === 'POST' && url.pathname === '/api/orders') {
      const input = await body(req); validateOrder(input)
      const order = { ...input, network: input.network || ACTIVE_NETWORK, status:'AWAITING_ZEC', createdAt: input.createdAt || new Date().toISOString(), expiresAt: input.expiresAt || new Date(Date.now()+30*60*1000).toISOString() }
      await store.createOrder(order)
      return json(res, 201, order)
    }
    const match = url.pathname.match(/^\/api\/payment-monitor\/([^/]+)$/)
    if (req.method === 'GET' && match) {
      const order = store.getOrder(decodeURIComponent(match[1]))
      if (!order) return json(res, 404, { error:'Order not found' })
      try {
        const manager = createNodeManager()
        if (order.network && order.network !== manager.network) return json(res, 409, { error: `Order network ${order.network} does not match active backend network ${manager.network}` })
        const result = await monitorOrder(store, manager, order, CONFIRMATIONS)
        return json(res, 200, result)
      } catch (e) {
        return json(res, 503, { state:'AWAITING_ZEC', payment:null, checkedAt:new Date().toISOString(), source:'unavailable', network:process.env.PRIVATE_BILL_NETWORK || 'testnet', error:e.message, details:e.details })
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/orders') return json(res, 200, store.listOrders())
    return json(res, 404, { error:'Not found' })
  } catch (e) { return json(res, 400, { error:e.message }) }
}

http.createServer(routes).listen(PORT, () => console.log(`Private Bill Q7 v3 backend listening on http://127.0.0.1:${PORT}`))
