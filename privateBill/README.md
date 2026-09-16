# Private Bill — Quest 10

## Transaction Tracking

Quest 10 adds the transaction tracking experience to the Private Bill flow. The tracker reads the persisted transaction state from the backend and does not simulate progress with a frontend timer.

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
Transaction Tracking UI
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
