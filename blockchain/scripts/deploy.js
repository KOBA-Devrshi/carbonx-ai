const hre = require("hardhat");

async function main() {
  const Registry = await hre.ethers.getContractFactory("CarbonDNARegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  console.log("CarbonDNARegistry deployed to:", await registry.getAddress());
  console.log("Set CARBON_DNA_CONTRACT_ADDRESS in backend/.env to this address.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
