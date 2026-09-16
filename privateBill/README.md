# Private Bill — Quest 08

## Build the Transaction Status Engine

Quest 08 adds an authoritative transaction lifecycle to Private Bill. The status is stored by the backend, valid transitions are enforced, every transition is timestamped, and the current status/history are exposed to the frontend.

## Core lifecycle

```text
CREATED
   ↓
AWAITING_ZEC
   ↓
ZEC_DETECTED
   ↓
CONFIRMING
   ↓
ZEC_CONFIRMED
   ↓
PAYOUT_PROCESSING
   ↓
FIAT_SENT
   ↓
COMPLETED
```

Exceptional states:

```text
EXPIRED
UNDERPAID
OVERPAID
PAYOUT_FAILED
CANCELLED
```

### Important Q7 → Q8 change

Q7 treated confirmed ZEC as `COMPLETED`. That is no longer correct for the full transaction lifecycle.

In Q8:

```text
ZEC_CONFIRMED ≠ COMPLETED
```

After ZEC is confirmed, the transaction must still pass through:

```text
PAYOUT_PROCESSING
→ FIAT_SENT
→ COMPLETED
```

This keeps blockchain settlement separate from fiat payout settlement.

## 1. Status engine

The canonical status definitions live in:

```text
src/status-engine.mjs
src/status-engine.ts
```

The backend uses `status-engine.mjs` as the authority.

It defines:

- all supported statuses
- valid transitions
- `canTransition(from, to)`
- `assertValidTransition(from, to)`

Invalid transitions are rejected.

Examples:

```text
CREATED → AWAITING_ZEC       valid
AWAITING_ZEC → ZEC_DETECTED  valid
CONFIRMING → ZEC_CONFIRMED   valid
ZEC_CONFIRMED → PAYOUT_PROCESSING  valid
FIAT_SENT → COMPLETED        valid
CREATED → COMPLETED          invalid
ZEC_CONFIRMED → COMPLETED    invalid
FIAT_SENT → PAYOUT_PROCESSING invalid
COMPLETED → AWAITING_ZEC     invalid
```

## 2. Stored transaction state

`src/store.mjs` now persists:

```json
{
  "status": "CONFIRMING",
  "statusHistory": [
    {
      "from": "AWAITING_ZEC",
      "to": "ZEC_DETECTED",
      "at": "2026-09-16T12:00:00.000Z",
      "reason": "On-chain ZEC payment detected"
    },
    {
      "from": "ZEC_DETECTED",
      "to": "CONFIRMING",
      "at": "2026-09-16T12:00:05.000Z",
      "reason": "Required ZEC received; waiting for 3 confirmations"
    }
  ],
  "statusTimestamps": {
    "CREATED": "2026-09-16T11:59:00.000Z",
    "AWAITING_ZEC": "2026-09-16T11:59:01.000Z",
    "ZEC_DETECTED": "2026-09-16T12:00:00.000Z",
    "CONFIRMING": "2026-09-16T12:00:05.000Z"
  }
}
```

The history is append-only through the transition function. The backend cannot jump directly to an unrelated status.

## 3. Order creation

A new order is deliberately created as:

```text
CREATED
```

The backend then performs the explicit transition:

```text
CREATED → AWAITING_ZEC
```

This records both stages and their timestamps.

The browser does not decide the authoritative initial status.

## 4. Payment monitor integration

Q7's real Zcash payment detection remains in place.

The monitor now maps blockchain observations into Q8 lifecycle states:

```text
No payment
    → AWAITING_ZEC

Payment detected but insufficient amount
    → UNDERPAID

Required amount received but confirmations incomplete
    → CONFIRMING

Required amount has enough confirmations
    → ZEC_CONFIRMED

Received amount exceeds required amount
    → OVERPAID

No payment and order expired
    → EXPIRED
```

The monitor intentionally stops at `ZEC_CONFIRMED`.

It does not invent a fiat payout.

`PAYOUT_PROCESSING`, `FIAT_SENT`, and `COMPLETED` are reserved for the payout workflow implemented by later quests or an authorized backend process.

## 5. API

### Get transaction status

```http
GET /api/orders/:orderId/status
```

Response:

```json
{
  "id": "PB-...",
  "status": "CONFIRMING",
  "statusHistory": [],
  "statusTimestamps": {}
}
```

### Transition transaction status

```http
POST /api/orders/:orderId/status
Content-Type: application/json

{
  "status": "PAYOUT_PROCESSING",
  "reason": "Fiat payout worker accepted the transaction"
}
```

