import { subtask } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DarkForestCore, DarkForestGPTCredit, DarkForestTokens, Whitelist } from '../task-types';

subtask('utils:assertChainId', 'Assert proper network is selectaed').setAction(assertChainId);

async function assertChainId({}, hre: HardhatRuntimeEnvironment) {
  const { NETWORK_ID } = hre.contracts;

  if (hre.network.config.chainId !== NETWORK_ID) {
    throw new Error(
      `Hardhat defined network chain id ${hre.network.config.chainId} is NOT same as contracts network id: ${NETWORK_ID}.`
    );
  }
}

subtask('utils:getCore', 'get the current core contract').setAction(getCore);

async function getCore({}, hre: HardhatRuntimeEnvironment): Promise<DarkForestCore> {
  const {
    CORE_CONTRACT_ADDRESS,
    INITIALIZE_LIBRARY_ADDRESS,
    PLANET_LIBRARY_ADDRESS,
    UTILS_LIBRARY_ADDRESS,
    VERIFIER_LIBRARY_ADDRESS,
    ARTIFACT_UTILS_LIBRARY_ADDRESS,
  } = hre.contracts;

  const [deployer] = await hre.ethers.getSigners();
  const DarkForestCoreFactory = await hre.ethers.getContractFactory('DarkForestCore', {
    libraries: {
      DarkForestInitialize: INITIALIZE_LIBRARY_ADDRESS,
      DarkForestPlanet: PLANET_LIBRARY_ADDRESS,
      DarkForestUtils: UTILS_LIBRARY_ADDRESS,
      Verifier: VERIFIER_LIBRARY_ADDRESS,
      DarkForestArtifactUtils: ARTIFACT_UTILS_LIBRARY_ADDRESS,
    },
  });

  const darkForestCore = DarkForestCoreFactory.attach(CORE_CONTRACT_ADDRESS);
  const d = darkForestCore.connect(deployer);
  return d;
}

subtask('utils:getWhitelist', 'get the current whitelist contract').setAction(getWhitelist);

async function getWhitelist({}, hre: HardhatRuntimeEnvironment): Promise<Whitelist> {
  const { WHITELIST_CONTRACT_ADDRESS } = hre.contracts;

  const [deployer] = await hre.ethers.getSigners();
  const WhitelistFactory = await hre.ethers.getContractFactory('Whitelist');
  const whitelist = WhitelistFactory.attach(WHITELIST_CONTRACT_ADDRESS);
  const w = whitelist.connect(deployer);
  return w;
}

subtask('utils:getTokens', 'get the current tokens contract').setAction(getTokens);

async function getTokens({}, hre: HardhatRuntimeEnvironment): Promise<DarkForestTokens> {
  const { TOKENS_CONTRACT_ADDRESS } = hre.contracts;

  const [deployer] = await hre.ethers.getSigners();
  const DarkForestTokensFactory = await hre.ethers.getContractFactory('DarkForestTokens');
  const tokens = DarkForestTokensFactory.attach(TOKENS_CONTRACT_ADDRESS);
  const t = tokens.connect(deployer);
  return t;
}

subtask('utils:getGPTCredit', 'get the current tokens contract').setAction(getGPTCredit);

async function getGPTCredit({}, hre: HardhatRuntimeEnvironment): Promise<DarkForestGPTCredit> {
  const { GPT_CREDIT_CONTRACT_ADDRESS } = hre.contracts;

  const [deployer] = await hre.ethers.getSigners();
  const DarkForestGPTCreditFactory = await hre.ethers.getContractFactory('DarkForestGPTCredit');
  const gptCredit = DarkForestGPTCreditFactory.attach(GPT_CREDIT_CONTRACT_ADDRESS);
  const g = gptCredit.connect(deployer);
  return g;
}
