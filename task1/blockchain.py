import hashlib
from datetime import datetime


class Block:
    def __init__(self, index, data, previous_hash):
        self.index = index
        self.timestamp = datetime.now().isoformat()
        self.data = data
        self.previous_hash = previous_hash
        self.hash = self.calculate_hash()

    def calculate_hash(self):
        block_content = (
            str(self.index)
            + self.timestamp
            + str(self.data)
            + self.previous_hash
        )

        return hashlib.sha256(block_content.encode()).hexdigest()

    def __str__(self):
        return (
            f"\nBlock #{self.index}\n"
            f"Timestamp: {self.timestamp}\n"
            f"Data: {self.data}\n"
            f"Previous Hash: {self.previous_hash}\n"
            f"Current Hash: {self.hash}\n"
        )


class Blockchain:
    def __init__(self):
        self.chain = [self.create_genesis_block()]

    def create_genesis_block(self):
        return Block(0, "Genesis Block", "0")

    def add_block(self, data):
        previous_block = self.chain[-1]

        new_block = Block(
            len(self.chain),
            data,
            previous_block.hash
        )

        self.chain.append(new_block)

    def is_valid(self):
        for i in range(1, len(self.chain)):
            current_block = self.chain[i]
            previous_block = self.chain[i - 1]

            if current_block.hash != current_block.calculate_hash():
                return False

            if current_block.previous_hash != previous_block.hash:
                return False

        return True

    def display_chain(self):
        for block in self.chain:
            print(block)


def main():
    blockchain = Blockchain()

    # Create two additional blocks
    blockchain.add_block("Alice sends 10 ZEC to Bob")
    blockchain.add_block("Bob sends 3 ZEC to Charlie")

    print("===== ORIGINAL BLOCKCHAIN =====")
    blockchain.display_chain()

    # Store the original hash of Block 1
    original_hash = blockchain.chain[1].hash

    # Modify Block 1 data
    blockchain.chain[1].data = "Alice sends 100 ZEC to Bob"

    # Recalculate the hash after modification
    modified_hash = blockchain.chain[1].calculate_hash()

    print("\n===== IMMUTABILITY DEMONSTRATION =====")
    print(f"Original Block 1 Hash : {original_hash}")
    print(f"Modified Block 1 Hash : {modified_hash}")

    if original_hash != modified_hash:
        print("\nBlock 1 hash changed after its data was modified.")
        print("This demonstrates blockchain immutability.")

    print("\n===== BLOCKCHAIN VALIDITY =====")
    print(f"Blockchain valid: {blockchain.is_valid()}")


if __name__ == "__main__":
    main()