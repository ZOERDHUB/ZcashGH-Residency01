# Private Bill — Quest 11

## Transaction Errors & Exceptions

Quest 11 adds the transaction error and exception handling experience to the Private Bill flow. The tracker reads the persisted transaction state from the backend and does not simulate progress with a frontend timer.

## Tracking lifecycle

```text
Waiting for ZEC
    ↓
Payment Detected
    ↓
Confirming
    ↓
ZEC Confirmed
    ↓
Processing Payout
    ↓
Fiat Sent
    ↓
Completed
```

The underlying statuses are the Q8/Q9 transaction states:

```text
AWAITING_ZEC → ZEC_DETECTED → CONFIRMING → ZEC_CONFIRMED
             → PAYOUT_PROCESSING → FIAT_SENT → COMPLETED
```

Exceptional states such as `EXPIRED`, `UNDERPAID`, `OVERPAID`, `PAYOUT_FAILED`, and `CANCELLED` are displayed as exception states rather than being hidden or converted into a fake progress step.

## Actual backend state

The frontend calls:

```http
GET /api/orders/:orderId/status
```

The response includes:

- transaction/order ID
- current status
- status history
- status timestamps

While the tracking page is open, it refreshes every 5 seconds. The refresh also invokes the existing backend payment monitor so newly detected or confirmed ZEC can update the real transaction state.

The frontend only renders the state returned by the backend. It does not advance statuses based on elapsed time.

## Transaction summary

The tracker displays:

- Order ID
- fiat amount and currency
- required ZEC
- recipient name
- destination country/currency
- detected ZEC payment details when available
- payout status/reference when available
- timestamps for completed lifecycle stages

## Exception handling

| Scenario | Handling | Completion safety |
|---|---|---|
| Underpayment | Marks `UNDERPAID`, explains the shortfall, allows additional funding | Cannot enter payout from the exception state |
| Overpayment | Marks `OVERPAID` and blocks payout until resolved | Never auto-completes or auto-pays |
| Expired transaction | Marks `EXPIRED`; late funding is not silently accepted | Terminal exception state |
| Payment not detected | Shows a retryable message while remaining `AWAITING_ZEC` | No client-side success assumption |
| Exchange-rate failure | Blocks order creation until a live quote is available | No order is created from a failed quote |
| Zcash/network failure | Returns a retryable `ZCASH_NETWORK_UNAVAILABLE` error without advancing state | Existing transaction state is preserved |
| Invalid recipient | Validates recipient details server-side and returns `INVALID_RECIPIENT` | Payout does not start |
| Payout failure | Records provider error and moves to `PAYOUT_FAILED` | Cannot become `COMPLETED` from failure |
| Duplicate processing | Rejects concurrent/already-processing payout attempts | Prevents a second payout attempt |
| Cancelled transaction | Records `CANCELLED` and blocks payout | Cancelled orders cannot complete |

Error records are persisted as `lastError` plus a bounded `errorHistory`, while transient node failures are returned without changing the transaction status.

## Architecture

```text
Zebra / Zakura
      ↓
Payment Monitor
      ↓
Transaction Status Engine
      ↓
/api/orders/:orderId/status
      ↓
Transaction Errors & Exceptions UI
```

The tracking layer is implemented in `src/tracking.ts`. It provides the backend status fetcher and maps the persisted lifecycle into visual tracking stages.

## Running

```bash
npm install
npm run check
npm test
npm run build
```

Start the frontend and backend with:

```bash
npm run dev:full
```

## Security

No RPC credentials, payout credentials, cookies, private keys, or provider secrets are exposed in the frontend or committed to GitHub.
