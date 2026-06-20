# Boostify Music Tokenization - Smart Contract

## Overview
ERC-1155 multi-token standard for tokenizing music on Polygon blockchain.

## Contract Architecture

### Key Features
- **One Contract, Multiple Songs**: Single contract manages all tokenized songs
- **ERC-1155 Standard**: Fungible tokens within each song ID
- **Automatic Royalty Split**: 80% artist, 20% platform
- **Low Gas Fees**: Deployed on Polygon (~$0.01 per transaction)
- **Custody Model**: Tokens held by contract until purchased

### Contract Functions

#### Admin Functions (only Boostify)
```solidity
// Mint new song tokens
mintSongTokens(
    address artist,
    uint256 totalSupply,
    uint256 pricePerToken,
    string metadataURI
) returns (uint256 tokenId)

// Update token price
updateTokenPrice(uint256 tokenId, uint256 newPrice)

// Toggle token sale status
toggleTokenStatus(uint256 tokenId)
```

#### Public Functions
```solidity
// Purchase tokens (payable)
buyTokens(uint256 tokenId, uint256 amount)

// Check user balance
balanceOf(address account, uint256 tokenId)

// Get token metadata
uri(uint256 tokenId)
```

## Deployment Guide

### Prerequisites
```bash
npm install --save-dev hardhat @openzeppelin/contracts
npm install --save-dev @nomicfoundation/hardhat-toolbox
```

### Hardhat Config (hardhat.config.js)
```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    polygon: {
      url: "https://polygon-rpc.com/",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 137
    },
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com/",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 80001
    }
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY
  }
};
```

### Deploy Script (scripts/deploy.js)
```javascript
const hre = require("hardhat");

async function main() {
  const platformWallet = "0xYOUR_PLATFORM_WALLET_ADDRESS";
  const baseURI = "https://api.boostifymusic.com/metadata/";

  const BoostifyMusicTokens = await hre.ethers.getContractFactory("BoostifyMusicTokens");
  const contract = await BoostifyMusicTokens.deploy(platformWallet, baseURI);

  await contract.deployed();

  console.log("BoostifyMusicTokens deployed to:", contract.address);

  // Verify on Polygonscan
  console.log("Verifying contract...");
  await hre.run("verify:verify", {
    address: contract.address,
    constructorArguments: [platformWallet, baseURI],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### Deployment Commands

#### Mumbai Testnet (recommended for testing)
```bash
# Get test MATIC from faucet
# https://faucet.polygon.technology/

# Deploy to Mumbai
npx hardhat run scripts/deploy.js --network mumbai

# Verify
npx hardhat verify --network mumbai DEPLOYED_CONTRACT_ADDRESS "0xPLATFORM_WALLET" "https://api.boostifymusic.com/metadata/"
```

#### Polygon Mainnet (production)
```bash
# Deploy to Polygon
npx hardhat run scripts/deploy.js --network polygon

# Verify
npx hardhat verify --network polygon DEPLOYED_CONTRACT_ADDRESS "0xPLATFORM_WALLET" "https://api.boostifymusic.com/metadata/"
```

## Integration with Backend

After deployment, update these files:

### 1. Update Contract Address
```typescript
// client/src/lib/web3-config.ts
export const BOOSTIFY_CONTRACT_ADDRESS = '0xYOUR_DEPLOYED_CONTRACT_ADDRESS';
```

### 2. Store Contract Address in Database
When minting a new song:
```typescript
await db.insert(tokenizedSongs).values({
  // ... other fields
  contractAddress: BOOSTIFY_CONTRACT_ADDRESS,
  tokenId: tokenIdFromBlockchain,
});
```

## Testing

### Local Testing with Hardhat
```bash
# Run tests
npx hardhat test

# Run local node
npx hardhat node

# Deploy to local node
npx hardhat run scripts/deploy.js --network localhost
```

### Test Script (test/BoostifyMusicTokens.test.js)
```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BoostifyMusicTokens", function () {
  let contract, owner, artist, buyer, platformWallet;

  beforeEach(async function () {
    [owner, artist, buyer, platformWallet] = await ethers.getSigners();
    
    const BoostifyMusicTokens = await ethers.getContractFactory("BoostifyMusicTokens");
    contract = await BoostifyMusicTokens.deploy(
      platformWallet.address,
      "https://api.boostifymusic.com/metadata/"
    );
  });

  it("Should mint song tokens", async function () {
    const tx = await contract.mintSongTokens(
      artist.address,
      10000,
      ethers.utils.parseEther("0.01"),
      "ipfs://QmExample"
    );
    
    const receipt = await tx.wait();
    const event = receipt.events.find(e => e.event === "SongTokenized");
    expect(event.args.tokenId).to.equal(1);
  });

  it("Should allow buying tokens with correct split", async function () {
    await contract.mintSongTokens(
      artist.address,
      10000,
      ethers.utils.parseEther("0.01"),
      "ipfs://QmExample"
    );
    
    const initialArtistBalance = await ethers.provider.getBalance(artist.address);
    const initialPlatformBalance = await ethers.provider.getBalance(platformWallet.address);
    
    await contract.connect(buyer).buyTokens(1, 100, {
      value: ethers.utils.parseEther("1.0")
    });
    
    const finalArtistBalance = await ethers.provider.getBalance(artist.address);
    const finalPlatformBalance = await ethers.provider.getBalance(platformWallet.address);
    
    // Artist should receive 80%
    expect(finalArtistBalance.sub(initialArtistBalance)).to.equal(
      ethers.utils.parseEther("0.8")
    );
    
    // Platform should receive 20%
    expect(finalPlatformBalance.sub(initialPlatformBalance)).to.equal(
      ethers.utils.parseEther("0.2")
    );
  });
});
```

## Gas Costs (Polygon Mainnet)

| Operation | Gas Used | Cost (at 30 gwei) |
|-----------|----------|-------------------|
| Deploy Contract | ~2,500,000 | ~$0.05 |
| Mint Song Tokens | ~150,000 | ~$0.003 |
| Buy Tokens (1-10) | ~80,000 | ~$0.002 |
| Buy Tokens (100) | ~100,000 | ~$0.002 |

## Security Considerations

1. **ReentrancyGuard**: Protects against reentrancy attacks
2. **OpenZeppelin Libraries**: Uses audited, battle-tested code
3. **Access Control**: Only owner can mint and manage tokens
4. **Emergency Withdrawal**: Owner can withdraw stuck funds
5. **Input Validation**: All functions validate inputs

## Metadata Format (JSON)

```json
{
  "name": "Song Name",
  "description": "Song description",
  "image": "ipfs://QmImageHash",
  "artist": "Artist Name",
  "properties": {
    "songUrl": "https://...",
    "benefits": [
      "Exclusive content access",
      "10% discount on merchandise",
      "Early access to new releases"
    ],
    "releaseDate": "2025-01-01",
    "genre": "Electronic"
  }
}
```

## Roadmap

### Phase 1 (Current)
- [x] ERC-1155 contract
- [x] Basic buy/sell functionality
- [x] Automatic royalty split

### Phase 2 (Future)
- [ ] Secondary market (OpenSea integration)
- [ ] Dynamic pricing based on demand
- [ ] Staking rewards for token holders
- [ ] Governance voting for exclusive perks

### Phase 3 (Future)
- [ ] Cross-chain bridge (Polygon → Ethereum)
- [ ] NFT album bundles
- [ ] Fractional ownership of music rights

## Support

For questions or issues:
- GitHub: [Your Repo]
- Discord: [Your Server]
- Email: dev@boostifymusic.com
