const { web3 } = require("@openzeppelin/test-environment");
const { time } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

const {
  zeroOwner,
  initializeTest,
  getPlanetIdFromHex,
  asteroid1Location,
  asteroid2Location,
  star2Location,
  silverStar1Location,
  silverStar2Location,
  SMALL_INTERVAL,
  LARGE_INTERVAL,
  TOLERANCE,
  makeInitArgs,
  makeMoveArgs,
  deployer,
  user1,
} = require("./DFTestUtils");
const expectRevert = require("@openzeppelin/test-helpers/src/expectRevert");

describe("DarkForestRefresh", function () {
  // test that silver and population lazy updating work

  beforeEach(async function () {
    await initializeTest(this);

    await this.contract.changeTokenMintEndTime(999999999999999, {
      from: deployer,
    });

    let planetId = getPlanetIdFromHex(asteroid1Location.hex);

    await this.contract.initializePlayer(...makeInitArgs(planetId, 10, 1999), {
      from: user1,
    });
  });

  it("should increase population over time", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);

    const startPlanet = await this.contract.planets(planetId);
    const startPlanetExtendedInfo = await this.contract.planetsExtendedInfo(
      planetId
    );
    expect(startPlanetExtendedInfo.lastUpdated).to.be.bignumber.equal(
      await time.latest()
    );

    time.increase(SMALL_INTERVAL);
    time.advanceBlock();
    await this.contract.refreshPlanet(planetId);
    const midPlanet = await this.contract.planets(planetId);
    const midPlanetExtendedInfo = await this.contract.planetsExtendedInfo(
      planetId
    );
    expect(midPlanetExtendedInfo.lastUpdated).to.be.bignumber.equal(
      await time.latest()
    );
    expect(midPlanet.population).to.be.bignumber.above(startPlanet.population);

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();
    await this.contract.refreshPlanet(planetId);

    const endPlanet = await this.contract.planets(planetId);
    const endPlanetExtendedInfo = await this.contract.planetsExtendedInfo(
      planetId
    );
    expect(endPlanet.population).to.be.bignumber.above(midPlanet.population);
    expect(endPlanet.population).to.not.be.bignumber.above(
      endPlanet.populationCap
    );
    expect(endPlanet.population).to.be.bignumber.above(
      endPlanet.populationCap.sub(web3.utils.toBN(1))
    );
    expect(endPlanetExtendedInfo.lastUpdated).to.be.bignumber.equal(
      await time.latest()
    );
  });

  it("should decrease population over time of overpopulated", async function () {
    let planetId1 = getPlanetIdFromHex(asteroid1Location.hex);
    let planetId2 = getPlanetIdFromHex(asteroid2Location.hex);

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.move(
      ...makeMoveArgs(planetId1, planetId2, 16, 2000, 0, 50000, 0),
      { from: user1 }
    );

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.move(
      ...makeMoveArgs(planetId2, planetId1, 17, 2000, 0, 100000, 0),
      { from: user1 }
    );

    await this.contract.refreshPlanet(planetId1);

    const startPlanet1 = await this.contract.planets(planetId1);
    expect(startPlanet1.population).to.be.bignumber.above(
      startPlanet1.populationCap
    );

    time.increase(SMALL_INTERVAL);
    time.advanceBlock();
    await this.contract.refreshPlanet(planetId1);

    const midPlanet1 = await this.contract.planets(planetId1);
    expect(midPlanet1.population).to.be.bignumber.above(
      midPlanet1.populationCap
    );
    expect(midPlanet1.population).to.be.bignumber.below(
      startPlanet1.population
    );

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();
    await this.contract.refreshPlanet(planetId1);
    const endPlanet1 = await this.contract.planets(planetId1);
    expect(endPlanet1.population).to.not.be.bignumber.below(
      endPlanet1.populationCap
    );
    expect(endPlanet1.population).to.be.bignumber.below(
      endPlanet1.populationCap.add(web3.utils.toBN(1))
    );
  });

  it("should increase silver of 50%pop silver-producing planet", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);
    let silverStarId = getPlanetIdFromHex(silverStar2Location.hex);

    // conquer silver planet
    for (let i = 0; i < 2; i++) {
      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(planetId, silverStarId, 16, 2000, 0, 90001, 0),
        { from: user1 }
      );
    }

    // after a long time, silver star is full of silver and pop
    // reduce it to 50% pop and 0% silver
    time.increase(LARGE_INTERVAL);
    time.advanceBlock();
    let silverStarPlanet = await this.contract.planets(silverStarId);
    const silverStarPopCap = silverStarPlanet.populationCap;
    const silverStarResCap = silverStarPlanet.silverCap;
    await this.contract.move(
      ...makeMoveArgs(
        silverStarId,
        planetId,
        17,
        2000,
        0,
        silverStarPopCap.toNumber() / 2,
        silverStarResCap
      ),
      { from: user1 }
    );

    // test that over SMALL_INTERVAL seconds it produces the correct amt of silver
    // i.e. after SMALL_INTERVAL seconds it has ~silverGrowth * SMALL_INTERVAL silver
    time.increase(SMALL_INTERVAL);
    time.advanceBlock();
    await this.contract.refreshPlanet(silverStarId);

    silverStarPlanet = await this.contract.planets(silverStarId);
    expect(silverStarPlanet.silver).to.not.be.bignumber.below(
      silverStarPlanet.silverGrowth.muln(SMALL_INTERVAL)
    );
    // to account for the fact that blockchain time passes somewhat unevenly
    expect(silverStarPlanet.silver).to.not.be.bignumber.above(
      silverStarPlanet.silverGrowth.muln(SMALL_INTERVAL + TOLERANCE)
    );
  });

  it("should not increase silver of non-silver-producing planet", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);
    time.increase(SMALL_INTERVAL);
    time.advanceBlock();
    await this.contract.refreshPlanet(planetId);
    const planet = await this.contract.planets(planetId);
    expect(planet.silver).to.be.bignumber.equal(web3.utils.toBN(0));
  });

  it("should not increase silver of full silver planet", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);
    let silverStarId1 = getPlanetIdFromHex(silverStar1Location.hex);
    let silverStarId2 = getPlanetIdFromHex(silverStar2Location.hex);

    // conquer and fill both silver planets
    time.increase(LARGE_INTERVAL);
    time.advanceBlock();
    await this.contract.move(
      ...makeMoveArgs(planetId, silverStarId1, 20, 2000, 0, 90000, 0),
      { from: user1 }
    );
    time.increase(LARGE_INTERVAL);
    time.advanceBlock();
    await this.contract.move(
      ...makeMoveArgs(planetId, silverStarId2, 20, 2000, 0, 90000, 0),
      { from: user1 }
    );
    time.increase(LARGE_INTERVAL);
    time.advanceBlock();
    // make planet 2's silver > cap
    await this.contract.move(
      ...makeMoveArgs(silverStarId1, silverStarId2, 10, 2000, 0, 90000, 1000),
      { from: user1 }
    );
    await this.contract.refreshPlanet(silverStarId2);
    let silverStarPlanet2 = await this.contract.planets(silverStarId2);
    const silverCap = silverStarPlanet2.silverCap;
    const oldSilver = silverStarPlanet2.silver;
    expect(oldSilver).to.not.be.bignumber.below(silverCap);

    // after time has passed, planet 2 silver should not have increased
    time.increase(SMALL_INTERVAL);
    time.advanceBlock();
    await this.contract.refreshPlanet(silverStarId2);
    silverStarPlanet2 = await this.contract.planets(silverStarId2);
    const newSilver = silverStarPlanet2.silver;
    expect(newSilver).to.not.be.bignumber.below(oldSilver);
  });

  it("should not increase pop or silver of barbarian-owned planet", async function () {
    let homePlanetId = getPlanetIdFromHex(asteroid1Location.hex);
    let star2Id = getPlanetIdFromHex(star2Location.hex);
    await this.contract.move(
      ...makeMoveArgs(homePlanetId, star2Id, 10, 2000, 0, 20000, 0),
      { from: user1 }
    );
    time.increase(LARGE_INTERVAL);
    time.advanceBlock();
    await this.contract.refreshPlanet(star2Id);
    let star2 = await this.contract.planets(star2Id);
    let oldPop = star2.population;
    let oldSilver = star2.silver;
    expect(star2.owner).to.be.equal(zeroOwner);
    expect(star2.population).to.be.bignumber.above(web3.utils.toBN(0));
    expect(star2.silver).to.be.bignumber.equal(web3.utils.toBN(0));

    time.increase(SMALL_INTERVAL);
    await this.contract.refreshPlanet(star2Id);
    star2 = await this.contract.planets(star2Id);
    let newPop = star2.population;
    let newSilver = star2.silver;
    expect(newPop).to.be.bignumber.equal(oldPop);
    expect(newSilver).to.be.bignumber.equal(oldSilver);
  });

  it("should revert if planet is not initialiazed", async function () {
    let uninitializedPlanet = getPlanetIdFromHex(asteroid2Location.hex);

    await expectRevert(
      this.contract.refreshPlanet(uninitializedPlanet, { from: user1 }),
      "Planet has not been initialized"
    );
  });
});
