# ZDR-001: Blockchain Fundamentals

A simple Python implementation demonstrating the fundamental concepts of blockchain technology, including blocks, SHA-256 hashing, block linking, and blockchain immutability.

## Task

**Task ID:** ZDR-001
**Programme:** Zcash Privacy Developers Residency 2026
**Topic:** Blockchain Fundamentals
**Language:** Python

## What is a Blockchain?

A blockchain is a distributed digital ledger that stores information in a sequence of blocks.

Each block contains data and a cryptographic hash that identifies the block. It also stores the hash of the previous block, creating a chain between blocks.

Because each block depends on the previous block's hash, changing data in an existing block changes its hash and breaks the chain that follows it.

## Why Does Each Block Contain the Previous Block's Hash?

The previous block's hash creates a cryptographic link between blocks.

For example:

```text
Genesis Block
     ↓
Block 1
     ↓
Block 2
```

Block 1 stores the hash of the Genesis Block.

Block 2 stores the hash of Block 1.

If Block 1 is modified, its hash changes. Block 2 still contains the old hash of Block 1, which makes the chain invalid.

This mechanism helps make blockchain data tamper-evident.

## What Happens When Data Inside an Existing Block Changes?

When data inside a block changes, the SHA-256 hash calculated from that block's contents also changes.

For example:

```text
Original Data:
Alice sends 10 ZEC to Bob

Original Hash:
abc123...

Modified Data:
Alice sends 100 ZEC to Bob

Modified Hash:
def456...
```

The two hashes are different.

The program demonstrates this by modifying Block 1 after the blockchain has been created and comparing its original hash with the newly calculated hash.

This shows why changing historical blockchain data is detectable.

## Centralized vs Decentralized Networks

### Centralized Network

A centralized network is controlled by a central authority or organization.

For example, a traditional banking system may rely on a central institution to maintain and validate its records.

### Decentralized Network

A decentralized network distributes control and verification across multiple independent participants.

Instead of relying on one central authority, participants can collectively maintain and verify the state of the network.

Bitcoin and Zcash are examples of decentralized blockchain networks.

## Bitcoin vs Zcash

One major difference is privacy.

Bitcoin transactions are publicly visible on its blockchain. Transaction amounts and addresses can be inspected on the public ledger.

Zcash supports shielded transactions that can use zero-knowledge cryptography to provide stronger transaction privacy while still allowing the network to verify transaction validity.

## What is a UTXO?

UTXO stands for **Unspent Transaction Output**.

It represents an output from a previous transaction that has not yet been spent.

Bitcoin uses the UTXO model to track spendable value. When a user makes a transaction, existing UTXOs can be consumed as inputs and new UTXOs are created as outputs.

Zcash also uses a UTXO-based transaction model, with additional privacy mechanisms for shielded transactions.

## Features Demonstrated

This project demonstrates:

* Genesis Block creation
* Block indexing
* Timestamps
* Block data
* Previous block hashes
* SHA-256 hashing
* Cryptographic block linking
* Hash changes after data modification
* Basic blockchain integrity validation

## Project Structure

```text
ZcashGH-Residency01/
├── blockchain.py
└── README.md
```

## Requirements

* Python 3.x

No external Python libraries are required.

The project uses Python's built-in `hashlib` module for SHA-256 hashing.

## How to Run

Clone the repository:

```bash
git clone <YOUR_REPOSITORY_URL>
cd ZcashGH-Residency01
```

Run the program:

```bash
python blockchain.py
```

On some systems, you may need:

```bash
python3 blockchain.py
```

## Expected Result

The program displays the three blocks and their hashes.

It then modifies the data in Block 1 and displays:

```text
===== IMMUTABILITY DEMONSTRATION =====
Original Block 1 Hash : ...
Modified Block 1 Hash : ...

Block 1 hash changed after its data was modified.
This demonstrates blockchain immutability.

===== BLOCKCHAIN VALIDITY =====
Blockchain valid: False
```

The blockchain becomes invalid because Block 1's data was changed without updating the blocks that depend on its original hash.

## Author

**Kodjo Labore Agbetsiassi**

Zcash Privacy Developers Residency Programme 2026
