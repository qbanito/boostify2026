const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * BTF Token + Staking Vault Deployment Script
 * 
 * Deploys:
 *   1. BTFToken (ERC-20) — The native Boostify ecosystem currency
 *   2. BTFStakingVault — Stake BTF → earn rewards → unlock tiers
 *
 * Network: Polygon Amoy (testnet) or Polygon Mainnet
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-btf-token.js --network amoy
 *   npx hardhat run scripts/deploy-btf-token.js --network polygon
 */
async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  🚀 BTF TOKEN DEPLOYMENT — Boostify Music");
  console.log("═══════════════════════════════════════════════════════\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(balance), "MATIC\n");

  if (parseFloat(hre.ethers.formatEther(balance)) < 0.1) {
    console.error("❌ Insufficient MATIC for deployment. Need at least 0.1 MATIC.");
    console.error("   Get Amoy testnet MATIC from: https://faucet.polygon.technology/");
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════
  //  WALLET CONFIGURATION
  // ═══════════════════════════════════════════════════════
  // In production, these should be MultiSig wallets (e.g. Gnosis Safe)
  // For testnet, deployer acts as all wallets
  const ADMIN             = process.env.BTF_ADMIN_WALLET || deployer.address;
  const ECOSYSTEM_WALLET  = process.env.BTF_ECOSYSTEM_WALLET || deployer.address;
  const LIQUIDITY_WALLET  = process.env.BTF_LIQUIDITY_WALLET || deployer.address;
  const TEAM_WALLET       = process.env.BTF_TEAM_WALLET || deployer.address;
  const TREASURY_WALLET   = process.env.BTF_TREASURY_WALLET || deployer.address;
  const EARLY_SUPPORTERS  = process.env.BTF_EARLY_SUPPORTERS_WALLET || deployer.address;
  const MARKETING_WALLET  = process.env.BTF_MARKETING_WALLET || deployer.address;

  console.log("⚙️  Wallet Configuration:");
  console.log("   Admin:            ", ADMIN);
  console.log("   Ecosystem Rewards:", ECOSYSTEM_WALLET);
  console.log("   Liquidity:        ", LIQUIDITY_WALLET);
  console.log("   Team (vested):    ", TEAM_WALLET);
  console.log("   Treasury/DAO:     ", TREASURY_WALLET);
  console.log("   Early Supporters: ", EARLY_SUPPORTERS);
  console.log("   Marketing:        ", MARKETING_WALLET);
  console.log("");

  // ═══════════════════════════════════════════════════════
  //  1. DEPLOY BTF TOKEN (ERC-20)
  // ═══════════════════════════════════════════════════════
  
  // Check if BTFToken was already deployed (resume after partial deploy)
  const EXISTING_BTF_TOKEN = process.env.BTF_TOKEN_ADDRESS || "";
  let btfToken, btfTokenAddress;
  
  if (EXISTING_BTF_TOKEN) {
    console.log("📦 [1/2] BTFToken already deployed, reusing:", EXISTING_BTF_TOKEN);
    btfTokenAddress = EXISTING_BTF_TOKEN;
    btfToken = await hre.ethers.getContractAt("BTFToken", btfTokenAddress);
  } else {
    console.log("📦 [1/2] Deploying BTFToken...");
    const BTFToken = await hre.ethers.getContractFactory("BTFToken");
    btfToken = await BTFToken.deploy(
      ADMIN,
      ECOSYSTEM_WALLET,
      LIQUIDITY_WALLET,
      TEAM_WALLET,
      TREASURY_WALLET,
      EARLY_SUPPORTERS,
      MARKETING_WALLET
    );
    await btfToken.waitForDeployment();
    btfTokenAddress = await btfToken.getAddress();
  }
  console.log("✅ BTFToken deployed to:", btfTokenAddress);

  // Verify initial state
  const totalSupply = await btfToken.totalSupply();
  const totalBurned = await btfToken.totalBurned();
  const rewardsRemaining = await btfToken.ecosystemRewardsRemaining();
  
  console.log("   Total Supply:      ", hre.ethers.formatEther(totalSupply), "BTF");
  console.log("   Ecosystem Rewards: ", hre.ethers.formatEther(rewardsRemaining), "BTF (in contract)");
  console.log("   Total Burned:      ", hre.ethers.formatEther(totalBurned), "BTF");

  // ═══════════════════════════════════════════════════════
  //  2. DEPLOY STAKING VAULT
  // ═══════════════════════════════════════════════════════
  console.log("\n📦 [2/2] Deploying BTFStakingVault...");
  
  const BTFStakingVault = await hre.ethers.getContractFactory("BTFStakingVault");
  const stakingVault = await BTFStakingVault.deploy(btfTokenAddress, ADMIN);
  await stakingVault.waitForDeployment();
  
  const stakingVaultAddress = await stakingVault.getAddress();
  console.log("✅ BTFStakingVault deployed to:", stakingVaultAddress);

  // ═══════════════════════════════════════════════════════
  //  3. POST-DEPLOYMENT CONFIGURATION
  // ═══════════════════════════════════════════════════════
  console.log("\n🔐 Setting up roles & permissions...");
  
  // Exclude staking vault from fees and limits (it holds staked tokens)
  await btfToken.setExcludedFromLimits(stakingVaultAddress, true);
  console.log("   ✓ Staking vault excluded from wallet limits");
  
  await btfToken.setExcludedFromFees(stakingVaultAddress, true);
  console.log("   ✓ Staking vault excluded from transfer fees");

  // Grant REWARDS_ROLE to staking vault address (optional: for backend integration)
  const REWARDS_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("REWARDS_ROLE"));
  // Keep REWARDS_ROLE on deployer for now (backend will call rewardArtist)
  console.log("   ✓ REWARDS_ROLE remains on deployer (for backend integration)");

  // Fund staking rewards pool with 5M BTF from liquidity allocation
  // (In production, you'd transfer from the appropriate wallet)
  console.log("\n💎 Funding staking rewards pool...");
  const INITIAL_STAKING_REWARDS = hre.ethers.parseEther("5000000"); // 5M BTF
  
  // Approve staking vault to pull tokens
  await btfToken.approve(stakingVaultAddress, INITIAL_STAKING_REWARDS);
  
  // Grant REWARDS_FUNDER_ROLE and fund
  const REWARDS_FUNDER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("REWARDS_FUNDER_ROLE"));
  await stakingVault.grantRole(REWARDS_FUNDER_ROLE, deployer.address);
  await stakingVault.fundRewardsPool(INITIAL_STAKING_REWARDS);
  
  const vaultStats = await stakingVault.getVaultStats();
  console.log("   ✓ Staking rewards pool funded:", hre.ethers.formatEther(vaultStats[4]), "BTF");

  // ═══════════════════════════════════════════════════════
  //  4. SAVE DEPLOYMENT INFO
  // ═══════════════════════════════════════════════════════
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      BTFToken: {
        address: btfTokenAddress,
        name: "Boostify Token",
        symbol: "BTF",
        totalSupply: "100000000",
        decimals: 18,
      },
      BTFStakingVault: {
        address: stakingVaultAddress,
        initialRewardsPool: "5000000",
        tiers: {
          Bronze: "100 BTF",
          Silver: "500 BTF",
          Gold: "2000 BTF",
          Platinum: "10000 BTF",
        },
        lockPeriods: {
          "30 days": "8% APY",
          "90 days": "15% APY",
          "180 days": "25% APY",
          "365 days": "40% APY",
        },
      },
    },
    wallets: {
      admin: ADMIN,
      ecosystem: ECOSYSTEM_WALLET,
      liquidity: LIQUIDITY_WALLET,
      team: TEAM_WALLET,
      treasury: TREASURY_WALLET,
      earlySupporters: EARLY_SUPPORTERS,
      marketing: MARKETING_WALLET,
    },
    tokenomics: {
      totalSupply: "100,000,000 BTF",
      transferBurn: "2%",
      serviceBurn: "50%",
      antiWhale: "2% max per wallet",
      allocations: {
        ecosystem: "40% (40M) — in contract, 4-year distribution",
        liquidity: "15% (15M) — DEX/BoostiSwap",
        team: "15% (15M) — 1-year cliff, 3-year vesting",
        treasury: "15% (15M) — DAO governed",
        earlySupporters: "10% (10M) — 6-month cliff, 1-year vesting",
        marketing: "5% (5M) — partnerships & growth",
      },
    },
  };

  const deploymentPath = path.join(__dirname, "..", `btf-token-deployment-${hre.network.name}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n📄 Deployment info saved to: ${deploymentPath}`);

  // ═══════════════════════════════════════════════════════
  //  5. UPDATE WEB3 CONFIG
  // ═══════════════════════════════════════════════════════
  const web3ConfigUpdate = `
// ═══════════════════════════════════════════════════════
// BTF TOKEN — Auto-generated from deployment
// Network: ${hre.network.name} (Chain ${deploymentInfo.chainId})
// Deployed: ${deploymentInfo.deployedAt}
// ═══════════════════════════════════════════════════════
export const BTF_TOKEN_ADDRESS = '${btfTokenAddress}';
export const BTF_STAKING_VAULT_ADDRESS = '${stakingVaultAddress}';
export const BTF_CHAIN_ID = ${deploymentInfo.chainId};
`;

  const configPath = path.join(__dirname, "..", "client", "src", "lib", "btf-token-config.ts");
  fs.writeFileSync(configPath, web3ConfigUpdate);
  console.log(`📄 Frontend config saved to: ${configPath}`);

  // ═══════════════════════════════════════════════════════
  //  SUMMARY
  // ═══════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅ DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  BTFToken:        ${btfTokenAddress}`);
  console.log(`  BTFStakingVault: ${stakingVaultAddress}`);
  console.log(`  Network:         ${hre.network.name}`);
  console.log("═══════════════════════════════════════════════════════");
  console.log("\n📋 Next Steps:");
  console.log("  1. Verify on Polygonscan:");
  console.log(`     npx hardhat verify --network ${hre.network.name} ${btfTokenAddress} ${ADMIN} ${ECOSYSTEM_WALLET} ${LIQUIDITY_WALLET} ${TEAM_WALLET} ${TREASURY_WALLET} ${EARLY_SUPPORTERS} ${MARKETING_WALLET}`);
  console.log(`     npx hardhat verify --network ${hre.network.name} ${stakingVaultAddress} ${btfTokenAddress} ${ADMIN}`);
  console.log("  2. Add BTF token to MetaMask (address above)");
  console.log("  3. Create BTF/MATIC liquidity pool on BoostiSwap");
  console.log("  4. Update .env with contract addresses");
  console.log("  5. Test: stake, reward, transfer, burn");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
