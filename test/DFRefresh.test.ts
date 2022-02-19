import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  fixtureLoader,
  increaseBlockchainTime,
  makeInitArgs,
  makeMoveArgs,
  ZERO_ADDRESS,
} from './utils/TestUtils';
import { defaultWorldFixture, World } from './utils/TestWorld';
import {
  LARGE_INTERVAL,
  LVL1_ASTEROID_1,
  LVL1_ASTEROID_2,
  LVL1_PLANET_NEBULA,
  SMALL_INTERVAL,
  SPAWN_PLANET_1,
  SPAWN_PLANET_2,
  TOLERANCE,
} from './utils/WorldConstants';

const { BigNumber: BN } = ethers;

describe('DarkForestRefresh', function () {
  let world: World;

  async function worldFixture() {
    const world = await fixtureLoader(defaultWorldFixture);
    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));
    return world;
  }

  beforeEach('load fixture', async function () {
    world = await fixtureLoader(worldFixture);
  });

  it('should increase population over time', async function () {
    const planetId = SPAWN_PLANET_1.id;

    const startPlanet = await world.contract.planets(planetId);
    const startPlanetExtendedInfo = await world.contract.planetsExtendedInfo(planetId);
    expect(startPlanetExtendedInfo.lastUpdated).to.equal(
      (await ethers.provider.getBlock('latest')).timestamp
    );

    await increaseBlockchainTime(SMALL_INTERVAL);

    await world.contract.refreshPlanet(planetId);
    const midPlanet = await world.contract.planets(planetId);
    const midPlanetExtendedInfo = await world.contract.planetsExtendedInfo(planetId);
    expect(midPlanetExtendedInfo.lastUpdated).to.equal(
      (await ethers.provider.getBlock('latest')).timestamp
    );
    expect(midPlanet.population).to.be.above(startPlanet.population);

    await increaseBlockchainTime(LARGE_INTERVAL);

    await world.contract.refreshPlanet(planetId);

    const endPlanet = await world.contract.planets(planetId);
    const endPlanetExtendedInfo = await world.contract.planetsExtendedInfo(planetId);
    expect(endPlanet.population).to.be.above(midPlanet.population);
    expect(endPlanet.population).to.not.be.above(endPlanet.populationCap);
    expect(endPlanet.population).to.be.above(endPlanet.populationCap.sub(BN.from(1)));
    expect(endPlanetExtendedInfo.lastUpdated).to.be.equal(
      (await ethers.provider.getBlock('latest')).timestamp
    );
  });

  it('should decrease population over time of overpopulated', async function () {
    const planetId1 = SPAWN_PLANET_1.id;

    await increaseBlockchainTime();

    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, SPAWN_PLANET_2, 0, 50000, 0));

    await increaseBlockchainTime();

    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_2, SPAWN_PLANET_1, 0, 99000, 0));

    await world.contract.refreshPlanet(planetId1);

    const startPlanet1 = await world.contract.planets(planetId1);
    expect(startPlanet1.population).to.be.above(startPlanet1.populationCap);

    await increaseBlockchainTime(SMALL_INTERVAL);
    await world.contract.refreshPlanet(planetId1);

    const midPlanet1 = await world.contract.planets(planetId1);
    expect(midPlanet1.population).to.be.above(midPlanet1.populationCap);
    expect(midPlanet1.population).to.be.below(startPlanet1.population);

    await increaseBlockchainTime();

    await world.contract.refreshPlanet(planetId1);
    const endPlanet1 = await world.contract.planets(planetId1);
    expect(endPlanet1.population).to.not.be.below(endPlanet1.populationCap);
    expect(endPlanet1.population).to.be.below(endPlanet1.populationCap.add(BN.from(1)));
  });

  it('should increase silver of 50%pop silver-producing planet', async function () {
    const silverStarId = LVL1_ASTEROID_2.id;

    // conquer silver planet
    for (let i = 0; i < 2; i++) {
      await increaseBlockchainTime();
      await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, LVL1_ASTEROID_2, 0, 90001, 0));
    }

    // after a long time, silver star is full of silver and pop
    // reduce it to 50% pop and 0% silver
    await increaseBlockchainTime();

    let silverStarPlanet = await world.contract.planets(silverStarId);
    const silverStarPopCap = silverStarPlanet.populationCap;
    const silverStarResCap = silverStarPlanet.silverCap;
    await world.user1Core.move(
      ...makeMoveArgs(
        LVL1_ASTEROID_2,
        SPAWN_PLANET_1,
        0,
        silverStarPopCap.toNumber() / 2,
        silverStarResCap
      )
    );

    // test that over SMALL_INTERVAL seconds it produces the correct amt of silver
    // i.e. after SMALL_INTERVAL seconds it has ~silverGrowth * SMALL_INTERVAL silver
    await increaseBlockchainTime(SMALL_INTERVAL);
    await world.contract.refreshPlanet(silverStarId);

    silverStarPlanet = await world.contract.planets(silverStarId);
    expect(silverStarPlanet.silver).to.not.be.below(
      silverStarPlanet.silverGrowth.mul(SMALL_INTERVAL)
    );
    // to account for the fact that blockchain time passes somewhat unevenly
    expect(silverStarPlanet.silver).to.not.be.above(
      silverStarPlanet.silverGrowth.mul(SMALL_INTERVAL + TOLERANCE)
    );
  });

  it('should not increase silver of non-silver-producing planet', async function () {
    const planetId = SPAWN_PLANET_1.id;
    await increaseBlockchainTime(SMALL_INTERVAL);
    await world.contract.refreshPlanet(planetId);
    const planet = await world.contract.planets(planetId);
    expect(planet.silver).to.be.equal(BN.from(0));
  });

  it('should not increase silver of full silver planet', async function () {
    const silverStarId2 = LVL1_ASTEROID_2.id;

    // conquer and fill both silver planets
    await increaseBlockchainTime();
    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, LVL1_ASTEROID_1, 0, 90000, 0));

    await increaseBlockchainTime();
    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, LVL1_ASTEROID_2, 0, 90000, 0));

    await increaseBlockchainTime();

    // make planet 2's silver > cap
    await world.user1Core.move(...makeMoveArgs(LVL1_ASTEROID_1, LVL1_ASTEROID_2, 0, 90000, 1000));

    await world.contract.refreshPlanet(silverStarId2);
    let silverStarPlanet2 = await world.contract.planets(silverStarId2);
    const silverCap = silverStarPlanet2.silverCap;
    const oldSilver = silverStarPlanet2.silver;
    expect(oldSilver).to.not.be.below(silverCap);

    // after time has passed, planet 2 silver should not have increased
    await increaseBlockchainTime(SMALL_INTERVAL);
    await world.contract.refreshPlanet(silverStarId2);
    silverStarPlanet2 = await world.contract.planets(silverStarId2);
    const newSilver = silverStarPlanet2.silver;
    expect(newSilver).to.not.be.below(oldSilver);
  });

  it('should not increase pop or silver of barbarian-owned planet', async function () {
    const star2Id = LVL1_PLANET_NEBULA.id;

    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, LVL1_PLANET_NEBULA, 0, 20000, 0));
    await increaseBlockchainTime();

    await world.contract.refreshPlanet(star2Id);
    let star2Data = await world.contract.planets(star2Id);
    const oldPop = star2Data.population;
    const oldSilver = star2Data.silver;
    expect(star2Data.owner).to.be.equal(ZERO_ADDRESS);
    expect(star2Data.population).to.be.above(BN.from(0));
    expect(star2Data.silver).to.be.equal(BN.from(0));

    increaseBlockchainTime(SMALL_INTERVAL);
    await world.contract.refreshPlanet(star2Id);
    star2Data = await world.contract.planets(star2Id);
    const newPop = star2Data.population;
    const newSilver = star2Data.silver;
    expect(newPop).to.be.equal(oldPop);
    expect(newSilver).to.be.equal(oldSilver);
  });

  it('should revert if planet is not initialiazed', async function () {
    const uninitializedPlanet = SPAWN_PLANET_2.id;

    await expect(world.user1Core.refreshPlanet(uninitializedPlanet)).to.be.revertedWith(
      'Planet has not been initialized'
    );
  });
});
