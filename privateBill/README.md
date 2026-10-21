# Private Bill — Quest 06

## Build ZEC Payment Instructions

Quest 06 adds the ZEC funding stage after an order is created. The payment screen reads the selected `TransactionOrder` and shows the exact ZEC amount, order ID, current status, receiving address, expiration information and clear instructions for funding that specific transaction.

### Included
- Required ZEC amount sourced from the created order
- Transaction-specific order ID and status
- ZEC receiving address with copy-address functionality
- Recipient fiat amount and destination
- Order expiration information
- Step-by-step payment instructions
- Clear warning to verify the address and exact amount before sending
- Back navigation to the created-order screen
- Responsive payment UI
- No wallet connection or blockchain transaction is initiated

### Receiving address configuration

The UI reads `VITE_ZEC_RECEIVING_ADDRESS` when configured. A clearly marked demo fallback is included so the quest can be previewed without exposing a private key or requiring a wallet connection.

For production, the receiving/deposit address should be assigned securely by a backend to the specific order. The frontend must not contain private keys or generate custodial addresses from secrets.

Example environment configuration:

```text
VITE_ZEC_RECEIVING_ADDRESS=<configured-demo-or-testnet-address>
```

### Transaction binding

The payment screen is only available after an order has been created. It uses that order's `requiredZec`, `id`, `status`, `fiatAmount`, recipient destination and `expiresAt`, preventing the displayed payment amount from becoming detached from the transaction being funded.

### Scope

This quest implements payment instructions only. It does not detect blockchain payments, broadcast transactions, update the order after confirmation, or execute bank transfers. Those capabilities belong to subsequent transaction stages.
