import { SCORING_CONTRACT_ADDRESS } from '@darkforest_eth/contracts';
import { DeployOptions } from '@openzeppelin/hardhat-upgrades/dist/deploy-proxy';
import { getImplementationAddress, TransactionMinedTimeout } from '@openzeppelin/upgrades-core';
import { Contract, Signer } from 'ethers';
import { task } from 'hardhat/config';
import { FactoryOptions, HardhatRuntimeEnvironment } from 'hardhat/types';
import type {
  DarkForestCore,
  DarkForestGetters,
  DarkForestGPTCredit,
  DarkForestTokens,
  LibraryContracts,
  Whitelist,
} from '../task-types';

// libraries (utils, in specific), is shared by DarkForestGetters and
// DarkForestCore, so can't be upgraded individually
task(
  'upgrade:multi',
  'upgrade libraries, DarkForestGetters, and DarkForestCore contract'
).setAction(upgradeMulti);

async function upgradeMulti({}, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  // need to force a compile for tasks
  await hre.run('compile');

  const {
    CORE_CONTRACT_ADDRESS,
    TOKENS_CONTRACT_ADDRESS,
    GETTERS_CONTRACT_ADDRESS,
    GPT_CREDIT_CONTRACT_ADDRESS,
    WHITELIST_CONTRACT_ADDRESS,
    START_BLOCK,
  } = hre.contracts;

  await upgradeProxyWithRetry<DarkForestGPTCredit>({
    contractName: 'DarkForestGPTCredit',
    contractAddress: GPT_CREDIT_CONTRACT_ADDRESS,
    signerOrOptions: {},
    deployOptions: {},
    retries: 5,
    hre,
  });

  console.log('upgraded DarkForestGPTCredit');

  await upgradeProxyWithRetry<Whitelist>({
    contractName: 'Whitelist',
    contractAddress: WHITELIST_CONTRACT_ADDRESS,
    signerOrOptions: {},
    deployOptions: {},
    retries: 5,
    hre,
  });

  console.log('upgraded Whitelist');

  const libraries: LibraryContracts = await hre.run('deploy:libraries');

  console.log('deployed new libraries');
  for (const [key, value] of Object.entries(libraries)) {
    console.log(`${key}:${value.address}`);
  }

  await upgradeProxyWithRetry<DarkForestGetters>({
    contractName: 'DarkForestGetters',
    contractAddress: GETTERS_CONTRACT_ADDRESS,
    signerOrOptions: {
      libraries: {
        DarkForestUtils: libraries.utils.address,
      },
    },
    // Linking external libraries like `DarkForestUtils` is not yet supported, or
    // skip this check with the `unsafeAllowLinkedLibraries` flag
    deployOptions: { unsafeAllowLinkedLibraries: true },
    retries: 5,
    hre,
  });

  // if we got a successful deploy based on new libraries save new addresses
  await hre.run('deploy:save', {
    coreBlockNumber: START_BLOCK,
    libraries,
    coreAddress: CORE_CONTRACT_ADDRESS,
    tokensAddress: TOKENS_CONTRACT_ADDRESS,
    gettersAddress: GETTERS_CONTRACT_ADDRESS,
    whitelistAddress: WHITELIST_CONTRACT_ADDRESS,
    gptCreditAddress: GPT_CREDIT_CONTRACT_ADDRESS,
    scoringAddress: SCORING_CONTRACT_ADDRESS,
  });

  console.log('upgraded DarkForestGetters');

  await upgradeProxyWithRetry<DarkForestCore>({
    contractName: 'DarkForestCore',
    contractAddress: CORE_CONTRACT_ADDRESS,
    signerOrOptions: {
      libraries: {
        DarkForestInitialize: libraries.initialize.address,
        DarkForestPlanet: libraries.planet.address,
        DarkForestUtils: libraries.utils.address,
        Verifier: libraries.verifier.address,
        DarkForestArtifactUtils: libraries.artifactUtils.address,
      },
    },
    // Linking external libraries like `DarkForestUtils` is not yet supported, or
    // skip this check with the `unsafeAllowLinkedLibraries` flag
    deployOptions: { unsafeAllowLinkedLibraries: true },
    retries: 5,
    hre,
  });

  console.log('upgraded DarkForestCore');
}

task('upgrade:core', 'upgrade DarkForestCore contract (only)').setAction(upgradeCore);

