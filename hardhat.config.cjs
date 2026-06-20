require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    // Polygon Mainnet (Production)
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts: (process.env.DEPLOYER_PRIVATE_KEY || process.env.PLATFORM_PRIVATE_KEY) ? [process.env.DEPLOYER_PRIVATE_KEY || process.env.PLATFORM_PRIVATE_KEY] : [],
      chainId: 137,
      timeout: 180000,
    },
    // Polygon Amoy Testnet (New testnet, replaces Mumbai)
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology/",
      accounts: (process.env.DEPLOYER_PRIVATE_KEY || process.env.PLATFORM_PRIVATE_KEY) ? [process.env.DEPLOYER_PRIVATE_KEY || process.env.PLATFORM_PRIVATE_KEY] : [],
      chainId: 80002,
    },
    // Local development
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Hardhat network
    hardhat: {
      chainId: 31337,
    }
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  }
};
