# Private Bill — Quest 12 · Integration, Testing & Final Polish

Private Bill is a privacy-first Zcash-to-fiat transaction flow for NGN and GHS. Quest 12 integrates the residency work into one demonstrable lifecycle and adds final validation, state tracking, exception handling, and a controlled sandbox payout.

## Complete flow

```text
NGN / GHS
  ↓
Fiat amount
  ↓
Live ZEC conversion
  ↓
Recipient bank / fintech details
  ↓
Review
  ↓
Create order
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

Exceptional states are handled as well: `EXPIRED`, `UNDERPAID`, `OVERPAID`, `PAYOUT_FAILED`, and `CANCELLED`.

## What Quest 12 integrates

- Live NGN/GHS → ZEC conversion from the earlier conversion layer.
- Recipient selection covering Nigerian and Ghanaian providers, including banks and fintech/mobile-money entries in the existing provider catalogue.
- Review and order creation.
- Persistent server-side order state and timestamps.
- Real payment monitoring through the existing Zebra/Zakura adapter architecture.
- ZEC payment detection, amount accounting, confirmation tracking and idempotency.
- Provider-independent fiat payout service.
- Controlled `private-bill-sandbox` payout provider for demonstration/testing.
- Backend transaction tracking endpoint consumed by the frontend.
- Error and exception persistence with `lastError` / `errorHistory`.
- Retry-safe payout handling and duplicate-processing protection.
- Responsive tracking UI for desktop and mobile.

## Transaction state machine

The backend owns the state machine. The browser cannot mark an order completed.

```text
CREATED → AWAITING_ZEC → ZEC_DETECTED → CONFIRMING → ZEC_CONFIRMED
                                                     ↓
                                             PAYOUT_PROCESSING
                                                     ↓
                                                FIAT_SENT
                                                     ↓
                                                 COMPLETED
```

Invalid transitions such as `ZEC_CONFIRMED → COMPLETED` are rejected. Fiat completion requires the payout path.

## Nodes

The payment layer remains compatible with the residency's node architecture:

- Zebra
- Zakurad / Zakura-compatible RPC
- network selection through the existing node configuration
- transparent-address payment detection in the current implementation

The application does not treat a wallet's local “sent” confirmation as proof of payment. The backend monitor must observe the payment through the configured Zcash node layer.

## Payout provider

Quest 12 uses `private-bill-sandbox` by default. This is deliberate: no production payout credentials are embedded in the frontend or repository.

To exercise the failure path locally:

```bash
PRIVATE_BILL_PAYOUT_MODE=fail npm run server
```

A normal run uses the successful sandbox response and records a provider/reference ID.

## Environment

Copy the example file:

```bash
cp .env.example .env
```

Never commit `.env` or real RPC credentials.

Important variables include:

```text
PRIVATE_BILL_NETWORK=testnet
ZCASH_REQUIRED_CONFIRMATIONS=3
PRIVATE_BILL_DB=./data/private-bill.json
PRIVATE_BILL_PAYOUT_MODE=success
VITE_ZEC_RECEIVING_ADDRESS=...
```

Use the existing Zebra/Zakurad node configuration for the selected network. Do not put RPC cookies, passwords, wallet credentials, seeds, private keys or API secrets in frontend code.

## Development

```bash
npm install
npm run check
npm test
npm run build
npm run server
```

Frontend:

```bash
npm run dev
```

Full local development:

```bash
npm run dev:full
```

## Automated verification

`npm test` covers:

- payment-state classification
- underpayment / overpayment / expiration
- valid lifecycle transitions
- invalid transition rejection
- completion safety
- persistent status timestamps
- payout provider success
- error persistence

## Demonstration checklist

1. Select NGN or GHS.
2. Enter the fiat amount and wait for the live ZEC quote.
3. Select a recipient provider and enter account details.
4. Review the transaction.
5. Create the order.
6. Copy the ZEC receiving address.
7. Send the required ZEC from the configured test wallet/node environment.
8. Watch the backend move through detection and confirmations.
9. Reach `ZEC_CONFIRMED`.
10. Run the sandbox payout.
11. Verify `PAYOUT_PROCESSING → FIAT_SENT → COMPLETED`.
12. Open the tracking view and verify timestamps and order ID.

## Failure-path checklist

Test at least:

- insufficient ZEC → `UNDERPAID`
- excess ZEC → `OVERPAID`
- no payment → `AWAITING_ZEC`
- expired order → `EXPIRED`
- payout provider failure → `PAYOUT_FAILED`
- payout retry → `PAYOUT_PROCESSING`
- cancellation before confirmation → `CANCELLED`
- invalid recipient → order creation rejected
- unavailable Zcash node → retryable backend error

## Security

No seed phrase, private key, wallet credential or payout secret is required by the frontend. Production payout credentials belong exclusively in server-side infrastructure and should be injected through the deployment environment.

## Quest

Branch:

```text
quest/12-0xweb3devrel
```

This branch is the final integration and polish submission for the Private Bill residency sequence.
