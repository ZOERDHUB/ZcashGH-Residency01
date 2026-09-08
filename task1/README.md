# ZDR-001: Blockchain Fundamentals

## Overview

This project demonstrates the basic structure of a blockchain and how cryptographic hashes are used to link blocks together.

The program creates a simple blockchain containing a Genesis Block and two additional blocks. Each block contains an index, timestamp, data, previous block hash, and current block hash.

SHA-256 is used to generate the hashes.

## Features

- Creates a Genesis Block.
- Creates at least three blocks.
- Uses SHA-256 for hashing.
- Links each block to the previous block using its hash.
- Demonstrates what happens when existing block data is modified.
- Displays the original and modified hashes.

## What is a Blockchain?

A blockchain is a distributed digital ledger that stores information in a sequence of blocks.

Each block contains data and a cryptographic hash that connects it to the previous block. This creates a chain of blocks.

Because changing information inside a block changes its hash, modifying a block can be detected by comparing its hash with the hash stored by the following block.

## Why Does Each Block Contain the Previous Block's Hash?

The previous block's hash creates a cryptographic connection between blocks.

For example:

- Block 1 contains the hash of Block 0.
- Block 2 contains the hash of Block 1.

If someone changes Block 1, its hash changes. Block 2 will then contain an outdated previous hash, making the modification detectable.

This helps protect the integrity of the blockchain.

## What Happens When Data Inside an Existing Block Changes?

The block's hash is calculated from its contents.

If the data changes, the input to the SHA-256 hash function changes. Therefore, the resulting hash also changes.

In this project, Block 1 is modified after the blockchain is created. The program displays both the original and modified hashes and shows that they are different.

## Centralized vs Decentralized Networks

A centralized network has a central authority that controls or manages the system.

For example, a traditional banking system has a central organization that maintains and controls its records.

A decentralized network distributes control among multiple independent participants. There is no single central authority responsible for controlling the entire network.

Blockchains such as Bitcoin and Zcash use decentralized networks.

## Bitcoin vs Zcash

One major difference between Bitcoin and Zcash is transaction privacy.

Bitcoin transactions are publicly visible on its blockchain.

Zcash supports both transparent transactions and shielded transactions, which can use zero-knowledge cryptography to provide stronger financial privacy.

## What is a UTXO?

UTXO stands for Unspent Transaction Output.

In a UTXO-based blockchain, cryptocurrency is represented by outputs from previous transactions that have not yet been spent.

For example, if a wallet has three unspent outputs worth:

- 0.5 BTC
- 0.2 BTC
- 0.1 BTC

The wallet has a total of 0.8 BTC available.

When the user makes a transaction, one or more UTXOs are consumed and new transaction outputs are created.

## How to Run the Program

### Requirements

- Node.js installed on your computer.

### Steps

1. Clone the repository.
2. Open the project directory in a terminal.
3. Run:

```bash
node blockchain.js