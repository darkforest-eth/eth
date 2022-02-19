//@ts-nocheck Because we can't run these tests
import { modPBigInt } from '@darkforest_eth/hashing';
import { expect } from 'chai';
import { BigNumber, constants, ethers } from 'ethers';
import {
  conquerUnownedPlanet,
  fixtureLoader,
  increaseBlockchainTime,
  makeInitArgs,
  makeRevealArgs,
} from './utils/TestUtils';
import { defaultWorldFixture, World } from './utils/TestWorld';
import {
  INVALID_PLANET,
  LVL3_SPACETIME_1,
  LVL3_SPACETIME_2,
  SPAWN_PLANET_1,
  SPAWN_PLANET_2,
} from './utils/WorldConstants';

const { BigNumber: BN } = ethers;

function toBN(n: number): ethers.BigNumber {
  return BN.from(modPBigInt(n).toString());
}

describe.skip('DarkForestScoringRound3', function () {
  let world: World;

  async function worldFixture() {
    const world = await fixtureLoader(defaultWorldFixture);
    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));

    // Conquer initial planets
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL3_SPACETIME_2);

    return world;
  }

  beforeEach('load fixture', async function () {
    this.timeout(0);
    world = await fixtureLoader(worldFixture);
  });

  it('allows player to claim self-owned planet for score (positive x/y)', async function () {
    const x = 10;
    const y = 20;
    const score = BN.from(22);

    await expect(world.user1Core.claim(...makeRevealArgs(LVL3_SPACETIME_2, x, y)))
      .to.emit(world.contract, 'LocationClaimed')
      .withArgs(world.user1.address, constants.AddressZero, LVL3_SPACETIME_2.id);
    expect((await world.user1Core.getNClaimedPlanets()).toNumber()).to.equal(1);
    const claimedCoords = await world.user1Core.getClaimedCoords(LVL3_SPACETIME_2.id);
    expect(claimedCoords.x).to.equal(BN.from(x));
    expect(claimedCoords.y).to.equal(BN.from(y));
    expect(claimedCoords.claimer).to.equal(world.user1.address);
    expect(claimedCoords.score).to.equal(score);
    expect(await world.user1Core.getScore(world.user1.address)).to.equal(score);
  });

  it('allows player to claim self-owned planet for score (positive x/negative y)', async function () {
    const x = 10;
    const y = -20;
    const score = BN.from(22);

    await expect(world.user1Core.claim(...makeRevealArgs(LVL3_SPACETIME_2, x, y)))
      .to.emit(world.contract, 'LocationClaimed')
      .withArgs(world.user1.address, constants.AddressZero, LVL3_SPACETIME_2.id);
    expect((await world.user1Core.getNClaimedPlanets()).toNumber()).to.equal(1);
    const claimedCoords = await world.user1Core.getClaimedCoords(LVL3_SPACETIME_2.id);
    expect(claimedCoords.x).to.equal(BN.from(x));
    expect(claimedCoords.y).to.equal(toBN(y));
    expect(claimedCoords.claimer).to.equal(world.user1.address);
    expect(claimedCoords.score).to.equal(score);
    expect(await world.user1Core.getScore(world.user1.address)).to.equal(score);
  });

  it('allows player to claim self-owned planet for score (negative x/negative y)', async function () {
    const x = -10;
    const y = -20;
    const score = BN.from(22);

    await expect(world.user1Core.claim(...makeRevealArgs(LVL3_SPACETIME_2, x, y)))
      .to.emit(world.contract, 'LocationClaimed')
      .withArgs(world.user1.address, constants.AddressZero, LVL3_SPACETIME_2.id);
    expect((await world.user1Core.getNClaimedPlanets()).toNumber()).to.equal(1);
    const claimedCoords = await world.user1Core.getClaimedCoords(LVL3_SPACETIME_2.id);
    expect(claimedCoords.x).to.equal(toBN(x));
    expect(claimedCoords.y).to.equal(toBN(y));
    expect(claimedCoords.claimer).to.equal(world.user1.address);
    expect(claimedCoords.score).to.equal(score);
    expect(await world.user1Core.getScore(world.user1.address)).to.equal(score);
  });

  it('allows player to claim self-owned planet for score (negative x/positive y)', async function () {
    const x = -10;
    const y = 20;
    const score = BN.from(22);

    await expect(world.user1Core.claim(...makeRevealArgs(LVL3_SPACETIME_2, x, y)))
      .to.emit(world.contract, 'LocationClaimed')
      .withArgs(world.user1.address, constants.AddressZero, LVL3_SPACETIME_2.id);
    expect((await world.user1Core.getNClaimedPlanets()).toNumber()).to.equal(1);
    const claimedCoords = await world.user1Core.getClaimedCoords(LVL3_SPACETIME_2.id);
    expect(claimedCoords.x).to.equal(toBN(x));
    expect(claimedCoords.y).to.equal(BN.from(y));
    expect(claimedCoords.claimer).to.equal(world.user1.address);
    expect(claimedCoords.score).to.equal(score);
    expect(await world.user1Core.getScore(world.user1.address)).to.equal(score);
  });

  it("player can't claim location of second planet without waiting for cooldown", async function () {
    const CLAIM_COOLDOWN = (
      await world.user1Core.gameConstants()
    ).CLAIM_PLANET_COOLDOWN_SECONDS.toNumber();

    const x1 = 30;
    const y1 = 40;
    const x2 = 10;
    const y2 = 20;

    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL3_SPACETIME_1);
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL3_SPACETIME_2);

    await world.user1Core.claim(...makeRevealArgs(LVL3_SPACETIME_1, x2, y2));
    await increaseBlockchainTime(CLAIM_COOLDOWN - 5);
    await expect(
      world.user1Core.claim(...makeRevealArgs(LVL3_SPACETIME_2, x1, y1))
    ).to.be.revertedWith('wait for cooldown before revealing again');

    await increaseBlockchainTime();
    await world.user1Core.claim(...makeRevealArgs(LVL3_SPACETIME_2, x1, y1));
    await expect((await world.user1Core.getNClaimedPlanets()).toNumber()).to.equal(2);
  });

  it("player can't claim invalid location that doesn't already exist in contract", async function () {
    const x = 30;
    const y = 40;
    await expect(world.user1Core.claim(...makeRevealArgs(INVALID_PLANET, x, y))).to.be.revertedWith(
      'Cannot claim uninitialized planet'
    );
  });

  it('can claim same location twice', async function () {
    const CLAIM_COOLDOWN = (
      await world.user1Core.gameConstants()
    ).CLAIM_PLANET_COOLDOWN_SECONDS.toNumber();

    const x = 30;
    const y = 40;

    await world.user1Core.claim(...makeRevealArgs(LVL3_SPACETIME_2, x, y));
    await increaseBlockchainTime(CLAIM_COOLDOWN);
    await world.user1Core.claim(...makeRevealArgs(LVL3_SPACETIME_2, x, y));

    await expect((await world.user1Core.getNClaimedPlanets()).toNumber()).to.equal(1);
  });

  it('player must pass in valid perlin flags for zk checks', async function () {
    const x = 10;
    const y = 20;
    const args = makeRevealArgs(SPAWN_PLANET_1, x, y);
    args[3][4] = parseInt(args[3][4].toString()) + 1;
    await expect(world.user1Core.claim(...args)).to.be.revertedWith('bad planethash mimc key');
  });

  it('players can claim each others planets, and the score reflects claim changes', async function () {
    const worstScore = BigNumber.from(
      '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    );

    const x = 10;
    const y = 20;
    const score = Math.floor(Math.sqrt(x ** 2 + y ** 2));

    await expect(world.user1Core.claim(...makeRevealArgs(LVL3_SPACETIME_2, x, y)))
      .to.emit(world.contract, 'LocationClaimed')
      .withArgs(world.user1.address, constants.AddressZero, LVL3_SPACETIME_2.id);

    const claimedCoordsByUser1 = await world.user1Core.getClaimedCoords(LVL3_SPACETIME_2.id);
    expect(claimedCoordsByUser1.x).to.equal(BN.from(x));
    expect(claimedCoordsByUser1.y).to.equal(BN.from(y));
    expect(claimedCoordsByUser1.claimer).to.equal(world.user1.address);
    expect(claimedCoordsByUser1.score).to.equal(score);

    expect((await world.user1Core.getNClaimedPlanets()).toNumber()).to.equal(1);
    expect(await world.contract.getScore(world.user1.address)).to.equal(score);
    expect(await world.contract.getScore(world.user2.address)).to.equal(worstScore);

    await world.user2Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_2));
    await world.contracts.core.setPlanetOwner(LVL3_SPACETIME_2.id, world.user2.address);
    await world.user2Core.claim(...makeRevealArgs(LVL3_SPACETIME_2, x, y));

    const claimedCoordsByUser2 = await world.user2Core.getClaimedCoords(LVL3_SPACETIME_2.id);
    expect(claimedCoordsByUser2.x).to.equal(BN.from(x));
    expect(claimedCoordsByUser2.y).to.equal(BN.from(y));
    expect(claimedCoordsByUser2.claimer).to.equal(world.user2.address);
    expect(claimedCoordsByUser2.score).to.equal(score);

    expect((await world.user2Core.getNClaimedPlanets()).toNumber()).to.equal(1);
    expect(await world.contract.getScore(world.user1.address)).to.equal(worstScore);
    expect(await world.contract.getScore(world.user2.address)).to.equal(score);
  });
});
