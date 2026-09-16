import type { TransactionOrder } from './orders'
export type PaymentState = 'AWAITING_ZEC'|'ZEC_DETECTED'|'CONFIRMING'|'ZEC_CONFIRMED'|'UNDERPAID'|'OVERPAID'|'EXPIRED'
export type NodeName='zebra'|'zakura'; export type NetworkName='mainnet'|'testnet'|'regtest'
export type DetectedPayment={txid:string;amountZec:number;confirmations:number;requiredConfirmations:number;detectedAt?:string;address:string;blockHeight?:number|null}
export type PaymentCheck={state:PaymentState;payment:DetectedPayment|null;checkedAt:string;source:NodeName|'unavailable';network:NetworkName;error?:string;errorCode?:string;retryable?:boolean;nodeErrors?:Array<{node:string;error:string}>}
export interface PaymentMonitor{check(order:TransactionOrder):Promise<PaymentCheck>}
export class BackendPaymentMonitor implements PaymentMonitor {
  constructor(private readonly baseUrl=import.meta.env.VITE_PAYMENT_MONITOR_URL||'/api/payment-monitor'){}
  async check(order:TransactionOrder):Promise<PaymentCheck>{
    const r=await fetch(`${this.baseUrl.replace(/\/$/,'')}/${encodeURIComponent(order.id)}`,{headers:{Accept:'application/json'},cache:'no-store'})
    const d=await r.json() as Partial<PaymentCheck>
    if(!r.ok&&r.status!==503) throw new Error(d.error||`Payment monitor returned ${r.status}`)
    const state=d.state as PaymentState
    const source:NodeName|'unavailable'=d.source==='zebra'||d.source==='zakura'?d.source:'unavailable'
    const network:NetworkName=d.network==='mainnet'||d.network==='regtest'||d.network==='testnet'?d.network:'testnet'
    return {state,payment:d.payment??null,checkedAt:d.checkedAt??new Date().toISOString(),source,network,error:d.error,errorCode:d.errorCode,retryable:d.retryable,nodeErrors:d.nodeErrors}
  }
}
export function paymentStatusLabel(state:PaymentState|TransactionOrder['status']){const labels:Record<string,string>={AWAITING_ZEC:'Waiting for ZEC',ZEC_DETECTED:'Payment detected',CONFIRMING:'Confirming',ZEC_CONFIRMED:'ZEC confirmed',UNDERPAID:'Underpaid',OVERPAID:'Overpaid',EXPIRED:'Transaction expired',PAYOUT_PROCESSING:'Processing payout',FIAT_SENT:'Fiat sent',COMPLETED:'Completed',PAYOUT_FAILED:'Payout failed',CANCELLED:'Cancelled'};return labels[state]||'Transaction status'}
