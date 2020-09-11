const HDWalletProvider = require("@truffle/hdwallet-provider");
require("dotenv").config({ path: `./.env.prod` });

module.exports = {
  networks: {
    development: {
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
  },
};
