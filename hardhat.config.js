require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config({path: __dirname + '/.env'});

const RINKEBY_RPC_URL = process.env.RINKEBY_RPC_URL
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
      hardhat: {
          // // If you want to do some forking, uncomment this
          // forking: {
          //   url: MAINNET_RPC_URL
          // }
          chainId: 31337,
      },
      localhost: {
          chainId: 31337,
      },
      rinkeby: {
          url: RINKEBY_RPC_URL,
          accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
          //   accounts: {
          //     mnemonic: MNEMONIC,
          //   },
          saveDeployments: true,
          chainId: 4,
      },
      mainnet: {
          url: process.env.MAINNET_RPC_URL,
          accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
          //   accounts: {
          //     mnemonic: MNEMONIC,
          //   },
          saveDeployments: true,
          chainId: 1,
      },
      polygon: {
          url: process.env.POLYGON_MAINNET_RPC_URL,
          accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
          saveDeployments: true,
          chainId: 137,
      },
      polygonMumbai: {
        url: process.env.POLYGON_MUMBAI_RPC_URL,
        accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        saveDeployments: true,
        chainId: 80001,
    },
  },
  etherscan: {
      // yarn hardhat verify --network <NETWORK> <CONTRACT_ADDRESS> <CONSTRUCTOR_PARAMETERS>
      apiKey: {
          rinkeby: process.env.ETHERSCAN_API_KEY,
          polygonMumbai: process.env.POLYGONSCAN_API_KEY,
          polygon: process.env.POLYGONSCAN_API_KEY,
      },
  },
  gasReporter: {
      enabled: process.env.REPORT_GAS,
      currency: "USD",
      outputFile: "gas-report.txt",
      noColors: true,
      coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  contractSizer: {
      runOnCompile: false,
      only: ["Raffle"],
  },
  namedAccounts: {
      deployer: {
          default: 0, // here this will by default take the first account as deployer
          1: 0, // similarly on mainnet it will take the first account as deployer. Note though that depending on how hardhat network are configured, the account 0 on one network can be different than on another
      },
      player: {
          default: 1,
      },
  },
  solidity: {
      compilers: [
          {
              version: "0.8.9",
          },
          {
              version: "0.4.24",
          },
      ],
  },
  mocha: {
      timeout: 500000, // 500 seconds max for running tests
  },
}