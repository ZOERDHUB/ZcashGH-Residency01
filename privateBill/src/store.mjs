import fs from 'node:fs/promises'
import path from 'node:path'
import { assertTransition } from './status-engine.mjs'

export class JsonStore {
  constructor(file) { this.file = path.resolve(file); this.data = { orders: {}, processedPayments: {} } }
  async init() { await fs.mkdir(path.dirname(this.file), { recursive: true }); try { this.data = JSON.parse(await fs.readFile(this.file,'utf8')) } catch { await this.save() } }
  async save() { await fs.writeFile(this.file, JSON.stringify(this.data,null,2)) }
  getOrder(id) { return this.data.orders[id] ?? null }
  listOrders() { return Object.values(this.data.orders) }
  async createOrder(order) {
    if (this.getOrder(order.id)) throw new Error('Order already exists')
    order.status = order.status || 'CREATED'; order.statusHistory = [{ status: order.status, at: order.createdAt || new Date().toISOString(), reason: 'Order created' }]; order.statusTimestamps = { [order.status]: order.createdAt || new Date().toISOString() }
    this.data.orders[order.id] = order; await this.save(); return order
  }
  async transitionOrder(id, next, reason='') {
    const order = this.getOrder(id); if (!order) throw new Error('Order not found')
    assertTransition(order.status, next)
    if (order.status === next) return order
    const at = new Date().toISOString(); order.status = next; order.statusHistory = [...(order.statusHistory || []), { status: next, at, reason }]; order.statusTimestamps = { ...(order.statusTimestamps || {}), [next]: at }; await this.save(); return order
  }
  async updateOrder(id, patch) { const order=this.getOrder(id); if(!order) throw new Error('Order not found'); Object.assign(order,patch); await this.save(); return order }
  hasProcessed(key) { return Boolean(this.data.processedPayments[key]) }
  async recordPayment(key,payment) { if(this.hasProcessed(key)) return false; this.data.processedPayments[key]=payment; await this.save(); return true }
  async recordError(id,error) { const order=this.getOrder(id); if(!order) throw new Error('Order not found'); order.lastError=error; order.errorHistory=[...(order.errorHistory||[]),error].slice(-10); await this.save(); return order }
  async clearError(id) { const order=this.getOrder(id); if(!order) return null; order.lastError=null; await this.save(); return order }
}
