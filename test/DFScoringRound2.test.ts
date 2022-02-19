import { expect } from 'chai';
import {
  conquerUnownedPlanet,
  feedSilverToCap,
  fixtureLoader,
  makeInitArgs,
} from './utils/TestUtils';
import { defaultWorldFixture, World } from './utils/TestWorld';
import { LVL1_ASTEROID_1, LVL3_SPACETIME_1, SPAWN_PLANET_1 } from './utils/WorldConstants';

describe('DFScoringRound2', async function () {
  // Bump the time out so that the test doesn't timeout during
  // initial fixture creation
  this.timeout(1000 * 60);
  let world: World;

  async function worldFixture() {
    const world = await fixtureLoader(defaultWorldFixture);
    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));

    // Conquer MINE_REGULAR and LVL3_SPACETIME_1 to accumulate silver
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_ASTEROID_1);
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL3_SPACETIME_1);

    // Fill up LVL3_SPACETIME_1 with silvers
    await feedSilverToCap(world, world.user1Core, LVL1_ASTEROID_1, LVL3_SPACETIME_1);

    return world;
  }

  beforeEach('load fixture', async function () {
    world = await fixtureLoader(worldFixture);
  });

  it('allows player to withdraw silver from trading posts', async function () {
    const withdrawnAmount = (await world.contract.planets(LVL3_SPACETIME_1.id)).silverCap;

    await expect(world.user1Core.withdrawSilver(LVL3_SPACETIME_1.id, withdrawnAmount))
      .to.emit(world.contract, 'PlanetSilverWithdrawn')
      .withArgs(world.user1.address, LVL3_SPACETIME_1.id, withdrawnAmount);

    // According to DarkForestPlanet.sol:
    // Energy and Silver are not stored as floats in the smart contracts,
    // so any of those values coming from the contracts need to be divided by
    // `CONTRACT_PRECISION` to get their true integer value.
    // FIXME(blaine): This should have been done client-side because this type of
    // division isn't supposed to be done in the contract. That's the whole point of
    // `CONTRACT_PRECISION`
    expect((await world.contract.players(world.user1.address)).score).to.equal(
      withdrawnAmount.div(1000)
    );
  });

  it("doesn't allow player to withdraw more silver than planet has", async function () {
    const withdrawnAmount = (await world.contract.planets(LVL3_SPACETIME_1.id)).silverCap.add(1000);

    await expect(
      world.user1Core.withdrawSilver(LVL3_SPACETIME_1.id, withdrawnAmount)
    ).to.be.revertedWith('tried to withdraw more silver than exists on planet');

    expect((await world.contract.players(world.user1.address)).score).to.equal(0);
  });

  it("doesn't allow player to withdraw silver from non-trading post", async function () {
    const withdrawnAmount = (await world.contract.planets(LVL1_ASTEROID_1.id)).silverCap;

    await expect(
      world.user1Core.withdrawSilver(LVL1_ASTEROID_1.id, withdrawnAmount)
    ).to.be.revertedWith('can only withdraw silver from trading posts');

    expect((await world.contract.players(world.user1.address)).score).to.equal(0);
  });

  it("doesn't allow player to withdraw silver from planet that is not theirs", async function () {
    const withdrawnAmount = (await world.contract.planets(LVL3_SPACETIME_1.id)).silverCap;

    await expect(
      world.user2Core.withdrawSilver(LVL3_SPACETIME_1.id, withdrawnAmount)
    ).to.be.revertedWith('you must own this planet');

    expect((await world.contract.players(world.user1.address)).score).to.equal(0);
    expect((await world.contract.players(world.user2.address)).score).to.equal(0);
  });
});
