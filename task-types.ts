// @ts-ignore because they don't exist before first compile
import type {
  DarkForestCore,
  DarkForestTokens,
  DarkForestGetters,
  DarkForestPlanet,
  DarkForestUtils,
  DarkForestArtifactUtils,
  Verifier,
  Whitelist,
  DarkForestGPTCredit,
} from '@darkforest_eth/contracts/typechain';
import type { Contract } from 'ethers';

export {
  DarkForestCore,
  DarkForestTokens,
  DarkForestGetters,
  DarkForestPlanet,
  DarkForestUtils,
  DarkForestGPTCredit,
  DarkForestArtifactUtils,
  Verifier,
  Whitelist,
};

export interface LibraryContracts {
  lazyUpdate: Contract;
  utils: DarkForestUtils;
  planet: DarkForestPlanet;
  initialize: Contract;
  verifier: Verifier;
  artifactUtils: DarkForestArtifactUtils;
}

export interface DarkForestCoreReturn {
  blockNumber: number;
  contract: DarkForestCore;
}
