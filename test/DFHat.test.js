const { web3 } = require("@openzeppelin/test-environment");
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
  makeInitArgs,
  deployer,
  user1,
  user2,
} = require("./DFTestUtils");
const expectRevert = require("@openzeppelin/test-helpers/src/expectRevert");

describe("DarkForestHat", function () {
  // test that silver and population lazy updating work

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
    await this.contract.changeGameEndTime(999999999999999, {
      from: deployer,
    });
    await web3.eth.sendTransaction({
      from: deployer,
      to: user1,
      value: "10000000000000000000",
    });

    let planetId = getPlanetIdFromHex(asteroid1Location.hex);

    await this.contract.initializePlayer(...makeInitArgs(planetId, 10, 1999), {
      from: user1,
    });
  });

  it("should buy hats", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);

    let planetExtendedInfo = await this.contract.planetsExtendedInfo(planetId);
    expect(planetExtendedInfo.hatLevel.toNumber()).to.be.equal(0);

    await this.contract.buyHat(planetId, {
      from: user1,
      value: "1000000000000000000",
    });

    await this.contract.buyHat(planetId, {
      from: user1,
      value: "2000000000000000000",
    });

    planetExtendedInfo = await this.contract.planetsExtendedInfo(planetId);
    expect(planetExtendedInfo.hatLevel.toNumber()).to.be.equal(2);
  });

  it("should only allow owner to buy hat", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);

    let planetExtendedInfo = await this.contract.planetsExtendedInfo(planetId);
    expect(planetExtendedInfo.hatLevel.toNumber()).to.be.equal(0);

    await expectRevert(
      this.contract.buyHat(planetId, {
        from: user2,
        value: "1000000000000000000",
      }),
      "Only owner can buy hat for planet"
    );
  });

  it("should not buy hat with insufficient value", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);

    let planetExtendedInfo = await this.contract.planetsExtendedInfo(planetId);
    expect(planetExtendedInfo.hatLevel.toNumber()).to.be.equal(0);

    await this.contract.buyHat(planetId, {
      from: user1,
      value: "1000000000000000000",
    });
    await expectRevert(
      this.contract.buyHat(planetId, {
        from: user1,
        value: "1500000000000000000",
      }),
      "Insufficient value sent"
    );
  });

  it("should allow admin to withdraw all funds", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);
    await this.contract.buyHat(planetId, {
      from: user1,
      value: "1000000000000000000",
    });

    await this.contract.withdraw({
      from: deployer,
    });

    expect(parseInt(await web3.eth.getBalance(this.contract.address))).to.equal(
      0
    );
  });

  it("should not allow non-admin to withdraw funds", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);
    await this.contract.buyHat(planetId, {
      from: user1,
      value: "1000000000000000000",
    });

    await expectRevert(
      this.contract.withdraw({
        from: user1,
      }),
      "Sender is not a game master"
    );
  });
});
