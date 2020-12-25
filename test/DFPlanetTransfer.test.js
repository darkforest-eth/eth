const { web3 } = require("@openzeppelin/test-environment");
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
  asteroid2Location,
  asteroid3Location,
  makeInitArgs: makePlayerInitializeArgs,
  makeMoveArgs,
  deployer,
  user1,
  user2,
  LARGE_INTERVAL,
} = require("./DFTestUtils");

describe("DarkForestTransferOwnership", function () {
  describe("transfering, moving, transfering back, moving again", function () {
    before(async function () {
      await initializeTest(this);

      await this.contract.changeTokenMintEndTime(99999999999999, {
        from: deployer,
      });

      const planet1Id = getPlanetIdFromHex(asteroid1Location.hex);
      await this.contract.initializePlayer(
        ...makePlayerInitializeArgs(planet1Id, 10, 2000),
        {
          from: user1,
        }
      );
    });

    it("can't move forces from planet you don't own", async function () {
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
        "Only owner account can perform operation on planets"
      );
    });

    it("transfer to user 2, emits event on planet ownership transfer", async function () {
      const planet = getPlanetIdFromHex(asteroid1Location.hex);

      await this.contract.initializePlayer(
        ...makePlayerInitializeArgs(
          getPlanetIdFromHex(asteroid3Location.hex),
          10,
          2000
        ),
        {
          from: user2,
        }
      );

      const receipt = await this.contract.transferOwnership(planet, user2, {
        from: user1,
      });

      expectEvent(
        receipt,
        "PlanetTransferred",
        (eventArgs = {
          loc: planet,
          player: user2,
        })
      );
    });

    it("new planet's owner must be the new owner", async function () {
      const planet1Id = getPlanetIdFromHex(asteroid1Location.hex);
      const planetExtendedInfo = await this.contract.planetsExtendedInfo(
        planet1Id
      );
      expect(planetExtendedInfo.lastUpdated).to.be.bignumber.equal(
        await time.latest()
      );

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.refreshPlanet(planet1Id);

      expect((await this.contract.planets(planet1Id)).owner).to.be.equal(user2);
    });

    it("moving works fine by user to whom the planet was transferred", async function () {
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

    it("should transfer back to original owner fine", async function () {
      const planet = getPlanetIdFromHex(asteroid1Location.hex);
      const receipt = await this.contract.transferOwnership(planet, user1, {
        from: user2,
      });

      expectEvent(
        receipt,
        "PlanetTransferred",
        (eventArgs = {
          loc: planet,
          player: user1,
        })
      );
    });
  });
});
