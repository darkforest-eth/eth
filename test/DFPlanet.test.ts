import { expect } from 'chai';
import {
  conquerUnownedPlanet,
  feedSilverToCap,
  fixtureLoader,
  increaseBlockchainTime,
  makeInitArgs,
  makeMoveArgs,
} from './utils/TestUtils';
import { defaultWorldFixture, World } from './utils/TestWorld';
import {
  ARTIFACT_PLANET_1,
  LVL0_PLANET_DEAD_SPACE,
  LVL0_PLANET_DEEP_SPACE,
  LVL0_PLANET_POPCAP_BOOSTED,
  LVL1_ASTEROID_1,
  LVL1_ASTEROID_2,
  LVL1_ASTEROID_DEEP_SPACE,
  LVL1_ASTEROID_NEBULA,
  LVL1_ASTEROID_NO_PRODUCE,
  LVL1_PLANET_NEBULA,
  LVL1_PLANET_SPACE,
  LVL1_QUASAR,
  LVL3_SPACETIME_1,
  LVL3_UNOWNED_DEEP_SPACE,
  LVL3_UNOWNED_NEBULA,
  LVL3_UNOWNED_SPACE,
  MAX_PLANET_DEAD_SPACE,
  MAX_PLANET_DEEP_SPACE,
  MAX_PLANET_NEBULA,
  MAX_PLANET_SPACE,
  SPAWN_PLANET_1,
  SPAWN_PLANET_2,
} from './utils/WorldConstants';

