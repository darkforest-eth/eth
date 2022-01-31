import { DeployOptions } from '@openzeppelin/hardhat-upgrades/dist/deploy-proxy';
import { TransactionMinedTimeout } from '@openzeppelin/upgrades-core';
import { Contract, Signer } from 'ethers';
import { subtask, types } from 'hardhat/config';
import { FactoryOptions, HardhatRuntimeEnvironment } from 'hardhat/types';
import type {
  DarkForestCore,
  DarkForestCoreReturn,
  DarkForestGetters,
  DarkForestGPTCredit,
  DarkForestScoringRound3,
  DarkForestTokens,
  LibraryContracts,
  Whitelist,
} from '../task-types';

subtask('deploy:getters', 'deploy and return getters')
  .addParam('controllerWalletAddress', '', undefined, types.string)
  .addParam('coreAddress', '', undefined, types.string)
  .addParam('tokensAddress', '', undefined, types.string)
  .addParam('utilsAddress', '', undefined, types.string)
  .setAction(deployGetters);

async function deployGetters(
  args: {
    controllerWalletAddress: string;
    coreAddress: string;
    tokensAddress: string;
    utilsAddress: string;
  },
  hre: HardhatRuntimeEnvironment
): Promise<DarkForestGetters> {
  return deployProxyWithRetry<DarkForestGetters>({
    contractName: 'DarkForestGetters',
    signerOrOptions: {
      libraries: {
        DarkForestUtils: args.utilsAddress,
      },
    },
    contractArgs: [args.controllerWalletAddress, args.coreAddress, args.tokensAddress],
    // Linking external libraries like `DarkForestGetters` is not yet supported, or
    // skip this check with the `unsafeAllowLinkedLibraries` flag
    deployOptions: { unsafeAllowLinkedLibraries: true },
    retries: 5,
    hre,
  });
}

subtask('deploy:whitelist', 'deploy and return whitelist')
  .addParam('controllerWalletAddress', '', undefined, types.string)
  .addParam('whitelistEnabled', '', undefined, types.boolean)
  .setAction(deployWhitelist);

async function deployWhitelist(
  args: { controllerWalletAddress: string; whitelistEnabled: boolean },
  hre: HardhatRuntimeEnvironment
): Promise<Whitelist> {
  return deployProxyWithRetry<Whitelist>({
    contractName: 'Whitelist',
    signerOrOptions: {},
    contractArgs: [args.controllerWalletAddress, args.whitelistEnabled],
    deployOptions: {},
    retries: 5,
    hre,
  });
}

subtask('deploy:gptcredits', 'deploy and return GPT credits contract')
  .addParam('controllerWalletAddress', '', undefined, types.string)
  .setAction(deployGPTCredits);

async function deployGPTCredits(
  args: { controllerWalletAddress: string },
  hre: HardhatRuntimeEnvironment
): Promise<DarkForestGPTCredit> {
  return deployProxyWithRetry<DarkForestGPTCredit>({
    contractName: 'DarkForestGPTCredit',
    signerOrOptions: {},
    contractArgs: [args.controllerWalletAddress],
    deployOptions: {},
    retries: 5,
    hre,
  });
}

subtask('deploy:score', 'deploy and return Scoring Contract')
  .addParam('coreAddress', '', undefined, types.string)
  .addParam('roundName', '', undefined, types.string)
  .addParam('roundEnd', '', undefined, types.int)
  .addParam('claimPlanetCooldown', '', undefined, types.int)
  .setAction(deployScoreContract);

async function deployScoreContract(
  args: {
    coreAddress: string;
    roundName: string;
    roundEnd: number;
    claimPlanetCooldown: number;
  },
  hre: HardhatRuntimeEnvironment
): Promise<DarkForestScoringRound3> {
  return deployProxyWithRetry<DarkForestScoringRound3>({
    contractName: 'DarkForestScoringRound3',
    signerOrOptions: {},
    contractArgs: [args.coreAddress, args.roundName, args.roundEnd, args.claimPlanetCooldown],
    deployOptions: {},
    retries: 5,
    hre,
  });
}

subtask('deploy:tokens', 'deploy and return tokens contract').setAction(deployTokens);

async function deployTokens({}, hre: HardhatRuntimeEnvironment): Promise<DarkForestTokens> {
  return deployProxyWithRetry<DarkForestTokens>({
    contractName: 'DarkForestTokens',
    signerOrOptions: {},
    contractArgs: [],
    deployOptions: { initializer: false },
    retries: 5,
    hre,
  });
}

subtask('deploy:libraries', 'deploy and return tokens contract').setAction(deployLibraries);

