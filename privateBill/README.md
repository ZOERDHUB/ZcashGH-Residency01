# Private Bill — Quest 09

## Fiat Payout Layer

Quest 09 adds a provider-independent fiat payout layer to the Private Bill transaction lifecycle.

The application now keeps internal transaction logic separate from the external payout provider. Until a production payout provider is approved/configured, the backend uses a controlled mock provider for NGN/GHS sandbox testing.

## Lifecycle

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

Exceptional states remain available:

- EXPIRED
- UNDERPAID
- OVERPAID
- PAYOUT_FAILED
- CANCELLED

## Payout architecture

```text
                    Transaction Order
                           |
                     ZEC_CONFIRMED
                           |
                    Payout Service
                           |
                 +---------+---------+
                 |                   |
            Provider API        Mock Provider
                 |                   |
                 +---------+---------+
                           |
                    Payout Result
                           |
             provider/reference ID
                           |
               FIAT_SENT / FAILED
```

The application calls the provider through `src/payout-service.mjs`. The transaction/order layer does not depend on a specific bank, mobile-money operator, or payment API.

## Provider interface

The provider contract is:

```js
sendPayout({ orderId, currency, amount, recipient })
```

The current implementation is `MockPayoutProvider`.

Supported currencies:

- NGN
- GHS

The mock provider returns a provider name and unique provider reference. It can also be switched into deterministic failure mode for testing.

## Configuration

Copy `.env.example` to `.env` and keep secrets local.

```env
PAYOUT_PROVIDER=mock
MOCK_PAYOUT_MODE=success
```

Use:

```env
MOCK_PAYOUT_MODE=success
```

to test successful payouts, or:

```env
MOCK_PAYOUT_MODE=failed
```

to test `PAYOUT_FAILED`.

No production API key is required for the mock provider.

## API

### Get payout state

```http
GET /api/orders/:orderId/payout
```

### Start or retry payout

```http
POST /api/orders/:orderId/payout
```

A payout can only start when the transaction is:

```text
ZEC_CONFIRMED
```

A failed payout can be retried from:

```text
PAYOUT_FAILED
```

The backend transitions the transaction through:

```text
ZEC_CONFIRMED
→ PAYOUT_PROCESSING
→ FIAT_SENT
→ COMPLETED
```

or, on provider failure:

```text
PAYOUT_PROCESSING
→ PAYOUT_FAILED
```

## Payout attempts

Each attempt records:

- internal attempt ID
- provider
- provider reference when available
- processing status
- requested/completed timestamps
- recipient snapshot
- error information on failure

Repeated recording of the same attempt ID is idempotent.

## Recipient handling

The payout service uses the recipient details already attached to the transaction:

- provider name/code
- provider type
- account number
- account name
- country
- currency

The frontend never receives or stores provider credentials.

## Security

Never commit:

- API keys
- provider secrets
- RPC credentials
- RPC cookies
- private keys
- seed phrases
- wallet files

`.env` is ignored by Git. Only `.env.example` is committed.

## Local test

```bash
npm install
npm run check
npm test
npm run build
```

Start the backend:

```bash
npm run server
```

With `MOCK_PAYOUT_MODE=success`, create/fund an order until it reaches `ZEC_CONFIRMED`, then call:

```bash
curl -X POST http://127.0.0.1:8787/api/orders/PB-YOUR-ORDER-ID/payout
```

For failure testing, set:

```env
MOCK_PAYOUT_MODE=failed
```

restart the backend and retry the payout. The order should enter `PAYOUT_FAILED`, with the failed attempt persisted.

## Scope

This quest implements the payout abstraction and controlled mock/sandbox flow. It does **not** claim to send real NGN/GHS through a production bank or mobile-money provider. A production provider must be approved and integrated behind the same provider interface before real fiat payouts are enabled.
