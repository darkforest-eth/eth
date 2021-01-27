const HDWalletProvider = require("@truffle/hdwallet-provider");
// NOTE: when running oz send-tx or oz upgrade for production contracts,
// isProd will be false. you'll have to manually set it to true
const isProd = process.env.NODE_ENV === "production";
require("dotenv").config({
  path: isProd ? ".env.prod" : ".env.example",
});

module.exports = {
  networks: {
    development: {
      provider: () =>
        new HDWalletProvider(
          process.env.deployer_mnemonic,
          "http://localhost:8545"
        ),
      protocol: "http",
      host: "localhost",
      port: 8545,
      gas: 8000000,
      gasPrice: 5e9,
      networkId: "*",
    },
    ropsten: {
      provider: () =>
        new HDWalletProvider(
          process.env.deployer_mnemonic,
          `https://ropsten.infura.io/v3/${process.env.project_id}`
        ),
      networkId: 3,
      gasPrice: 10e9,
    },
    xdai: {
      provider: () =>
        new HDWalletProvider(
          process.env.deployer_mnemonic,
          `https://dai.poa.network/`
        ),
      networkId: 100,
      gas: 8000000,
      gasPrice: 1e9,
    },
    personalGanache: {
      provider: () =>
        new HDWalletProvider(
          process.env.deployer_mnemonic,
          "https://dark-forest.online:8545"
        ),
      gas: 8000000,
      gasPrice: 1e8,
    },
  },
};
