const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * BTF Token Verification Script
 * 
 * Verifies both BTFToken and BTFStakingVault on Polygonscan.
 * Run AFTER deploy-btf-token.js has been executed.
 * 
 * Usage:
 *   npx hardhat run scripts/verify-btf-token.js --config hardhat.config.cjs --network amoy
 */
async function main() {
  const network = hre.network.name;
  const deploymentPath = path.join(__dirname, "..", `btf-token-deployment-${network}.json`);

  if (!fs.existsSync(deploymentPath)) {
    console.error(`❌ No deployment file found: ${deploymentPath}`);
    console.error(`   Run deploy-btf-token.js first on network '${network}'`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log("═══════════════════════════════════════════════════════");
  console.log("  🔍 BTF TOKEN VERIFICATION — Polygonscan");
  console.log("═══════════════════════════════════════════════════════\n");

  const { contracts, wallets } = deployment;

  // ═══════════════════════════════════════════════════════
  //  1. Verify BTFToken
  // ═══════════════════════════════════════════════════════
  console.log(`📦 [1/2] Verifying BTFToken at ${contracts.BTFToken.address}...`);
  try {
    await hre.run("verify:verify", {
      address: contracts.BTFToken.address,
      constructorArguments: [
        wallets.admin,
        wallets.ecosystem,
        wallets.liquidity,
        wallets.team,
        wallets.treasury,
        wallets.earlySupporters,
        wallets.marketing,
      ],
    });
    console.log("✅ BTFToken verified on Polygonscan!\n");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("ℹ️  BTFToken already verified.\n");
    } else {
      console.error("❌ BTFToken verification failed:", error.message, "\n");
    }
  }

  // ═══════════════════════════════════════════════════════
  //  2. Verify BTFStakingVault
  // ═══════════════════════════════════════════════════════
  console.log(`📦 [2/2] Verifying BTFStakingVault at ${contracts.BTFStakingVault.address}...`);
  try {
    await hre.run("verify:verify", {
      address: contracts.BTFStakingVault.address,
      constructorArguments: [
        contracts.BTFToken.address,
        wallets.admin,
      ],
    });
    console.log("✅ BTFStakingVault verified on Polygonscan!\n");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("ℹ️  BTFStakingVault already verified.\n");
    } else {
      console.error("❌ BTFStakingVault verification failed:", error.message, "\n");
    }
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log("  ✅ VERIFICATION COMPLETE");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  BTFToken:        https://amoy.polygonscan.com/address/${contracts.BTFToken.address}`);
  console.log(`  BTFStakingVault: https://amoy.polygonscan.com/address/${contracts.BTFStakingVault.address}`);
  console.log("═══════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification script failed:", error);
    process.exit(1);
  });
