import fs from 'node:fs/promises'
import path from 'node:path'

export class JsonStore {
  constructor(file) { this.file = path.resolve(file); this.data = { orders: {}, processedPayments: {} } }
  async init() {
    await fs.mkdir(path.dirname(this.file), { recursive: true })
    try { this.data = JSON.parse(await fs.readFile(this.file, 'utf8')) } catch { await this.save() }
  }
  async save() { await fs.writeFile(this.file, JSON.stringify(this.data, null, 2)) }
  getOrder(id) { return this.data.orders[id] ?? null }
  listOrders() { return Object.values(this.data.orders) }
  async createOrder(order) { if (this.getOrder(order.id)) throw new Error('Order already exists'); this.data.orders[order.id] = order; await this.save(); return order }
  async updateOrder(id, patch) { const order = this.getOrder(id); if (!order) throw new Error('Order not found'); Object.assign(order, patch); await this.save(); return order }
  hasProcessed(key) { return Boolean(this.data.processedPayments[key]) }
  async recordPayment(key, payment) { if (this.hasProcessed(key)) return false; this.data.processedPayments[key] = payment; await this.save(); return true }
}
