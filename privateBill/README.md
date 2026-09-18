# Private Bill — Quest 12

## Integration, Testing & Final Polish

Quest 12 brings the complete Private Bill transaction flow together and prepares it for a final residency demonstration.

### Complete user journey

```text
Select NGN / GHS
      ↓
Enter fiat amount
      ↓
Calculate ZEC from live rates
      ↓
Enter recipient / bank details
      ↓
Review
      ↓
Create order
      ↓
Receive ZEC payment instructions
      ↓
ZEC detected & confirmed by the backend monitor
      ↓
Fiat payout
      ↓
Track progress
      ↓
Completed
```

The frontend never treats a browser-side timer or wallet “sent” message as proof of payment. Blockchain state is obtained through the backend payment monitor and persisted transaction state.

## Integrated modules

- Live NGN/GHS conversion using external market data
- Recipient and financial-provider selection with client + server validation
- Persistent order creation and status history
- Zebra / Zakura payment-monitor architecture
- ZEC detection, confirmation, underpayment, overpayment and expiry handling
- Fiat payout provider abstraction with mock sandbox provider
- Payout idempotency and retry handling
- Transaction tracking with backend-driven state
- Explicit cancellation handling
- Persisted error records and user-facing exception feedback
- Completion guard: only `FIAT_SENT → COMPLETED` can produce successful completion

## Reliability and failure handling

The final build covers:

| Scenario | Expected behaviour |
|---|---|
| Live exchange-rate failure | Quote unavailable; order creation is blocked |
| Invalid recipient | Server rejects the order with `INVALID_RECIPIENT` |
| Payment not detected | Order remains `AWAITING_ZEC`; retryable feedback is shown |
| Underpayment | `UNDERPAID`; no payout is started |
| Overpayment | `OVERPAID`; no payout is started |
| Expiry | `EXPIRED`; late funding does not silently complete the order |
| Zcash/network failure | `ZCASH_NETWORK_UNAVAILABLE`; persisted state is preserved |
| Payout failure | `PAYOUT_FAILED`; retry creates a controlled new attempt |
| Duplicate payout request | Request is rejected while processing / after terminal completion |
| Cancellation | `CANCELLED`; payout and completion are blocked |
| Invalid status transition | Backend rejects it through the status engine |

## Testing

Automated checks cover:

- status transition invariants
- full successful lifecycle
- payout success and failure
- payout retry/idempotency
- underpayment / overpayment / expiry
- persisted errors and error history
- cancellation safety
- invalid recipient validation
- exchange-rate conversion validation
- frontend integration markers and responsive layout checks
- live HTTP API integration using an isolated temporary database
- security hygiene checks for committed secrets/debug output

Run:

```bash
npm install
npm run check
npm test
npm run build
```

For the local demonstration:

```bash
npm run dev:full
```

Open the Vite URL shown by the dev server. The backend listens only on `127.0.0.1` by default.

## Zcash node architecture

```text
React + Vite
     ↓
Node backend
     ↓
Payment Monitor
   ↙       ↘
Zebra     Zakura
     ↓
Transaction Status Engine
     ↓
Payout Provider
     ↓
Transaction Tracker
```

The backend supports the existing Zebra/Zakura + Zallet setup and the configured `mainnet`, `testnet`, or `regtest` environment.

## Security

- No RPC cookies or credentials are committed.
- No payout-provider secrets are committed.
- No private keys or seed phrases are used by the application.
- `.env` and `.env.*` are ignored except for `.env.example`.
- Runtime order data and logs are excluded from Git.
- The backend binds to loopback by default for local development.
- Recipient information is not displayed unnecessarily in the tracking UI.

## Demo notes

The default payout provider is a controlled mock provider. It is intentionally not presented as a real banking integration. A production payout adapter must be implemented server-side with approved provider credentials and operational controls.

The ZEC payment monitor requires a reachable configured Zebra/Zakura node for real on-chain detection. Without a reachable node, the application preserves the transaction state and reports a retryable network error instead of fabricating a successful payment.
