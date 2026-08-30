require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: "0.8.26",
  networks: {
    amoy: {
      // Polygon Amoy testnet — set these in blockchain/.env before deploying.
      url: process.env.POLYGON_RPC_URL || "",
      accounts: process.env.POLYGON_PRIVATE_KEY ? [process.env.POLYGON_PRIVATE_KEY] : [],
    },
  },
};
