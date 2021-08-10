import { expect } from 'chai';
import { ethers } from 'hardhat';
import { fixtureLoader, makeInitArgs } from './utils/TestUtils';
import { whilelistWorldFixture, World } from './utils/TestWorld';
import { SPAWN_PLANET_1 } from './utils/WorldConstants';

const { utils } = ethers;

describe('DarkForestWhitelist', function () {
  let world: World;

  async function worldFixture() {
    const world = await fixtureLoader(whilelistWorldFixture);
    await world.contracts.whitelist.addKeys([
      utils.id('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX'),
      utils.id('XXXXX-XXXXX-XXXXX-XXXXX-XXXX0'),
    ]);

    return world;
  }

  beforeEach('load fixture', async function () {
    world = await fixtureLoader(worldFixture);
  });

  it('should reject change admin if not admin', async function () {
    await expect(world.user2Whitelist.changeAdmin(world.user1.address)).to.be.revertedWith(
      'Only administrator can perform this action'
    );
  });

  it('should reject add keys if not admin', async function () {
    await expect(
      world.user2Whitelist.addKeys([utils.id('XXXXX-XXXXX-XXXXX-XXXXX-XXX00')])
    ).to.be.revertedWith('Only administrator can perform this action');
  });

  it('should reject use key if not admin', async function () {
    await expect(
      world.user2Whitelist.useKey('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', world.user1.address)
    ).to.be.revertedWith('Only administrator can perform this action');
  });

  it('should reject use key if already whitelisted', async function () {
    await world.contracts.whitelist.useKey('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', world.user1.address);
    await expect(
      world.contracts.whitelist.useKey('XXXXX-XXXXX-XXXXX-XXXXX-XXXX0', world.user1.address)
    ).to.be.revertedWith('player already whitelisted');
  });

  it('should reject use key if key invalid', async function () {
    await expect(
      world.contracts.whitelist.useKey('XXXXX-XXXXX-XXXXX-XXXXX-XXX00', world.user1.address)
    ).to.be.revertedWith('invalid key');
  });

  it('should reject use key if key already used', async function () {
    await world.contracts.whitelist.useKey('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', world.user2.address);
    await expect(
      world.contracts.whitelist.useKey('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', world.user1.address)
    ).to.be.revertedWith('invalid key');
  });

  it('should reject remove from whitelist if not admin', async function () {
    await world.contracts.whitelist.useKey('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', world.user1.address);
    await expect(world.user2Whitelist.removeFromWhitelist(world.user1.address)).to.be.revertedWith(
      'Only administrator can perform this action'
    );
  });

  it('should reject remove from whitelist if account never whitelist', async function () {
    await expect(
      world.contracts.whitelist.removeFromWhitelist(world.user1.address)
    ).to.be.revertedWith('player was not whitelisted to begin with');
  });

  it('should allow player to initialize after whitelisted', async function () {
    await world.contracts.whitelist.useKey('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', world.user1.address);
    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));

    await expect((await world.contracts.core.players(world.user1.address)).isInitialized).is.equal(
      true
    );
  });

  it('should reject player to initialize if not whitelisted', async function () {
    await expect(
      world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1))
    ).to.be.revertedWith('Player is not whitelisted');
  });

  it('should reject player to initialize if removed from whitelist', async function () {
    await world.contracts.whitelist.useKey('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', world.user1.address);
    await world.contracts.whitelist.removeFromWhitelist(world.user1.address);
    await expect(
      world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1))
    ).to.be.revertedWith('Player is not whitelisted');
  });

  it('should allow admin to set drip, and drip player eth after whitelisted', async function () {
    await world.contracts.whitelist.changeDrip(utils.parseEther('0.02'));

    const drip = await world.contracts.whitelist.drip();

    expect(drip).to.equal(utils.parseEther('0.02'));
    await expect(
      await world.contracts.whitelist.useKey('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', world.user1.address)
    ).to.changeEtherBalance(world.user1, drip);
  });
});
