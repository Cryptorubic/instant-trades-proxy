import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomiclabs/hardhat-web3";

dotenv.config();

const {
  BSC_RPC,
  POLYGON_RPC,
  FANTOM_RPC,
  AVALANCHE_RPC,
  HARMONY_RPC,
  MOONRIVER_RPC,
  ARBITRUM_RPC,
  AURORA_RPC,

  PRIVATE_KEY,

  BSCSCAN_API_KEY,
  POLYGONSCAN_API_KEY,
  FTMSCAN_API_KEY,
  MOONRIVER_MOONSCAN_API_KEY,
  SNOWTRACE_API_KEY,
  ARBISCAN_API_KEY
} = process.env;

const config: HardhatUserConfig = {
  solidity: "0.8.4",
  networks: {
    hardhat: {
      forking: {
        url: BSC_RPC!,
        blockNumber: 14255005
      },
      chainId: 56
    },
    bsc: {
      url: BSC_RPC,
      accounts: [ PRIVATE_KEY! ]
    },
    polygon: {
      url: POLYGON_RPC,
      accounts: [ PRIVATE_KEY! ]
    },
    fantom: {
      url: FANTOM_RPC,
      accounts: [ PRIVATE_KEY! ]
    },
    avalanche: {
      url: AVALANCHE_RPC,
      accounts: [ PRIVATE_KEY! ]
    },
    harmony: {
      url: HARMONY_RPC,
      accounts: [ PRIVATE_KEY! ]
    },
    moonriver: {
      url: MOONRIVER_RPC,
      accounts: [ PRIVATE_KEY! ]
    },
    arbitrum: {
      url: ARBITRUM_RPC,
      accounts: [ PRIVATE_KEY! ],
      gas: 50000000
    },
    aurora: {
      url: AURORA_RPC,
      accounts: [ PRIVATE_KEY! ]
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: ARBISCAN_API_KEY
  }
};

export default config;
