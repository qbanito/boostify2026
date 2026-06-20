const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * BTF AI Artist Minter V2 Deployment Script
 * 
 * Deploys the BTFArtistMinter V2 contract with:
 *   - Continuous bonding curve (price rises per mint)
 *   - 800 public + 200 platform reserve
 *   - 4-way distribution (40% burn, 30% staking, 20% treasury, 10% reserve)
 *   - On-chain value appreciation system
 *
 * Prerequisites:
 *   - BTFToken deployed (need address)
 *   - BTFStakingVault deployed (need address)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-btf-artist-minter.cjs --network polygon
 */
async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  🎨 BTF ARTIST MINTER V2 DEPLOYMENT — Boostify Music");
  console.log("═══════════════════════════════════════════════════════\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(balance), "MATIC\n");

  // ═══════════════════════════════════════════════════════
  //  CONTRACT ADDRESSES — from previous deployment
  // ═══════════════════════════════════════════════════════
  
  let btfTokenAddress = process.env.BTF_TOKEN_ADDRESS;
  let stakingVaultAddress = process.env.BTF_STAKING_VAULT_ADDRESS;
  
  const deploymentFile = path.join(__dirname, '..', 'btf-token-deployment-polygon.json');
  if (fs.existsSync(deploymentFile)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    btfTokenAddress = btfTokenAddress || deployment.contracts?.BTFToken?.address || deployment.btfToken?.address;
    stakingVaultAddress = stakingVaultAddress || deployment.contracts?.BTFStakingVault?.address || deployment.btfStakingVault?.address;
  }

  if (!btfTokenAddress || !stakingVaultAddress) {
    console.error("❌ Missing BTFToken or BTFStakingVault addresses.");
    console.error("   Set BTF_TOKEN_ADDRESS and BTF_STAKING_VAULT_ADDRESS in .env");
    console.error("   Or ensure btf-token-deployment-polygon.json exists.");
    process.exit(1);
  }

  const TREASURY = process.env.BTF_TREASURY_WALLET || deployer.address;
  const RESERVE_FUND = process.env.BTF_RESERVE_FUND_WALLET || deployer.address;
  const ADMIN = process.env.BTF_ADMIN_WALLET || deployer.address;

  console.log("⚙️  Configuration V2:");
  console.log("   BTF Token:      ", btfTokenAddress);
  console.log("   Staking Vault:  ", stakingVaultAddress);
  console.log("   Treasury:       ", TREASURY);
  console.log("   Reserve Fund:   ", RESERVE_FUND);
  console.log("   Admin:          ", ADMIN);
  console.log("   Public Supply:   800");
  console.log("   Platform Reserve:200");
  console.log("");

  // ═══════════════════════════════════════════════════════
  //  DEPLOY BTFArtistMinter V2
  // ═══════════════════════════════════════════════════════

  console.log("🏗️  Deploying BTFArtistMinter V2...");
  
  const BTFArtistMinter = await hre.ethers.getContractFactory("BTFArtistMinter");
  const minter = await BTFArtistMinter.deploy(
    btfTokenAddress,
    stakingVaultAddress,
    TREASURY,
    RESERVE_FUND,
    ADMIN
  );
  
  await minter.waitForDeployment();
  const minterAddress = await minter.getAddress();
  
  console.log("  ✅ BTFArtistMinter V2:", minterAddress);
  console.log("");

  // ═══════════════════════════════════════════════════════
  //  VERIFY SETUP  
  // ═══════════════════════════════════════════════════════

  console.log("🔍 Verifying deployment...");
  
  const maxArtists = await minter.MAX_ARTISTS();
  const publicSupply = await minter.PUBLIC_SUPPLY();
  const platformReserve = await minter.PLATFORM_RESERVE();
  const currentPrice = await minter.getCurrentPrice();
  const publicMinted = await minter.publicMinted();
  const tier = await minter.getCurrentTier();
  
  console.log("   Max Artists:      ", maxArtists.toString());
  console.log("   Public Supply:    ", publicSupply.toString());
  console.log("   Platform Reserve: ", platformReserve.toString());
  console.log("   Public Minted:    ", publicMinted.toString());
  console.log("   Current Tier:     ", tier.toString());
  console.log("   Current Price:    ", hre.ethers.formatEther(currentPrice), "BTF");
  console.log("");

  // Bonding curve
  const [basePrices, steps, boundaries] = await minter.getBondingCurve();
  const tierNames = ['Tier 1 (Common)', 'Tier 2 (Uncommon)', 'Tier 3 (Rare)', 'Tier 4 (Epic)', 'Tier 5 (Legendary)'];
  console.log("📊 Continuous Bonding Curve:");
  for (let i = 0; i < 5; i++) {
    console.log(`   ${tierNames[i]}: base ${hre.ethers.formatEther(basePrices[i])} BTF (+${hre.ethers.formatEther(steps[i])}/mint) up to #${boundaries[i]}`);
  }
  console.log("");

  // ═══════════════════════════════════════════════════════
  //  SAVE DEPLOYMENT INFO
  // ═══════════════════════════════════════════════════════

  const deploymentData = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    version: "V2",
    contracts: {
      btfToken: btfTokenAddress,
      stakingVault: stakingVaultAddress,
      artistMinter: minterAddress,
    },
    configuration: {
      maxArtists: 1000,
      publicSupply: 800,
      platformReserve: 200,
      maxPerWallet: 5,
      burnBps: 4000,
      stakingBps: 3000,
      treasuryBps: 2000,
      reserveFundBps: 1000,
    },
    bondingCurve: {
      tier1: { artists: '1-160', base: '2,000 BTF', step: '+10/mint' },
      tier2: { artists: '161-400', base: '3,500 BTF', step: '+20/mint' },
      tier3: { artists: '401-600', base: '6,000 BTF', step: '+40/mint' },
      tier4: { artists: '601-720', base: '10,000 BTF', step: '+80/mint' },
      tier5: { artists: '721-800', base: '20,000 BTF', step: '+150/mint' },
    },
    tokenDistribution: {
      burn: '40%',
      stakingVault: '30%',
      treasury: '20%',
      reserveFund: '10%',
    },
    valueAppreciation: {
      song_created: 50,
      video_created: 200,
      collab_completed: 100,
      fan_interaction: 25,
      merch_sold: 75,
      stream_milestone: 150,
    }
  };

  const outputFile = path.join(__dirname, '..', 'btf-artist-minter-deployment.json');
  fs.writeFileSync(outputFile, JSON.stringify(deploymentData, null, 2));
  console.log("💾 Deployment saved to:", outputFile);

  if (fs.existsSync(deploymentFile)) {
    const mainDeployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    mainDeployment.btfArtistMinter = {
      address: minterAddress,
      version: "V2",
      deployedAt: new Date().toISOString(),
      maxArtists: 1000,
      publicSupply: 800,
      platformReserve: 200,
    };
    fs.writeFileSync(deploymentFile, JSON.stringify(mainDeployment, null, 2));
    console.log("📝 Updated main deployment file with ArtistMinter V2 address.");
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  🎉 AI ARTIST MINTER V2 DEPLOYED SUCCESSFULLY!");
  console.log("═══════════════════════════════════════════════════════");
  console.log("");
  console.log("  📋 Next Steps:");
  console.log("  1. Verify on Polygonscan:");
  console.log(`     npx hardhat verify --network polygon ${minterAddress} ${btfTokenAddress} ${stakingVaultAddress} ${TREASURY} ${RESERVE_FUND} ${ADMIN}`);
  console.log("  2. Update frontend config with ArtistMinter address");
  console.log("  3. Set activity reporters:");
  console.log(`     minter.setActivityReporter(backendAddress, true)`);
  console.log("  4. Test mint flow on frontend");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
