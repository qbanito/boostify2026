const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * BTFTokenSale Deployment Script
 * 
 * Deploys the BTFTokenSale contract and funds it with BTF from the deployer.
 * After deployment, it also excludes the sale contract from BTF token fees & limits.
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-btf-sale.cjs --network polygon
 *   npx hardhat run scripts/deploy-btf-sale.cjs --network amoy
 *   npx hardhat run scripts/deploy-btf-sale.cjs --network localhost
 */
async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  🏪 BTF TOKEN SALE DEPLOYMENT — Boostify Music");
  console.log("═══════════════════════════════════════════════════════\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 MATIC Balance:", hre.ethers.formatEther(balance), "MATIC\n");

  // ── Configuration ──
  const BTF_TOKEN_ADDRESS = process.env.BTF_TOKEN_ADDRESS || "0x3DF18dAa074D8744cC620a89CFc8b7c4138CEb05";
  
  // Rate: BTF per 1 MATIC (18 decimals)
  // Example: 1 MATIC = 1000 BTF → rate = 1000 * 10^18
  const RATE = hre.ethers.parseEther(process.env.BTF_SALE_RATE || "1000");
  
  // Initial BTF deposit amount (from deployer's balance)
  const INITIAL_DEPOSIT = hre.ethers.parseEther(process.env.BTF_SALE_DEPOSIT || "1000000"); // 1M BTF
  
  console.log("⚙️  Configuration:");
  console.log("   BTF Token:       ", BTF_TOKEN_ADDRESS);
  console.log("   Rate:            ", `1 MATIC = ${hre.ethers.formatEther(RATE)} BTF`);
  console.log("   Initial Deposit: ", `${hre.ethers.formatEther(INITIAL_DEPOSIT)} BTF`);
  console.log("");

  // ── Check BTF Balance ──
  const btfToken = await hre.ethers.getContractAt("BTFToken", BTF_TOKEN_ADDRESS);
  const deployerBTF = await btfToken.balanceOf(deployer.address);
  console.log("🪙  Deployer BTF Balance:", hre.ethers.formatEther(deployerBTF), "BTF");

  if (deployerBTF < INITIAL_DEPOSIT) {
    console.error(`❌ Insufficient BTF. Have ${hre.ethers.formatEther(deployerBTF)}, need ${hre.ethers.formatEther(INITIAL_DEPOSIT)}`);
    console.error("   Reduce BTF_SALE_DEPOSIT or transfer more BTF to deployer.");
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════
  //  1. DEPLOY BTFTokenSale
  // ═══════════════════════════════════════════════════════

  console.log("\n📦 [1/4] Deploying BTFTokenSale...");
  const BTFTokenSale = await hre.ethers.getContractFactory("BTFTokenSale");
  const sale = await BTFTokenSale.deploy(BTF_TOKEN_ADDRESS, RATE);
  await sale.waitForDeployment();
  const saleAddress = await sale.getAddress();
  console.log("   ✅ BTFTokenSale deployed:", saleAddress);

  // ═══════════════════════════════════════════════════════
  //  2. EXCLUDE SALE CONTRACT FROM BTF FEES & LIMITS
  // ═══════════════════════════════════════════════════════

  console.log("\n🔧 [2/4] Excluding sale contract from BTF fees & limits...");
  try {
    const tx1 = await btfToken.setExcludedFromFees(saleAddress, true);
    await tx1.wait();
    console.log("   ✅ Excluded from fees");
  } catch (e) {
    console.log("   ⚠️  Could not exclude from fees:", e.message?.substring(0, 100));
  }

  try {
    const tx2 = await btfToken.setExcludedFromLimits(saleAddress, true);
    await tx2.wait();
    console.log("   ✅ Excluded from wallet limits");
  } catch (e) {
    console.log("   ⚠️  Could not exclude from limits:", e.message?.substring(0, 100));
  }

  // ═══════════════════════════════════════════════════════
  //  3. DEPOSIT BTF INTO SALE CONTRACT
  // ═══════════════════════════════════════════════════════

  console.log("\n💎 [3/4] Depositing BTF into sale contract...");
  try {
    const tx3 = await btfToken.transfer(saleAddress, INITIAL_DEPOSIT);
    await tx3.wait();
    const saleBalance = await btfToken.balanceOf(saleAddress);
    console.log("   ✅ Deposited:", hre.ethers.formatEther(saleBalance), "BTF");
  } catch (e) {
    console.error("   ❌ Deposit failed:", e.message?.substring(0, 200));
    console.log("   You can manually transfer BTF to:", saleAddress);
  }

  // ═══════════════════════════════════════════════════════
  //  4. VERIFY DEPLOYMENT
  // ═══════════════════════════════════════════════════════

  console.log("\n🔍 [4/4] Verifying deployment...");
  const saleInfo = await sale.getSaleInfo();
  console.log("   Rate:          ", `1 MATIC = ${hre.ethers.formatEther(saleInfo[0])} BTF`);
  console.log("   Min Purchase:  ", hre.ethers.formatEther(saleInfo[1]), "MATIC");
  console.log("   Max Purchase:  ", hre.ethers.formatEther(saleInfo[2]), "MATIC");
  console.log("   BTF Available: ", hre.ethers.formatEther(saleInfo[3]), "BTF");
  console.log("   Total Raised:  ", hre.ethers.formatEther(saleInfo[4]), "MATIC");
  console.log("   Paused:        ", saleInfo[7]);

  // ═══════════════════════════════════════════════════════
  //  SAVE DEPLOYMENT INFO
  // ═══════════════════════════════════════════════════════

  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    contracts: {
      BTFToken: BTF_TOKEN_ADDRESS,
      BTFTokenSale: saleAddress,
    },
    config: {
      rate: hre.ethers.formatEther(RATE),
      rateRaw: RATE.toString(),
      initialDeposit: hre.ethers.formatEther(INITIAL_DEPOSIT),
    },
    deployedAt: new Date().toISOString(),
  };

  const outFile = path.join(__dirname, "..", "deployment-btf-sale.json");
  fs.writeFileSync(outFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📝 Deployment info saved to deployment-btf-sale.json");

  // ═══════════════════════════════════════════════════════
  //  SUMMARY
  // ═══════════════════════════════════════════════════════

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅ DEPLOYMENT COMPLETE!");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  BTFTokenSale: ${saleAddress}`);
  console.log(`  Rate: 1 MATIC = ${hre.ethers.formatEther(RATE)} BTF`);
  console.log("");
  console.log("  📌 NEXT STEPS:");
  console.log("  1. Update BTF_SALE_ADDRESS in client/src/lib/btf-token-config.ts");
  console.log(`     → BTF_SALE_ADDRESS = '${saleAddress}'`);
  console.log("  2. Verify on PolygonScan:");
  console.log(`     npx hardhat verify --network polygon ${saleAddress} ${BTF_TOKEN_ADDRESS} ${RATE}`);
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
