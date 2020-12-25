const {
  time,
  expectEvent,
  expectRevert,
} = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

const {
  initializeTest,
  getPlanetIdFromHex,
  asteroid1Location,
  star1Location,
  silverStar2Location,
  makeInitArgs,
  makeMoveArgs,
  deployer,
  user1,
  user2,
  LARGE_INTERVAL,
} = require("./DFTestUtils");

describe("DarkForestUpgrade", function () {
  beforeEach(async function () {
    await initializeTest(this);

    await this.contract.changeTokenMintEndTime(99999999999999, {
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
      ...makeInitArgs(player1Planet, 10, 2000),
      {
        from: user1,
      }
    );

    await expectRevert(
      this.contract.upgradePlanet(player1Planet, 0, { from: user2 }),
      "Only owner account can perform operation on planets"
    );
  });

  it("should reject if planet level is not high enough", async function () {
    const lowLevelPlanet = getPlanetIdFromHex(asteroid1Location.hex);

    await this.contract.initializePlayer(
      ...makeInitArgs(lowLevelPlanet, 10, 2000),
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
    const upgradeablePlanetId = getPlanetIdFromHex(star1Location.hex);
    const dist = 0;
    const shipsSent = 90000;
    const silverSent = 0;

    await this.contract.initializePlayer(
      ...makeInitArgs(homePlanetId, 10, 2000),
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
    const upgradeablePlanetId = getPlanetIdFromHex(star1Location.hex);
    const silverMinePlanetId = getPlanetIdFromHex(silverStar2Location.hex);
    const dist = 0;
    const shipsSent = 90000;
    const silverSent = 0;

    await this.contract.initializePlayer(
      ...makeInitArgs(homePlanetId, 10, 2000),
      {
        from: user1,
      }
    );

    // conquer silver mine and upgradeable planet
    for (let i = 0; i < 4; i++) {
      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          upgradeablePlanetId,
          10,
          2000,
          dist,
          shipsSent,
          silverSent
        ),
        { from: user1 }
      );

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          silverMinePlanetId,
          10,
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
    const silverMine = await this.contract.planets(silverMinePlanetId);

    await this.contract.move(
      ...makeMoveArgs(
        silverMinePlanetId,
        upgradeablePlanetId,
        10,
        2000,
        dist,
        Math.floor(0.5 * silverMine.populationCap),
        silverMine.silverCap
      ),
      { from: user1 }
    );

    this.contract.refreshPlanet(upgradeablePlanetId);

    const planetBeforeUpgrade = await this.contract.planets(
      upgradeablePlanetId
    );

    let silverCap = planetBeforeUpgrade.silverCap.toNumber();
    let initialSilver = planetBeforeUpgrade.silver.toNumber();
    let initialPopulationCap = planetBeforeUpgrade.populationCap;
    let initialPopulationGrowth = planetBeforeUpgrade.populationGrowth;
    const receipt = await this.contract.upgradePlanet(upgradeablePlanetId, 0, {
      from: user1,
    });

    const planetAfterUpgrade = await this.contract.planets(upgradeablePlanetId);
    let newPopulationCap = planetAfterUpgrade.populationCap;
    let newPopulationGrowth = planetAfterUpgrade.populationGrowth;
    let newSilver = planetAfterUpgrade.silver.toNumber();

    expectEvent(
      receipt,
      "PlanetUpgraded",
      (eventArgs = { loc: upgradeablePlanetId })
    );
    expect(newSilver).to.equal(initialSilver - 0.2 * silverCap);
    expect(initialPopulationCap).to.be.bignumber.below(newPopulationCap);
    expect(initialPopulationGrowth).to.be.bignumber.below(newPopulationGrowth);
  });

  it("should reject upgrade on silver mine", async function () {
    const homePlanetId = getPlanetIdFromHex(asteroid1Location.hex);
    const silverMinePlanetId = getPlanetIdFromHex(silverStar2Location.hex);
    const dist = 0;
    const shipsSent = 90000;
    const silverSent = 0;

    await this.contract.initializePlayer(
      ...makeInitArgs(homePlanetId, 10, 2000),
      {
        from: user1,
      }
    );

    // conquer the upgradeable planet
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

    await expectRevert(
      this.contract.upgradePlanet(silverMinePlanetId, 0, { from: user1 }),
      "Can't upgrade silver mine"
    );
  });

  it("should reject upgrade if there's not enough resources", async function () {
    const homePlanetId = getPlanetIdFromHex(asteroid1Location.hex);
    const upgradeablePlanetId = getPlanetIdFromHex(star1Location.hex);
    const dist = 0;
    const shipsSent = 90000;
    const silverSent = 0;

    await this.contract.initializePlayer(
      ...makeInitArgs(homePlanetId, 10, 2000),
      {
        from: user1,
      }
    );

    // conquer the upgradeable planet
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

    await expectRevert(
      this.contract.upgradePlanet(upgradeablePlanetId, 0, { from: user1 }),
      "Insufficient silver to upgrade"
    );
  });

  it("should reject upgrade if branch is maxed", async function () {
    this.timeout(5000);

    const homePlanetId = getPlanetIdFromHex(asteroid1Location.hex);
    const upgradeablePlanetId = getPlanetIdFromHex(star1Location.hex);
    const silverMinePlanetId = getPlanetIdFromHex(silverStar2Location.hex);
    const dist = 0;
    const shipsSent = 90000;
    const silverSent = 0;

    await this.contract.initializePlayer(
      ...makeInitArgs(homePlanetId, 10, 2000),
      {
        from: user1,
      }
    );

    // conquer upgradeable planet and silver planet
    for (let i = 0; i < 4; i++) {
      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          upgradeablePlanetId,
          20,
          2000,
          dist,
          shipsSent,
          silverSent
        ),
        { from: user1 }
      );

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          silverMinePlanetId,
          20,
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
      for (let j = 0; j < 2; j++) {
        await this.contract.move(
          ...makeMoveArgs(
            silverMinePlanetId,
            upgradeablePlanetId,
            20,
            2000,
            1,
            shipsSent,
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

  it("should reject upgrade if total level already maxed (safe space)", async function () {
    this.timeout(10000);

    const homePlanetId = getPlanetIdFromHex(asteroid1Location.hex);
    const upgradeablePlanetId = getPlanetIdFromHex(star1Location.hex);
    const silverMinePlanetId = getPlanetIdFromHex(silverStar2Location.hex);
    const dist = 0;
    const shipsSent = 90000;
    const silverSent = 0;

    await this.contract.initializePlayer(
      ...makeInitArgs(homePlanetId, 10, 2000),
      {
        from: user1,
      }
    );

    // conquer upgradeable planet and silver planet
    for (let i = 0; i < 4; i++) {
      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          upgradeablePlanetId,
          10,
          2000,
          dist,
          shipsSent,
          silverSent
        ),
        { from: user1 }
      );

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          silverMinePlanetId,
          10,
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

    const branchOrder = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const silverMinePlanet = await this.contract.planets(silverMinePlanetId);
      // fill up planet with silver
      for (let j = 0; j < 2; j++) {
        await this.contract.move(
          ...makeMoveArgs(
            silverMinePlanetId,
            upgradeablePlanetId,
            10,
            2000,
            1,
            shipsSent,
            silverMinePlanet.silverCap
          ),
          { from: user1 }
        );
        time.increase(LARGE_INTERVAL);
        time.advanceBlock();
      }

      await this.contract.upgradePlanet(upgradeablePlanetId, branchOrder[i], {
        from: user1,
      });

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();
    }

    await expectRevert(
      this.contract.upgradePlanet(upgradeablePlanetId, 1, { from: user1 }),
      "Planet at max total level"
    );
  });

  it("should reject upgrade if total level already maxed (deep space)", async function () {
    this.timeout(10000);

    const homePlanetId = getPlanetIdFromHex(asteroid1Location.hex);
    const upgradeablePlanetId = getPlanetIdFromHex(star1Location.hex);
    const silverMinePlanetId = getPlanetIdFromHex(silverStar2Location.hex);
    const dist = 0;
    const shipsSent = 90000;
    const silverSent = 0;

    await this.contract.initializePlayer(
      ...makeInitArgs(homePlanetId, 10, 2000),
      {
        from: user1,
      }
    );

    // conquer upgradeable planet and silver planet
    for (let i = 0; i < 4; i++) {
      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          upgradeablePlanetId,
          20,
          2000,
          dist,
          shipsSent,
          silverSent
        ),
        { from: user1 }
      );

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          silverMinePlanetId,
          20,
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

    const branchOrder = [2, 2, 2, 1, 1];
    for (let i = 0; i < 5; i++) {
      const silverMinePlanet = await this.contract.planets(silverMinePlanetId);
      // fill up planet with silver
      for (let j = 0; j < 2; j++) {
        await this.contract.move(
          ...makeMoveArgs(
            silverMinePlanetId,
            upgradeablePlanetId,
            20,
            2000,
            1,
            shipsSent,
            silverMinePlanet.silverCap
          ),
          { from: user1 }
        );
        time.increase(LARGE_INTERVAL);
        time.advanceBlock();
      }

      await this.contract.upgradePlanet(upgradeablePlanetId, branchOrder[i], {
        from: user1,
      });

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();
    }

    await expectRevert(
      this.contract.upgradePlanet(upgradeablePlanetId, 1, { from: user1 }),
      "Planet at max total level"
    );
  });

  it("should reject lvl3 def upgrade in deep space", async function () {
    this.timeout(10000);

    const homePlanetId = getPlanetIdFromHex(asteroid1Location.hex);
    const upgradeablePlanetId = getPlanetIdFromHex(star1Location.hex);
    const silverMinePlanetId = getPlanetIdFromHex(silverStar2Location.hex);
    const dist = 0;
    const shipsSent = 90000;
    const silverSent = 0;

    await this.contract.initializePlayer(
      ...makeInitArgs(homePlanetId, 10, 2000),
      {
        from: user1,
      }
    );

    // conquer upgradeable planet and silver planet
    for (let i = 0; i < 4; i++) {
      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          upgradeablePlanetId,
          20,
          2000,
          dist,
          shipsSent,
          silverSent
        ),
        { from: user1 }
      );

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          homePlanetId,
          silverMinePlanetId,
          20,
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

    for (let i = 0; i < 3; i++) {
      const silverMinePlanet = await this.contract.planets(silverMinePlanetId);
      // fill up planet with silver
      for (let j = 0; j < 2; j++) {
        await this.contract.move(
          ...makeMoveArgs(
            silverMinePlanetId,
            upgradeablePlanetId,
            20,
            2000,
            1,
            shipsSent,
            silverMinePlanet.silverCap
          ),
          { from: user1 }
        );
        time.increase(LARGE_INTERVAL);
        time.advanceBlock();
      }

      if (i === 2) {
        await expectRevert(
          this.contract.upgradePlanet(upgradeablePlanetId, 0, { from: user1 }),
          "Can't upgrade DEF past level 2 in deep space"
        );
      } else {
        await this.contract.upgradePlanet(upgradeablePlanetId, 0, {
          from: user1,
        });
      }

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();
    }
  });
});
