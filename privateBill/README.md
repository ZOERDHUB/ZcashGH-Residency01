# Private Bill — Quest 07 v3

## Multi-network / Multi-node Zcash payment detection

Q7 v3 replaces the Q7 v2 `zcashd`-oriented monitor with a **node-adapter architecture**.

The Private Bill business logic does not depend directly on Zebra or Zakura. A common adapter contract normalizes blockchain observations into payment records, while the monitor handles order matching, amount accounting, confirmations, idempotency, expiration, and status transitions.

## Scope of this quest version

### Networks

- **Regtest** — local, instant blocks, no real funds
- **Testnet** — public Zcash test network, TAZ only
- **Mainnet** — real ZEC

### Node implementations

- **Zebra** — primary/current consensus node path
- **Zakura** — alternative node with `zcashd`-compatible RPC mode
- **auto** — Zebra first, Zakura fallback

### Payment detection

The current quest implementation detects **transparent-address payments**.

It is intentionally **not** a complete Sapling/Orchard shielded payment processor. Do not describe it as such in the PR.

For Zebra, the quest adapter scans recent blocks and matches transparent `vout` addresses. For Zakura, the adapter uses the compatibility RPC `getaddresstxids` and `getrawtransaction`.

For a production payment processor, add a dedicated address indexer such as **Zaino** / CompactTxStreamer and implement shielded note detection where required.

---

# 1. Architecture

```text
                         PRIVATE BILL
                              |
                       Payment Monitor
                              |
                        Node Manager
                              |
                  +-----------+-----------+
                  |                       |
                Zebra                  Zakura
                  |                       |
                  +-----------+-----------+
                              |
                       Normalized Payment
                              |
                  +-----------+-----------+
                  |                       |
             Order matching          Idempotency
                  |                       |
                  +-----------+-----------+
                              |
                       Payment State
```

The node layer is replaceable. Private Bill does not trust a frontend button or wallet UI as proof of payment.

## Status model

```text
AWAITING_ZEC
     |
     v
PAYMENT_DETECTED  (payment exists but has 0 confirmations)
     |
     v
CONFIRMING        (payment exists, but the required amount is not yet fully confirmed)
     |
     v
CONFIRMED         (required amount has enough confirmations)
     |
     v
COMPLETED         (order status after confirmed funding)
```

Other states:

- `PAYMENT_UNDERPAID` — received amount is below the order requirement
- `EXPIRED` — no payment received before order expiration

The backend only records a payment when the selected node reports it.

---

# 2. WSL Ubuntu prerequisites

You said your development environment is **WSL2 + Ubuntu**. Run the following inside Ubuntu, not PowerShell.

```bash
sudo apt update
sudo apt install -y git curl jq openssl ca-certificates

node --version
docker --version
docker compose version
git --version
```

Recommended:

- Node.js 20+
- Docker Engine / Docker Desktop with WSL integration
- Docker Compose v2.24.4+
- SSD storage
- 16 GB RAM recommended if Mainnet + other services are running together

Z3 currently documents approximately **300 GB** for Mainnet chain data and approximately **30 GB** for Testnet. Initial sync is expected to take hours, with Mainnet commonly taking 24–72 hours depending on hardware and network conditions.

---

# 3. Z3: Zebra + Zallet environment

Z3 is the reproducible Docker environment for the current Zcash stack. It runs independent Compose projects for Mainnet, Testnet and Regtest, so all three can coexist on the same host with isolated ports and volumes.

Clone it once:

```bash
cd ~
git clone https://github.com/ZcashFoundation/z3.git
cd z3
```

## 3.1 Regtest — FIRST

Do this before Testnet or Mainnet.

```bash
./scripts/regtest-init.sh
docker compose --env-file .env.regtest up -d
```

Current Z3 Regtest endpoints include:

```text
Zebra RPC:   http://127.0.0.1:29232
Zallet RPC:  http://127.0.0.1:50232
RPC router:  http://127.0.0.1:8181
```

Z3 initializes the Regtest environment, the wallet, activation blocks, and initial mining during `regtest-init.sh`.

Check Zebra:

```bash
curl -s -X POST \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getblockchaininfo","params":[],"id":1}' \
  http://127.0.0.1:29232 | jq
```

