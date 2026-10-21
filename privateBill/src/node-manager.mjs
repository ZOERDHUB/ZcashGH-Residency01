import { getNodeConfig } from './node-config.mjs'
import { ZebraAdapter } from './adapters/zebra.mjs'
import { ZakuraAdapter } from './adapters/zakura.mjs'

export function createNodeManager() {
  const cfg = getNodeConfig()
  const adapters = {
    zebra: new ZebraAdapter(cfg.zebra),
    zakura: new ZakuraAdapter(cfg.zakura)
  }

  // 'auto' tries Zebra first and falls back to Zakura.
  // A fixed preference ('zebra' or 'zakura') is pinned to that node only —
  // it must not silently fall back to a node the operator did not select.
  const order = cfg.preference === 'auto'
    ? ['zebra', 'zakura']
    : [cfg.preference]

  return {
    network: cfg.network,
    preference: cfg.preference,
    adapters,
    async select() {
      const errors = []
      for (const name of order) {
        try {
          await adapters[name].health()
          return { name, adapter: adapters[name], errors }
        } catch (error) {
          errors.push({ node: name, error: error instanceof Error ? error.message : String(error) })
        }
      }
      const error = new Error(`No healthy ${cfg.network} Zcash node available`)
      error.details = errors
      throw error
    },
    async findPayments(address) {
      const errors = []
      for (const name of order) {
        try {
          const adapter = adapters[name]
          await adapter.health()
          const payments = await adapter.findPayments(address)
          return { name, payments, errors }
        } catch (error) {
          errors.push({ node: name, error: error instanceof Error ? error.message : String(error) })
        }
      }
      const error = new Error(`No ${cfg.network} Zcash node could scan the deposit address`)
      error.details = errors
      throw error
    }
  }
}
