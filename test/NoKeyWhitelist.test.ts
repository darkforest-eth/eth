import { expect } from 'chai';
import { ethers } from 'hardhat';
import { fixtureLoader, makeInitArgs } from './utils/TestUtils';
import { whilelistWorldFixture, World } from './utils/TestWorld';

const { utils } = ethers;

describe('NoKeyDarkForestWhitelist', function () {
  let world: World;

  async function worldFixture() {
    const world = await fixtureLoader(whilelistWorldFixture);
    await world.contracts.whitelist.addAndDripPlayers([
      world.user1.address,
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

  it('should reject add players if not admin', async function () {
    await expect(
      world.user2Whitelist.addAndDripPlayers([world.user2.address])
    ).to.be.revertedWith('Only administrator can perform this action');
  });

  it('should increase numPlayers after player is whitelisted', async function () {
    const prevPlayers = await world.contracts.whitelist.numPlayers();

    const addTx = await world.contracts.whitelist.addAndDripPlayers([world.user2.address]);

    const currPlayers = await world.contracts.whitelist.numPlayers();

    expect(currPlayers).to.equal(prevPlayers.add(ethers.BigNumber.from("1")));
  })

  it('should confirm a whitelisted player\'s balance has increased by drip amt', async function () {
    const drip = await world.contracts.whitelist.drip();
    expect(drip).to.equal(utils.parseEther('0.15'));
    await expect(
      await world.contracts.whitelist.addAndDripPlayers([world.user2.address])
    ).to.changeEtherBalance(world.user2, drip);
  });

  it('should approve a player who is whitelisted', async function () { 
    expect(
      await world.user1Whitelist.isWhitelisted(world.user1.address)
    ).to.be.true;
  });

  it('should reject a player who is not whitelisted', async function () {
    expect(
      await world.user1Whitelist.isWhitelisted(world.user2.address)
    ).to.be.false;
  });

  it('should reject drip to a player who is not whitelisted', async function () {
    await expect(
      world.contracts.whitelist.sendDrip(world.user2.address)
    ).to.be.revertedWith('player not whitelisted');
  });

  it('should reject drip to a player who is whitelisted but has received drip', async function () {
    await expect(
      world.contracts.whitelist.sendDrip(world.user1.address)
    ).to.be.revertedWith('player already received drip');
  });

  it('should NOT drip and NOT revert if drip > contract balance, but still whitelist', async function () {
    const [deployer, user1, user2, user3 ] = await ethers.getSigners();

    const dripTx = await world.contracts.whitelist.changeDrip(utils.parseEther('10.0'));
    await dripTx.wait();

    const drip = await world.contracts.whitelist.drip();

    expect(drip).to.equal(utils.parseEther('10.0'));

    const prevBalance = await user2.getBalance();
    await world.contracts.whitelist.addAndDripPlayers([user2.address]);
    const currBalance = await user2.getBalance();
    expect(prevBalance).to.equal(currBalance);
    expect(
        await world.user1Whitelist.isWhitelisted(world.user2.address)
      ).to.be.true;
  });

  // drip 0.15 on addPlayers
  // allow DisruptBanksy to send POKT money as desired.
  // some check about contract out of money
    // whitelist contract has 0.5 ether to start.

});