async function upgradeCore({}, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  // need to force a compile for tasks
  await hre.run('compile');

  const {
    CORE_CONTRACT_ADDRESS,
    UTILS_LIBRARY_ADDRESS,
    PLANET_LIBRARY_ADDRESS,
    INITIALIZE_LIBRARY_ADDRESS,
    VERIFIER_LIBRARY_ADDRESS,
    ARTIFACT_UTILS_LIBRARY_ADDRESS,
  } = hre.contracts;

  await upgradeProxyWithRetry<DarkForestCore>({
    contractName: 'DarkForestCore',
    contractAddress: CORE_CONTRACT_ADDRESS,
    signerOrOptions: {
      libraries: {
        DarkForestInitialize: INITIALIZE_LIBRARY_ADDRESS,
        DarkForestPlanet: PLANET_LIBRARY_ADDRESS,
        DarkForestArtifactUtils: ARTIFACT_UTILS_LIBRARY_ADDRESS,
        DarkForestUtils: UTILS_LIBRARY_ADDRESS,
        Verifier: VERIFIER_LIBRARY_ADDRESS,
      },
    },
    // Linking external libraries like `DarkForestUtils` is not yet supported, or
    // skip this check with the `unsafeAllowLinkedLibraries` flag
    deployOptions: { unsafeAllowLinkedLibraries: true },
    retries: 5,
    hre,
  });
}

task('upgrade:getters', 'upgrade DarkForestGetters contract (only)').setAction(upgradeGetters);

async function upgradeGetters({}, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  // need to force a compile for tasks
  await hre.run('compile');

  const { UTILS_LIBRARY_ADDRESS, GETTERS_CONTRACT_ADDRESS } = hre.contracts;

  await upgradeProxyWithRetry<DarkForestGetters>({
    contractName: 'DarkForestGetters',
    contractAddress: GETTERS_CONTRACT_ADDRESS,
    signerOrOptions: {
      libraries: {
        DarkForestUtils: UTILS_LIBRARY_ADDRESS,
      },
    },
    // Linking external libraries like `DarkForestUtils` is not yet supported, or
    // skip this check with the `unsafeAllowLinkedLibraries` flag
    deployOptions: { unsafeAllowLinkedLibraries: true },
    retries: 5,
    hre,
  });
}

task('upgrade:tokens', 'upgrade DarkForestTokens contract').setAction(upgradeTokens);

async function upgradeTokens({}, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  // need to force a compile for tasks
  await hre.run('compile');

  const { TOKENS_CONTRACT_ADDRESS } = hre.contracts;

  await upgradeProxyWithRetry<DarkForestTokens>({
    contractName: 'DarkForestTokens',
    contractAddress: TOKENS_CONTRACT_ADDRESS,
    signerOrOptions: {},
    deployOptions: {},
    retries: 5,
    hre,
  });
}

task('upgrade:gpt', 'upgrade DarkForestGPTCredit contract (only)').setAction(upgradeGpt);

async function upgradeGpt({}, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  // need to force a compile for tasks
  await hre.run('compile');

  const { GPT_CREDIT_CONTRACT_ADDRESS } = hre.contracts;

  await upgradeProxyWithRetry<DarkForestGPTCredit>({
    contractName: 'DarkForestGPTCredit',
    contractAddress: GPT_CREDIT_CONTRACT_ADDRESS,
    signerOrOptions: {},
    deployOptions: {},
    retries: 5,
    hre,
  });
}

task('getImplementationAddress', 'gets the implementation address of the given proxy contrat')
  .addPositionalParam('contractAddress')
  .setAction(getImplementationAddressTask);

async function getImplementationAddressTask(
  { contractAddress }: { contractAddress: string },
  hre: HardhatRuntimeEnvironment
) {
  const implementationAddress = await getImplementationAddress(
    hre.ethers.provider,
    contractAddress
  );

  console.log(`implementation address: ` + implementationAddress);

  return implementationAddress;
}

task('upgrade:whitelist', 'upgrade Whitelist contract (only)').setAction(upgradeWhitelist);

async function upgradeWhitelist({}, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  // need to force a compile for tasks
  await hre.run('compile');

  const { WHITELIST_CONTRACT_ADDRESS } = hre.contracts;

  await upgradeProxyWithRetry<Whitelist>({
    contractName: 'Whitelist',
    contractAddress: WHITELIST_CONTRACT_ADDRESS,
    signerOrOptions: {},
    deployOptions: {},
    retries: 5,
    hre,
  });
}

async function upgradeProxyWithRetry<C extends Contract>({
  contractName,
  contractAddress,
  signerOrOptions,
  deployOptions,
  hre,
  retries,
}: {
  contractName: string;
  contractAddress: string;
  signerOrOptions: Signer | FactoryOptions | undefined;
  deployOptions: DeployOptions;
  hre: HardhatRuntimeEnvironment;
  retries: number;
}): Promise<C> {
  try {
    const factory = await hre.ethers.getContractFactory(contractName, signerOrOptions);
    const contract = await hre.upgrades.upgradeProxy(contractAddress, factory, deployOptions);
    await contract.deployTransaction.wait();
    return contract as C;
  } catch (e) {
    if (e instanceof TransactionMinedTimeout && retries > 0) {
      console.log(`timed out upgrading ${contractName}, retrying`);
      return upgradeProxyWithRetry({
        contractName,
        contractAddress,
        signerOrOptions,
        deployOptions,
        retries: --retries,
        hre,
      });
    } else {
      throw e;
    }
  }
}
