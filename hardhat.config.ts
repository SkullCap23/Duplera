import { defineConfig } from "hardhat/config";
export default defineConfig({
  solidity: { version: "0.8.38", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris" } },
  paths: { sources: "./packages/contracts/src" },
});
