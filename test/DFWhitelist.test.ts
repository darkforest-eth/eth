import { EthAddress } from '@darkforest_eth/types';
import { generateKeys, keyHash } from '@darkforest_eth/whitelist';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { fixtureLoader, makeInitArgs, makeWhitelistArgs } from './utils/TestUtils';
import { whilelistWorldFixture, World } from './utils/TestWorld';
import { SPAWN_PLANET_1 } from './utils/WorldConstants';

const { utils } = ethers;
const keys = generateKeys(2);
const keyHashes = keys.map(keyHash);

describe('DarkForestWhitelist', function () {
  let world: World;

  async function worldFixture() {
    const world = await fixtureLoader(whilelistWorldFixture);
    await world.contract.addKeys(keyHashes);

    return world;
  }

  beforeEach('load fixture', async function () {
    world = await fixtureLoader(worldFixture);
  });

  it('allows a user to register with a valid key', async function () {
    const whitelistArgs = await makeWhitelistArgs(keys[0], world.user1.address as EthAddress);
    await world.user1Core.useKey(...whitelistArgs);
    expect(await world.contract.isWhitelisted(world.user1.address)).to.eq(true);
  });

  it('allows a user to register another address with a valid key', async function () {
    const whitelistArgs = await makeWhitelistArgs(keys[0], world.user2.address as EthAddress);
    await world.user1Core.useKey(...whitelistArgs);
    expect(await world.contract.isWhitelisted(world.user2.address)).to.eq(true);
  });

  it('rewards relayers for whitelisting another address if relay rewards are turned on', async function () {
    await world.contract.setRelayerRewardsEnabled(true);
    await world.contract.changeRelayerReward(utils.parseEther('0.03'));
    const relayerReward = await world.contract.relayerReward();
    const whitelistArgs = await makeWhitelistArgs(keys[0], world.user2.address as EthAddress);

    await expect(await world.user1Core.useKey(...whitelistArgs)).to.changeEtherBalance(
      world.user1,
      relayerReward
    );
  });

  it('does not reward relayers if relay rewards are turned off', async function () {
    await world.contract.setRelayerRewardsEnabled(false);
    const relayerReward = await world.contract.relayerReward();
    const whitelistArgs = await makeWhitelistArgs(keys[0], world.user2.address as EthAddress);

    await expect(await world.user1Core.useKey(...whitelistArgs)).to.not.changeEtherBalance(
      world.user1,
      relayerReward
    );
  });

  it('allows admins to whitelist users without a snark', async function () {
    await world.contract.adminUseKey(keyHashes[0], world.user1.address);

    expect(await world.contract.isWhitelisted(world.user1.address)).to.eq(true);
    expect(await world.contract.isKeyHashValid(keyHashes[0])).to.eq(false);
  });

  it('should reject change admin if not admin', async function () {
    await expect(world.user2Core.transferOwnership(world.user1.address)).to.be.revertedWith(
      'LibDiamond: Must be contract owner'
    );
  });

  it('should reject add keys if not admin', async function () {
    await expect(world.user2Core.addKeys(keyHashes)).to.be.revertedWith(
      'LibDiamond: Must be contract owner'
    );
  });

  it('should no-op use key if already whitelisted', async function () {
    const whitelistArgs1 = await makeWhitelistArgs(keys[0], world.user1.address as EthAddress);
    const whitelistArgs2 = await makeWhitelistArgs(keys[1], world.user1.address as EthAddress);

    await world.user1Core.useKey(...whitelistArgs1);
    await world.user1Core.useKey(...whitelistArgs2);
  });

  it('should not pay relayer if address is already whitelisted', async function () {
    await world.contract.setRelayerRewardsEnabled(true);
    const relayerReward = await world.contract.relayerReward();
    const whitelistArgs1 = await makeWhitelistArgs(keys[0], world.user2.address as EthAddress);
    const whitelistArgs2 = await makeWhitelistArgs(keys[1], world.user2.address as EthAddress);

    await world.user1Core.useKey(...whitelistArgs1);
    await expect(await world.user1Core.useKey(...whitelistArgs2)).to.not.changeEtherBalance(
      world.user1,
      relayerReward
    );
  });

  it('should reject use key if key invalid', async function () {
    const whitelistArgs = await makeWhitelistArgs('1', world.user1.address as EthAddress);

    await expect(world.user1Core.useKey(...whitelistArgs)).to.be.revertedWith('invalid key');
  });

  it('should reject use key if key already used', async function () {
    const whitelistArgs1 = await makeWhitelistArgs(keys[0], world.user1.address as EthAddress);
    const whitelistArgs2 = await makeWhitelistArgs(keys[0], world.user2.address as EthAddress);

    await world.user1Core.useKey(...whitelistArgs1);
    await expect(world.user1Core.useKey(...whitelistArgs2)).to.be.revertedWith('invalid key');
  });

  it('should reject remove from whitelist if not admin', async function () {
    await world.contract.addToWhitelist(world.user1.address);
    await expect(world.user2Core.removeFromWhitelist(world.user1.address)).to.be.revertedWith(
      'LibDiamond: Must be contract owner'
    );
  });

  it('should reject remove from whitelist if account never whitelist', async function () {
    await expect(world.contract.removeFromWhitelist(world.user1.address)).to.be.revertedWith(
      'player was not whitelisted to begin with'
    );
  });

  it('should allow player to initialize after whitelisted', async function () {
    await world.contract.addToWhitelist(world.user1.address);
    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));
    expect((await world.contract.players(world.user1.address)).isInitialized).is.equal(true);
  });

  it('should reject player to initialize if not whitelisted', async function () {
    await expect(
      world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1))
    ).to.be.revertedWith('Player is not whitelisted');
  });

  it('should reject player to initialize if removed from whitelist', async function () {
    await world.contract.addToWhitelist(world.user1.address);
    await world.contract.removeFromWhitelist(world.user1.address);
    await expect(
      world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1))
    ).to.be.revertedWith('Player is not whitelisted');
  });

  it('should allow admin to set drip, and drip player eth after whitelisted', async function () {
    await world.contract.changeDrip(utils.parseEther('0.02'));
    const drip = await world.contract.drip();
    expect(drip).to.equal(utils.parseEther('0.02'));

    const whitelistArgs = await makeWhitelistArgs(keys[0], world.user1.address as EthAddress);

    await expect(await world.user1Core.useKey(...whitelistArgs)).to.changeEtherBalance(
      world.user1,
      drip
    );
  });
});
