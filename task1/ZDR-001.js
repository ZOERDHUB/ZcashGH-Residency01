const crypto = require("crypto");

class Block {
    constructor(index, data, previousHash){
        this.index =index;
        this.timestamp = new Date().toISOString();
        this.data = data;
        this.previousHash = previousHash;
        this.hash = this.calculateHash();
    }
    calculateHash(){
        const blockData = 
        this.index +
        this.timestamp +
        this.data +
        this.previousHash;

        return crypto
            .createHash("sha256")
            .update(blockData)
            .digest("hex");
    }
}

class Blockchain{
    constructor(){
        this.chain = [this.createGenesisBlock()];
    }
    
    createGenesisBlock(){
        return new Block(0,"Genesis Block","0");
    }

    addBlock(data){
        const previousBlock = this.chain[this.chain.length -1];

        const newBlock = new Block(
            this.chain.length,
            data,
            previousBlock.hash
        );
        this.chain.push(newBlock);
    }
}

const blockchain = new Blockchain();
// Now we add one Block1
blockchain.addBlock("Daniel sent 10 ZEC to Keisha");
// adding another Block
blockchain.addBlock("Keisha sent 10 ZEC to Mr Squirrel");
// I will displaythe original blockchain
console.log("\n ------- ORIGINAL BLOCKCHAIN ------- \n");
blockchain.chain.forEach((block)=>{
    console.log(block);
});

// Now I want to get Block 1
const block1 = blockchain.chain[1];
// I will now save the original hash
const originalHash = block1.hash;

// According to the task i will now modify the block
block1.data = "Daniel sent 100 ZEC to Keisha";
// I will Now Calculate the new hash
const modifiedHash = block1.calculateHash();

console.log("\n------ DEMONSTRATION -------\n");

console.log("Original Data: ");
console.log("Daniel sent 10 ZEC to Keisha");

console.log("\nModified data\n");
console.log(block1.data);

console.log("\nOriginal Hash\n");
console.log(originalHash);

console.log("\nModified Hash\n");
console.log(modifiedHash);

console.log("Was the hash changed?");
console.log(originalHash !== modifiedHash);