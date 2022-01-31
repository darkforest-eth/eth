import { NETWORK_ID } from '@darkforest_eth/contracts';
import {
  DarkForestCore,
  DarkForestGetters,
  DarkForestGPTCredit,
  DarkForestPlanet,
  DarkForestScoringRound3,
  DarkForestTokens,
  DarkForestUtils,
  Verifier,
  Whitelist,
} from '@darkforest_eth/contracts/typechain';
import { ethers, upgrades } from 'hardhat';
import * as yup from 'yup';
import * as settings from '../../settings';

export interface TestContracts {
  whitelist: Whitelist;
  tokens: DarkForestTokens;
  verifier: Verifier;
  utils: DarkForestUtils;
  planet: DarkForestPlanet;
  core: DarkForestCore;
  getters: DarkForestGetters;
  gptCredits: DarkForestGPTCredit;
  scoring: DarkForestScoringRound3;
}

export interface InitializeContractArgs {
  initializers: yup.Asserts<typeof settings.Initializers>;
  enableWhitelist?: boolean;
}

export async function initializeContracts({
  enableWhitelist,
  initializers,
}: InitializeContractArgs): Promise<TestContracts> {
  // silence all the linking warnings, ideally remove this someday
  upgrades.silenceWarnings();

  const [deployer] = await ethers.getSigners();

  const WhitelistContract = await ethers.getContractFactory('Whitelist');
  const whitelist = (await upgrades.deployProxy(WhitelistContract, [
    deployer.address,
    enableWhitelist,
  ])) as Whitelist;

  const VerifierContract = await ethers.getContractFactory('Verifier');
  const verifier = await VerifierContract.deploy();

  const DarkForestUtilsContract = await ethers.getContractFactory('DarkForestUtils');
  const darkForestUtils = await DarkForestUtilsContract.deploy();

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
  const darkForestPlanet = await DarkForestPlanet.deploy();

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

  await darkForestTokens.initialize(
    darkForestCore.address,
    deployer.address,
    `https://nft-test.zkga.me/token-uri/artifact/${NETWORK_ID}-${darkForestTokens.address}/`
  );

  const DarkForestGPTCreditContractFactory = await ethers.getContractFactory('DarkForestGPTCredit');

  const darkForestGPTCredit = (await upgrades.deployProxy(DarkForestGPTCreditContractFactory, [
    deployer.address,
  ])) as DarkForestGPTCredit;

  const DarkForestScoringRound3Factory = await ethers.getContractFactory('DarkForestScoringRound3');

  const darkForestScoringContract = (await upgrades.deployProxy(DarkForestScoringRound3Factory, [
    darkForestCore.address,
    initializers.ROUND_NAME,
    initializers.ROUND_END,
    initializers.CLAIM_PLANET_COOLDOWN,
  ])) as DarkForestScoringRound3;

  return {
    whitelist,
    tokens: darkForestTokens,
    verifier,
    utils: darkForestUtils,
    planet: darkForestPlanet,
    core: darkForestCore,
    getters: darkForestGetters,
    gptCredits: darkForestGPTCredit,
    scoring: darkForestScoringContract,
  };
}