The backend checks the transition before changing the stored status.

For example:

```text
ZEC_CONFIRMED → PAYOUT_PROCESSING
```

is accepted.

But:

```text
ZEC_CONFIRMED → COMPLETED
```

is rejected.

> Quest/demo note: this endpoint is intentionally simple. A production system must authenticate and authorize status-changing actors; the browser must not be allowed to arbitrarily mark a transaction as paid.

### Payment monitor

```http
GET /api/payment-monitor/:orderId
```

The response now includes:

- current lifecycle status
- detected payment
- confirmation data
- network
- selected node
- status history
- status timestamps

## 6. Frontend

The frontend consumes the backend status and displays the lifecycle timeline:

```text
Created
   ✓
Awaiting ZEC
   ✓
ZEC detected
   ✓
Confirming
   ●
ZEC confirmed
   ○
Payout processing
   ○
Fiat sent
   ○
Completed
```

The browser synchronizes its local order representation with the backend response.

The UI does not treat a wallet "sent" button as proof of payment.

## 7. Q7 node architecture remains intact

Quest 08 does not remove the Q7 v3 node layer:

```text
Private Bill
    │
    ▼
Transaction Status Engine
    │
    ▼
Payment Monitor
    │
    ▼
Node Manager
   / \
Zebra Zakura
```

Q7 supports:

- Regtest
- Testnet
- Mainnet
- Zebra
- Zakura
- automatic node fallback
- transparent-address payment detection
- confirmation tracking
- payment idempotency

The Q7 limitation remains: payment detection is currently transparent-address based. This is not a complete Sapling/Orchard shielded payment processor.

## 8. Tests

Run:

```bash
npm install
npm run check
npm test
npm run build
```

The Q8 test suite verifies:

1. all transaction statuses exist
2. core lifecycle transitions are valid
3. invalid jumps are rejected
4. payment state calculation
5. underpayment / overpayment / expiration
6. status persistence
7. status timestamps
8. invalid persisted transitions are rejected

## 9. Manual API lifecycle test

Start:

```bash
npm run server
```

Create an order through the UI or API.

Then inspect:

```bash
curl -s http://127.0.0.1:8787/api/orders/PB-YOUR-ID/status | jq
```

After ZEC is detected and sufficiently confirmed, the expected state is:

```text
ZEC_CONFIRMED
```

not `COMPLETED`.

Then, for quest testing only, advance through the remaining lifecycle:

```bash
curl -s -X POST \
  http://127.0.0.1:8787/api/orders/PB-YOUR-ID/status \
  -H 'content-type: application/json' \
  -d '{"status":"PAYOUT_PROCESSING","reason":"Payout worker started"}' | jq
```

Then:

```bash
curl -s -X POST \
  http://127.0.0.1:8787/api/orders/PB-YOUR-ID/status \
  -H 'content-type: application/json' \
  -d '{"status":"FIAT_SENT","reason":"Fiat payout sent"}' | jq
```

Finally:

```bash
curl -s -X POST \
  http://127.0.0.1:8787/api/orders/PB-YOUR-ID/status \
  -H 'content-type: application/json' \
  -d '{"status":"COMPLETED","reason":"Transaction lifecycle completed"}' | jq
```

Do not use these demo transitions to claim that a real fiat payout occurred.

## 10. Data safety

Do not commit:

```text
.env
.env.*
data/*.json
RPC cookies
RPC passwords
seed phrases
private keys
wallet files
real customer banking information
```

The repository keeps:

```text
data/.gitkeep
```

but runtime `private-bill.json` remains ignored.

## 11. Branch

Use exactly:

```text
quest/08-your-github-username
```

For this repository:

```text
quest/08-0xweb3devrel
```

## 12. Suggested commit

```text
feat(private-bill): build transaction status engine
```

## 13. PR summary

Implemented the Private Bill transaction status engine with:

- authoritative persisted transaction status
- explicit valid transition rules
- invalid transition protection
- transition timestamps and history
- backend status API
- frontend status synchronization
- lifecycle timeline
- Q7 payment-monitor integration
- separation between `ZEC_CONFIRMED` and final `COMPLETED`
- underpaid, overpaid, expired, cancelled and payout-failed states
- automated transition/state tests

### Scope statement

This quest implements transaction lifecycle state management. It does not implement the actual fiat payout rail. `PAYOUT_PROCESSING`, `FIAT_SENT`, and `COMPLETED` are lifecycle states prepared for the payout workflow.
