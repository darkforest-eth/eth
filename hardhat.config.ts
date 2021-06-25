import * as path from 'path';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { HardhatUserConfig, extendEnvironment } from 'hardhat/config';
import { lazyObject } from 'hardhat/plugins';
import '@nomiclabs/hardhat-ethers';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-typechain';
import '@nomiclabs/hardhat-waffle';
import 'hardhat-contract-sizer';
import 'hardhat-circom';
import * as settings from './settings';
import './tasks/circom';
import './tasks/deploy';
import './tasks/whitelist';
import './tasks/wallet';
import './tasks/upgrades';
import './tasks/compile';
import './tasks/utils';
import './tasks/game';
import './tasks/subgraph';
import './tasks/debug';
import './tasks/gpt-credits';

require('dotenv').config();

const { DEPLOYER_MNEMONIC, ADMIN_PUBLIC_ADDRESS } = process.env;

// Ensure we can lookup the needed workspace packages
const packageDirs = {
  '@darkforest_eth/contracts': settings.resolvePackageDir('@darkforest_eth/contracts'),
  '@darkforest_eth/snarks': settings.resolvePackageDir('@darkforest_eth/snarks'),
};

extendEnvironment((env: HardhatRuntimeEnvironment) => {
  env.DEPLOYER_MNEMONIC = DEPLOYER_MNEMONIC;
  // cant easily lookup deployer.address here so well have to be ok with undefined and check it later
  env.ADMIN_PUBLIC_ADDRESS = ADMIN_PUBLIC_ADDRESS;

  env.packageDirs = packageDirs;

  env.contracts = lazyObject(() => {
    const contracts = require('@darkforest_eth/contracts');
    return settings.parse(settings.Contracts, contracts);
  });

  env.initializers = lazyObject(() => {
    const { initializers = {} } = settings.load();
    return settings.parse(settings.Initializers, initializers);
  });

  env.adminPlanets = lazyObject(() => {
    const { planets = [] } = settings.load();
    return settings.parse(settings.AdminPlanets, planets);
  });
});

// The xdai config, but it isn't added to networks unless we have a DEPLOYER_MNEMONIC
const xdai = {
  // Using our archive node for admin task running
  url: 'https://rpc-df.xdaichain.com/',
  accounts: {
    mnemonic: DEPLOYER_MNEMONIC,
  },
  chainId: 100,
};

// The mainnet config, but it isn't added to networks unless we have a DEPLOYER_MNEMONIC
const mainnet = {
  // Brian's Infura endpoint (free tier)
  url: 'https://mainnet.infura.io/v3/5459b6d562eb47f689c809fe0b78408e',
  accounts: {
    mnemonic: DEPLOYER_MNEMONIC,
  },
  chainId: 1,
};

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    // Check for a DEPLOYER_MNEMONIC before we add xdai/mainnet network to the list of networks
    // Ex: If you try to deploy to xdai without DEPLOYER_MNEMONIC, you'll see this error:
    // > Error HH100: Network xdai doesn't exist
    ...(DEPLOYER_MNEMONIC ? { xdai } : undefined),
    ...(DEPLOYER_MNEMONIC ? { mainnet } : undefined),
    localhost: {
      url: 'http://localhost:8545/',
      accounts: {
        // Same mnemonic used in the .env.example
        mnemonic: 'change typical hire slam amateur loan grid fix drama electric seed label',
      },
      chainId: 31337,
    },
    // Used when you dont specify a network on command line, like in tests
    hardhat: {
      accounts: [
        // from/deployer is default the first address in accounts
        {
          privateKey: '0x044C7963E9A89D4F8B64AB23E02E97B2E00DD57FCB60F316AC69B77135003AEF',
          balance: '100000000000000000000',
        },
        // user1 in tests
        {
          privateKey: '0x523170AAE57904F24FFE1F61B7E4FF9E9A0CE7557987C2FC034EACB1C267B4AE',
          balance: '100000000000000000000',
        },
        // user2 in tests
        {
          privateKey: '0x67195c963ff445314e667112ab22f4a7404bad7f9746564eb409b9bb8c6aed32',
          balance: '100000000000000000000',
        },
      ],
      blockGasLimit: 16777215,
    },
  },
  solidity: {
    version: '0.7.6',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
    disambiguatePaths: false,
  },
  circom: {
    inputBasePath: '../circuits/',
    outputBasePath: packageDirs['@darkforest_eth/snarks'],
    ptau: 'pot15_final.ptau',
    circuits: [
      {
        name: 'init',
        circuit: 'init/circuit.circom',
        input: 'init/input.json',
        beacon: '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      },
      {
        name: 'move',
        circuit: 'move/circuit.circom',
        input: 'move/input.json',
        beacon: '0000000005060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      },
      {
        name: 'biomebase',
        circuit: 'biomebase/circuit.circom',
        input: 'biomebase/input.json',
        beacon: '0000000005060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      },
      {
        name: 'reveal',
        circuit: 'reveal/circuit.circom',
        input: 'reveal/input.json',
        beacon: '0000000005060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      },
    ],
  },
  typechain: {
    outDir: path.join(packageDirs['@darkforest_eth/contracts'], 'typechain'),
  },
};

export default config;