async function deployLibraries({}, hre: HardhatRuntimeEnvironment): Promise<LibraryContracts> {
  const UtilsFactory = await hre.ethers.getContractFactory('DarkForestUtils');
  const utils = await UtilsFactory.deploy();
  await utils.deployTransaction.wait();

  const LazyUpdateFactory = await hre.ethers.getContractFactory('DarkForestLazyUpdate');
  const lazyUpdate = await LazyUpdateFactory.deploy();
  await lazyUpdate.deployTransaction.wait();

  const ArtifactUtilsFactory = await hre.ethers.getContractFactory('DarkForestArtifactUtils', {
    libraries: {
      DarkForestUtils: utils.address,
    },
  });

  const artifactUtils = await ArtifactUtilsFactory.deploy();
  await artifactUtils.deployTransaction.wait();

  const PlanetFactory = await hre.ethers.getContractFactory('DarkForestPlanet', {
    libraries: {
      DarkForestUtils: utils.address,
      DarkForestLazyUpdate: lazyUpdate.address,
      DarkForestArtifactUtils: artifactUtils.address,
    },
  });
  const planet = await PlanetFactory.deploy();
  await planet.deployTransaction.wait();

  const InitializeFactory = await hre.ethers.getContractFactory('DarkForestInitialize');
  const initialize = await InitializeFactory.deploy();
  await initialize.deployTransaction.wait();

  const VerifierFactory = await hre.ethers.getContractFactory('Verifier');
  const verifier = await VerifierFactory.deploy();
  await verifier.deployTransaction.wait();

  return {
    lazyUpdate,
    utils: utils,
    planet: planet,
    initialize,
    verifier: verifier,
    artifactUtils: artifactUtils,
  };
}

subtask('deploy:core', 'deploy and return tokens contract')
  .addParam('controllerWalletAddress', '', undefined, types.string)
  .addParam('whitelistAddress', '', undefined, types.string)
  .addParam('tokensAddress', '', undefined, types.string)
  .addParam('initializeAddress', '', undefined, types.string)
  .addParam('planetAddress', '', undefined, types.string)
  .addParam('utilsAddress', '', undefined, types.string)
  .addParam('verifierAddress', '', undefined, types.string)
  .addParam('artifactUtilsAddress', '', undefined, types.string)
  .setAction(deployCore);

async function deployCore(
  args: {
    controllerWalletAddress: string;
    whitelistAddress: string;
    tokensAddress: string;
    initializeAddress: string;
    planetAddress: string;
    utilsAddress: string;
    verifierAddress: string;
    artifactUtilsAddress: string;
  },
  hre: HardhatRuntimeEnvironment
): Promise<DarkForestCoreReturn> {
  const darkForestCore = await deployProxyWithRetry<DarkForestCore>({
    contractName: 'DarkForestCore',
    signerOrOptions: {
      libraries: {
        DarkForestInitialize: args.initializeAddress,
        DarkForestPlanet: args.planetAddress,
        DarkForestUtils: args.utilsAddress,
        Verifier: args.verifierAddress,
        DarkForestArtifactUtils: args.artifactUtilsAddress,
      },
    },
    contractArgs: [
      args.controllerWalletAddress,
      args.whitelistAddress,
      args.tokensAddress,
      hre.initializers,
    ],
    // Linking external libraries like `DarkForestUtils` is not yet supported, or
    // skip this check with the `unsafeAllowLinkedLibraries` flag
    deployOptions: { unsafeAllowLinkedLibraries: true },
    retries: 5,
    hre,
  });

  const blockNumber = await (await darkForestCore.deployTransaction.wait()).blockNumber;

  return {
    // should be impossible to not exist since we waited on it in deployProxyWithRetry
    blockNumber,
    contract: darkForestCore,
  };
}

async function deployProxyWithRetry<C extends Contract>({
  contractName,
  signerOrOptions,
  contractArgs,
  deployOptions,
  hre,
  retries,
}: {
  contractName: string;
  signerOrOptions: Signer | FactoryOptions | undefined;
  contractArgs: unknown[];
  deployOptions: DeployOptions;
  hre: HardhatRuntimeEnvironment;
  retries: number;
}): Promise<C> {
  try {
    const factory = await hre.ethers.getContractFactory(contractName, signerOrOptions);
    const contract = await hre.upgrades.deployProxy(factory, contractArgs, deployOptions);
    await contract.deployTransaction.wait();
    return contract as C;
  } catch (e) {
    if (e instanceof TransactionMinedTimeout && retries > 0) {
      console.log(`timed out deploying ${contractName}, retrying`);
      return deployProxyWithRetry({
        contractName,
        signerOrOptions,
        contractArgs,
        deployOptions,
        retries: --retries,
        hre,
      });
    } else {
      throw e;
    }
  }
}
