const { expectRevert } = require("@openzeppelin/test-helpers");
const { web3 } = require("@openzeppelin/test-environment");
const { expect } = require("chai");

const {
  initializeTest,
  deployer,
  user1,
  user2,
  asteroid1Location,
  makeInitArgs,
  getPlanetIdFromHex,
  expectEqualWithTolerance,
} = require("./DFTestUtils");

describe("DarkForestWhitelist", function () {
  beforeEach(async function () {
    await initializeTest(this, true);
    await this.whitelistContract.send(1000000000000000000, {
      from: deployer,
    });

    await this.contract.changeTokenMintEndTime(99999999999999, {
      from: deployer,
    });
  });

  it("should reject change admin if not admin", async function () {
    await expectRevert(
      this.whitelistContract.changeAdmin(user1, { from: user2 }),
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

    await this.contract.initializePlayer(...makeInitArgs(planetId, 10, 1999), {
      from: user1,
    });

    expect(await this.contract.isPlayerInitialized(user1)).is.equal(true);
  });

  it("should reject player to initialize if not whitelisted", async function () {
    let planetId = getPlanetIdFromHex(asteroid1Location.hex);

    await expectRevert(
      this.contract.initializePlayer(...makeInitArgs(planetId, 10, 1999), {
        from: user1,
      }),
      "Player is not whitelisted"
    );
  });

  it("should reject player to initialize if removed from whitelist", async function () {
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

    await this.whitelistContract.removeFromWhitelist(user1, { from: deployer });

    await expectRevert(
      this.contract.initializePlayer(...makeInitArgs(planetId, 10, 1999), {
        from: user1,
      }),
      "Player is not whitelisted"
    );
  });

  it("should allow admin to set drip, and drip player eth after whitelisted", async function () {
    await this.whitelistContract.addKeys(
      [web3.utils.keccak256("XXXXX-XXXXX-XXXXX-XXXXX-XXXXX")],
      {
        from: deployer,
      }
    );

    await this.whitelistContract.changeDrip("20000000000000000", {
      from: deployer,
    });

    const drip = parseFloat(
      web3.utils.fromWei(await this.whitelistContract.drip())
    );

    expectEqualWithTolerance(drip, 0.02, 0.00000000000001);

    const oldBalance = parseFloat(
      web3.utils.fromWei(await web3.eth.getBalance(user1), "ether")
    );

    await this.whitelistContract.useKey(
      "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
      user1,
      {
        from: deployer,
      }
    );

    const newBalance = parseFloat(
      web3.utils.fromWei(await web3.eth.getBalance(user1), "ether")
    );

    expectEqualWithTolerance(newBalance, oldBalance + drip, 0.00000000000001);
  });
});
