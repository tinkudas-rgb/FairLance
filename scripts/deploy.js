const { ethers } = require("hardhat");
async function main() {
  const fair = await ethers.deployContract("FairLance");
  await fair.waitForDeployment();
  console.log("FairLance deployed to:", await fair.getAddress());
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
