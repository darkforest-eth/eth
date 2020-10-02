const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

const {
  DarkForestCore,
  Whitelist,
  Verifier,
  DarkForestPlanet,
  DarkForestLazyUpdate,
  DarkForestUtils,
  DarkForestTypes,
  DarkForestInitialize,
  getPlanetIdFromHex,
  asteroid1Location,
  asteroid2Location,
  star1Location,
  makeInitArgs,
  deployer,
  user1,
  user2,
} = require("./DFTestUtils");

describe("DarkForestInit", function () {
  // test that initialization works as expected

  beforeEach(async function () {
    this.timeout(5000);

    await Whitelist.detectNetwork();
    this.whitelistContract = await Whitelist.new({ from: deployer });
    await this.whitelistContract.initialize(deployer, false);

    this.verifierLib = await Verifier.new({ from: deployer });
    this.dfUtilsLib = await DarkForestUtils.new({ from: deployer });
    this.dfLazyUpdateLib = await DarkForestLazyUpdate.new({ from: deployer });
    this.dfTypesLib = await DarkForestTypes.new({ from: deployer });
    await DarkForestPlanet.detectNetwork();
    await DarkForestPlanet.link(
      "DarkForestLazyUpdate",
      this.dfLazyUpdateLib.address
    );
    await DarkForestPlanet.link("DarkForestUtils", this.dfUtilsLib.address);
    this.dfPlanetLib = await DarkForestPlanet.new({ from: deployer });
    this.dfInitializeLib = await DarkForestInitialize.new({ from: deployer });
    await DarkForestCore.detectNetwork();
    await DarkForestCore.link("Verifier", this.verifierLib.address);
    await DarkForestCore.link("DarkForestPlanet", this.dfPlanetLib.address);
    await DarkForestCore.link(
      "DarkForestLazyUpdate",
      this.dfLazyUpdateLib.address
    );
    await DarkForestCore.link("DarkForestTypes", this.dfTypesLib.address);
    await DarkForestCore.link("DarkForestUtils", this.dfUtilsLib.address);
    await DarkForestCore.link(
      "DarkForestInitialize",
      this.dfInitializeLib.address
    );
    this.contract = await DarkForestCore.new({ from: deployer });
    await this.contract.initialize(
      deployer,
      this.whitelistContract.address,
      true
    );
    await this.contract.changeGameEndTime(99999999999999, {
      from: deployer,
    });
  });

  it("initializes player successfully with the correct planet value", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);

    const receipt = await this.contract.initializePlayer(
      ...makeInitArgs(planetId, 10, 2000),
      {
        from: user1,
      }
    );

    expectEvent(
      receipt,
      "PlayerInitialized",
      (eventArgs = {
        player: user1,
        loc: planetId.toString(),
      })
    );

    expect(await this.contract.isPlayerInitialized(user1)).equal(true);

    expect((await this.contract.planets(planetId)).owner).to.equal(user1);

    expect(
      (await this.contract.planets(planetId)).population
    ).to.be.bignumber.equal("50000");

    expect(
      (await this.contract.planets(planetId)).populationCap
    ).to.be.bignumber.equal("100000");
  });

  it("rejects player trying to initialize a second time", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);

    await this.contract.initializePlayer(...makeInitArgs(planetId, 10, 1999), {
      from: user1,
    });

    let planetId2 = getPlanetIdFromHex(asteroid2Location.hex);

    await expectRevert(
      this.contract.initializePlayer(...makeInitArgs(planetId2, 10, 1999), {
        from: user1,
      }),
      "Player is already initialized"
    );
  });

  it("rejects player trying to initialize on existing planet", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);

    await this.contract.initializePlayer(...makeInitArgs(planetId, 10, 1999), {
      from: user1,
    });

    await expectRevert(
      this.contract.initializePlayer(...makeInitArgs(planetId, 10, 1999), {
        from: user2,
      }),
      "Planet is already initialized"
    );
  });

  it("rejects player trying to initialize on invalid planet location", async function () {
    let invalidPlanetId = getPlanetIdFromHex(
      "1111115b379a678bf7076778da66355dc814c5c184bc043e87e011c876418b365"
    );

    await expectRevert(
      this.contract.initializePlayer(
        ...makeInitArgs(invalidPlanetId, 10, 1999),
        { from: user1 }
      ),
      "Not a valid planet location"
    );
  });

  it("rejects player trying to initialize on planet level above 0", async function () {
    let planetId = getPlanetIdFromHex(star1Location.hex);

    await expectRevert(
      this.contract.initializePlayer(...makeInitArgs(planetId, 10, 2000), {
        from: user1,
      }),
      "Can only initialize on planet level 0"
    );
  });

  it("rejects player trying to init out of bounds", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);

    await expectRevert(
      this.contract.initializePlayer(...makeInitArgs(planetId, 10, 99999999), {
        from: user1,
      }),
      "Init radius is bigger than the current world radius"
    );
  });

  it("rejects player trying to initialize in deep space", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);

    await expectRevert(
      this.contract.initializePlayer(...makeInitArgs(planetId, 18, 2000), {
        from: user1,
      }),
      "Init not allowed in perlin value greater than or equal to the threshold"
    );
  });
});
