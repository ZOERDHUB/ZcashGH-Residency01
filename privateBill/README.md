# Private Bill — Quest 05

## Create Transaction Orders

Quest 05 adds the order-management foundation to Private Bill. After the user confirms the transaction review, the application creates a persistent transaction order that can be identified and retrieved by the next payment stage.

### Included
- Unique order identifier (`PB-...`)
- Fiat currency and recipient amount
- Required ZEC amount from the live conversion quote
- Recipient payment information including provider, provider code, account number, account name, country and currency
- Initial transaction status: `AWAITING_ZEC`
- Creation timestamp
- 30-minute expiration timestamp
- Persistent order storage for the demo using browser `localStorage`
- Order retrieval helpers in `src/orders.ts`
- Final order-created screen with order ID and status
- Masked account number in the order UI
- Existing Quest 02–04 functionality preserved

### Order model

```text
TransactionOrder
├── id
├── fiatCurrency
├── fiatAmount
├── requiredZec
├── recipient
│   ├── providerName
│   ├── providerCode
│   ├── providerType
│   ├── accountNumber
│   ├── accountName
│   ├── country
│   └── currency
├── status
├── createdAt
└── expiresAt
```

New orders begin in `AWAITING_ZEC`.

### Persistence and production note

For this frontend quest foundation, orders are persisted in browser `localStorage` so the next stage can retrieve an order by ID after creation. This is suitable for a local/demo implementation only. A production deployment should move order persistence to a secure backend/database, avoid storing sensitive recipient data in browser storage, and enforce server-side authorization, status transitions, expiration and audit controls.

No real bank transfer or ZEC transaction is executed by this quest.
