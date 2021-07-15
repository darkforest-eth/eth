import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ethers } from 'hardhat';
import {
  DarkForestCore,
  DarkForestGPTCredit,
  Whitelist,
} from '@darkforest_eth/contracts/typechain';
import { initializeContracts, TestContracts } from './TestContracts';
import { BigNumber } from 'ethers';

const { utils } = ethers;

export interface World {
  contracts: TestContracts;
  user1: SignerWithAddress;
  user2: SignerWithAddress;
  deployer: SignerWithAddress;
  user1Core: DarkForestCore;
  user2Core: DarkForestCore;
  user1Whitelist: Whitelist;
  user2Whitelist: Whitelist;
  user1GPTCredit: DarkForestGPTCredit;
  user2GPTCredit: DarkForestGPTCredit;
}

export interface Player {
  isInitialized: boolean;
  player: string;
  initTimestamp: BigNumber;
  homePlanetId: BigNumber;
  lastRevealTimestamp: BigNumber;
  withdrawnSilver: BigNumber;
  totalArtifactPoints: BigNumber;
}

export interface InitializeWorldArgs {
  enableWhitelist?: boolean;
}

export function defaultWorldFixture(): Promise<World> {
  return initializeWorld();
}

export async function initializeWorld(args?: InitializeWorldArgs): Promise<World> {
  args = Object.assign(
    {
      enableWhitelist: false,
    },
    args
  );

  const contracts = await initializeContracts(args.enableWhitelist as boolean);
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
    user1GPTCredit: contracts.gptCredits.connect(user1),
    user2GPTCredit: contracts.gptCredits.connect(user2),
  };
}
