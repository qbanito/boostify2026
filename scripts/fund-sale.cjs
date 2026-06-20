const hre = require("hardhat");

const SALE = "0x2a434268ED7d16a5d5CB8f6143E4535BDe16239d";
const BTF = "0x3DF18dAa074D8744cC620a89CFc8b7c4138CEb05";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function retry(fn, label, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("rate limit") || msg.includes("Too many") || msg.includes("quota")) {
        console.log(`   ⏳ Rate limited on ${label}, waiting 15s... (attempt ${i + 1}/${attempts})`);
        await sleep(15000);
      } else {
        throw e;
      }
    }
  }
  throw new Error(`Failed after ${attempts} attempts: ${label}`);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const btf = await retry(
    () => hre.ethers.getContractAt("BTFToken", BTF),
    "getContractAt"
  );

  const bal = await retry(() => btf.balanceOf(deployer.address), "balanceOf");
  console.log("Deployer BTF:", hre.ethers.formatEther(bal));

  // Step 1: Exclude from limits (fees already done)
  console.log("\n[1/2] Excluding from limits...");
  try {
    const tx = await retry(() => btf.setExcludedFromLimits(SALE, true), "setExcludedFromLimits");
    await sleep(5000);
    await retry(() => tx.wait(), "wait-limits");
    console.log("✅ Excluded from limits");
  } catch (e) {
    console.log("⚠️", e.message?.substring(0, 100));
  }

  await sleep(10000); // cooldown between TXs

  // Step 2: Transfer 1M BTF to sale contract
  const deposit = hre.ethers.parseEther("1000000");
  console.log("\n[2/2] Depositing 1,000,000 BTF...");
  const tx3 = await retry(() => btf.transfer(SALE, deposit), "transfer");
  await sleep(5000);
  await retry(() => tx3.wait(), "wait-transfer");

  const saleBal = await retry(() => btf.balanceOf(SALE), "balanceOf-sale");
  console.log("✅ Sale contract BTF balance:", hre.ethers.formatEther(saleBal));
  console.log("\n🎉 DONE! BTFTokenSale at", SALE, "is funded and ready.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
