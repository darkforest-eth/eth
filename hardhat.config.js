
module.exports = {
  // This is a sample solc configuration that specifies which version of solc to use
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      accounts: [
        {
          privateKey:
            "0x044C7963E9A89D4F8B64AB23E02E97B2E00DD57FCB60F316AC69B77135003AEF",
          balance: "100000000000000000000",
        },
        {
          privateKey:
            "0x523170AAE57904F24FFE1F61B7E4FF9E9A0CE7557987C2FC034EACB1C267B4AE",
          balance: "100000000000000000000",
        },
        {
          privateKey:
            "0x67195c963ff445314e667112ab22f4a7404bad7f9746564eb409b9bb8c6aed32",
          balance: "100000000000000000000",
        },
      ],
      blockGasLimit: 16777215,
      blockTime: 3,
    },
  },
  solidity: {
    version: "0.6.9",
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
  },
};