describe('DarkForestPlanet', function () {
  // Bump the time out so that the test doesn't timeout during
  // initial fixture creation
  this.timeout(1000 * 60);
  let world: World;

  async function worldFixture() {
    const world = await fixtureLoader(defaultWorldFixture);
    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));
    await world.user2Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_2));

    // Touch initial planets to initialize data
    // We don't need this planet to be conquered
    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, ARTIFACT_PLANET_1, 0, 10000, 0));
    await increaseBlockchainTime();
    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, MAX_PLANET_NEBULA, 0, 10000, 0));
    await increaseBlockchainTime();
    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, MAX_PLANET_SPACE, 0, 10000, 0));
    await increaseBlockchainTime();
    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, MAX_PLANET_DEEP_SPACE, 0, 10000, 0));
    await increaseBlockchainTime();
    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, MAX_PLANET_DEAD_SPACE, 0, 10000, 0));
    await increaseBlockchainTime();
    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, LVL1_PLANET_NEBULA, 0, 10000, 0));
    await increaseBlockchainTime();
    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, LVL1_PLANET_SPACE, 0, 10000, 0));
    await increaseBlockchainTime();
    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, LVL3_UNOWNED_NEBULA, 0, 10000, 0));
    await increaseBlockchainTime();
    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, LVL3_UNOWNED_SPACE, 0, 10000, 0));
    await increaseBlockchainTime();
    await world.user1Core.move(
      ...makeMoveArgs(SPAWN_PLANET_1, LVL3_UNOWNED_DEEP_SPACE, 0, 10000, 0)
    );
    await increaseBlockchainTime();
    await world.user1Core.move(
      ...makeMoveArgs(SPAWN_PLANET_1, LVL0_PLANET_DEEP_SPACE, 0, 10000, 0)
    );
    await increaseBlockchainTime();
    await world.user1Core.move(
      ...makeMoveArgs(SPAWN_PLANET_1, LVL0_PLANET_DEAD_SPACE, 0, 10000, 0)
    );
    await increaseBlockchainTime();
    await world.user1Core.move(
      ...makeMoveArgs(SPAWN_PLANET_1, LVL0_PLANET_POPCAP_BOOSTED, 0, 10000, 0)
    );
    await increaseBlockchainTime();
    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, LVL1_ASTEROID_2, 0, 10000, 0));
    await increaseBlockchainTime();
    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, LVL1_ASTEROID_NEBULA, 0, 10000, 0));
    await increaseBlockchainTime();
    await world.user1Core.move(
      ...makeMoveArgs(SPAWN_PLANET_1, LVL1_ASTEROID_DEEP_SPACE, 0, 10000, 0)
    );
    await increaseBlockchainTime();
    await world.user1Core.move(
      ...makeMoveArgs(SPAWN_PLANET_1, LVL1_ASTEROID_NO_PRODUCE, 0, 10000, 0)
    );
    await increaseBlockchainTime();
    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, LVL1_QUASAR, 0, 10000, 0));
    await increaseBlockchainTime();

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

  it('clips level in nebula and space', async function () {
    const nebulaPlanet = await world.contract.planets(MAX_PLANET_NEBULA.id);
    const regularPlanet = await world.contract.planets(MAX_PLANET_SPACE.id);

    expect(nebulaPlanet.planetLevel.toNumber()).to.equal(4);
    expect(regularPlanet.planetLevel.toNumber()).to.equal(5);
  });

  it("doesn't clip level in deep or dead space", async function () {
    const deepSpacePlanet = await world.contract.planets(MAX_PLANET_DEEP_SPACE.id);
    const deadSpacePlanet = await world.contract.planets(MAX_PLANET_DEAD_SPACE.id);

    expect(deepSpacePlanet.planetLevel.toNumber()).to.be.above(4);
    expect(deadSpacePlanet.planetLevel.toNumber()).to.be.above(4);
  });

  it('applies medium space buffs and debuffs', async function () {
    const nebulaPlanet = await world.contract.planets(LVL3_UNOWNED_NEBULA.id);
    const regularPlanet = await world.contract.planets(LVL3_UNOWNED_SPACE.id);

    expect(Math.floor(nebulaPlanet.range.toNumber() * 1.25)).to.equal(
      regularPlanet.range.toNumber()
    );
    expect(Math.floor(nebulaPlanet.speed.toNumber() * 1.25)).to.equal(
      regularPlanet.speed.toNumber()
    );
    expect(Math.floor(nebulaPlanet.populationCap.toNumber() * 1.25)).to.equal(
      regularPlanet.populationCap.toNumber()
    );
    expect(Math.floor(nebulaPlanet.populationGrowth.toNumber() * 1.25)).to.equal(
      regularPlanet.populationGrowth.toNumber()
    );
    expect(Math.floor(nebulaPlanet.silverCap.toNumber() * 1.25)).to.equal(
      regularPlanet.silverCap.toNumber()
    );
    expect(Math.floor(nebulaPlanet.silverGrowth.toNumber() * 1.25)).to.equal(
      regularPlanet.silverGrowth.toNumber()
    );
    expect(Math.floor(nebulaPlanet.defense.toNumber() * 0.5)).to.equal(
      regularPlanet.defense.toNumber()
    );
    // pirates
    expect(Math.floor(nebulaPlanet.population.toNumber() * 4 * 1.25)).to.equal(
      regularPlanet.population.toNumber()
    );
  });

  it('applies deep space buffs and debuffs', async function () {
    const nebulaPlanet = await world.contract.planets(SPAWN_PLANET_1.id);
    const deepSpacePlanet = await world.contract.planets(LVL0_PLANET_DEEP_SPACE.id);

    expect(Math.floor(nebulaPlanet.range.toNumber() * 1.5)).to.be.equal(
      deepSpacePlanet.range.toNumber()
    );
    expect(Math.floor(nebulaPlanet.speed.toNumber() * 1.5)).to.be.equal(
      deepSpacePlanet.speed.toNumber()
    );
    expect(Math.floor(nebulaPlanet.populationCap.toNumber() * 1.5)).to.be.equal(
      deepSpacePlanet.populationCap.toNumber()
    );
    expect(Math.floor(nebulaPlanet.populationGrowth.toNumber() * 1.5)).to.be.equal(
      deepSpacePlanet.populationGrowth.toNumber()
    );
    expect(Math.floor(nebulaPlanet.silverCap.toNumber() * 1.5)).to.be.equal(
      deepSpacePlanet.silverCap.toNumber()
    );
    expect(Math.floor(nebulaPlanet.silverGrowth.toNumber() * 1.5)).to.be.equal(
      deepSpacePlanet.silverGrowth.toNumber()
    );
    expect(Math.floor(nebulaPlanet.defense.toNumber() * 0.25)).to.be.equal(
      deepSpacePlanet.defense.toNumber()
    );
  });

  it('applies dead space buffs and debuffs', async function () {
    const nebulaPlanet = await world.contract.planets(SPAWN_PLANET_1.id);
    const deadSpacePlanet = await world.contract.planets(LVL0_PLANET_DEAD_SPACE.id);

    expect(Math.floor(nebulaPlanet.range.toNumber() * 2)).to.be.equal(
      deadSpacePlanet.range.toNumber()
    );
    expect(Math.floor(nebulaPlanet.speed.toNumber() * 2)).to.be.equal(
      deadSpacePlanet.speed.toNumber()
    );
    expect(Math.floor(nebulaPlanet.populationCap.toNumber() * 2)).to.be.equal(
      deadSpacePlanet.populationCap.toNumber()
    );
    expect(Math.floor(nebulaPlanet.populationGrowth.toNumber() * 2)).to.be.equal(
      deadSpacePlanet.populationGrowth.toNumber()
    );
    expect(Math.floor(nebulaPlanet.silverCap.toNumber() * 2)).to.be.equal(
      deadSpacePlanet.silverCap.toNumber()
    );
    expect(Math.floor(nebulaPlanet.silverGrowth.toNumber() * 2)).to.be.equal(
      deadSpacePlanet.silverGrowth.toNumber()
    );
    expect(Math.floor(nebulaPlanet.defense.toNumber() * 0.15)).to.be.equal(
      deadSpacePlanet.defense.toNumber()
    );
  });

  it('applies deep space buffs and debuffs on silver mines', async function () {
    const nebulaMine = await world.contract.planets(LVL1_ASTEROID_NEBULA.id);
    const deepSpaceMine = await world.contract.planets(LVL1_ASTEROID_DEEP_SPACE.id);

    expect(Math.floor(nebulaMine.range.toNumber() * 1.5)).to.be.equal(
      deepSpaceMine.range.toNumber()
    );
    expect(Math.floor(nebulaMine.speed.toNumber() * 1.5)).to.be.equal(
      deepSpaceMine.speed.toNumber()
    );
    expect(Math.floor(nebulaMine.populationCap.toNumber() * 1.5)).to.be.equal(
      deepSpaceMine.populationCap.toNumber()
    );
    expect(Math.floor(nebulaMine.populationGrowth.toNumber() * 1.5)).to.be.equal(
      deepSpaceMine.populationGrowth.toNumber()
    );
    expect(Math.floor(nebulaMine.silverCap.toNumber() * 1.5)).to.be.equal(
      deepSpaceMine.silverCap.toNumber()
    );
    expect(Math.floor(nebulaMine.silverGrowth.toNumber() * 1.5)).to.be.equal(
      deepSpaceMine.silverGrowth.toNumber()
    );
    expect(Math.floor(nebulaMine.defense.toNumber() * 0.25)).to.be.equal(
      deepSpaceMine.defense.toNumber()
    );
  });

  it('applies doubled stat comet buffs', async function () {
    const normalPlanet = await world.contract.planets(SPAWN_PLANET_1.id);
    const popcapBoosterPlanet = await world.contract.planets(LVL0_PLANET_POPCAP_BOOSTED.id);

    // should buff popcap
    expect(normalPlanet.populationCap.toNumber() * 2).to.be.equal(
      popcapBoosterPlanet.populationCap.toNumber()
    );
    // should not buff other stats
    expect(normalPlanet.populationGrowth.toNumber()).to.be.equal(
      popcapBoosterPlanet.populationGrowth.toNumber()
    );
  });

  it('initializes silver mines more frequently in deep space', async function () {
    // both hex value of silver byte is 51
    const nonSilverPlanet = await world.contract.planets(LVL1_ASTEROID_NO_PRODUCE.id);
    const silverPlanet = await world.contract.planets(LVL1_ASTEROID_DEEP_SPACE.id);

    expect(nonSilverPlanet.silverGrowth.toNumber()).to.be.equal(0);
    expect(silverPlanet.silverGrowth.toNumber()).to.be.above(0);
  });

  it('initializes silver mines with debuffs and silver cache', async function () {
    const regularPlanet = await world.contract.planets(LVL1_PLANET_SPACE.id);
    const silverPlanet = await world.contract.planets(LVL1_ASTEROID_2.id);

    // buffs silver cap, but debuffs silver mine defense
    expect(Math.floor(regularPlanet.silverCap.toNumber() * 2)).to.be.equal(
      silverPlanet.silverCap.toNumber()
    );
    expect(Math.floor(regularPlanet.defense.toNumber() / 2)).to.be.equal(
      silverPlanet.defense.toNumber()
    );

    // planet is half filled with silver
    expect(silverPlanet.silver.toNumber()).to.be.equal(silverPlanet.silverCap.toNumber() / 2);
  });

  it('initializes ruins with normal stats', async function () {
    const regularPlanet = await world.contract.planets(LVL1_PLANET_SPACE.id);
    const ruinsPlanet = await world.contract.planets(ARTIFACT_PLANET_1.id);

    // debuffs
    expect(regularPlanet.populationCap.toNumber()).to.be.equal(
      ruinsPlanet.populationCap.toNumber()
    );
    expect(regularPlanet.populationGrowth.toNumber()).to.be.equal(
      ruinsPlanet.populationGrowth.toNumber()
    );
    expect(regularPlanet.defense.toNumber()).to.be.equal(ruinsPlanet.defense.toNumber());
  });

  it('initializes quasar with modified stats', async function () {
    const regularPlanet = await world.contract.planets(LVL1_PLANET_NEBULA.id);
    const quasarPlanet = await world.contract.planets(LVL1_QUASAR.id);

    // debuffs
    expect(quasarPlanet.planetType).to.be.equal(4);
    expect(Math.floor(regularPlanet.silverCap.toNumber() * 10)).to.be.equal(
      quasarPlanet.silverCap.toNumber()
    );
    expect(Math.floor(regularPlanet.speed.toNumber() / 2)).to.be.equal(
      quasarPlanet.speed.toNumber()
    );
    expect(Math.floor(quasarPlanet.populationGrowth.toNumber())).to.be.equal(0);
    expect(Math.floor(regularPlanet.populationCap.toNumber() * 5)).to.be.equal(
      quasarPlanet.populationCap.toNumber()
    );
  });

  it('initializes trading post with modified stats', async function () {
    const regularPlanet = await world.contract.planets(LVL3_UNOWNED_DEEP_SPACE.id);
    const tradingPostPlanet = await world.contract.planets(LVL3_SPACETIME_1.id);

    // debuffs
    expect(regularPlanet.populationCap.toNumber()).to.be.equal(
      tradingPostPlanet.populationCap.toNumber()
    );
    expect(regularPlanet.populationGrowth.toNumber()).to.be.equal(
      tradingPostPlanet.populationGrowth.toNumber()
    );
    expect(Math.floor(regularPlanet.defense.toNumber() / 2)).to.be.equal(
      tradingPostPlanet.defense.toNumber()
    );
    expect(regularPlanet.silverCap.toNumber() * 2).to.be.equal(
      tradingPostPlanet.silverCap.toNumber()
    );
  });
});
