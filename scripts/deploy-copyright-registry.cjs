const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * BoostifyCopyrightRegistry Deployment Script
 * 
 * Deploys the immutable on-chain copyright hash registry.
 * Each certification stores: SHA-256 hash, author wallet, timestamp, song title, authorship score.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-copyright-registry.cjs --network polygon
 *   npx hardhat run scripts/deploy-copyright-registry.cjs --network amoy
 */
async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  🔒 COPYRIGHT REGISTRY DEPLOYMENT — Boostify Music");
  console.log("═══════════════════════════════════════════════════════\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(balance), "MATIC\n");

  if (parseFloat(hre.ethers.formatEther(balance)) < 0.05) {
    console.error("❌ Insufficient MATIC. Need at least 0.05 MATIC for deployment gas.");
    process.exit(1);
  }

  // Deploy
  console.log("📦 Deploying BoostifyCopyrightRegistry...");
  const Factory = await hre.ethers.getContractFactory("BoostifyCopyrightRegistry");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ Deployed at:", address);
  console.log("   Owner:", deployer.address);

  // Save deployment info
  const networkName = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  const deploymentInfo = {
    contract: "BoostifyCopyrightRegistry",
    address,
    deployer: deployer.address,
    network: networkName,
    chainId: Number(chainId),
    deployedAt: new Date().toISOString(),
    txHash: contract.deploymentTransaction()?.hash || null,
  };

  const outPath = path.join(__dirname, "..", "copyright-registry-deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📄 Deployment info saved to copyright-registry-deployment.json");

  // Remind to set env var
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅ DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`\n  Set this in your .env / Render / hosting:\n`);
  console.log(`  COPYRIGHT_REGISTRY_ADDRESS=${address}`);
  console.log("");

  // Verify on Polygonscan (optional, may fail if API key missing)
  if (networkName === "polygon" || networkName === "amoy") {
    console.log("⏳ Waiting 30s before Polygonscan verification...");
    await new Promise(r => setTimeout(r, 30000));
    try {
      await hre.run("verify:verify", {
        address,
        constructorArguments: [],
      });
      console.log("✅ Verified on Polygonscan!");
    } catch (err) {
      console.log("⚠️  Polygonscan verification skipped:", err.message?.substring(0, 100));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
