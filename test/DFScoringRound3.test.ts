import { modPBigInt } from '@darkforest_eth/hashing';
import { expect } from 'chai';
import { constants, ethers } from 'ethers';
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
} from './utils/WorldConstants';

const { BigNumber: BN } = ethers;

function toBN(n: number): ethers.BigNumber {
  return BN.from(modPBigInt(n).toString());
}

describe('DarkForestScoringRound3', function () {
  let world: World;

  async function worldFixture() {
    const world = await fixtureLoader(defaultWorldFixture);
    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));

    // Conquer initial planets
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL3_SPACETIME_2);

    return world;
  }

  beforeEach('load fixture', async function () {
    world = await fixtureLoader(worldFixture);
  });

  it('allows player to claim self-owned planet for score (positive x/y)', async function () {
    const x = 10;
    const y = 20;
    const score = BN.from(22);

    await expect(world.user1Scoring.claim(...makeRevealArgs(LVL3_SPACETIME_2, x, y)))
      .to.emit(world.contracts.scoring, 'LocationClaimed')
      .withArgs(world.user1.address, constants.AddressZero, LVL3_SPACETIME_2.id);
    expect((await world.user1Scoring.getNClaimedPlanets()).toNumber()).to.equal(1);
    const claimedCoords = await world.user1Scoring.getClaimedCoords(LVL3_SPACETIME_2.id);
    expect(claimedCoords.x).to.equal(BN.from(x));
    expect(claimedCoords.y).to.equal(BN.from(y));
    expect(claimedCoords.claimer).to.equal(world.user1.address);
    expect(claimedCoords.score).to.equal(score);
    expect(await world.user1Scoring.getScore(world.user1.address)).to.equal(score);
  });

  it('allows player to claim self-owned planet for score (positive x/negative y)', async function () {
    const x = 10;
    const y = -20;
    const score = BN.from(22);

    await expect(world.user1Scoring.claim(...makeRevealArgs(LVL3_SPACETIME_2, x, y)))
      .to.emit(world.contracts.scoring, 'LocationClaimed')
      .withArgs(world.user1.address, constants.AddressZero, LVL3_SPACETIME_2.id);
    expect((await world.user1Scoring.getNClaimedPlanets()).toNumber()).to.equal(1);
    const claimedCoords = await world.user1Scoring.getClaimedCoords(LVL3_SPACETIME_2.id);
    expect(claimedCoords.x).to.equal(BN.from(x));
    expect(claimedCoords.y).to.equal(toBN(y));
    expect(claimedCoords.claimer).to.equal(world.user1.address);
    expect(claimedCoords.score).to.equal(score);
    expect(await world.user1Scoring.getScore(world.user1.address)).to.equal(score);
  });

  it('allows player to claim self-owned planet for score (negative x/negative y)', async function () {
    const x = -10;
    const y = -20;
    const score = BN.from(22);

    await expect(world.user1Scoring.claim(...makeRevealArgs(LVL3_SPACETIME_2, x, y)))
      .to.emit(world.contracts.scoring, 'LocationClaimed')
      .withArgs(world.user1.address, constants.AddressZero, LVL3_SPACETIME_2.id);
    expect((await world.user1Scoring.getNClaimedPlanets()).toNumber()).to.equal(1);
    const claimedCoords = await world.user1Scoring.getClaimedCoords(LVL3_SPACETIME_2.id);
    expect(claimedCoords.x).to.equal(toBN(x));
    expect(claimedCoords.y).to.equal(toBN(y));
    expect(claimedCoords.claimer).to.equal(world.user1.address);
    expect(claimedCoords.score).to.equal(score);
    expect(await world.user1Scoring.getScore(world.user1.address)).to.equal(score);
  });

  it('allows player to claim self-owned planet for score (negative x/positive y)', async function () {
    const x = -10;
    const y = 20;
    const score = BN.from(22);

    await expect(world.user1Scoring.claim(...makeRevealArgs(LVL3_SPACETIME_2, x, y)))
      .to.emit(world.contracts.scoring, 'LocationClaimed')
      .withArgs(world.user1.address, constants.AddressZero, LVL3_SPACETIME_2.id);
    expect((await world.user1Scoring.getNClaimedPlanets()).toNumber()).to.equal(1);
    const claimedCoords = await world.user1Scoring.getClaimedCoords(LVL3_SPACETIME_2.id);
    expect(claimedCoords.x).to.equal(toBN(x));
    expect(claimedCoords.y).to.equal(BN.from(y));
    expect(claimedCoords.claimer).to.equal(world.user1.address);
    expect(claimedCoords.score).to.equal(score);
    expect(await world.user1Scoring.getScore(world.user1.address)).to.equal(score);
  });

  it.skip("player can't claim a location owned by someone else", async function () {
    const x = 10;
    const y = 20;

    await world.user1Core.revealLocation(...makeRevealArgs(LVL3_SPACETIME_1, x, y));
    const revealedCoords = await world.contracts.core.revealedCoords(LVL3_SPACETIME_1.id);
    expect(revealedCoords.x.toNumber()).to.equal(x);
    expect(revealedCoords.y.toNumber()).to.equal(y);
    await expect((await world.contracts.core.getNRevealedPlanets()).toNumber()).to.equal(1);
    await expect(await world.contracts.core.revealedPlanetIds(0)).to.be.equal(SPAWN_PLANET_1.id);
  });

  it("player can't reveal location of second planet without waiting for cooldown", async function () {
    await world.contracts.core.changeLocationRevealCooldown(60);
    const x1 = 30;
    const y1 = 40;
    const x2 = 10;
    const y2 = 20;
    await world.user1Core.revealLocation(...makeRevealArgs(LVL3_SPACETIME_1, x2, y2));
    await expect(
      world.user1Core.revealLocation(...makeRevealArgs(LVL3_SPACETIME_2, x1, y1))
    ).to.be.revertedWith('wait for cooldown before revealing again');

    await increaseBlockchainTime();
    await world.user1Core.revealLocation(...makeRevealArgs(LVL3_SPACETIME_2, x1, y1));
    await expect((await world.contracts.core.getNRevealedPlanets()).toNumber()).to.equal(2);
  });

  it("player can't reveal invalid location that doesn't already exist in contract", async function () {
    const x = 30;
    const y = 40;
    await expect(
      world.user1Core.revealLocation(...makeRevealArgs(INVALID_PLANET, x, y))
    ).to.be.revertedWith('Not a valid planet location');
  });

  it("can't reveal same location twice", async function () {
    await world.contracts.core.changeLocationRevealCooldown(60);
    const x = 30;
    const y = 40;
    await world.user1Core.revealLocation(...makeRevealArgs(LVL3_SPACETIME_1, x, y));
    await increaseBlockchainTime();
    await expect(
      world.user1Core.revealLocation(...makeRevealArgs(LVL3_SPACETIME_1, x, y))
    ).to.be.revertedWith('Location already revealed');

    await expect((await world.contracts.core.getNRevealedPlanets()).toNumber()).to.equal(1);
  });

  it('player must pass in valid perlin flags for zk checks', async function () {
    const x = 10;
    const y = 20;
    const args = makeRevealArgs(SPAWN_PLANET_1, x, y);
    args[3][4] = parseInt(args[3][4].toString()) + 1;
    await expect(world.user1Core.revealLocation(...args)).to.be.revertedWith(
      'bad planethash mimc key'
    );
  });
});
