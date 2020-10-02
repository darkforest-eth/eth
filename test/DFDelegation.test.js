const { web3 } = require("@openzeppelin/test-environment");
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
  asteroid2Location,
  star2Location,
  silverStar2Location,
  makeInitArgs,
  makeMoveArgs,
  deployer,
  user1,
  user2,
  LARGE_INTERVAL,
} = require("./DFTestUtils");

describe("DarkForestDelegation", function () {
  describe("move to new planet using delegated account", function () {
    before(async function () {
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

    it("should reject planet delegation in non initialized planet", async function () {
      const planet = getPlanetIdFromHex(asteroid1Location.hex);

      await expectRevert(
        this.contract.delegatePlanet(planet, user2),
        "Planet is not initialized"
      );
    });

    it("should reject player that have not been delegated", async function () {
      const planet1Id = getPlanetIdFromHex(asteroid1Location.hex);
      const planet2Id = getPlanetIdFromHex(asteroid2Location.hex);
      const dist = 100;
      const shipsSent = 40000;
      const silverSent = 100;

      await this.contract.initializePlayer(
        ...makeInitArgs(planet1Id, 10, 2000),
        {
          from: user1,
        }
      );

      await expectRevert(
        this.contract.move(
          ...makeMoveArgs(
            planet1Id,
            planet2Id,
            16,
            2000,
            dist,
            shipsSent,
            silverSent
          ),
          { from: user2 }
        ),
        "Only owner or delegated account can perform operation on planets"
      );
    });

    it("should emit event on planet delegation", async function () {
      const planet = getPlanetIdFromHex(asteroid1Location.hex);

      const receipt = await this.contract.delegatePlanet(planet, user2, {
        from: user1,
      });

      expectEvent(
        receipt,
        "PlanetDelegated",
        (eventArgs = {
          loc: planet,
          player: user2,
        })
      );
    });

    it("should reject delegating on player who is already delegated", async function () {
      const planet = getPlanetIdFromHex(asteroid1Location.hex);

      await expectRevert(
        this.contract.delegatePlanet(planet, user2, {
          from: user1,
        }),
        "Planet already delegated"
      );
    });

    it("should successfully move and emit event using delegated account", async function () {
      const planet1Id = getPlanetIdFromHex(asteroid1Location.hex);
      const planet2Id = getPlanetIdFromHex(asteroid2Location.hex);
      const dist = 100;
      const shipsSent = 40000;
      const silverSent = 0;

      const receipt = await this.contract.move(
        ...makeMoveArgs(
          planet1Id,
          planet2Id,
          16,
          2000,
          dist,
          shipsSent,
          silverSent
        ),
        { from: user2 }
      );

      expectEvent(
        receipt,
        "ArrivalQueued",
        (eventArgs = {
          arrivalId: web3.utils.toBN(0),
        })
      );
    });

    it("new planet's owner must be the actual planet owner (not delegated account)", async function () {
      const planet2Id = getPlanetIdFromHex(asteroid2Location.hex);
      const planetExtendedInfo = await this.contract.planetsExtendedInfo(
        planet2Id
      );
      expect(planetExtendedInfo.lastUpdated).to.be.bignumber.equal(
        await time.latest()
      );

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.refreshPlanet(planet2Id);

      expect((await this.contract.planets(planet2Id)).owner).to.be.equal(user1);
    });

    it("should emit event on planet undelegation", async function () {
      const planet = getPlanetIdFromHex(asteroid1Location.hex);
      const receipt = await this.contract.undelegatePlanet(planet, user2, {
        from: user1,
      });

      expectEvent(
        receipt,
        "PlanetUndelegated",
        (eventArgs = {
          loc: planet,
          player: user2,
        })
      );
    });

    it("should reject player that have been undelegated", async function () {
      const planet1Id = getPlanetIdFromHex(asteroid1Location.hex);
      const planet2Id = getPlanetIdFromHex(asteroid2Location.hex);
      const dist = 100;
      const shipsSent = 40000;
      const silverSent = 100;

      await expectRevert(
        this.contract.move(
          ...makeMoveArgs(
            planet1Id,
            planet2Id,
            16,
            2000,
            dist,
            shipsSent,
            silverSent
          ),
          { from: user2 }
        ),
        "Only owner or delegated account can perform operation on planets"
      );
    });

    it("should reject undelegating on player who is already undelegated", async function () {
      const planet = getPlanetIdFromHex(asteroid1Location.hex);

      await expectRevert(
        this.contract.undelegatePlanet(planet, user2, {
          from: user1,
        }),
        "Planet is not delegated"
      );
    });
  });

  describe("upgrade planet using delegated account", function () {
    before(async function () {
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

      // start preparing game environment for testing
      const homePlanetId = getPlanetIdFromHex(asteroid1Location.hex);
      const upgradeablePlanetId = getPlanetIdFromHex(star2Location.hex);
      const silverMinePlanetId = getPlanetIdFromHex(silverStar2Location.hex);
      const dist = 0;
      const shipsSent = 90000;
      const silverSent = 0;

      await this.contract.initializePlayer(
        ...makeInitArgs(homePlanetId, 10, 1999),
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
    });

    it("should reject player that have not been delegated", async function () {
      const upgradeablePlanetId = getPlanetIdFromHex(star2Location.hex);

      await expectRevert(
        this.contract.upgradePlanet(upgradeablePlanetId, 0, {
          from: user2,
        }),
        "Only owner or delegated account can perform operation on planets"
      );
    });

    it("should emit event on planet delegation", async function () {
      const planet = getPlanetIdFromHex(star2Location.hex);

      const receipt = await this.contract.delegatePlanet(planet, user2, {
        from: user1,
      });

      expectEvent(
        receipt,
        "PlanetDelegated",
        (eventArgs = {
          loc: planet,
          player: user2,
        })
      );
    });

    it("should reject delegating on player who is already delegated", async function () {
      const planet = getPlanetIdFromHex(star2Location.hex);

      await expectRevert(
        this.contract.delegatePlanet(planet, user2, {
          from: user1,
        }),
        "Planet already delegated"
      );
    });

    it("should successfully upgrade and emit event using delegated account", async function () {
      const upgradeablePlanetId = getPlanetIdFromHex(star2Location.hex);

      const planetBeforeUpgrade = await this.contract.planets(
        upgradeablePlanetId
      );

      let silverCap = planetBeforeUpgrade.silverCap.toNumber();
      let initialSilver = planetBeforeUpgrade.silver.toNumber();
      let initialPopulationCap = planetBeforeUpgrade.populationCap;
      let initialPopulationGrowth = planetBeforeUpgrade.populationGrowth;
      const receipt = await this.contract.upgradePlanet(
        upgradeablePlanetId,
        0,
        {
          from: user2,
        }
      );

      const planetAfterUpgrade = await this.contract.planets(
        upgradeablePlanetId
      );
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
      expect(initialPopulationGrowth).to.be.bignumber.below(
        newPopulationGrowth
      );
    });

    it("should emit event on planet undelegation", async function () {
      const planet = getPlanetIdFromHex(star2Location.hex);
      const receipt = await this.contract.undelegatePlanet(planet, user2, {
        from: user1,
      });

      expectEvent(
        receipt,
        "PlanetUndelegated",
        (eventArgs = {
          loc: planet,
          player: user2,
        })
      );
    });

    it("should reject player that have been undelegated", async function () {
      const upgradeablePlanetId = getPlanetIdFromHex(star2Location.hex);

      await expectRevert(
        this.contract.upgradePlanet(upgradeablePlanetId, 0, {
          from: user2,
        }),
        "Only owner or delegated account can perform operation on planets"
      );
    });

    it("should reject undelegating on player who is already undelegated", async function () {
      const planet = getPlanetIdFromHex(star2Location.hex);

      await expectRevert(
        this.contract.undelegatePlanet(planet, user2, {
          from: user1,
        }),
        "Planet is not delegated"
      );
    });
  });
});
