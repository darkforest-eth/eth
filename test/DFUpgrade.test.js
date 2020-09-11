const {
  time,
  expectEvent,
  expectRevert,
} = require("@openzeppelin/test-helpers");
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
  highLevelLocation,
  highLevel2Location,
  makeInitArgs,
  makeMoveArgs,
  deployer,
  user1,
  user2,
  LARGE_INTERVAL,
} = require("./DFTestUtils");

describe("DarkForestUpgrade", function () {
  beforeEach(async function () {
    await Whitelist.detectNetwork();
    this.whitelistContract = await Whitelist.new({ from: deployer });
    await this.whitelistContract.initialize(deployer, false);

    this.verifierLib = await Verifier.new({ from: deployer });
    this.dfPlanetLib = await DarkForestPlanet.new({ from: deployer });
    this.dfLazyUpdateLib = await DarkForestLazyUpdate.new({ from: deployer });
    this.dfTypesLib = await DarkForestTypes.new({ from: deployer });
    this.dfUtilsLib = await DarkForestUtils.new({ from: deployer });
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

  it("should reject if planet not initialized", async function () {
    const fromId = getPlanetIdFromHex(asteroid1Location.hex);

    await expectRevert(
      this.contract.upgradePlanet(fromId, 0, { from: user1 }),
      "Planet has not been initialized"
    );
  });

  it("should reject if not planet owner", async function () {
    const player1Planet = getPlanetIdFromHex(asteroid1Location.hex);

    await this.contract.initializePlayer(
      ...makeInitArgs(player1Planet, 17, 2000),
      {
        from: user1,
      }
    );

    await expectRevert(
      this.contract.upgradePlanet(player1Planet, 0, { from: user2 }),
      "Only owner can perform operation on planets"
    );
  });

  it("should reject if planet level is not high enough", async function () {
    const lowLevelPlanet = getPlanetIdFromHex(asteroid1Location.hex);

    await this.contract.initializePlayer(
      ...makeInitArgs(lowLevelPlanet, 17, 2000),
      {
        from: user1,
      }
    );

    await expectRevert(
      this.contract.upgradePlanet(lowLevelPlanet, 0, { from: user1 }),
      "Planet level is not high enough for this upgrade"
    );
  });

  it("should reject if upgrade branch not valid", async function () {
    const homePlanetId = getPlanetIdFromHex(asteroid1Location.hex);
    const upgradeablePlanetId = getPlanetIdFromHex(highLevelLocation.hex);
    const dist = 0;
    const shipsSent = 250000;
    const silverSent = 0;

    await this.contract.initializePlayer(
      ...makeInitArgs(homePlanetId, 17, 2000),
      {
        from: user1,
      }
    );

    for (let i = 0; i < 4; i++) {
      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          upgradeablePlanetId,
          16,
          2000,
          dist,
          shipsSent,
          silverSent
        ),
        { from: user1 }
      );
    }

    await expectRevert(
      this.contract.upgradePlanet(upgradeablePlanetId, 99, { from: user1 }),
      "Upgrade branch not valid"
    );
  });

  it("should upgrade planet stats and emit event", async function () {
    const homePlanetId = getPlanetIdFromHex(asteroid1Location.hex);
    const upgradeablePlanetId = getPlanetIdFromHex(highLevelLocation.hex);
    const dist = 0;
    const shipsSent = 250000;
    const silverSent = 0;

    await this.contract.initializePlayer(
      ...makeInitArgs(homePlanetId, 17, 2000),
      {
        from: user1,
      }
    );

    for (let i = 0; i < 4; i++) {
      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          upgradeablePlanetId,
          16,
          2000,
          dist,
          shipsSent,
          silverSent
        ),
        { from: user1 }
      );
    }

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    this.contract.refreshPlanet(upgradeablePlanetId);

    const planetBeforeUpgrade = await this.contract.planets(
      upgradeablePlanetId
    );

    let initialSilverCap = planetBeforeUpgrade.silverCap;
    let initialSilverGrowth = planetBeforeUpgrade.silverGrowth;
    let initialSilverMax = planetBeforeUpgrade.silverMax;
    const receipt = await this.contract.upgradePlanet(upgradeablePlanetId, 0, {
      from: user1,
    });

    const planetAfterUpgrade = await this.contract.planets(upgradeablePlanetId);
    let newSilverCap = planetAfterUpgrade.silverCap;
    let newSilverGrowth = planetAfterUpgrade.silverGrowth;
    let newSilverMax = planetAfterUpgrade.silverMax;

    expectEvent(
      receipt,
      "PlanetUpgraded",
      (eventArgs = { loc: upgradeablePlanetId })
    );
    expect(initialSilverCap).to.be.bignumber.below(newSilverCap);
    expect(initialSilverGrowth).to.be.bignumber.below(newSilverGrowth);
    expect(initialSilverMax).to.be.bignumber.below(newSilverMax);
  });

  it("should reject upgrade if there's not enough resources", async function () {
    const homePlanetId = getPlanetIdFromHex(asteroid1Location.hex);
    const upgradeablePlanetId = getPlanetIdFromHex(highLevelLocation.hex);
    const dist = 0;
    const shipsSent = 250000;
    const silverSent = 0;

    await this.contract.initializePlayer(
      ...makeInitArgs(homePlanetId, 17, 2000),
      {
        from: user1,
      }
    );

    for (let i = 0; i < 4; i++) {
      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          upgradeablePlanetId,
          16,
          2000,
          dist,
          shipsSent,
          silverSent
        ),
        { from: user1 }
      );
    }

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.upgradePlanet(upgradeablePlanetId, 0, { from: user1 });
    await this.contract.upgradePlanet(upgradeablePlanetId, 0, { from: user1 });

    await expectRevert(
      this.contract.upgradePlanet(upgradeablePlanetId, 0, { from: user1 }),
      "Insufficient silver to upgrade"
    );
  });

  it("should reject upgrade if branch is maxed", async function () {
    const homePlanetId = getPlanetIdFromHex(asteroid1Location.hex);
    const upgradeablePlanetId = getPlanetIdFromHex(highLevelLocation.hex);
    const silverMinePlanetId = getPlanetIdFromHex(highLevel2Location.hex);
    const dist = 0;
    const shipsSent = 250000;
    const silverSent = 0;

    await this.contract.initializePlayer(
      ...makeInitArgs(homePlanetId, 17, 2000),
      {
        from: user1,
      }
    );

    for (let i = 0; i < 4; i++) {
      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          upgradeablePlanetId,
          16,
          2000,
          dist,
          shipsSent,
          silverSent
        ),
        { from: user1 }
      );
    }

    for (let i = 0; i < 4; i++) {
      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          silverMinePlanetId,
          16,
          2000,
          dist,
          shipsSent,
          silverSent
        ),
        { from: user1 }
      );
    }

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    for (let i = 0; i < 4; i++) {
      const silverMinePlanet = await this.contract.planets(silverMinePlanetId);
      // fill up planet with silver
      for (let j = 0; j < 1; j++) {
        await this.contract.move(
          ...makeMoveArgs(
            silverMinePlanetId,
            upgradeablePlanetId,
            16,
            2000,
            1,
            1000000,
            silverMinePlanet.silverCap
          ),
          { from: user1 }
        );
        time.increase(LARGE_INTERVAL);
        time.advanceBlock();
      }

      await this.contract.upgradePlanet(upgradeablePlanetId, 1, {
        from: user1,
      });

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();
    }

    await expectRevert(
      this.contract.upgradePlanet(upgradeablePlanetId, 1, { from: user1 }),
      "Upgrade branch already maxed"
    );
  });

  it("should reject upgrade if trying to upgrade a second branch to level 3", async function () {
    const homePlanetId = getPlanetIdFromHex(asteroid1Location.hex);
    const upgradeablePlanetId = getPlanetIdFromHex(highLevelLocation.hex);
    const silverMinePlanetId = getPlanetIdFromHex(highLevel2Location.hex);
    const dist = 0;
    const shipsSent = 250000;
    const silverSent = 0;

    await this.contract.initializePlayer(
      ...makeInitArgs(homePlanetId, 17, 2000),
      {
        from: user1,
      }
    );

    for (let i = 0; i < 4; i++) {
      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          upgradeablePlanetId,
          16,
          2000,
          dist,
          shipsSent,
          silverSent
        ),
        { from: user1 }
      );
    }

    for (let i = 0; i < 4; i++) {
      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          silverMinePlanetId,
          16,
          2000,
          dist,
          shipsSent,
          silverSent
        ),
        { from: user1 }
      );
    }

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    this.contract.refreshPlanet(upgradeablePlanetId);
    this.contract.refreshPlanet(silverMinePlanetId);

    for (let branch = 0; branch < 2; branch++) {
      for (let i = 0; i < 4; i++) {
        const silverMinePlanet = await this.contract.planets(
          silverMinePlanetId
        );

        // fill up planet with silver
        for (let j = 0; j < 8; j++) {
          await this.contract.move(
            ...makeMoveArgs(
              silverMinePlanetId,
              upgradeablePlanetId,
              16,
              2000,
              1,
              1000000,
              silverMinePlanet.silverCap
            ),
            { from: user1 }
          );
          time.increase(LARGE_INTERVAL);
          time.advanceBlock();
        }

        if (branch === 1 && i === 2) {
          await expectRevert(
            this.contract.upgradePlanet(upgradeablePlanetId, branch, {
              from: user1,
            }),
            "Can't upgrade a second branch to level 3"
          );

          break;
        }

        this.contract.upgradePlanet(upgradeablePlanetId, branch, {
          from: user1,
        });

        time.increase(LARGE_INTERVAL);
        time.advanceBlock();
      }
    }
  });
});
