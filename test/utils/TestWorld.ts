import { DarkForestCore, Whitelist } from '@darkforest_eth/contracts/typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BigNumber, utils } from 'ethers';
import { ethers } from 'hardhat';
import * as settings from '../../settings';
import { initializeContracts, TestContracts } from './TestContracts';
import { initializers, shrinkingInitializers, target4Initializers } from './WorldConstants';

export interface World {
  contracts: TestContracts;
  user1: SignerWithAddress;
  user2: SignerWithAddress;
  deployer: SignerWithAddress;
  user1Core: DarkForestCore;
  user2Core: DarkForestCore;
  user1Whitelist: Whitelist;
  user2Whitelist: Whitelist;
}

export interface Player {
  isInitialized: boolean;
  player: string;
  initTimestamp: BigNumber;
  homePlanetId: BigNumber;
  lastRevealTimestamp: BigNumber;
  score: BigNumber;
}

export interface InitializeWorldArgs {
  initializers: ReturnType<typeof settings.Initializers>;
  enableWhitelist: boolean;
}

export function defaultWorldFixture(): Promise<World> {
  return initializeWorld({
    initializers,
    enableWhitelist: false,
  });
}

export function growingWorldFixture(): Promise<World> {
  return initializeWorld({
    initializers: target4Initializers,
    enableWhitelist: false,
  });
}

export function shrinkingWorldFixture(): Promise<World> {
  return initializeWorld({
    initializers: shrinkingInitializers,
    enableWhitelist: false,
  });
}

export function whilelistWorldFixture(): Promise<World> {
  return initializeWorld({
    initializers,
    enableWhitelist: true,
  });
}

export async function initializeWorld(args: InitializeWorldArgs): Promise<World> {
  const contracts = await initializeContracts(args);
  const [deployer, user1, user2] = await ethers.getSigners();

  await deployer.sendTransaction({
    to: contracts.whitelist.address,
    value: utils.parseEther('0.5'), // good for about (100eth / 0.5eth/test) = 200 tests
  });

  return {
    // If any "admin only" contract state needs to be changed, use `contracts`
    // to call methods with deployer privileges. e.g. `world.contracts.core.pause()`
    contracts,
    user1,
    user2,
    deployer,
    user1Core: contracts.core.connect(user1),
    user2Core: contracts.core.connect(user2),
    user1Whitelist: contracts.whitelist.connect(user1),
    user2Whitelist: contracts.whitelist.connect(user2),
  };
}
