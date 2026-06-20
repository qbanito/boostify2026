const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting BTF-2300 Contract Deployment...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying contracts with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "MATIC\n");

  // ============================================
  // CONFIGURATION - UPDATE THESE VALUES
  // ============================================
  const PLATFORM_WALLET = process.env.PLATFORM_WALLET || deployer.address;
  const BASE_METADATA_URI = process.env.METADATA_URI || "https://api.boostifymusic.com/metadata/";
  
  console.log("⚙️  Configuration:");
  console.log("   Platform Wallet:", PLATFORM_WALLET);
  console.log("   Metadata URI:", BASE_METADATA_URI);
  console.log("");

  // ============================================
  // 1. Deploy BTF2300 Artist Token (Main Contract)
  // ============================================
  console.log("📦 Deploying BTF2300ArtistToken...");
  
  const BTF2300ArtistToken = await hre.ethers.getContractFactory("BTF2300ArtistToken");
  const artistToken = await BTF2300ArtistToken.deploy(PLATFORM_WALLET, BASE_METADATA_URI);
  await artistToken.waitForDeployment();
  
  const artistTokenAddress = await artistToken.getAddress();
  console.log("✅ BTF2300ArtistToken deployed to:", artistTokenAddress);

  // ============================================
  // 2. Deploy BTF2300 DEX
  // ============================================
  console.log("\n📦 Deploying BTF2300DEX...");
  
  const BTF2300DEX = await hre.ethers.getContractFactory("BTF2300DEX");
  const dex = await BTF2300DEX.deploy(artistTokenAddress, PLATFORM_WALLET);
  await dex.waitForDeployment();
  
  const dexAddress = await dex.getAddress();
  console.log("✅ BTF2300DEX deployed to:", dexAddress);

  // ============================================
  // 3. Deploy BTF2300 Royalties
  // ============================================
  console.log("\n📦 Deploying BTF2300Royalties...");
  
  const BTF2300Royalties = await hre.ethers.getContractFactory("BTF2300Royalties");
  const royalties = await BTF2300Royalties.deploy(artistTokenAddress, PLATFORM_WALLET);
  await royalties.waitForDeployment();
  
  const royaltiesAddress = await royalties.getAddress();
  console.log("✅ BTF2300Royalties deployed to:", royaltiesAddress);

  // ============================================
  // 4. Grant Roles
  // ============================================
  console.log("\n🔐 Setting up roles...");
  
  // Grant MINTER_ROLE to deployer (for backend minting)
  const MINTER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MINTER_ROLE"));
  await artistToken.grantRole(MINTER_ROLE, deployer.address);
  console.log("   ✓ MINTER_ROLE granted to deployer");
  
  // Grant DISTRIBUTOR_ROLE to deployer (for royalty distribution)
  const DISTRIBUTOR_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("DISTRIBUTOR_ROLE"));
  await royalties.grantRole(DISTRIBUTOR_ROLE, deployer.address);
  console.log("   ✓ DISTRIBUTOR_ROLE granted to deployer");

  // ============================================
  // 5. Save Deployment Info
  // ============================================
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    platformWallet: PLATFORM_WALLET,
    metadataURI: BASE_METADATA_URI,
    contracts: {
      BTF2300ArtistToken: {
        address: artistTokenAddress,
        name: "BTF-2300 Artist Token",
        symbol: "BTF2300"
      },
      BTF2300DEX: {
        address: dexAddress,
        name: "BTF-2300 DEX",
        linkedTo: artistTokenAddress
      },
      BTF2300Royalties: {
        address: royaltiesAddress,
        name: "BTF-2300 Royalties",
        linkedTo: artistTokenAddress
      }
    }
  };

  // Save to file
  const deploymentPath = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath, { recursive: true });
  }
  
  const filename = `deployment-${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentPath, filename),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  // Also save as latest
  fs.writeFileSync(
    path.join(deploymentPath, `latest-${hre.network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // ============================================
  // 6. Summary
  // ============================================
  console.log("\n" + "=".repeat(60));
  console.log("🎉 BTF-2300 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Addresses:");
  console.log("   BTF2300ArtistToken:", artistTokenAddress);
  console.log("   BTF2300DEX:        ", dexAddress);
  console.log("   BTF2300Royalties:  ", royaltiesAddress);
  console.log("\n📁 Deployment saved to:", path.join(deploymentPath, filename));
  console.log("\n⚠️  IMPORTANT: Update these addresses in your frontend config!");
  console.log("   File: client/src/lib/web3-config.ts");
  console.log("=".repeat(60));

  // ============================================
  // 7. Verify Contracts (if not local)
  // ============================================
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("\n⏳ Waiting 30 seconds before verification...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log("\n🔍 Verifying contracts on Polygonscan...");
    
    try {
      await hre.run("verify:verify", {
        address: artistTokenAddress,
        constructorArguments: [PLATFORM_WALLET, BASE_METADATA_URI],
      });
      console.log("   ✓ BTF2300ArtistToken verified");
    } catch (e) {
      console.log("   ⚠️ BTF2300ArtistToken verification failed:", e.message);
    }

    try {
      await hre.run("verify:verify", {
        address: dexAddress,
        constructorArguments: [artistTokenAddress, PLATFORM_WALLET],
      });
      console.log("   ✓ BTF2300DEX verified");
    } catch (e) {
      console.log("   ⚠️ BTF2300DEX verification failed:", e.message);
    }

    try {
      await hre.run("verify:verify", {
        address: royaltiesAddress,
        constructorArguments: [artistTokenAddress, PLATFORM_WALLET],
      });
      console.log("   ✓ BTF2300Royalties verified");
    } catch (e) {
      console.log("   ⚠️ BTF2300Royalties verification failed:", e.message);
    }
  }

  return deploymentInfo;
}

main()
  .then((info) => {
    console.log("\n✅ Deployment successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
