import {
  DarkForestCore,
  DarkForestTokens,
  DarkForestPlanet,
  DarkForestUtils,
  Verifier,
  Whitelist,
  DarkForestGetters,
  DarkForestGPTCredit,
} from '@darkforest_eth/contracts/typechain';
import { ethers, upgrades } from 'hardhat';
import { initializers } from './WorldConstants';

export interface TestContracts {
  whitelist: Whitelist;
  tokens: DarkForestTokens;
  verifier: Verifier;
  utils: DarkForestUtils;
  planet: DarkForestPlanet;
  core: DarkForestCore;
  getters: DarkForestGetters;
  gptCredits: DarkForestGPTCredit;
}

export async function initializeContracts(enableWhitelist?: boolean): Promise<TestContracts> {
  // silence all the linking warnings, ideally remove this someday
  upgrades.silenceWarnings();

  const [deployer] = await ethers.getSigners();

  const WhitelistContract = await ethers.getContractFactory('Whitelist');
  const whitelist = (await upgrades.deployProxy(WhitelistContract, [
    deployer.address,
    enableWhitelist,
  ])) as Whitelist;

  const VerifierContract = await ethers.getContractFactory('Verifier');
  const verifier = (await VerifierContract.deploy()) as Verifier;

  const DarkForestUtilsContract = await ethers.getContractFactory('DarkForestUtils');
  const darkForestUtils = (await DarkForestUtilsContract.deploy()) as DarkForestUtils;

  const DarkForestTokensContract = await ethers.getContractFactory('DarkForestTokens');

  const darkForestTokens = (await upgrades.deployProxy(DarkForestTokensContract, [], {
    initializer: false,
  })) as DarkForestTokens;

  const DarkForestLazyUpdateContract = await ethers.getContractFactory('DarkForestLazyUpdate');
  const darkForestLazyUpdate = await DarkForestLazyUpdateContract.deploy();

  const DarkForestTypesContract = await ethers.getContractFactory('DarkForestTypes');
  await DarkForestTypesContract.deploy();

  const DarkForestArtifactUtils = await ethers.getContractFactory('DarkForestArtifactUtils', {
    libraries: {
      DarkForestUtils: darkForestUtils.address,
    },
  });
  const artifactUtils = await DarkForestArtifactUtils.deploy();
  await artifactUtils.deployTransaction.wait();

  const DarkForestPlanet = await ethers.getContractFactory('DarkForestPlanet', {
    libraries: {
      DarkForestLazyUpdate: darkForestLazyUpdate.address,
      DarkForestUtils: darkForestUtils.address,
      DarkForestArtifactUtils: artifactUtils.address,
    },
  });
  const darkForestPlanet = (await DarkForestPlanet.deploy()) as DarkForestPlanet;

  const DarkForestInitializeContract = await ethers.getContractFactory('DarkForestInitialize');
  const darkForestInitialize = await DarkForestInitializeContract.deploy();

  const DarkForestCoreContract = await ethers.getContractFactory('DarkForestCore', {
    libraries: {
      DarkForestInitialize: darkForestInitialize.address,
      DarkForestPlanet: darkForestPlanet.address,
      DarkForestUtils: darkForestUtils.address,
      Verifier: verifier.address,
      DarkForestArtifactUtils: artifactUtils.address,
    },
  });

  // Linking external libraries like `DarkForestUtils` is not yet supported,
  // or skip this check with the `unsafeAllowLinkedLibraries` flag
  const darkForestCore = (await upgrades.deployProxy(
    DarkForestCoreContract,
    [deployer.address, whitelist.address, darkForestTokens.address, initializers],
    { unsafeAllowLinkedLibraries: true }
  )) as DarkForestCore;

  const DarkForestGettersContract = await ethers.getContractFactory('DarkForestGetters', {
    libraries: {
      DarkForestUtils: darkForestUtils.address,
    },
  });
  const darkForestGetters = (await upgrades.deployProxy(
    DarkForestGettersContract,
    [deployer.address, darkForestCore.address, darkForestTokens.address],
    { unsafeAllowLinkedLibraries: true }
  )) as DarkForestGetters;

  await darkForestTokens.initialize(darkForestCore.address, deployer.address);

  const DarkForestGPTCreditContractFactory = await ethers.getContractFactory('DarkForestGPTCredit');

  const darkForestGPTCredit = (await upgrades.deployProxy(DarkForestGPTCreditContractFactory, [
    deployer.address,
  ])) as DarkForestGPTCredit;

  return {
    whitelist,
    tokens: darkForestTokens,
    verifier,
    utils: darkForestUtils,
    planet: darkForestPlanet,
    core: darkForestCore,
    getters: darkForestGetters,
    gptCredits: darkForestGPTCredit,
  };
}
