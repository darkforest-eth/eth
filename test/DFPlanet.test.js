const { expect } = require("chai");
const { time } = require("@openzeppelin/test-helpers");

const {
  initializeTest,
  getPlanetIdFromHex,
  asteroid1Location,
  asteroid2Location,
  asteroid3Location,
  star1Location,
  silverStar2Location,
  silverStar3Location,
  silverStar4Location,
  lvl3Location1,
  lvl3Location2,
  maxLvlLocation1,
  maxLvlLocation2,
  makeInitArgs,
  makeMoveArgs,
  deployer,
  user1,
  LARGE_INTERVAL,
  expectEqualWithTolerance,
} = require("./DFTestUtils");

describe("DarkForestPlanet", function () {
  // test that initialization works as expected

  beforeEach(async function () {
    await initializeTest(this);

    await this.contract.changeTokenMintEndTime(99999999999999, {
      from: deployer,
    });
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);

    await this.contract.initializePlayer(...makeInitArgs(planetId, 10, 2000), {
      from: user1,
    });
  });

  it("clips level in nebula and space", async function () {
    const fromId = getPlanetIdFromHex(asteroid1Location.hex);
    const toId1 = getPlanetIdFromHex(maxLvlLocation1.hex);
    const toId2 = getPlanetIdFromHex(maxLvlLocation2.hex);
    await this.contract.move(
      ...makeMoveArgs(fromId, toId1, 10, 2000, 0, 30000, 0),
      { from: user1 }
    );

    const bigPlanet1 = await this.contract.planets(toId1);
    expect(bigPlanet1.planetLevel.toNumber()).to.equal(3);

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.move(
      ...makeMoveArgs(fromId, toId2, 16, 2000, 0, 30000, 0),
      { from: user1 }
    );

    const bigPlanet2 = await this.contract.planets(toId2);
    expect(bigPlanet2.planetLevel.toNumber()).to.equal(4);
  });

  it("doesn't clip level in deep space", async function () {
    const fromId = getPlanetIdFromHex(asteroid1Location.hex);
    const toId = getPlanetIdFromHex(maxLvlLocation1.hex);
    await this.contract.move(
      ...makeMoveArgs(fromId, toId, 20, 2000, 0, 30000, 0),
      { from: user1 }
    );

    const bigPlanet = await this.contract.planets(toId);
    expect(bigPlanet.planetLevel.toNumber()).to.be.above(4);
  });

  it("applies medium space buffs and debuffs", async function () {
    const fromId = getPlanetIdFromHex(asteroid1Location.hex);
    const lvlFourId1 = getPlanetIdFromHex(lvl3Location1.hex);
    const lvlFourId2 = getPlanetIdFromHex(lvl3Location2.hex);
    // nebula
    await this.contract.move(
      ...makeMoveArgs(fromId, lvlFourId1, 10, 2000, 0, 10000, 0),
      { from: user1 }
    );
    // medium space
    await this.contract.move(
      ...makeMoveArgs(fromId, lvlFourId2, 16, 2000, 0, 10000, 0),
      { from: user1 }
    );

    const lvlFourPlanet1 = await this.contract.planets(lvlFourId1);
    const lvlFourPlanet2 = await this.contract.planets(lvlFourId2);

    expectEqualWithTolerance(
      lvlFourPlanet1.range.toNumber() * 1.25,
      lvlFourPlanet2.range.toNumber()
    );
    expectEqualWithTolerance(
      lvlFourPlanet1.speed.toNumber() * 1.25,
      lvlFourPlanet2.speed.toNumber()
    );
    expectEqualWithTolerance(
      lvlFourPlanet1.populationCap.toNumber() * 1.25,
      lvlFourPlanet2.populationCap.toNumber()
    );
    expectEqualWithTolerance(
      lvlFourPlanet1.populationGrowth.toNumber() * 1.25,
      lvlFourPlanet2.populationGrowth.toNumber()
    );
    expectEqualWithTolerance(
      lvlFourPlanet1.silverCap.toNumber() * 1.25,
      lvlFourPlanet2.silverCap.toNumber()
    );
    expectEqualWithTolerance(
      lvlFourPlanet1.silverGrowth.toNumber() * 1.25,
      lvlFourPlanet2.silverGrowth.toNumber()
    );
    expectEqualWithTolerance(
      lvlFourPlanet1.defense.toNumber() * 0.5,
      lvlFourPlanet2.defense.toNumber()
    );
    // barbarians
    expectEqualWithTolerance(
      lvlFourPlanet1.population.toNumber() * 2.5 * 1.25,
      lvlFourPlanet2.population.toNumber()
    );
  });

  it("applies deep space buffs and debuffs", async function () {
    const fromId = getPlanetIdFromHex(asteroid1Location.hex);
    const toId = getPlanetIdFromHex(asteroid2Location.hex);
    await this.contract.move(
      ...makeMoveArgs(fromId, toId, 20, 2000, 0, 30000, 0),
      { from: user1 }
    );

    const fromPlanet = await this.contract.planets(fromId);
    const toPlanet = await this.contract.planets(toId);

    expect(Math.floor(fromPlanet.range.toNumber() * 1.5)).to.be.equal(
      toPlanet.range.toNumber()
    );
    expect(Math.floor(fromPlanet.speed.toNumber() * 1.5)).to.be.equal(
      toPlanet.speed.toNumber()
    );
    expect(Math.floor(fromPlanet.populationCap.toNumber() * 1.5)).to.be.equal(
      toPlanet.populationCap.toNumber()
    );
    expect(
      Math.floor(fromPlanet.populationGrowth.toNumber() * 1.5)
    ).to.be.equal(toPlanet.populationGrowth.toNumber());
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

  it("applies asteroid buff", async function () {
    const fromId = getPlanetIdFromHex(asteroid1Location.hex);
    const toId = getPlanetIdFromHex(asteroid3Location.hex);
    await this.contract.move(
      ...makeMoveArgs(fromId, toId, 10, 2000, 0, 30000, 0),
      { from: user1 }
    );

    const fromPlanet = await this.contract.planets(fromId);
    const toPlanet = await this.contract.planets(toId);

    // should buff popcap
    expect(fromPlanet.populationCap.toNumber() * 2).to.be.equal(
      toPlanet.populationCap.toNumber()
    );
    // should not buff other stats
    expect(fromPlanet.populationGrowth.toNumber()).to.be.equal(
      toPlanet.populationGrowth.toNumber()
    );
  });

  it("initializes silver mines more frequently in deep space", async function () {
    const homeId = getPlanetIdFromHex(asteroid1Location.hex);
    // hex value of silver byte is 51
    const nebulaNonMineId = getPlanetIdFromHex(silverStar3Location.hex);
    // hex value of silver byte is 51
    const deepSpaceMineId = getPlanetIdFromHex(silverStar4Location.hex);
    await this.contract.move(
      ...makeMoveArgs(homeId, nebulaNonMineId, 10, 2000, 0, 30000, 0),
      { from: user1 }
    );

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.move(
      ...makeMoveArgs(homeId, deepSpaceMineId, 20, 2000, 0, 30000, 0),
      { from: user1 }
    );

    const nonSilverPlanet = await this.contract.planets(nebulaNonMineId);
    const silverPlanet = await this.contract.planets(deepSpaceMineId);

    expect(nonSilverPlanet.silverGrowth.toNumber()).to.be.equal(0);
    expect(silverPlanet.silverGrowth.toNumber()).to.be.above(0);
  });

  it("initializes silver mines with debuffs and silver cache", async function () {
    const homeId = getPlanetIdFromHex(asteroid1Location.hex);
    const regularPlanetId = getPlanetIdFromHex(star1Location.hex);
    const silverPlanetId = getPlanetIdFromHex(silverStar2Location.hex);
    await this.contract.move(
      ...makeMoveArgs(homeId, regularPlanetId, 10, 2000, 0, 30000, 0),
      { from: user1 }
    );

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.move(
      ...makeMoveArgs(homeId, silverPlanetId, 10, 2000, 0, 30000, 0),
      { from: user1 }
    );

    const regularPlanet = await this.contract.planets(regularPlanetId);
    const silverPlanet = await this.contract.planets(silverPlanetId);

    // debuffs silver mines
    expect(Math.floor(regularPlanet.populationCap.toNumber() / 2)).to.be.equal(
      silverPlanet.populationCap.toNumber()
    );
    expect(
      Math.floor(regularPlanet.populationGrowth.toNumber() / 2)
    ).to.be.equal(silverPlanet.populationGrowth.toNumber());
    expect(Math.floor(regularPlanet.silverCap.toNumber() * 2)).to.be.equal(
      silverPlanet.silverCap.toNumber()
    );
    expect(Math.floor(regularPlanet.defense.toNumber() / 2)).to.be.equal(
      silverPlanet.defense.toNumber()
    );

    // planet is filled with silver
    expect(silverPlanet.silver.toNumber()).to.be.equal(
      silverPlanet.silverCap.toNumber() / 2
    );
  });
});