The Z3 Regtest environment uses username/password RPC rather than cookie authentication. Its documented credentials are `zebra` / `zebra` for Regtest.

---

# 4. Testnet Zebra

Testnet is the first real blockchain test for Private Bill.

```bash
cd ~/z3
./scripts/setup-network.sh testnet

docker compose --env-file .env.testnet up -d zebra
./scripts/check-zebra-readiness.sh 18080
```

Only after Zebra is ready:

```bash
docker compose --env-file .env.testnet up -d
```

Zebra's host RPC is:

```text
http://127.0.0.1:18232
```

Mainnet and Testnet use cookie authentication in Z3.

Check the node:

```bash
curl -s -X POST \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getblockchaininfo","params":[],"id":1}' \
  http://127.0.0.1:18232 | jq
```

For a host-side Private Bill process, the RPC cookie must be made readable by that process, or the backend must run as a container attached to the Z3 network with the cookie volume mounted read-only. **Do not copy a permanent RPC password into Git.**

---

# 5. Mainnet Zebra

Do this only after the Regtest and Testnet flows pass.

```bash
cd ~/z3
./scripts/setup-network.sh mainnet

docker compose --env-file .env.mainnet up -d zebra
./scripts/check-zebra-readiness.sh
```

Wait for the node to finish synchronization. Then:

```bash
docker compose --env-file .env.mainnet up -d
```

Mainnet Zebra RPC:

```text
http://127.0.0.1:8232
```

Do not send real ZEC yet. First verify the node is synchronized and Private Bill can read it. Z3 explicitly recommends the two-phase Zebra-first boot on Mainnet because wallet services should wait for the node to synchronize.

---

# 6. Running Mainnet + Testnet + Regtest simultaneously

This is supported by Z3.

```bash
# Terminal 1
cd ~/z3
docker compose --env-file .env.mainnet up -d

# Terminal 2
cd ~/z3
docker compose --env-file .env.testnet up -d

# Terminal 3
cd ~/z3
docker compose --env-file .env.regtest up -d
```

The three environments use separate Compose projects, containers, networks, volumes and host ports.

The important distinction is that **one Private Bill backend process still has one active network configuration**. If you want Mainnet and Testnet payment monitors simultaneously, run two Private Bill backend processes with different `.env` files and different ports/databases.

Example:

```text
Private Bill backend A
  network = testnet
  port    = 8787
  db      = data/private-bill-testnet.json

Private Bill backend B
  network = mainnet
  port    = 8788
  db      = data/private-bill-mainnet.json
```

Do not share the same order database between networks.

---

# 7. Zakura

Zakura is supported as the second node adapter. Its project documents a compatibility mode that reproduces the legacy `zcashd` RPC interface so existing integrations can continue to work.

If Zakura is installed directly in WSL, configure its RPC listener according to your installed version and verify it first:

```bash
curl -s -X POST \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getblockchaininfo","params":[],"id":1}' \
  http://127.0.0.1:18232 | jq
```

For Mainnet use the configured Mainnet RPC port, normally `8232`.

Do **not** assume that a Zakura installation and a Z3 Zebra instance can both bind the same host port. If both run on the same network, assign different RPC ports.

---

# 8. Install Private Bill Q7 v3

From the project directory:

```bash
cd ~/private-bill
npm install
```

The existing Q6/Q7 React application is preserved. Q7 v3 adds:

```text
src/adapters/zebra.mjs
src/adapters/zakura.mjs
src/node-config.mjs
src/node-manager.mjs
src/rpc.mjs
src/payment-monitor.mjs
src/store.mjs
server.mjs
```

Create your local configuration:

```bash
cp .env.example .env
```

Never commit `.env`.

---

# 9. Configuration examples

## Testnet + Zebra

```env
PRIVATE_BILL_NETWORK=testnet
PRIVATE_BILL_NODE=zebra
ZEBRA_TESTNET_RPC_URL=http://127.0.0.1:18232
```

## Testnet + Zakura

```env
PRIVATE_BILL_NETWORK=testnet
PRIVATE_BILL_NODE=zakura
ZAKURA_TESTNET_RPC_URL=http://127.0.0.1:18232
```

## Mainnet + Zebra

