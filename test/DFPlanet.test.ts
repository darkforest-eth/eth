import { expect } from 'chai';
import {
  conquerUnownedPlanet,
  feedSilverToCap,
  hexToBigNumber,
  increaseBlockchainTime,
  makeInitArgs,
  makeMoveArgs,
} from './utils/TestUtils';
import {
  asteroid1,
  maxLvlLocation1,
  maxLvlLocation2,
  lvl3Location1,
  lvl3Location2,
  asteroid3,
  silverStar4,
  star2,
  silverStar2,
  maxLvlLocation3,
  deepSpaceAsteroid,
  nebulaNonSilverStar,
  planetWithArtifact1,
  silverBank1,
  tradingPost1,
  star1,
  lvl3Location3,
  silverStar5,
  silverStar1,
  asteroid2,
  maxLvlLocation4,
  deadSpaceAsteroid,
} from './utils/WorldConstants';
import { initializeWorld, World } from './utils/TestWorld';

describe('DarkForestPlanet', function () {
  let world: World;

  beforeEach(async function () {
    world = await initializeWorld();
    const initArgs = makeInitArgs(asteroid1);

    await world.user1Core.initializePlayer(...initArgs);
  });

  it('clips level in nebula and space', async function () {
    const toId1 = hexToBigNumber(maxLvlLocation1.hex);
    const toId2 = hexToBigNumber(maxLvlLocation2.hex);

    const moveArgs = makeMoveArgs(asteroid1, maxLvlLocation1, 0, 30000, 0);

    await world.user1Core.move(...moveArgs);

    const bigPlanet1 = await world.contracts.core.planets(toId1);
    expect(bigPlanet1.planetLevel.toNumber()).to.equal(4);

    await increaseBlockchainTime();

    const moveArgs2 = makeMoveArgs(asteroid1, maxLvlLocation2, 0, 30000, 0);

    await world.user1Core.move(...moveArgs2);

    const bigPlanet2 = await world.contracts.core.planets(toId2);
    expect(bigPlanet2.planetLevel.toNumber()).to.equal(5);
  });

  it("doesn't clip level in deep or dead space", async function () {
    const toId1 = hexToBigNumber(maxLvlLocation3.hex);
    const toId2 = hexToBigNumber(maxLvlLocation4.hex);

    await world.user1Core.move(...makeMoveArgs(asteroid1, maxLvlLocation3, 0, 30000, 0));
    await increaseBlockchainTime();
    await world.user1Core.move(...makeMoveArgs(asteroid1, maxLvlLocation4, 0, 30000, 0));

    const bigPlanet1 = await world.contracts.core.planets(toId1);
    expect(bigPlanet1.planetLevel.toNumber()).to.be.above(4);
    const bigPlanet2 = await world.contracts.core.planets(toId2);
    expect(bigPlanet2.planetLevel.toNumber()).to.be.above(4);
  });

  it('applies medium space buffs and debuffs', async function () {
    const lvlThreeId1 = hexToBigNumber(lvl3Location1.hex);
    const lvlThreeId2 = hexToBigNumber(lvl3Location2.hex);

    // nebula
    const moveArgs1 = makeMoveArgs(asteroid1, lvl3Location1, 0, 10000, 0);
    await world.user1Core.move(...moveArgs1);

    // medium space
    const moveArgs2 = makeMoveArgs(asteroid1, lvl3Location2, 0, 10000, 0);
    await world.user1Core.move(...moveArgs2);

    const lvlFourPlanet1 = await world.contracts.core.planets(lvlThreeId1);
    const lvlFourPlanet2 = await world.contracts.core.planets(lvlThreeId2);

    expect(Math.floor(lvlFourPlanet1.range.toNumber() * 1.25)).to.equal(
      lvlFourPlanet2.range.toNumber()
    );
    expect(Math.floor(lvlFourPlanet1.speed.toNumber() * 1.25)).to.equal(
      lvlFourPlanet2.speed.toNumber()
    );
    expect(Math.floor(lvlFourPlanet1.populationCap.toNumber() * 1.25)).to.equal(
      lvlFourPlanet2.populationCap.toNumber()
    );
    expect(Math.floor(lvlFourPlanet1.populationGrowth.toNumber() * 1.25)).to.equal(
      lvlFourPlanet2.populationGrowth.toNumber()
    );
    expect(Math.floor(lvlFourPlanet1.silverCap.toNumber() * 1.25)).to.equal(
      lvlFourPlanet2.silverCap.toNumber()
    );
    expect(Math.floor(lvlFourPlanet1.silverGrowth.toNumber() * 1.25)).to.equal(
      lvlFourPlanet2.silverGrowth.toNumber()
    );
    expect(Math.floor(lvlFourPlanet1.defense.toNumber() * 0.5)).to.equal(
      lvlFourPlanet2.defense.toNumber()
    );
    // barbarians
    expect(Math.floor(lvlFourPlanet1.population.toNumber() * 4 * 1.25)).to.equal(
      lvlFourPlanet2.population.toNumber()
    );
  });

  it('applies deep space buffs and debuffs', async function () {
    const fromId = hexToBigNumber(asteroid1.hex);
    const toId = hexToBigNumber(deepSpaceAsteroid.hex);
    const moveArgs = makeMoveArgs(asteroid1, deepSpaceAsteroid, 0, 30000, 0);

    await world.user1Core.move(...moveArgs);

    const fromPlanet = await world.contracts.core.planets(fromId);
    const toPlanet = await world.contracts.core.planets(toId);

    expect(Math.floor(fromPlanet.range.toNumber() * 1.5)).to.be.equal(toPlanet.range.toNumber());
    expect(Math.floor(fromPlanet.speed.toNumber() * 1.5)).to.be.equal(toPlanet.speed.toNumber());
    expect(Math.floor(fromPlanet.populationCap.toNumber() * 1.5)).to.be.equal(
      toPlanet.populationCap.toNumber()
    );
    expect(Math.floor(fromPlanet.populationGrowth.toNumber() * 1.5)).to.be.equal(
      toPlanet.populationGrowth.toNumber()
    );
    expect(Math.floor(fromPlanet.silverCap.toNumber() * 1.5)).to.be.equal(
      toPlanet.silverCap.toNumber()
    );
    expect(Math.floor(fromPlanet.silverGrowth.toNumber() * 1.5)).to.be.equal(
      toPlanet.silverGrowth.toNumber()
    );
    expect(Math.floor(fromPlanet.defense.toNumber() * 0.25)).to.be.equal(
      toPlanet.defense.toNumber()
    );
  });

  it('applies dead space buffs and debuffs', async function () {
    const fromId = hexToBigNumber(asteroid1.hex);
    const toId = hexToBigNumber(deadSpaceAsteroid.hex);
    const moveArgs = makeMoveArgs(asteroid1, deadSpaceAsteroid, 0, 30000, 0);

    await world.user1Core.move(...moveArgs);

    const fromPlanet = await world.contracts.core.planets(fromId);
    const toPlanet = await world.contracts.core.planets(toId);

    expect(Math.floor(fromPlanet.range.toNumber() * 2)).to.be.equal(toPlanet.range.toNumber());
    expect(Math.floor(fromPlanet.speed.toNumber() * 2)).to.be.equal(toPlanet.speed.toNumber());
    expect(Math.floor(fromPlanet.populationCap.toNumber() * 2)).to.be.equal(
      toPlanet.populationCap.toNumber()
    );
    expect(Math.floor(fromPlanet.populationGrowth.toNumber() * 2)).to.be.equal(
      toPlanet.populationGrowth.toNumber()
    );
    expect(Math.floor(fromPlanet.silverCap.toNumber() * 2)).to.be.equal(
      toPlanet.silverCap.toNumber()
    );
    expect(Math.floor(fromPlanet.silverGrowth.toNumber() * 2)).to.be.equal(
      toPlanet.silverGrowth.toNumber()
    );
    expect(Math.floor(fromPlanet.defense.toNumber() * 0.15)).to.be.equal(
      toPlanet.defense.toNumber()
    );
  });

  it('applies deep space buffs and debuffs on silver mines', async function () {
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, silverStar5);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, silverStar4);

    world.user1Core.refreshPlanet(hexToBigNumber(silverStar5.hex));
    world.user1Core.refreshPlanet(hexToBigNumber(silverStar4.hex));

    const nebulaMine = await world.contracts.core.planets(hexToBigNumber(silverStar5.hex));
    const deepSpaceMine = await world.contracts.core.planets(hexToBigNumber(silverStar4.hex));

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
    const fromId = hexToBigNumber(asteroid1.hex);
    const toId = hexToBigNumber(asteroid3.hex);
    const moveArgs = makeMoveArgs(asteroid1, asteroid3, 0, 30000, 0);

    await world.user1Core.move(...moveArgs);

    const fromPlanet = await world.contracts.core.planets(fromId);
    const toPlanet = await world.contracts.core.planets(toId);

    // should buff popcap
    expect(fromPlanet.populationCap.toNumber() * 2).to.be.equal(toPlanet.populationCap.toNumber());
    // should not buff other stats
    expect(fromPlanet.populationGrowth.toNumber()).to.be.equal(
      toPlanet.populationGrowth.toNumber()
    );
  });

  it('initializes silver mines more frequently in deep space', async function () {
    // hex value of silver byte is 51
    const nebulaNonMineId = hexToBigNumber(nebulaNonSilverStar.hex);
    // hex value of silver byte is 51
    const deepSpaceMineId = hexToBigNumber(silverStar4.hex);
    const moveArgs1 = makeMoveArgs(asteroid1, nebulaNonSilverStar, 0, 30000, 0);

    await world.user1Core.move(...moveArgs1);

    await increaseBlockchainTime();

    const moveArgs2 = makeMoveArgs(asteroid1, silverStar4, 0, 30000, 0);

    await world.user1Core.move(...moveArgs2);

    const nonSilverPlanet = await world.contracts.core.planets(nebulaNonMineId);
    const silverPlanet = await world.contracts.core.planets(deepSpaceMineId);

    expect(nonSilverPlanet.silverGrowth.toNumber()).to.be.equal(0);
    expect(silverPlanet.silverGrowth.toNumber()).to.be.above(0);
  });

  it('initializes silver mines with debuffs and silver cache', async function () {
    const regularPlanetId = hexToBigNumber(star2.hex);
    const silverPlanetId = hexToBigNumber(silverStar2.hex);
    const moveArgs1 = makeMoveArgs(asteroid1, star2, 0, 30000, 0);

    await world.user1Core.move(...moveArgs1);

    await increaseBlockchainTime();

    const moveArgs2 = makeMoveArgs(asteroid1, silverStar2, 0, 30000, 0);

    await world.user1Core.move(...moveArgs2);

    const regularPlanet = await world.contracts.core.planets(regularPlanetId);
    const silverPlanet = await world.contracts.core.planets(silverPlanetId);

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
    const regularPlanetId = hexToBigNumber(star2.hex);
    const ruinsId = hexToBigNumber(planetWithArtifact1.hex);

    await conquerUnownedPlanet(world, world.user1Core, asteroid1, star2);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, planetWithArtifact1);
    await increaseBlockchainTime();

    const planetData = await world.contracts.core.planets(regularPlanetId);
    const ruinsData = await world.contracts.core.planets(ruinsId);

    // debuffs
    expect(planetData.populationCap.toNumber()).to.be.equal(ruinsData.populationCap.toNumber());
    expect(planetData.populationGrowth.toNumber()).to.be.equal(
      ruinsData.populationGrowth.toNumber()
    );
    expect(planetData.defense.toNumber()).to.be.equal(ruinsData.defense.toNumber());
  });

  it('initializes quasar with modified stats', async function () {
    const regularPlanetId = hexToBigNumber(star1.hex);
    const quasarId = hexToBigNumber(silverBank1.hex);

    await conquerUnownedPlanet(world, world.user1Core, asteroid1, star1);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, silverBank1);
    await increaseBlockchainTime();

    const planetData = await world.contracts.core.planets(regularPlanetId);
    const quasarData = await world.contracts.core.planets(quasarId);

    // debuffs
    expect(Math.floor(planetData.silverCap.toNumber() * 10)).to.be.equal(
      quasarData.silverCap.toNumber()
    );
    expect(Math.floor(planetData.speed.toNumber() / 2)).to.be.equal(quasarData.speed.toNumber());
    expect(Math.floor(quasarData.populationGrowth.toNumber())).to.be.equal(0);
    expect(Math.floor(planetData.populationCap.toNumber() * 5)).to.be.equal(
      quasarData.populationCap.toNumber()
    );
  });

  it('initializes trading post with modified stats', async function () {
    const regularPlanetId = hexToBigNumber(lvl3Location3.hex);
    const tradingPostId = hexToBigNumber(tradingPost1.hex);

    await conquerUnownedPlanet(world, world.user1Core, asteroid1, lvl3Location3);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);
    await increaseBlockchainTime();

    const planetData = await world.contracts.core.planets(regularPlanetId);
    const tradingPostData = await world.contracts.core.planets(tradingPostId);

    // debuffs
    expect(planetData.populationCap.toNumber()).to.be.equal(
      tradingPostData.populationCap.toNumber()
    );
    expect(planetData.populationGrowth.toNumber()).to.be.equal(
      tradingPostData.populationGrowth.toNumber()
    );
    expect(Math.floor(planetData.defense.toNumber() / 2)).to.be.equal(
      tradingPostData.defense.toNumber()
    );
    expect(planetData.silverCap.toNumber() * 2).to.be.equal(tradingPostData.silverCap.toNumber());
  });

  it('allows player to withdraw silver from trading posts', async function () {
    const tradingPostId = hexToBigNumber(tradingPost1.hex);

    await conquerUnownedPlanet(world, world.user1Core, asteroid1, silverStar1);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);
    await feedSilverToCap(world, world.user1Core, silverStar1, tradingPost1);

    const withdrawnAmount = (await world.contracts.core.planets(tradingPostId)).silverCap;

    await expect(world.user1Core.withdrawSilver(tradingPostId, withdrawnAmount))
      .to.emit(world.contracts.core, 'PlanetSilverWithdrawn')
      .withArgs(world.user1.address, tradingPostId, withdrawnAmount);

    expect((await world.contracts.core.players(world.user1.address)).withdrawnSilver).to.equal(
      withdrawnAmount
    );
  });

  it("doesn't allow player to withdraw more silver than planet has", async function () {
    const tradingPostId = hexToBigNumber(tradingPost1.hex);

    await conquerUnownedPlanet(world, world.user1Core, asteroid1, silverStar1);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);
    await feedSilverToCap(world, world.user1Core, silverStar1, tradingPost1);

    const withdrawnAmount = (await world.contracts.core.planets(tradingPostId)).silverCap.add(1000);

    await expect(world.user1Core.withdrawSilver(tradingPostId, withdrawnAmount)).to.be.revertedWith(
      'tried to withdraw more silver than exists on planet'
    );

    expect((await world.contracts.core.players(world.user1.address)).withdrawnSilver).to.equal(0);
  });

  it("doesn't allow player to withdraw silver from non-trading post", async function () {
    const silverStarId = hexToBigNumber(silverStar1.hex);

    await conquerUnownedPlanet(world, world.user1Core, asteroid1, silverStar1);
    await increaseBlockchainTime();

    const withdrawnAmount = (await world.contracts.core.planets(silverStarId)).silverCap;

    await expect(world.user1Core.withdrawSilver(silverStarId, withdrawnAmount)).to.be.revertedWith(
      'can only withdraw silver from trading posts'
    );

    expect((await world.contracts.core.players(world.user1.address)).withdrawnSilver).to.equal(0);
  });

  it("doesn't allow player to withdraw silver from planet that is not theirs", async function () {
    const tradingPostId = hexToBigNumber(tradingPost1.hex);

    await conquerUnownedPlanet(world, world.user1Core, asteroid1, silverStar1);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);
    await feedSilverToCap(world, world.user1Core, silverStar1, tradingPost1);
    await increaseBlockchainTime();

    const withdrawnAmount = (await world.contracts.core.planets(tradingPostId)).silverCap;

    await world.user2Core.initializePlayer(...makeInitArgs(asteroid2));

    await expect(world.user2Core.withdrawSilver(tradingPostId, withdrawnAmount)).to.be.revertedWith(
      'you must own this planet'
    );

    expect((await world.contracts.core.players(world.user1.address)).withdrawnSilver).to.equal(0);
    expect((await world.contracts.core.players(world.user2.address)).withdrawnSilver).to.equal(0);
  });
});
