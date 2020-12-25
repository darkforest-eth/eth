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
  star2Location,
  silverStar1Location,
  silverStar2Location,
  lvl4Location1,
  makeInitArgs,
  makeMoveArgs,
  deployer,
  user1,
  user2,
  SMALL_INTERVAL,
  LARGE_INTERVAL,
  star1Location,
} = require("./DFTestUtils");

describe("DarkForestMove", function () {
  // test that moves execute and are applied at the right times in the right ways

  describe("move to new planet", function () {
    before(async function () {
      await initializeTest(this);

      await this.contract.changeTokenMintEndTime(9997464000, {
        from: deployer,
      });

      const fromId = getPlanetIdFromHex(asteroid1Location.hex);

      await this.contract.initializePlayer(...makeInitArgs(fromId, 10, 1999), {
        from: user1,
      });
      await this.contract.changeTokenMintEndTime(99999999999999, {
        from: deployer,
      });
      time.increase(LARGE_INTERVAL);
      time.advanceBlock();
    });

    it("should emit event", async function () {
      const fromId = getPlanetIdFromHex(asteroid1Location.hex);
      const toId = getPlanetIdFromHex(asteroid2Location.hex);
      const dist = 100;
      const shipsSent = 50000;
      const silverSent = 0;
      const receipt = await this.contract.move(
        ...makeMoveArgs(fromId, toId, 10, 2000, dist, shipsSent, silverSent),
        { from: user1 }
      );

      expectEvent(
        receipt,
        "ArrivalQueued",
        (eventArgs = {
          arrivalId: web3.utils.toBN(0),
        })
      );
    });

    it("should init new toPlanet", async function () {
      const toId = getPlanetIdFromHex(asteroid2Location.hex);
      const toPlanetExtended = await this.contract.planetsExtendedInfo(toId);
      expect(toPlanetExtended.isInitialized).to.equal(true);
    });

    it("should create new event and arrival with correct delay", async function () {
      const fromId = getPlanetIdFromHex(asteroid1Location.hex);
      const toId = getPlanetIdFromHex(asteroid2Location.hex);
      const planetEventsCount = await this.contract.planetEventsCount();
      const planetEvent0 = await this.contract.planetEvents(toId, 0);
      const planetArrivals = await this.contract.getPlanetArrivals(toId);

      // check planet events: arrival and departure
      expect(planetEvent0.id).to.be.bignumber.equal("0");
      expect(planetEvent0.eventType).to.be.bignumber.equal("0");

      // check planet arrival
      expect(
        planetArrivals[planetEventsCount - 1].player
      ).to.be.bignumber.equal(user1);
      expect(
        planetArrivals[planetEventsCount - 1].fromPlanet
      ).to.be.bignumber.equal(fromId);

      // check that time delay is correct
      const fromPlanet = await this.contract.planets(fromId);

      const dist = 100;
      const expectedTime = Math.floor(
        (dist * 100) / fromPlanet.speed.toNumber()
      );
      const planetArrival = (await this.contract.getPlanetArrivals(toId))[0];
      expect(
        planetArrival.arrivalTime - planetArrival.departureTime
      ).to.be.equal(expectedTime);
    });

    it("should decay ships", async function () {
      const fromId = getPlanetIdFromHex(asteroid1Location.hex);
      const toId = getPlanetIdFromHex(asteroid2Location.hex);

      const fromPlanet = await this.contract.planets(fromId);
      const range = fromPlanet.range.toNumber();
      const popCap = fromPlanet.populationCap.toNumber();
      const shipsSent = 50000;
      const dist = 100;
      const decayFactor = Math.pow(2, dist / range);
      const approxArriving = shipsSent / decayFactor - 0.05 * popCap;

      const planetArrivals = await this.contract.getPlanetArrivals(toId);
      expect(parseInt(planetArrivals[0].popArriving)).to.be.above(
        approxArriving - 1000
      );
      expect(parseInt(planetArrivals[0].popArriving)).to.be.below(
        approxArriving + 1000
      );
    });

    it("should not apply event before arrival time", async function () {
      const toId = getPlanetIdFromHex(asteroid2Location.hex);
      const planetExtendedInfo = await this.contract.planetsExtendedInfo(toId);
      expect(planetExtendedInfo.lastUpdated).to.be.bignumber.equal(
        await time.latest()
      );

      time.increase(SMALL_INTERVAL);
      time.advanceBlock();

      await this.contract.refreshPlanet(toId);

      const lvl0PlanetStartingPop = 0.0 * 100000;

      expect(
        (await this.contract.planets(toId)).population
      ).to.be.bignumber.equal(lvl0PlanetStartingPop.toString());
    });

    it("should apply event after arrival time", async function () {
      const toId = getPlanetIdFromHex(asteroid2Location.hex);
      const planetExtendedInfo = await this.contract.planetsExtendedInfo(toId);
      expect(planetExtendedInfo.lastUpdated).to.be.bignumber.equal(
        await time.latest()
      );

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.refreshPlanet(toId);

      expect(
        (await this.contract.planets(toId)).population
      ).to.be.bignumber.above("0");
    });

    it("should select and apply multiple arrivals", async function () {
      const fromId = getPlanetIdFromHex(asteroid2Location.hex);
      const toId = getPlanetIdFromHex(asteroid1Location.hex);
      const dist = 100;
      const shipsSent = 30000;
      const silverSent = 0;
      // drain the population first
      await this.contract.move(
        ...makeMoveArgs(toId, fromId, 16, 2000, dist, 99999, silverSent),
        { from: user1 }
      );

      // initiate move
      await this.contract.move(
        ...makeMoveArgs(fromId, toId, 16, 2000, dist, shipsSent, silverSent),
        { from: user1 }
      );
      await this.contract.move(
        ...makeMoveArgs(fromId, toId, 16, 2000, dist, shipsSent, silverSent),
        { from: user1 }
      );
      await this.contract.move(
        ...makeMoveArgs(fromId, toId, 16, 2000, dist, shipsSent, silverSent),
        { from: user1 }
      );
      let planetArrivals = await this.contract.getPlanetArrivals(toId);
      const popArrivingTotal =
        parseInt(planetArrivals[0].popArriving) +
        parseInt(planetArrivals[1].popArriving) +
        parseInt(planetArrivals[2].popArriving);
      expect(planetArrivals.length).to.equal(3);

      time.increase(200);
      time.advanceBlock();

      await this.contract.refreshPlanet(toId);

      planetArrivals = await this.contract.getPlanetArrivals(toId);
      expect(planetArrivals.length).to.equal(0);

      let planets = await this.contract.planets(toId);
      // above because need to take into account some pop growth
      expect(planets.population).to.be.bignumber.above(
        popArrivingTotal.toString()
      );
    });

    it("should init high level planet with barbarians", async function () {
      const fromId = getPlanetIdFromHex(asteroid2Location.hex);
      const toId = getPlanetIdFromHex(star2Location.hex);
      const dist = 100;
      const shipsSent = 50000;
      const silverSent = 0;

      await this.contract.move(
        ...makeMoveArgs(fromId, toId, 16, 2000, dist, shipsSent, silverSent),
        { from: user1 }
      );

      expect(
        (await this.contract.planets(toId)).population
      ).to.be.bignumber.above("0");
    });

    it("should expand world radius when init high level planet", async function () {
      await this.contract.changeTarget4RadiusConstant(1, { from: deployer }); // basically no min radius
      const initialRadius = await this.contract.worldRadius();
      const fromId = getPlanetIdFromHex(asteroid2Location.hex);

      const toId = getPlanetIdFromHex(lvl4Location1.hex);
      const dist = 100;
      const shipsSent = 40000;
      const silverSent = 0;

      await this.contract.move(
        ...makeMoveArgs(fromId, toId, 20, 1, dist, shipsSent, silverSent),
        { from: user1 }
      );

      expect(await this.contract.worldRadius()).to.be.bignumber.above(
        initialRadius
      );
    });
  });

  describe("move to friendly planet", function () {
    before(async function () {
      await initializeTest(this);

      await this.contract.changeTokenMintEndTime(9997464000, {
        from: deployer,
      });

      const fromId = getPlanetIdFromHex(asteroid1Location.hex);
      const toId = getPlanetIdFromHex(asteroid2Location.hex);
      const dist = 10;
      const shipsSent = 40000;
      const silverSent = 0;

      await this.contract.initializePlayer(...makeInitArgs(fromId, 10, 1999), {
        from: user1,
      });

      await this.contract.move(
        ...makeMoveArgs(fromId, toId, 10, 2000, dist, shipsSent, silverSent),
        { from: user1 }
      );
    });

    it("should increase population", async function () {
      const toId = getPlanetIdFromHex(asteroid2Location.hex);

      const planet = await this.contract.planets(toId);
      const initialPlanetPopulation = planet.population;

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.refreshPlanet(toId);

      expect(
        (await this.contract.planets(toId)).population
      ).to.be.bignumber.above(initialPlanetPopulation);
    });

    it("should allow overpopulation", async function () {
      const fromId = getPlanetIdFromHex(asteroid1Location.hex);
      const toId = getPlanetIdFromHex(asteroid2Location.hex);
      await this.contract.refreshPlanet(fromId);
      await this.contract.refreshPlanet(toId);
      const planet2 = await this.contract.planets(toId);

      const dist = 100;
      const shipsSent = 50000;
      const silverSent = 0;

      await this.contract.move(
        ...makeMoveArgs(fromId, toId, 16, 2000, dist, shipsSent, silverSent),
        { from: user1 }
      );

      time.increase(200);
      time.advanceBlock();

      await this.contract.refreshPlanet(toId);

      expect(
        (await this.contract.planets(toId)).population
      ).to.be.bignumber.above(planet2.populationCap);
    });

    it("should send silver", async function () {
      const fromId = getPlanetIdFromHex(asteroid1Location.hex);
      const toId = getPlanetIdFromHex(silverStar2Location.hex);
      const toId2 = getPlanetIdFromHex(silverStar1Location.hex);

      const dist = 100;
      const shipsSent = 90000;
      const silverSent = 0;

      await this.contract.move(
        ...makeMoveArgs(fromId, toId, 16, 2000, dist, shipsSent, silverSent),
        { from: user1 }
      );

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.refreshPlanet(toId);

      expect((await this.contract.planets(toId)).silver).to.be.bignumber.above(
        "0"
      );

      // send silver to toId2 but don't conquer it. 30000 conquers but 10000 move fails
      await this.contract.move(
        ...makeMoveArgs(toId, toId2, 16, 2000, 10, 20000, 100),
        { from: user1 }
      );

      const oldTo2 = await this.contract.planets(toId2);
      const oldSilverValue = oldTo2.silver;
      const silverCap = oldTo2.silverCap;

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.refreshPlanet(toId2);

      expect((await this.contract.planets(toId2)).silver).to.be.bignumber.above(
        oldSilverValue
      );
      expect((await this.contract.planets(toId2)).silver).to.be.bignumber.below(
        silverCap
      );
    });
  });

  describe("move to enemy planet", function () {
    before(async function () {
      await initializeTest(this);

      await this.contract.changeTokenMintEndTime(9997464000, {
        from: deployer,
      });

      const planet1 = getPlanetIdFromHex(asteroid1Location.hex);
      const planet2 = getPlanetIdFromHex(asteroid2Location.hex);

      await this.contract.initializePlayer(...makeInitArgs(planet1, 10, 1999), {
        from: user1,
      });

      await this.contract.initializePlayer(...makeInitArgs(planet2, 10, 1999), {
        from: user2,
      });
    });

    it("should decrease population if insufficient to conquer", async function () {
      const planet1Id = getPlanetIdFromHex(asteroid1Location.hex);
      const planet2Id = getPlanetIdFromHex(asteroid2Location.hex);
      const dist = 0; // instant move - just for testing correct decay application
      const shipsSent = 40000;
      const silverSent = 0;

      time.increase(LARGE_INTERVAL);

      await this.contract.move(
        ...makeMoveArgs(
          planet1Id,
          planet2Id,
          10,
          2000,
          dist,
          shipsSent,
          silverSent
        ),
        { from: user1 }
      );

      const toPlanetDef = (
        await this.contract.planets(planet2Id)
      ).defense.toNumber();
      const planetArrival = (
        await this.contract.getPlanetArrivals(planet2Id)
      )[0];
      const shipsMoved = parseInt(planetArrival.popArriving);
      const attackForce = Math.floor((shipsMoved * 100) / toPlanetDef);

      await this.contract.refreshPlanet(planet2Id);

      const planet2 = await this.contract.planets(planet2Id);
      expect(planet2.owner).to.equal(user2);

      // range of tolerances
      expect(planet2.population.toNumber()).to.be.above(
        planet2.populationCap.toNumber() - attackForce - 1000
      );
      expect(planet2.population.toNumber()).to.be.below(
        planet2.populationCap.toNumber() - attackForce + 1000
      );
    });

    it("should conquer planet if sufficient forces", async function () {
      time.increase(LARGE_INTERVAL);
      const planet1Id = getPlanetIdFromHex(asteroid1Location.hex);
      const planet2Id = getPlanetIdFromHex(asteroid2Location.hex);
      const planet3Id = getPlanetIdFromHex(silverStar1Location.hex);
      const dist = 0; // instant move - just for testing correct decay application
      const silverSent = 0;

      // drain planet first
      await this.contract.move(
        ...makeMoveArgs(
          planet2Id,
          planet3Id,
          10,
          2000,
          dist,
          95000,
          silverSent
        ),
        { from: user2 }
      );

      await this.contract.refreshPlanet(planet2Id);
      let planet2 = await this.contract.planets(planet2Id);
      const planet2Pop = planet2.population.toNumber();
      const planet2Def = planet2.defense.toNumber();
      const defenseForce = Math.floor((planet2Pop * planet2Def) / 100);

      await this.contract.move(
        ...makeMoveArgs(
          planet1Id,
          planet2Id,
          10,
          2000,
          dist,
          50000,
          silverSent
        ),
        { from: user1 }
      );

      const planetArrival = (
        await this.contract.getPlanetArrivals(planet2Id)
      )[0];
      const shipsMoved = parseInt(planetArrival.popArriving);

      await this.contract.refreshPlanet(planet2Id);
      planet2 = await this.contract.planets(planet2Id);

      expect(planet2.owner).to.equal(user1);

      // range of tolerances
      expect(planet2.population.toNumber()).to.be.above(
        shipsMoved - defenseForce - 1000
      );
      expect(planet2.population.toNumber()).to.be.below(
        shipsMoved - defenseForce + 1000
      );
    });

    it("should send silver", async function () {
      time.increase(LARGE_INTERVAL);
      const planet1Id = getPlanetIdFromHex(asteroid2Location.hex);
      const planet2Id = getPlanetIdFromHex(silverStar2Location.hex);
      const planet3Id = getPlanetIdFromHex(silverStar1Location.hex);
      const dist = 100;
      const silverSent = 100;

      await this.contract.move(
        ...makeMoveArgs(planet1Id, planet2Id, 20, 2000, dist, 99999, 0),
        { from: user1 }
      );

      time.increase(200);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          planet3Id,
          planet2Id,
          20,
          2000,
          dist,
          99999,
          silverSent
        ),
        { from: user2 }
      );

      time.increase(200);
      time.advanceBlock();

      await this.contract.refreshPlanet(planet2Id);

      const planet2 = await this.contract.planets(planet2Id);
      expect(planet2.silver).to.be.bignumber.above("0");
    });
  });

  describe("reject move with insufficient resources", function () {
    before(async function () {
      await initializeTest(this);

      const planet1 = getPlanetIdFromHex(asteroid1Location.hex);

      await this.contract.initializePlayer(...makeInitArgs(planet1, 10, 1999), {
        from: user1,
      });
    });

    // tried to send more silver than you had
    it("should reject if moving more silver than what the planet has", async function () {
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
          { from: user1 }
        ),
        "Tried to move more silver than what exists"
      );
    });

    // tried to send more pop than you had
    it("should reject if moving more population than what the planet has", async function () {
      const planet1Id = getPlanetIdFromHex(asteroid1Location.hex);
      const planet2Id = getPlanetIdFromHex(asteroid2Location.hex);
      const dist = 100;
      const shipsSent = 99999999999;
      const silverSent = 0;

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
          { from: user1 }
        ),
        "Tried to move more population that what exists"
      );
    });

    // tried to send an amount of pop that would result in 0 arriving forces
    it("should reject if moving population that results in 0 arriving forces", async function () {
      const planet1Id = getPlanetIdFromHex(asteroid1Location.hex);
      const planet2Id = getPlanetIdFromHex(asteroid2Location.hex);
      const dist = 100;
      const shipsSent = 100;
      const silverSent = 0;

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
          { from: user1 }
        ),
        "Not enough forces to make move"
      );
    });

    it("should reject if moving from planet not owned", async function () {
      const planet1Id = getPlanetIdFromHex(asteroid2Location.hex);
      const planet2Id = getPlanetIdFromHex(asteroid1Location.hex);
      const dist = 100;
      const shipsSent = 50000;
      const silverSent = 0;

      await this.contract.initializePlayer(
        ...makeInitArgs(planet1Id, 10, 1999),
        {
          from: user2,
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
          { from: user1 }
        ),
        "Only owner account can perform operation on planets"
      );
    });

    it("should reject if moving out of radius", async function () {
      const planet1Id = getPlanetIdFromHex(asteroid1Location.hex);
      const planet2Id = getPlanetIdFromHex(asteroid2Location.hex);
      const dist = 100;
      const shipsSent = 50000;
      const silverSent = 0;

      await expectRevert(
        this.contract.move(
          ...makeMoveArgs(
            planet1Id,
            planet2Id,
            16,
            9999999999,
            dist,
            shipsSent,
            silverSent
          ),
          { from: user1 }
        ),
        "Attempting to move out of bounds"
      );
    });
  });

  describe("move rate limits", function () {
    beforeEach(async function () {
      await initializeTest(this);

      await this.contract.changeTokenMintEndTime(9997464000, {
        from: deployer,
      });

      const planet1 = getPlanetIdFromHex(asteroid1Location.hex);
      const planet2 = getPlanetIdFromHex(asteroid2Location.hex);
      const planet3 = getPlanetIdFromHex(star1Location.hex);

      await this.contract.initializePlayer(...makeInitArgs(planet1, 10, 1999), {
        from: user1,
      });
      await this.contract.initializePlayer(...makeInitArgs(planet2, 10, 1999), {
        from: user2,
      });

      // conquer the star
      for (let i = 0; i < 2; i++) {
        time.increase(LARGE_INTERVAL);
        time.advanceBlock();
        await this.contract.move(
          ...makeMoveArgs(planet1, planet3, 10, 1999, 0, 90000, 0),
          {
            from: user1,
          }
        );
      }
      time.increase(LARGE_INTERVAL);
      time.advanceBlock();
    });

    it("don't allow 7th incoming arrival until at least one has finished", async function () {
      const planet3 = getPlanetIdFromHex(star1Location.hex);
      const planet1 = getPlanetIdFromHex(asteroid1Location.hex);
      const from = await this.contract.planets(planet3);

      // do 1 move
      await this.contract.move(
        ...makeMoveArgs(
          planet3,
          planet1,
          10,
          1999,
          from.range.toNumber(),
          from.populationCap.toNumber() / 8,
          0
        ),
        { from: user1 }
      );
      time.increase(from.range.toNumber() / (from.speed.toNumber() / 100) - 5);
      // do 5 moves after some time
      for (let i = 0; i < 5; i++) {
        await this.contract.move(
          ...makeMoveArgs(
            planet3,
            planet1,
            10,
            1999,
            from.range.toNumber(),
            from.populationCap.toNumber() / 8,
            0
          ),
          { from: user1 }
        );
      }
      // queue should be full
      await expectRevert(
        this.contract.move(
          ...makeMoveArgs(
            planet3,
            planet1,
            10,
            1999,
            from.range.toNumber(),
            from.populationCap.toNumber() / 8,
            0
          ),
          { from: user1 }
        ),
        "Planet is rate-limited."
      );
      time.increase(10);
      // first move should be done
      this.contract.move(
        ...makeMoveArgs(
          planet3,
          planet1,
          10,
          1999,
          from.range.toNumber(),
          from.populationCap.toNumber() / 8,
          0
        ),
        { from: user1 }
      );
    });

    it("should not allow 7 incoming enemy arrivals", async function () {
      const planet3 = getPlanetIdFromHex(star1Location.hex);
      const planet2 = getPlanetIdFromHex(asteroid2Location.hex);
      const from = await this.contract.planets(planet3);
      for (let i = 0; i < 6; i++) {
        await this.contract.move(
          ...makeMoveArgs(
            planet3,
            planet2,
            10,
            1999,
            from.range.toNumber(),
            from.populationCap.toNumber() / 8,
            0
          ),
          { from: user1 }
        );
      }
      await expectRevert(
        this.contract.move(
          ...makeMoveArgs(
            planet3,
            planet2,
            10,
            1999,
            from.range.toNumber(),
            from.populationCap.toNumber() / 8,
            0
          ),
          { from: user1 }
        ),
        "Planet is rate-limited."
      );
    });

    it("should allow owner to move to planet even if there are 7 enemy arrivals", async function () {
      const planet3 = getPlanetIdFromHex(star1Location.hex);
      const planet2 = getPlanetIdFromHex(asteroid2Location.hex);
      const planet1 = getPlanetIdFromHex(asteroid1Location.hex);
      const enemyFrom = await this.contract.planets(planet2);
      const myFrom = await this.contract.planets(planet3);
      for (let i = 0; i < 6; i++) {
        await this.contract.move(
          ...makeMoveArgs(
            planet2,
            planet1,
            10,
            1999,
            enemyFrom.range.toNumber(),
            enemyFrom.populationCap.toNumber() / 8,
            0
          ),
          { from: user2 }
        );
      }
      for (let i = 0; i < 6; i++) {
        await this.contract.move(
          ...makeMoveArgs(
            planet3,
            planet1,
            10,
            1999,
            myFrom.range.toNumber(),
            myFrom.populationCap.toNumber() / 8,
            0
          ),
          { from: user1 }
        );
      }
    });
  });
});