```env
PRIVATE_BILL_NETWORK=mainnet
PRIVATE_BILL_NODE=zebra
ZEBRA_MAINNET_RPC_URL=http://127.0.0.1:8232
```

## Mainnet + Zakura

```env
PRIVATE_BILL_NETWORK=mainnet
PRIVATE_BILL_NODE=zakura
ZAKURA_MAINNET_RPC_URL=http://127.0.0.1:8232
```

## Automatic fallback

```env
PRIVATE_BILL_NODE=auto
```

The manager tries:

```text
Zebra -> Zakura
```

If Zebra is unavailable or cannot scan the address, Zakura is attempted.

---

# 10. Start the backend

Validate all server modules:

```bash
npm run check
```

Start:

```bash
npm run server
```

Expected:

```text
Private Bill Q7 v3 backend listening on http://127.0.0.1:8787
```

In another WSL terminal:

```bash
curl -s http://127.0.0.1:8787/api/config | jq
curl -s http://127.0.0.1:8787/api/health | jq
```

A healthy Testnet Zebra configuration should report approximately:

```json
{
  "ok": true,
  "network": "testnet",
  "selectedNode": "zebra"
}
```

---

# 11. Real Regtest payment test

Use Regtest before spending testnet funds.

1. Start Z3 Regtest.
2. Obtain a transparent Regtest address from the Zallet wallet.
3. Configure Private Bill:

```env
PRIVATE_BILL_NETWORK=regtest
PRIVATE_BILL_NODE=zebra
ZEBRA_REGTEST_RPC_URL=http://127.0.0.1:29232
ZEBRA_RPC_USER=zebra
ZEBRA_RPC_PASSWORD=zebra
```

4. Start the backend.
5. Create an order through the UI or API.
6. Send a Regtest payment to the order address.
7. Mine blocks.
8. Check the monitor.

Example order API:

```bash
curl -s -X POST http://127.0.0.1:8787/api/orders \
  -H 'content-type: application/json' \
  -d '{
    "id":"PB-REGTEST-001",
    "fiatCurrency":"NGN",
    "fiatAmount":10000,
    "requiredZec":0.01,
    "recipient":{
      "providerName":"Demo Bank",
      "providerCode":"DEMO",
      "providerType":"payment_provider",
      "accountNumber":"1234567890",
      "accountName":"Test User",
      "country":"Nigeria",
      "currency":"NGN"
    },
    "depositAddress":"REPLACE_WITH_REAL_REGTEST_TRANSPARENT_ADDRESS"
  }' | jq
```

Then:

```bash
curl -s http://127.0.0.1:8787/api/payment-monitor/PB-REGTEST-001 | jq
```

The UI/backend must not mark the order funded because the user merely clicked a wallet button.

---

# 12. Real Testnet transaction

After Regtest passes:

1. Start Testnet Zebra or Zakura.
2. Wait for synchronization.
3. Create a transparent Testnet address controlled by your test wallet.
4. Put that address in the Private Bill order.
5. Send TAZ to the exact address.
6. Record the real TXID locally.
7. Check the monitor.

```bash
curl -s http://127.0.0.1:8787/api/payment-monitor/PB-Q7-TEST-001 | jq
```

Expected progression:

```text
AWAITING_ZEC
      ↓
PAYMENT_DETECTED
      ↓
CONFIRMING
      ↓
CONFIRMED
      ↓
COMPLETED
```

If the received amount is below the order requirement:

```text
PAYMENT_UNDERPAID
```

---

# 13. Confirmation accounting

Q7 v3 improves on Q7 v2 by not treating the maximum confirmation count as sufficient when several payments exist.

The monitor calculates:

```text
receivedZec  = sum(all detected payments)
confirmedZec = sum(payments with required confirmations)
```

Therefore, if an order needs `0.10 ZEC` and:

```text
payment A = 0.06 ZEC, 3 confirmations
payment B = 0.04 ZEC, 0 confirmations
```

then:

```text
receivedZec  = 0.10
confirmedZec = 0.06
```

The order remains `CONFIRMING`.

It becomes `COMPLETED` only when the required amount is sufficiently confirmed.

---

# 14. Idempotency

Each observed transaction is recorded with:

```text
<orderId>:<txid>
```

Example:

