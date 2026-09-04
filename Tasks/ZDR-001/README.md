# ZDR-001: Blockchain Fundamentals

A beginner-friendly blockchain implementation in JavaScript (Node.js) demonstrating core blockchain concepts including SHA-256 hashing, block linking, and tamper detection.

---

## Table of Contents

1. [What Is a Blockchain?](#1-what-is-a-blockchain)
2. [Why Does the Previous Block Hash Exist?](#2-why-does-the-previous-block-hash-exist)
3. [What Happens When Data in an Existing Block Is Changed?](#3-what-happens-when-data-in-an-existing-block-is-changed)
4. [Centralized vs. Decentralized Networks](#4-centralized-vs-decentralized-networks)
5. [One Major Difference Between Bitcoin and Zcash](#5-one-major-difference-between-bitcoin-and-zcash)
6. [What Is a UTXO?](#6-what-is-a-utxo)
7. [How to Install and Run the Program](#7-how-to-install-and-run-the-program)
8. [What the Program Demonstrates](#8-what-the-program-demonstrates)
9. [How to Run the Tests](#9-how-to-run-the-tests)
10. [Expected Output](#10-expected-output)

---

## 1. What Is a Blockchain?

A **blockchain** is a distributed, append-only ledger made up of ordered units called **blocks**. Each block bundles a set of transactions (or data), a timestamp, and — critically — the cryptographic hash of the block that came before it. This chaining of hashes creates a tamper-evident sequence: altering any block would break the chain from that point onward, making unauthorized changes immediately detectable.

Key properties:

- **Append-only**: New blocks are added to the end; old blocks are never removed or reordered under normal conditions.
- **Cryptographically linked**: Each block references the previous block's hash, forming a "chain."
- **Distributed**: Copies of the chain are held by many independent nodes, so no single party controls the data.
- **Tamper-evident**: Changing even one character of data in a block changes its hash, which invalidates every subsequent block.

---

## 2. Why Does the Previous Block Hash Exist?

The `previous_hash` field is what makes a blockchain a *chain* rather than just a list of blocks. It serves two purposes:

1. **Integrity linking** — Because each block's hash is computed from its own contents *plus* the previous block's hash, any change to an earlier block cascades forward and invalidates every block that follows.

2. **Order enforcement** — The previous-hash reference guarantees the chronological order of blocks. A node can walk the chain from the genesis block to the tip, verifying at every step that the links are unbroken.

Without this field, an attacker could swap, remove, or reorder blocks without detection.

---

## 3. What Happens When Data in an Existing Block Is Changed?

Because each block's hash is a deterministic function of its contents (`index + timestamp + data + previous_hash`), changing *any* field — including `data` — produces a completely different hash. This is known as the **avalanche effect** of cryptographic hash functions.

Consequences:

| Step | What happens |
|------|-------------|
| 1 | Attacker modifies `data` in Block *N*. |
| 2 | Block *N*'s stored hash no longer matches its recalculated hash → tampering detected. |
| 3 | Even if the attacker recalculates Block *N*'s hash, Block *N+1*'s `previous_hash` no longer matches → the link is broken. |
| 4 | The attacker must recalculate *every* block from *N* onward, which becomes computationally infeasible on a real network with many confirming blocks. |

This program demonstrates steps 1–4 by modifying Block 1 and showing the hash change and validation failure.

---

## 4. Centralized vs. Decentralized Networks

| Aspect | Centralized | Decentralized |
|--------|------------|---------------|
| **Control** | A single entity (company, server) controls the data. | No single entity has control; many independent participants share responsibility. |
| **Single point of failure** | Yes — if the central server goes down, the whole system stops. | No — the network continues as long as enough nodes are online. |
| **Trust model** | You must trust the central authority not to alter data. | Trust is placed in mathematics (cryptography) and consensus protocols instead. |
| **Transparency** | The operator can silently change data. | All participants can independently verify the data. |
| **Examples** | Traditional bank databases, corporate servers. | Bitcoin, Zcash, BitTorrent, IPFS. |

Blockchains are a *decentralized* technology: every participant holds (or can obtain) a copy of the ledger and independently verifies its validity.

---

## 5. One Major Difference Between Bitcoin and Zcash

**Privacy.** Bitcoin transactions are recorded on a public ledger where sender addresses, receiver addresses, and amounts are visible to everyone. Zcash introduces **zero-knowledge proofs** (specifically zk-SNARKs) that allow transactions to be fully validated without revealing the sender, receiver, or amount. This means a Zcash transaction can be either transparent (like Bitcoin) or **shielded** (completely private), giving users the option to transact with enhanced privacy.

---

## 6. What Is a UTXO?

**UTXO** stands for **Unspent Transaction Output**. In Bitcoin-like systems (including Zcash), the ledger does not track "account balances" like a bank. Instead, it tracks individual outputs of transactions that have not yet been spent.

- When you receive 1 BTC, you hold a UTXO worth 1 BTC.
- When you spend that UTXO, it is consumed and one or more *new* UTXOs are created (e.g., one for the recipient and one change output back to yourself).
- Your "balance" is the sum of all UTXOs you control.

The UTXO model provides better privacy and parallelism compared to the account model used by Ethereum, because each transaction consumes and creates independent outputs.

---

## 7. How to Install and Run the Program

### Prerequisites

- **Node.js** (v14 or later) — [https://nodejs.org](https://nodejs.org)

No additional packages are required; the implementation uses only Node.js built-in modules.

### Clone the repository

```bash
git clone https://github.com/JemimahEkong/ZcashGH-Residency01.git
cd ZcashGH-Residency01
git checkout task/ZDR-001-JemimahEkong
```

### Run the program

```bash
node Tasks/ZDR-001/blockchain.js
```

---

## 8. What the Program Demonstrates

The program walks through four steps:

1. **Creates a blockchain** with a Genesis Block (Block 0), Block 1, and Block 2.
2. **Displays the full chain** showing every block's index, timestamp, data, previous hash, and hash.
3. **Modifies Block 1's data** and recalculates its hash, then displays both the original and modified hashes side by side — proving that changing the data changes the hash.
4. **Validates the chain** and shows that the blockchain now detects the tampering.

This is a clear, visual proof of blockchain immutability: even a small data change produces a completely different hash, and the chain's validation function catches the tampering.

---

## 9. How to Run the Tests

```bash
node Tasks/ZDR-001/test_blockchain.js
```

The test suite covers:

| Test | What it verifies |
|------|-----------------|
| Block creation | All required fields (index, timestamp, data, previous_hash, hash) exist |
| SHA-256 hashing | Block hash matches a manual SHA-256 calculation |
| Hash uniqueness | Different data produces different hashes |
| Genesis block | Created on initialization with previous_hash of 64 zeros |
| Block linking | Each block's previous_hash matches the preceding block's hash |
| Chain validity | An untampered chain passes validation |
| Tamper detection | Modifying block data invalidates the chain |
| Full demonstration | End-to-end: create → modify → detect |

All 11 tests must pass before the implementation is considered complete.

---

## 10. Expected Output

Running `node Tasks/ZDR-001/blockchain.js` produces output similar to:

```
======================================================================
ZDR-001: BLOCKCHAIN FUNDAMENTALS DEMONSTRATION
======================================================================

[STEP 1] Creating blockchain with 3 blocks...

[STEP 2] Original blockchain:

======================================================================
BLOCKCHAIN CONTENTS
======================================================================

----------------------------------------------------------------------
Block #0
----------------------------------------------------------------------
  Index:            0
  Timestamp:        2026-09-04T09:50:01.595Z
  Data:             Genesis Block - The first block in the chain
  Previous Hash:    0000000000000000000000000000000000000000000000000000000000000000
  Hash:             288b77145756f5a85f48c3ec65d662a3cfd43dad8726c4fac81007e244b2e412

----------------------------------------------------------------------
Block #1
----------------------------------------------------------------------
  Index:            1
  Timestamp:        2026-09-04T09:50:01.597Z
  Data:             Block 1 - First transaction data
  Previous Hash:    288b77145756f5a85f48c3ec65d662a3cfd43dad8726c4fac81007e244b2e412
  Hash:             e10bd121860be7a2e91befa00781958a471a26364f66a7286e001f2904d7040b

----------------------------------------------------------------------
Block #2
----------------------------------------------------------------------
  Index:            2
  Timestamp:        2026-09-04T09:50:01.597Z
  Data:             Block 2 - Second transaction data
  Previous Hash:    e10bd121860be7a2e91befa00781958a471a26364f66a7286e001f2904d7040b
  Hash:             92d8413153dfcafd0647358b2200273dd9b1645b9b4c55ff2232968080fc8f80

======================================================================

======================================================================
BLOCK 1 - ORIGINAL STATE
======================================================================
  Original Data:    Block 1 - First transaction data
  Original Hash:    e10bd121860be7a2e91befa00781958a471a26364f66a7286e001f2904d7040b

[STEP 3] Modifying Block 1's data...

======================================================================
BLOCK 1 - AFTER MODIFICATION
======================================================================
  Modified Data:    Block 1 - MODIFIED TRANSACTION DATA (TAMPERED!)
  Modified Hash:    46fcd906d777144eb38309e04199590ecbc04bb95bc77f1881e4969f8e90decb

======================================================================
HASH COMPARISON - IMMUTABILITY DEMONSTRATION
======================================================================
  Original Hash:    e10bd121860be7a2e91befa00781958a471a26364f66a7286e001f2904d7040b
  Modified Hash:    46fcd906d777144eb38309e04199590ecbc04bb95bc77f1881e4969f8e90decb
  Hashes match:     false

  *** The hash changed! This proves that modifying data
      in a block breaks the chain's integrity. ***
======================================================================

[STEP 4] Validating blockchain integrity...

  Blockchain valid: false
  *** Tampering detected! The blockchain validation failed.
      This demonstrates how blockchains protect data integrity. ***

======================================================================
DEMONSTRATION COMPLETE
======================================================================
```

Running the tests produces:

```
  Block
    ✓ creates a block with all required fields
    ✓ hash is a valid SHA-256 of the block contents
    ✓ different data produces different hashes

  Blockchain
    ✓ creates a genesis block on initialization
    ✓ adds a block that references the previous block's hash
    ✓ links Block 2 to Block 1 via previous hash
    ✓ has at least 3 blocks after adding two
    ✓ valid chain passes validation
    ✓ modifying block data invalidates the chain
    ✓ modifying data changes the block's hash

  Full demonstration (ZDR-001 requirements)
    ✓ create chain → modify Block 1 → detect tampering

Results: 11/11 passed, 0 failed
```

---

## Project Structure

```
Tasks/
└── ZDR-001/
    ├── README.md           ← This file
    ├── blockchain.js       ← Blockchain implementation
    └── test_blockchain.js  ← Test suite (11 tests)
```
