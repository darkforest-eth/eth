import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  conquerUnownedPlanet,
  feedSilverToCap,
  fixtureLoader,
  increaseBlockchainTime,
  makeInitArgs,
} from './utils/TestUtils';
import { defaultWorldFixture, World } from './utils/TestWorld';
import {
  ARTIFACT_PLANET_1,
  LVL1_ASTEROID_2,
  LVL1_PLANET_DEEP_SPACE,
  LVL1_PLANET_NEBULA,
  LVL1_QUASAR,
  LVL2_PLANET_DEAD_SPACE,
  LVL3_SPACETIME_1,
  SPAWN_PLANET_1,
} from './utils/WorldConstants';

const { BigNumber: BN } = ethers;

describe('DarkForestUpgrade', function () {
  let world: World;

  beforeEach('load fixture', async function () {
    world = await fixtureLoader(defaultWorldFixture);
  });

  it('should reject if planet not initialized', async function () {
    const fromId = SPAWN_PLANET_1.id;

    await expect(world.user1Core.upgradePlanet(fromId, 0)).to.be.revertedWith(
      'Planet has not been initialized'
    );
  });

  it('should reject if not planet owner', async function () {
    const player1Planet = SPAWN_PLANET_1.id;

    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));

    await expect(world.user2Core.upgradePlanet(player1Planet, 0)).to.be.revertedWith(
      'Only owner account can perform that operation on planet.'
    );
  });

  it('should reject if planet level is not high enough', async function () {
    const lowLevelPlanet = SPAWN_PLANET_1.id;
    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));

    await expect(world.user1Core.upgradePlanet(lowLevelPlanet, 0)).to.be.revertedWith(
      'Planet level is not high enough for this upgrade'
    );
  });

  it('should reject if upgrade branch not valid', async function () {
    const upgradeablePlanetId = LVL1_PLANET_NEBULA.id;

    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_PLANET_NEBULA);

    await expect(world.user1Core.upgradePlanet(upgradeablePlanetId, 99)).to.be.revertedWith(
      'Upgrade branch not valid'
    );
  });

  it('should upgrade planet stats and emit event', async function () {
    const upgradeablePlanetId = LVL1_PLANET_NEBULA.id;
    const silverMinePlanetId = LVL1_ASTEROID_2.id;

    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));

    // conquer silver mine and upgradeable planet
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_PLANET_NEBULA);
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_ASTEROID_2);

    await increaseBlockchainTime();

    await world.user1Core.refreshPlanet(silverMinePlanetId);

    await feedSilverToCap(world, world.user1Core, LVL1_ASTEROID_2, LVL1_PLANET_NEBULA);

    await world.contract.refreshPlanet(upgradeablePlanetId);

    const planetBeforeUpgrade = await world.contract.planets(upgradeablePlanetId);

    const silverCap = planetBeforeUpgrade.silverCap.toNumber();
    const initialSilver = planetBeforeUpgrade.silver.toNumber();
    const initialPopulationCap = planetBeforeUpgrade.populationCap;
    const initialPopulationGrowth = planetBeforeUpgrade.populationGrowth;

    await expect(world.user1Core.upgradePlanet(upgradeablePlanetId, 0))
      .to.emit(world.contract, 'PlanetUpgraded')
      .withArgs(world.user1.address, upgradeablePlanetId, BN.from(0), BN.from(1));

    const planetAfterUpgrade = await world.contract.planets(upgradeablePlanetId);
    const newPopulationCap = planetAfterUpgrade.populationCap;
    const newPopulationGrowth = planetAfterUpgrade.populationGrowth;
    const newSilver = planetAfterUpgrade.silver.toNumber();

    expect(newSilver).to.equal(initialSilver - 0.2 * silverCap);
    expect(initialPopulationCap).to.be.below(newPopulationCap);
    expect(initialPopulationGrowth).to.be.below(newPopulationGrowth);
  });

  it('should reject upgrade on silver mine, ruins, silver bank, and trading post', async function () {
    this.timeout(0);
    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));

    // conquer the special planets
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_ASTEROID_2);
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL3_SPACETIME_1);
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, ARTIFACT_PLANET_1);
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_QUASAR);

    // fill up the special planets with silver
    await feedSilverToCap(world, world.user1Core, LVL1_ASTEROID_2, LVL3_SPACETIME_1);
    await feedSilverToCap(world, world.user1Core, LVL1_ASTEROID_2, ARTIFACT_PLANET_1);
    await feedSilverToCap(world, world.user1Core, LVL1_ASTEROID_2, LVL1_QUASAR);
    await increaseBlockchainTime(); // fills up LVL1_ASTEROID_2

    await expect(world.user1Core.upgradePlanet(LVL1_ASTEROID_2.id, 0)).to.be.revertedWith(
      'Can only upgrade regular planets'
    );
    await expect(world.user1Core.upgradePlanet(LVL3_SPACETIME_1.id, 0)).to.be.revertedWith(
      'Can only upgrade regular planets'
    );
    await expect(world.user1Core.upgradePlanet(ARTIFACT_PLANET_1.id, 0)).to.be.revertedWith(
      'Can only upgrade regular planets'
    );
    await expect(world.user1Core.upgradePlanet(LVL1_QUASAR.id, 0)).to.be.revertedWith(
      'Can only upgrade regular planets'
    );
  });

  it("should reject upgrade if there's not enough resources", async function () {
    const upgradeablePlanetId = LVL1_PLANET_NEBULA.id;

    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));

    // conquer the upgradeable planet
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_PLANET_NEBULA);

    await increaseBlockchainTime();

    await expect(world.user1Core.upgradePlanet(upgradeablePlanetId, 0)).to.be.revertedWith(
      'Insufficient silver to upgrade'
    );
  });

  it('should reject upgrade if branch is maxed', async function () {
    const upgradeablePlanetId = LVL1_PLANET_DEEP_SPACE.id;

    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));

    // conquer upgradeable planet and silver planet
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_PLANET_DEEP_SPACE);
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_ASTEROID_2);

    await increaseBlockchainTime();

    for (let i = 0; i < 4; i++) {
      // fill up planet with silver
      await feedSilverToCap(world, world.user1Core, LVL1_ASTEROID_2, LVL1_PLANET_DEEP_SPACE);

      await world.user1Core.upgradePlanet(upgradeablePlanetId, 1, {});

      await increaseBlockchainTime();
    }

    await expect(world.user1Core.upgradePlanet(upgradeablePlanetId, 1)).to.be.revertedWith(
      'Upgrade branch already maxed'
    );
  });

  it('should reject upgrade if total level already maxed (safe space)', async function () {
    this.timeout(10000);

    const upgradeablePlanetId = LVL1_PLANET_NEBULA.id;

    const initArgs = makeInitArgs(SPAWN_PLANET_1);

    await world.user1Core.initializePlayer(...initArgs);

    // conquer upgradeable planet and silver planet
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_PLANET_NEBULA);
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_ASTEROID_2);

    await increaseBlockchainTime();

    const branchOrder = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      // fill up planet with silver
      await feedSilverToCap(world, world.user1Core, LVL1_ASTEROID_2, LVL1_PLANET_NEBULA);

      await world.user1Core.upgradePlanet(upgradeablePlanetId, branchOrder[i]);

      await increaseBlockchainTime();
    }

    await expect(world.user1Core.upgradePlanet(upgradeablePlanetId, 1)).to.be.revertedWith(
      'Planet at max total level'
    );
  });

  it('should reject upgrade if total level already maxed (dead space)', async function () {
    const upgradeablePlanetId = LVL2_PLANET_DEAD_SPACE.id;

    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));
    await world.contract.safeSetOwner(world.user1.address, ...makeInitArgs(LVL2_PLANET_DEAD_SPACE));

    const branchOrder = [2, 2, 2, 1, 1];
    for (let i = 0; i < 5; i++) {
      await world.contract.adminFillPlanet(upgradeablePlanetId);
      await world.user1Core.upgradePlanet(upgradeablePlanetId, branchOrder[i]);
    }

    await expect(world.user1Core.upgradePlanet(upgradeablePlanetId, 1)).to.be.revertedWith(
      'Planet at max total level'
    );
  });
});