```text
PB-Q7-TEST-001:abc123...
```

Polling the same transaction repeatedly does not create duplicate payment records.

---

# 15. Node failover test

Set:

```env
PRIVATE_BILL_NODE=auto
```

Start both adapters for the selected network.

Verify:

```bash
curl -s http://127.0.0.1:8787/api/health | jq
```

Stop the primary node.

The next monitor request should try the fallback node.

If both nodes fail, the backend returns HTTP 503 and the order remains unfunded.

---

# 16. Mainnet test

Do **not** jump directly to a real-money transaction.

First verify:

```text
[ ] npm run check
[ ] Regtest payment detected
[ ] Regtest confirmations work
[ ] Regtest underpayment works
[ ] Regtest duplicate TXID is idempotent
[ ] Testnet real TAZ payment detected
[ ] Testnet confirmations work
[ ] Testnet underpayment works
[ ] Testnet node outage works
[ ] Testnet Zebra -> Zakura fallback works
[ ] RPC credentials are not committed
[ ] No seed phrase/private key is stored
[ ] Mainnet Zebra is fully synchronized
```

Then run:

```env
PRIVATE_BILL_NETWORK=mainnet
PRIVATE_BILL_NODE=zebra
```

Verify:

```bash
curl -s http://127.0.0.1:8787/api/health | jq
```

Only after the node is healthy should you consider a small real-ZEC transaction.

---

# 17. Running two Private Bill monitors at once

The code intentionally treats the active network as process configuration. This avoids mixing Mainnet and Testnet orders in one store.

### Testnet backend

Create `.env.testnet.private-bill`:

```env
PRIVATE_BILL_NETWORK=testnet
PRIVATE_BILL_NODE=auto
PORT=8787
PRIVATE_BILL_DB=./data/private-bill-testnet.json
```

Run:

```bash
set -a
source .env.testnet.private-bill
set +a
npm run server
```

### Mainnet backend

Create `.env.mainnet.private-bill`:

```env
PRIVATE_BILL_NETWORK=mainnet
PRIVATE_BILL_NODE=auto
PORT=8788
PRIVATE_BILL_DB=./data/private-bill-mainnet.json
```

Run from another terminal:

```bash
set -a
source .env.mainnet.private-bill
set +a
npm run server
```

Now:

```text
127.0.0.1:8787 -> Testnet
127.0.0.1:8788 -> Mainnet
```

This is safer than a single mixed database.

---

# 18. Important production limitations

This quest implementation is a strong, testable foundation. It is **not yet a production payment processor**.

Before production:

1. Replace JSON persistence with PostgreSQL or another transactional database.
2. Generate/assign a unique deposit address **server-side per order**.
3. Do not accept a deposit address supplied by an untrusted browser.
4. Add a proper address/payment indexer instead of repeated block scanning.
5. Add Sapling/Orchard payment detection if shielded payments are required.
6. Add reorg handling and canonical-chain checks.
7. Store transaction observations and state transitions atomically.
8. Add authentication and authorization to order APIs.
9. Add rate limiting and request validation.
10. Add structured logs without exposing financial or credential secrets.
11. Add metrics and alerting.
12. Use a dedicated wallet/signing architecture; the consensus node is not the application's wallet.
13. Never store seed phrases or private keys in Private Bill source code.

---

# 19. Files introduced by Q7 v3

```text
server.mjs
src/
  adapters/
    zebra.mjs
    zakura.mjs
  node-config.mjs
  node-manager.mjs
  payment-monitor.mjs
  payment-monitor.ts
  rpc.mjs
  store.mjs
.env.example
README.md
```

The React application from Q6/Q7 remains in the project so the quest can be exercised through the UI.

---

# 20. Final PR claims — keep them accurate

Safe claim:

> Implemented a multi-network, multi-node payment monitor supporting Zcash Regtest, Testnet and Mainnet configurations, with Zebra/Zakura adapters, automatic node fallback, transaction idempotency, amount verification, confirmation tracking, underpayment handling and expiration handling for transparent-address payments.

Do **not** claim:

> Full Zcash shielded payment support.

Do **not** claim:

> Production-ready payment infrastructure.

Do **not** claim:

> Mainnet payment tested with real ZEC.

unless you personally complete those tests and record the evidence.
