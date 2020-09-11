const {expectRevert} = require("@openzeppelin/test-helpers");
const {web3} = require("@openzeppelin/test-environment");
const {expect} = require("chai");

const {
  DarkForestCore,
  Whitelist,
  Verifier,
  DarkForestPlanet,
  DarkForestLazyUpdate,
  DarkForestUtils,
  DarkForestTypes,
  DarkForestInitialize,
  deployer,
  user1,
  user2,
  asteroid1Location,
  makeInitArgs,
  getPlanetIdFromHex,
} = require("./DFTestUtils");

describe("DarkForestWhitelist", function () {
  beforeEach(async function () {
    await Whitelist.detectNetwork();
    this.whitelistContract = await Whitelist.new({from: deployer});
    await this.whitelistContract.initialize(deployer, true);

    this.verifierLib = await Verifier.new({from: deployer});
    this.dfPlanetLib = await DarkForestPlanet.new({from: deployer});
    this.dfLazyUpdateLib = await DarkForestLazyUpdate.new({from: deployer});
    this.dfTypesLib = await DarkForestTypes.new({from: deployer});
    this.dfUtilsLib = await DarkForestUtils.new({from: deployer});
    this.dfInitializeLib = await DarkForestInitialize.new({from: deployer});

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
    this.contract = await DarkForestCore.new({from: deployer});
    await this.contract.initialize(
      deployer,
      this.whitelistContract.address,
      true
    );
    await this.contract.changeGameEndTime(99999999999999, {
      from: deployer,
    });
  });

  it("should reject change admin if not admin", async function () {
    await expectRevert(
      this.whitelistContract.changeAdmin(user1, {from: user2}),
      "Only administrator can perform this action"
    );
  });

  it("should reject add keys if not admin", async function () {
    await expectRevert(
      this.whitelistContract.addKeys(
        [web3.utils.keccak256("XXXXX-XXXXX-XXXXX-XXXXX-XXXXX")],
        {
          from: user2,
        }
      ),
      "Only administrator can perform this action"
    );
  });

  it("should reject use key if not admin", async function () {
    await this.whitelistContract.addKeys(
      [web3.utils.keccak256("XXXXX-XXXXX-XXXXX-XXXXX-XXXXX")],
      {
        from: deployer,
      }
    );

    await expectRevert(
      this.whitelistContract.useKey("XXXXX-XXXXX-XXXXX-XXXXX-XXXXX", user1, {
        from: user2,
      }),
      "Only administrator can perform this action"
    );
  });

  it("should reject use key if already whitelisted", async function () {
    await this.whitelistContract.addKeys(
      [
        web3.utils.keccak256("XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"),
        web3.utils.keccak256("XXXXX-XXXXX-XXXXX-XXXXX-XXXX0"),
      ],
      {
        from: deployer,
      }
    );

    await this.whitelistContract.useKey(
      "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
      user1,
      {
        from: deployer,
      }
    );

    await expectRevert(
      this.whitelistContract.useKey("XXXXX-XXXXX-XXXXX-XXXXX-XXXX0", user1, {
        from: deployer,
      }),
      "player already whitelisted"
    );
  });

  it("should reject use key if key invalid", async function () {
    await this.whitelistContract.addKeys(
      [web3.utils.keccak256("XXXXX-XXXXX-XXXXX-XXXXX-XXXXX")],
      {
        from: deployer,
      }
    );

    await expectRevert(
      this.whitelistContract.useKey("XXXXX-XXXXX-XXXXX-XXXXX-XXXX0", user1, {
        from: deployer,
      }),
      "invalid key"
    );
  });

  it("should reject use key if key already used", async function () {
    await this.whitelistContract.addKeys(
      [web3.utils.keccak256("XXXXX-XXXXX-XXXXX-XXXXX-XXXXX")],
      {
        from: deployer,
      }
    );

    await this.whitelistContract.useKey(
      "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
      user2,
      {
        from: deployer,
      }
    );

    await expectRevert(
      this.whitelistContract.useKey("XXXXX-XXXXX-XXXXX-XXXXX-XXXXX", user1, {
        from: deployer,
      }),
      "invalid key"
    );
  });

  it("should reject remove from whitelist if not admin", async function () {
    await this.whitelistContract.addKeys(
      [web3.utils.keccak256("XXXXX-XXXXX-XXXXX-XXXXX-XXXXX")],
      {
        from: deployer,
      }
    );

    await this.whitelistContract.useKey(
      "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
      user1,
      {
        from: deployer,
      }
    );

    await expectRevert(
      this.whitelistContract.removeFromWhitelist(user1, {
        from: user2,
      }),
      "Only administrator can perform this action"
    );
  });

  it("should reject remove from whitelist if account never whitelist", async function () {
    await expectRevert(
      this.whitelistContract.removeFromWhitelist(user1, {
        from: deployer,
      }),
      "player was not whitelisted to begin with"
    );
  });

  it("should allow player to initialize after whitelisted", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);
    await this.whitelistContract.addKeys(
      [web3.utils.keccak256("XXXXX-XXXXX-XXXXX-XXXXX-XXXXX")],
      {
        from: deployer,
      }
    );

    await this.whitelistContract.useKey(
      "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
      user1,
      {
        from: deployer,
      }
    );

    await this.contract.initializePlayer(...makeInitArgs(planetId, 17, 1999), {
      from: user1,
    });

    expect(await this.contract.isPlayerInitialized(user1)).is.equal(true);
  });

  it("should reject player to initialize if not whitelisted", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);

    await expectRevert(
      this.contract.initializePlayer(...makeInitArgs(planetId, 17, 1999), {
        from: user1,
      }),
      "Player is not whitelisted"
    );
  });

  it("should reject player to initialize if removed fromw hitelist", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);
    await this.whitelistContract.addKeys(
      [web3.utils.keccak256("XXXXX-XXXXX-XXXXX-XXXXX-XXXXX")],
      {
        from: deployer,
      }
    );

    await this.whitelistContract.useKey(
      "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
      user1,
      {
        from: deployer,
      }
    );

    await this.whitelistContract.removeFromWhitelist(user1, {from: deployer});

    await expectRevert(
      this.contract.initializePlayer(...makeInitArgs(planetId, 17, 1999), {
        from: user1,
      }),
      "Player is not whitelisted"
    );
  });
});
