import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  conquerUnownedPlanet,
  feedSilverToCap,
  hexToBigNumber,
  increaseBlockchainTime,
  makeInitArgs,
} from './utils/TestUtils';
import {
  asteroid1,
  star1,
  silverStar2,
  star3,
  tradingPost1,
  planetWithArtifact1,
  silverBank1,
  star6,
} from './utils/WorldConstants';
import { initializeWorld, World } from './utils/TestWorld';

const { BigNumber: BN } = ethers;

describe('DarkForestUpgrade', function () {
  let world: World;

  beforeEach(async function () {
    world = await initializeWorld();
  });

  it('should reject if planet not initialized', async function () {
    const fromId = hexToBigNumber(asteroid1.hex);

    await expect(world.user1Core.upgradePlanet(fromId, 0)).to.be.revertedWith(
      'Planet has not been initialized'
    );
  });

  it('should reject if not planet owner', async function () {
    const player1Planet = hexToBigNumber(asteroid1.hex);

    await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));

    await expect(world.user2Core.upgradePlanet(player1Planet, 0)).to.be.revertedWith(
      'Only owner account can perform operation on planets'
    );
  });

  it('should reject if planet level is not high enough', async function () {
    const lowLevelPlanet = hexToBigNumber(asteroid1.hex);
    await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));

    await expect(world.user1Core.upgradePlanet(lowLevelPlanet, 0)).to.be.revertedWith(
      'Planet level is not high enough for this upgrade'
    );
  });

  it('should reject if upgrade branch not valid', async function () {
    const upgradeablePlanetId = hexToBigNumber(star1.hex);

    await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, star1);

    await expect(world.user1Core.upgradePlanet(upgradeablePlanetId, 99)).to.be.revertedWith(
      'Upgrade branch not valid'
    );
  });

  it('should upgrade planet stats and emit event', async function () {
    const upgradeablePlanetId = hexToBigNumber(star1.hex);
    const silverMinePlanetId = hexToBigNumber(silverStar2.hex);

    await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));

    // conquer silver mine and upgradeable planet
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, star1);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, silverStar2);

    await increaseBlockchainTime();

    await world.user1Core.refreshPlanet(silverMinePlanetId);

    await feedSilverToCap(world, world.user1Core, silverStar2, star1);

    await world.contracts.core.refreshPlanet(upgradeablePlanetId);

    const planetBeforeUpgrade = await world.contracts.core.planets(upgradeablePlanetId);

    const silverCap = planetBeforeUpgrade.silverCap.toNumber();
    const initialSilver = planetBeforeUpgrade.silver.toNumber();
    const initialPopulationCap = planetBeforeUpgrade.populationCap;
    const initialPopulationGrowth = planetBeforeUpgrade.populationGrowth;

    await expect(world.user1Core.upgradePlanet(upgradeablePlanetId, 0))
      .to.emit(world.contracts.core, 'PlanetUpgraded')
      .withArgs(world.user1.address, upgradeablePlanetId, BN.from(0), BN.from(1));

    const planetAfterUpgrade = await world.contracts.core.planets(upgradeablePlanetId);
    const newPopulationCap = planetAfterUpgrade.populationCap;
    const newPopulationGrowth = planetAfterUpgrade.populationGrowth;
    const newSilver = planetAfterUpgrade.silver.toNumber();

    expect(newSilver).to.equal(initialSilver - 0.2 * silverCap);
    expect(initialPopulationCap).to.be.below(newPopulationCap);
    expect(initialPopulationGrowth).to.be.below(newPopulationGrowth);
  });

  it('should reject upgrade on silver mine, ruins, silver bank, and trading post', async function () {
    await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));

    // conquer the special planets
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, silverStar2);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, planetWithArtifact1);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, silverBank1);

    // fill up the special planets with silver
    await feedSilverToCap(world, world.user1Core, silverStar2, tradingPost1);
    await feedSilverToCap(world, world.user1Core, silverStar2, planetWithArtifact1);
    await feedSilverToCap(world, world.user1Core, silverStar2, silverBank1);
    await increaseBlockchainTime(); // fills up silverStar2

    await expect(
      world.user1Core.upgradePlanet(hexToBigNumber(silverStar2.hex), 0)
    ).to.be.revertedWith('Can only upgrade regular planets');
    await expect(
      world.user1Core.upgradePlanet(hexToBigNumber(tradingPost1.hex), 0)
    ).to.be.revertedWith('Can only upgrade regular planets');
    await expect(
      world.user1Core.upgradePlanet(hexToBigNumber(planetWithArtifact1.hex), 0)
    ).to.be.revertedWith('Can only upgrade regular planets');
    await expect(
      world.user1Core.upgradePlanet(hexToBigNumber(silverBank1.hex), 0)
    ).to.be.revertedWith('Can only upgrade regular planets');
  });

  it("should reject upgrade if there's not enough resources", async function () {
    const upgradeablePlanetId = hexToBigNumber(star1.hex);

    await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));

    // conquer the upgradeable planet
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, star1);

    await increaseBlockchainTime();

    await expect(world.user1Core.upgradePlanet(upgradeablePlanetId, 0)).to.be.revertedWith(
      'Insufficient silver to upgrade'
    );
  });

  it('should reject upgrade if branch is maxed', async function () {
    const upgradeablePlanetId = hexToBigNumber(star3.hex);

    await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));

    // conquer upgradeable planet and silver planet
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, star3);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, silverStar2);

    await increaseBlockchainTime();

    for (let i = 0; i < 4; i++) {
      // fill up planet with silver
      await feedSilverToCap(world, world.user1Core, silverStar2, star3);

      await world.user1Core.upgradePlanet(upgradeablePlanetId, 1, {});

      await increaseBlockchainTime();
    }

    await expect(world.user1Core.upgradePlanet(upgradeablePlanetId, 1)).to.be.revertedWith(
      'Upgrade branch already maxed'
    );
  });

  it('should reject upgrade if total level already maxed (safe space)', async function () {
    this.timeout(10000);

    const upgradeablePlanetId = hexToBigNumber(star1.hex);

    const initArgs = makeInitArgs(asteroid1);

    await world.user1Core.initializePlayer(...initArgs);

    // conquer upgradeable planet and silver planet
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, star1);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, silverStar2);

    await increaseBlockchainTime();

    const branchOrder = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      // fill up planet with silver
      await feedSilverToCap(world, world.user1Core, silverStar2, star1);

      await world.user1Core.upgradePlanet(upgradeablePlanetId, branchOrder[i]);

      await increaseBlockchainTime();
    }

    await expect(world.user1Core.upgradePlanet(upgradeablePlanetId, 1)).to.be.revertedWith(
      'Planet at max total level'
    );
  });

  it('should reject upgrade if total level already maxed (dead space)', async function () {
    this.timeout(10000);

    const upgradeablePlanetId = hexToBigNumber(star6.hex);

    await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));

    // conquer upgradeable planet and silver planet
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, star6);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, silverStar2);

    await increaseBlockchainTime();

    const branchOrder = [2, 2, 2, 1, 1];
    for (let i = 0; i < 5; i++) {
      // fill up planet with silver
      await feedSilverToCap(world, world.user1Core, silverStar2, star6);

      await world.user1Core.upgradePlanet(upgradeablePlanetId, branchOrder[i]);

      await increaseBlockchainTime();
    }

    await expect(world.user1Core.upgradePlanet(upgradeablePlanetId, 1)).to.be.revertedWith(
      'Planet at max total level'
    );
  });
});
