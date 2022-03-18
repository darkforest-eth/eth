import { ArtifactType } from '@darkforest_eth/types';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import {
  conquerUnownedPlanet,
  createArtifactOnPlanet,
  fixtureLoader,
  increaseBlockchainTime,
  makeInitArgs,
  makeMoveArgs,
  ZERO_ADDRESS,
} from './utils/TestUtils';
import { defaultWorldFixture, growingWorldFixture, World } from './utils/TestWorld';
import {
  LVL0_PLANET_OUT_OF_BOUNDS,
  LVL1_ASTEROID_1,
  LVL1_ASTEROID_2,
  LVL1_ASTEROID_NEBULA,
  LVL1_PLANET_NEBULA,
  LVL1_QUASAR,
  LVL2_PLANET_SPACE,
  LVL4_UNOWNED_DEEP_SPACE,
  SMALL_INTERVAL,
  SPAWN_PLANET_1,
  SPAWN_PLANET_2,
} from './utils/WorldConstants';

const { BigNumber: BN } = ethers;

describe('DarkForestMove', function () {
  describe('moving space ships', function () {
    let world: World;

    async function worldFixture() {
      const world = await fixtureLoader(defaultWorldFixture);
      let initArgs = makeInitArgs(SPAWN_PLANET_1);
      await world.user1Core.initializePlayer(...initArgs);
      await world.user1Core.giveSpaceShips(SPAWN_PLANET_1.id);

      initArgs = makeInitArgs(SPAWN_PLANET_2);
      await world.user2Core.initializePlayer(...initArgs);
      await world.user2Core.giveSpaceShips(SPAWN_PLANET_2.id);

      await increaseBlockchainTime();
      return world;
    }

    beforeEach(async function () {
      world = await fixtureLoader(worldFixture);
    });

    it('allows controller to move ships to places they do not own with infinite distance', async function () {
      const ship = (await world.user1Core.getArtifactsOnPlanet(SPAWN_PLANET_1.id))[0].artifact;
      const shipId = ship.id;

      await world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_1, LVL2_PLANET_SPACE, 1000, 0, 0, shipId)
      );
      await increaseBlockchainTime();

      await world.user1Core.refreshPlanet(LVL2_PLANET_SPACE.id);
      expect((await world.user1Core.getArtifactsOnPlanet(SPAWN_PLANET_1.id)).length).to.be.eq(4);
      expect((await world.user1Core.getArtifactsOnPlanet(LVL2_PLANET_SPACE.id)).length).to.be.eq(1);
    });

    it('allows controller to move ships between their own planets', async function () {
      await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_ASTEROID_NEBULA);
      await increaseBlockchainTime();

      const ship = (await world.user1Core.getArtifactsOnPlanet(SPAWN_PLANET_1.id))[0].artifact;
      const shipId = ship.id;
      await world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_1, LVL1_ASTEROID_NEBULA, 1000, 0, 0, shipId)
      );

      await increaseBlockchainTime();
      await world.user1Core.refreshPlanet(LVL1_ASTEROID_NEBULA.id);

      expect((await world.user1Core.getArtifactsOnPlanet(LVL1_ASTEROID_NEBULA.id)).length).to.be.eq(
        1
      );
    });

    it('should not allow you to move enemy ships on your own planet', async function () {
      const ship = (await world.user2Core.getArtifactsOnPlanet(SPAWN_PLANET_2.id))[0].artifact;
      const shipId = ship.id;

      await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL2_PLANET_SPACE);

      await world.user2Core.move(
        ...makeMoveArgs(SPAWN_PLANET_2, LVL2_PLANET_SPACE, 1000, 0, 0, shipId)
      );
      await increaseBlockchainTime();

      await expect(
        world.user1Core.move(...makeMoveArgs(LVL2_PLANET_SPACE, SPAWN_PLANET_2, 1000, 0, 0, shipId))
      ).to.be.revertedWith('you can only move your own ships');
    });

    it('should not consume a photoid if moving a ship off a planet with one activated', async function () {
      const artifactId = await createArtifactOnPlanet(
        world.contract,
        world.user1.address,
        SPAWN_PLANET_1,
        ArtifactType.PhotoidCannon
      );

      await world.user1Core.activateArtifact(SPAWN_PLANET_1.id, artifactId, 0);
      await increaseBlockchainTime();

      const ship = (await world.user1Core.getArtifactsOnPlanet(SPAWN_PLANET_1.id))[0].artifact;
      const shipId = ship.id;

      await world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_1, LVL1_ASTEROID_1, 100, 0, 0, shipId)
      );

      await world.contract.refreshPlanet(SPAWN_PLANET_1.id);
      const activePhotoid = (await world.contract.getArtifactsOnPlanet(SPAWN_PLANET_1.id)).filter(
        (a) => a.artifact.artifactType === ArtifactType.PhotoidCannon
      )[0];
      // If the photoid is not there, it was used during ship move
      expect(activePhotoid).to.not.eq(undefined);
    });
  });

  describe('move to a neutral planet', function () {
    let world: World;

    async function worldFixture() {
      const world = await fixtureLoader(defaultWorldFixture);
      const initArgs = makeInitArgs(SPAWN_PLANET_1);

      await world.user1Core.initializePlayer(...initArgs);
      await increaseBlockchainTime();
      return world;
    }

    beforeEach(async function () {
      world = await fixtureLoader(worldFixture);
    });

    it("should add space junk to the user's total space junk", async function () {
      const dist = 100;
      const shipsSent = 50000;
      const silverSent = 0;

      await world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_1, LVL2_PLANET_SPACE, dist, shipsSent, silverSent)
      );

      const playerAddress = await world.user1.getAddress();
      const player = await world.contract.players(playerAddress);
      const { PLANET_LEVEL_JUNK } = await world.contract.getGameConstants();
      const junkFromPlanet = PLANET_LEVEL_JUNK[2];

      expect(player.spaceJunk).to.be.equal(junkFromPlanet);
    });
  });

  describe('move to an enemy planet', function () {
    let world: World;
    async function worldFixture() {
      const world = await fixtureLoader(defaultWorldFixture);

      let initArgs = makeInitArgs(SPAWN_PLANET_1);
      await world.user1Core.initializePlayer(...initArgs);

      initArgs = makeInitArgs(SPAWN_PLANET_2);
      await world.user2Core.initializePlayer(...initArgs);

      await increaseBlockchainTime();

      await conquerUnownedPlanet(world, world.user2Core, SPAWN_PLANET_2, LVL1_ASTEROID_1);
      return world;
    }

    beforeEach(async function () {
      world = await fixtureLoader(worldFixture);
    });

    it("should not add space junk to the user's total space junk", async function () {
      const dist = 100;
      const shipsSent = 50000;
      const silverSent = 0;

      await world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_1, LVL1_ASTEROID_1, dist, shipsSent, silverSent)
      );

      const playerAddress = await world.user1.getAddress();
      const player = await world.contract.players(playerAddress);
      expect(player.spaceJunk).to.be.equal(0);
    });
  });

  describe('abandon a planet', function () {
    let world: World;

    async function worldFixture() {
      const world = await fixtureLoader(defaultWorldFixture);
      const initArgs = makeInitArgs(SPAWN_PLANET_1);

      await world.user1Core.initializePlayer(...initArgs);
      await increaseBlockchainTime();

      await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_ASTEROID_1);

      const dist = 100;
      const shipsSent = 50000;
      const silverSent = 0;
      const playerAddress = await world.user1.getAddress();

      const player = await world.contract.players(playerAddress);
      const { PLANET_LEVEL_JUNK } = await world.contract.getGameConstants();
      const junkFromPlanet = PLANET_LEVEL_JUNK[1];
      expect(player.spaceJunk).to.be.equal(junkFromPlanet);

      await world.user1Core.move(
        ...makeMoveArgs(LVL1_ASTEROID_1, SPAWN_PLANET_1, dist, shipsSent, silverSent, 0, 1)
      );

      return world;
    }
    beforeEach(async function () {
      world = await fixtureLoader(worldFixture);
    });

    it("removes space junk from the user's total", async function () {
      const playerAddress = await world.user1.getAddress();
      const player = await world.contract.players(playerAddress);

      expect(player.spaceJunk).to.be.equal(0);
    });

    it('returns the abandoned planet to the 0 address', async function () {
      const planet = await world.contract.planets(LVL1_ASTEROID_1.id);
      expect(planet.owner).to.be.equal(ZERO_ADDRESS);
    });

    it('leaves double the amount of usual space pirates on the abandoned planet', async function () {
      const planet = await world.contract.planets(LVL1_ASTEROID_1.id);
      expect(planet.population).to.be.equal(40000);
    });
  });

  describe('abandoning a planet while there is an incoming voyage from yourself', async function () {
    let world: World;

    async function worldFixture() {
      world = await fixtureLoader(defaultWorldFixture);
      const initArgs = makeInitArgs(SPAWN_PLANET_1);

      await world.user1Core.initializePlayer(...initArgs);
      await increaseBlockchainTime();

      await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_ASTEROID_1);
      await increaseBlockchainTime();
      await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, LVL1_ASTEROID_1, 100, 50000, 0));

      return world;
    }

    beforeEach(async function () {
      world = await fixtureLoader(worldFixture);
    });

    it('reverts', async function () {
      await expect(
        world.user1Core.move(...makeMoveArgs(LVL1_ASTEROID_1, SPAWN_PLANET_2, 100, 50000, 0, 0, 1))
      ).to.be.revertedWith('Cannot abandon a planet that has incoming voyages');
    });
  });

  describe('abandoning a planet while there is an incoming voyage from an enemy', async function () {
    let world: World;

    async function worldFixture() {
      const world = await fixtureLoader(defaultWorldFixture);
      let initArgs = makeInitArgs(SPAWN_PLANET_1);
      await world.user1Core.initializePlayer(...initArgs);
      initArgs = makeInitArgs(SPAWN_PLANET_2);
      await world.user2Core.initializePlayer(...initArgs);
      await increaseBlockchainTime();

      await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_ASTEROID_1);
      await increaseBlockchainTime();
      await world.user2Core.move(...makeMoveArgs(SPAWN_PLANET_2, LVL1_ASTEROID_1, 100, 50000, 0));

      return world;
    }

    beforeEach(async function () {
      world = await fixtureLoader(worldFixture);
    });

    it('reverts', async function () {
      await expect(
        world.user1Core.move(...makeMoveArgs(LVL1_ASTEROID_1, SPAWN_PLANET_2, 100, 50000, 0, 0, 1))
      ).to.be.revertedWith('Cannot abandon a planet that has incoming voyages');
    });
  });

  describe('move to new planet', function () {
    let world: World;

    async function worldFixture() {
      const world = await fixtureLoader(defaultWorldFixture);
      const initArgs = makeInitArgs(SPAWN_PLANET_1);

      await world.user1Core.initializePlayer(...initArgs);
      await increaseBlockchainTime();

      const dist = 100;
      const shipsSent = 50000;
      const silverSent = 0;
      await world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_1, SPAWN_PLANET_2, dist, shipsSent, silverSent)
      );

      return world;
    }

    beforeEach(async function () {
      world = await fixtureLoader(worldFixture);
    });

    it('should emit event', async function () {
      const dist = 100;
      const shipsSent = 50000;
      const silverSent = 0;

      await expect(
        world.user1Core.move(
          ...makeMoveArgs(SPAWN_PLANET_1, LVL1_ASTEROID_1, dist, shipsSent, silverSent)
        )
      )
        .to.emit(world.contract, 'ArrivalQueued')
        .withArgs(
          world.user1.address,
          BN.from(2),
          BN.from('0x' + SPAWN_PLANET_1.hex),
          BN.from('0x' + LVL1_ASTEROID_1.hex),
          BN.from(0),
          BN.from(0)
        );
    });

    it('should init new toPlanet', async function () {
      const toId = SPAWN_PLANET_2.id;
      const toPlanetExtended = await world.contract.planetsExtendedInfo(toId);
      expect(toPlanetExtended.isInitialized).to.equal(true);
    });

    it('should create new event and arrival with correct delay', async function () {
      const fromId = SPAWN_PLANET_1.id;
      const toId = SPAWN_PLANET_2.id;
      const planetEventsCount = await world.contract.planetEventsCount();
      const planetEvent0 = await world.contract.getPlanetEvent(toId, 0);
      const planetArrivals = await world.contract.getPlanetArrivals(toId);

      // check planet events: arrival and departure
      expect(planetEvent0.id).to.be.equal(1);
      expect(planetEvent0.eventType).to.be.equal(0);

      // check planet arrival
      expect(planetArrivals[planetEventsCount.toNumber() - 1].player).to.be.equal(
        world.user1.address
      );
      expect(planetArrivals[planetEventsCount.toNumber() - 1].fromPlanet).to.be.equal(fromId);

      // check that time delay is correct
      const fromPlanet = await world.contract.planets(fromId);

      const dist = 100;
      const expectedTime = Math.floor((dist * 100) / fromPlanet.speed.toNumber());
      const planetArrival = (await world.contract.getPlanetArrivals(toId))[0];
      expect(planetArrival.arrivalTime.sub(planetArrival.departureTime)).to.be.equal(expectedTime);
    });

    it('should decay ships', async function () {
      const fromId = SPAWN_PLANET_1.id;
      const toId = SPAWN_PLANET_2.id;

      const fromPlanet = await world.contract.planets(fromId);
      const range = fromPlanet.range.toNumber();
      const popCap = fromPlanet.populationCap.toNumber();
      const shipsSent = 50000;
      const dist = 100;
      const decayFactor = Math.pow(2, dist / range);
      const approxArriving = shipsSent / decayFactor - 0.05 * popCap;

      const planetArrivals = await world.contract.getPlanetArrivals(toId);

      expect(planetArrivals[0].popArriving.toNumber()).to.be.above(approxArriving - 1000);
      expect(planetArrivals[0].popArriving.toNumber()).to.be.below(approxArriving + 1000);
    });

    it('should not apply event before arrival time', async function () {
      const toId = SPAWN_PLANET_2.id;
      const planetExtendedInfo = await world.contract.planetsExtendedInfo(toId);
      expect(planetExtendedInfo.lastUpdated).to.be.equal(
        (await ethers.provider.getBlock('latest')).timestamp
      );

      await increaseBlockchainTime(SMALL_INTERVAL);
      await world.contract.refreshPlanet(toId);

      const lvl0PlanetStartingPop = 0.0 * 100000;

      expect((await world.contract.planets(toId)).population).to.be.equal(lvl0PlanetStartingPop);
    });

    it('should apply event after arrival time', async function () {
      const toId = SPAWN_PLANET_2.id;
      const planetExtendedInfo = await world.contract.planetsExtendedInfo(toId);
      expect(planetExtendedInfo.lastUpdated).to.be.equal(
        (await ethers.provider.getBlock('latest')).timestamp
      );

      await increaseBlockchainTime();
      await world.contract.refreshPlanet(toId);

      expect((await world.contract.planets(toId)).population).to.be.above(0);
    });

    it('should select and apply multiple arrivals', async function () {
      await increaseBlockchainTime();

      const toId = SPAWN_PLANET_1.id;
      const dist = 100;
      const shipsSent = 30000;
      const silverSent = 0;

      // drain the population first
      await world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_1, SPAWN_PLANET_2, dist, 99999, silverSent)
      );

      // queue multiple moves from SPAWN_PLANET_2 to asteroid
      const moveArgs = makeMoveArgs(SPAWN_PLANET_2, SPAWN_PLANET_1, dist, shipsSent, silverSent);

      await world.user1Core.move(...moveArgs);
      await world.user1Core.move(...moveArgs);
      await world.user1Core.move(...moveArgs);

      let planetArrivals = await world.contract.getPlanetArrivals(toId);
      const popArrivingTotal = planetArrivals[0].popArriving
        .add(planetArrivals[1].popArriving)
        .add(planetArrivals[2].popArriving);
      expect(planetArrivals.length).to.equal(3);

      await increaseBlockchainTime(200);
      await world.contract.refreshPlanet(toId);

      planetArrivals = await world.contract.getPlanetArrivals(toId);
      expect(planetArrivals.length).to.equal(0);

      const planets = await world.contract.planets(toId);
      // above because need to take into account some pop growth
      expect(planets.population).to.be.above(popArrivingTotal);
    });

    it('should init high level planet with pirates', async function () {
      await increaseBlockchainTime();

      const toId = LVL2_PLANET_SPACE.id;
      const dist = 100;
      const shipsSent = 50000;
      const silverSent = 0;

      await world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_2, LVL2_PLANET_SPACE, dist, shipsSent, silverSent)
      );

      expect((await world.contract.planets(toId)).population).to.be.above(0);
    });
  });

  describe('in a growing universe', async function () {
    let initialRadius: BigNumber;
    let world: World;

    async function worldFixture() {
      const world = await fixtureLoader(growingWorldFixture);
      initialRadius = await world.contract.worldRadius();
      const initArgs = makeInitArgs(SPAWN_PLANET_2, initialRadius.toNumber());

      await world.user1Core.initializePlayer(...initArgs);
      await increaseBlockchainTime();

      return world;
    }

    beforeEach(async function () {
      world = await fixtureLoader(worldFixture);
    });

    it('should expand world radius when init high level planet', async function () {
      const dist = 100;
      const shipsSent = 40000;
      const silverSent = 0;

      await world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_2, LVL4_UNOWNED_DEEP_SPACE, dist, shipsSent, silverSent)
      );

      expect(await world.contract.worldRadius()).to.be.above(initialRadius);
    });
  });
});

describe('move to friendly planet', function () {
  let world: World;

  before(async function () {
    world = await fixtureLoader(defaultWorldFixture);

    const dist = 10;
    const shipsSent = 40000;
    const silverSent = 0;

    const initArgs = makeInitArgs(SPAWN_PLANET_1);

    world.user1Core.initializePlayer(...initArgs);

    const moveArgs = makeMoveArgs(SPAWN_PLANET_1, SPAWN_PLANET_2, dist, shipsSent, silverSent);

    await world.user1Core.move(...moveArgs);
  });

  it('should increase population', async function () {
    const toId = SPAWN_PLANET_2.id;
    const planet = await world.contract.planets(toId);
    const initialPlanetPopulation = planet.population;

    await increaseBlockchainTime();
    await world.contract.refreshPlanet(toId);

    expect((await world.contract.planets(toId)).population).to.be.above(initialPlanetPopulation);
  });

  it('should allow overpopulation', async function () {
    const fromId = SPAWN_PLANET_1.id;
    const toId = SPAWN_PLANET_2.id;
    await world.contract.refreshPlanet(fromId);
    await world.contract.refreshPlanet(toId);
    const planet2 = await world.contract.planets(toId);

    const dist = 100;
    const shipsSent = 50000;
    const silverSent = 0;

    await world.user1Core.move(
      ...makeMoveArgs(SPAWN_PLANET_1, SPAWN_PLANET_2, dist, shipsSent, silverSent)
    );

    await increaseBlockchainTime(200);

    await world.contract.refreshPlanet(toId);

    expect((await world.contract.planets(toId)).population).to.be.above(planet2.populationCap);
  });

  it('should send silver', async function () {
    const toId = LVL1_ASTEROID_2.id;
    const toId2 = LVL1_ASTEROID_1.id;

    const dist = 100;
    const shipsSent = 90000;
    const silverSent = 0;

    await world.user1Core.move(
      ...makeMoveArgs(SPAWN_PLANET_1, LVL1_ASTEROID_2, dist, shipsSent, silverSent)
    );
    await increaseBlockchainTime();
    await world.contract.refreshPlanet(toId);

    expect((await world.contract.planets(toId)).silver).to.be.above(0);

    // send silver to toId2 but don't conquer it. 30000 is just enough (25000 fails)
    await world.user1Core.move(...makeMoveArgs(LVL1_ASTEROID_2, LVL1_ASTEROID_1, 0, 30000, 100));
    const oldTo2 = await world.contract.planets(toId2);
    const oldSilverValue = oldTo2.silver;
    const silverCap = oldTo2.silverCap;

    await increaseBlockchainTime();
    await world.contract.refreshPlanet(toId2);

    expect((await world.contract.planets(toId2)).silver).to.be.above(oldSilverValue);
    expect((await world.contract.planets(toId2)).silver).to.be.below(silverCap);
  });

  it('should not allow overpopulation of quasars', async function () {
    const planetId = LVL1_PLANET_NEBULA.id;
    const quasarId = LVL1_QUASAR.id;

    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_PLANET_NEBULA);
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_QUASAR);

    const star1Data = await world.contract.planets(planetId);
    for (let i = 0; i < 15; i++) {
      await increaseBlockchainTime();
      await world.user1Core.move(
        ...makeMoveArgs(
          LVL1_PLANET_NEBULA,
          LVL1_QUASAR,
          0,
          star1Data.populationCap.toNumber() * 0.9,
          0
        )
      );
    }

    // quasar should be full
    await increaseBlockchainTime();
    await world.contract.refreshPlanet(quasarId);
    let quasarData = await world.contract.planets(quasarId);
    expect(quasarData.populationCap.toNumber()).to.equal(quasarData.population.toNumber());

    // shouldn't accept any more population
    await world.user1Core.move(
      ...makeMoveArgs(
        LVL1_PLANET_NEBULA,
        LVL1_QUASAR,
        0,
        star1Data.populationCap.toNumber() * 0.9,
        0
      )
    );
    await world.contract.refreshPlanet(quasarId);
    quasarData = await world.contract.planets(quasarId);
    expect(quasarData.populationCap.toNumber()).to.equal(quasarData.population.toNumber());
  });
});

describe('move to enemy planet', function () {
  let world: World;

  before(async function () {
    world = await fixtureLoader(defaultWorldFixture);

    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));
    await world.user2Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_2));
  });

  it('should decrease population if insufficient to conquer', async function () {
    const planet2Id = SPAWN_PLANET_2.id;
    const dist = 0; // instant move - just for testing correct decay application
    const shipsSent = 40000;
    const silverSent = 0;

    await increaseBlockchainTime();

    await world.user1Core.move(
      ...makeMoveArgs(SPAWN_PLANET_1, SPAWN_PLANET_2, dist, shipsSent, silverSent)
    );

    const toPlanetDef = (await world.contract.planets(planet2Id)).defense.toNumber();
    const planetArrival = (await world.contract.getPlanetArrivals(planet2Id))[0];
    const shipsMoved = planetArrival.popArriving.toNumber();
    const attackForce = Math.floor((shipsMoved * 100) / toPlanetDef);

    await world.contract.refreshPlanet(planet2Id);

    const planet2 = await world.contract.planets(planet2Id);
    expect(planet2.owner).to.equal(world.user2.address);

    // range of tolerances
    expect(planet2.population.toNumber()).to.be.above(
      planet2.populationCap.toNumber() - attackForce - 1000
    );
    expect(planet2.population.toNumber()).to.be.below(
      planet2.populationCap.toNumber() - attackForce + 1000
    );
  });

  it('should conquer planet if sufficient forces', async function () {
    await increaseBlockchainTime();

    const planet2Id = SPAWN_PLANET_2.id;
    const dist = 0; // instant move - just for testing correct decay application
    const silverSent = 0;

    // drain planet first

    await world.user2Core.move(
      ...makeMoveArgs(SPAWN_PLANET_2, LVL1_ASTEROID_1, dist, 95000, silverSent)
    );

    await world.contract.refreshPlanet(planet2Id);
    let planet2 = await world.contract.planets(planet2Id);
    const planet2Pop = planet2.population.toNumber();
    const planet2Def = planet2.defense.toNumber();
    const defenseForce = Math.floor((planet2Pop * planet2Def) / 100);

    await world.user1Core.move(
      ...makeMoveArgs(SPAWN_PLANET_1, SPAWN_PLANET_2, dist, 50000, silverSent)
    );

    const planetArrival = (await world.contract.getPlanetArrivals(planet2Id))[0];
    const shipsMoved = planetArrival.popArriving.toNumber();

    await world.contract.refreshPlanet(planet2Id);
    planet2 = await world.contract.planets(planet2Id);

    expect(planet2.owner).to.equal(world.user1.address);

    // range of tolerances
    expect(planet2.population.toNumber()).to.be.above(shipsMoved - defenseForce - 1000);
    expect(planet2.population.toNumber()).to.be.below(shipsMoved - defenseForce + 1000);
  });

  it('should send silver', async function () {
    await increaseBlockchainTime();

    const planet2Id = LVL1_ASTEROID_2.id;
    const dist = 100;
    const silverSent = 100;

    await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_2, LVL1_ASTEROID_2, dist, 99999, 0));
    await increaseBlockchainTime();
    await world.user2Core.move(
      ...makeMoveArgs(LVL1_ASTEROID_1, LVL1_ASTEROID_2, dist, 99999, silverSent)
    );
    await increaseBlockchainTime();
    await world.contract.refreshPlanet(planet2Id);

    const planet2 = await world.contract.planets(planet2Id);
    expect(planet2.silver).to.be.above(0);
  });
});

describe('reject move with insufficient resources', function () {
  let world: World;

  beforeEach(async function () {
    world = await fixtureLoader(defaultWorldFixture);
    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));
  });

  // tried to send more silver than you had
  it('should reject if moving more silver than what the planet has', async function () {
    const dist = 100;
    const shipsSent = 40000;
    const silverSent = 100;

    await expect(
      world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_1, SPAWN_PLANET_2, dist, shipsSent, silverSent)
      )
    ).to.be.revertedWith('Tried to move more silver than what exists');
  });

  // tried to send more pop than you had
  it('should reject if moving more population than what the planet has', async function () {
    const dist = 100;
    const shipsSent = 99999999999;
    const silverSent = 0;

    await expect(
      world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_1, SPAWN_PLANET_2, dist, shipsSent, silverSent)
      )
    ).to.be.revertedWith('Tried to move more population that what exists');
  });

  // tried to send an amount of pop that would result in 0 arriving forces
  it('should reject if moving population that results in 0 arriving forces', async function () {
    const dist = 100;
    const shipsSent = 100;
    const silverSent = 0;

    await expect(
      world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_1, SPAWN_PLANET_2, dist, shipsSent, silverSent)
      )
    ).to.be.revertedWith('Not enough forces to make move');
  });

  it('should reject if moving from planet not owned', async function () {
    const dist = 100;
    const shipsSent = 50000;
    const silverSent = 0;

    await world.user2Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_2));

    await expect(
      world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_2, SPAWN_PLANET_1, dist, shipsSent, silverSent)
      )
    ).to.be.revertedWith('Only owner account can perform that operation on planet.');
  });

  it('should reject if moving out of radius', async function () {
    const dist = 100;
    const shipsSent = 50000;
    const silverSent = 0;

    await expect(
      world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_1, LVL0_PLANET_OUT_OF_BOUNDS, dist, shipsSent, silverSent)
      )
    ).to.be.revertedWith('Attempting to move out of bounds');
  });
});

describe('move rate limits', function () {
  let world: World;

  beforeEach(async function () {
    world = await fixtureLoader(defaultWorldFixture);

    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));
    await world.user2Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_2));

    // conquer the star
    for (let i = 0; i < 2; i++) {
      await increaseBlockchainTime();

      await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, LVL1_PLANET_NEBULA, 0, 90000, 0));
    }
    await increaseBlockchainTime();
  });

  it("don't allow 7th incoming arrival until at least one has finished", async function () {
    const star1Id = LVL1_PLANET_NEBULA.id;
    const from = await world.contract.planets(star1Id);

    const moveArgs = makeMoveArgs(
      LVL1_PLANET_NEBULA,
      SPAWN_PLANET_1,
      from.range.toNumber(),
      from.populationCap.toNumber() / 8,
      0
    );

    // do 1 move

    await world.user1Core.move(...moveArgs);

    await ethers.provider.send('evm_increaseTime', [
      from.range.toNumber() / (from.speed.toNumber() / 100) - 10,
    ]);

    // do 5 moves after some time

    for (let i = 0; i < 5; i++) {
      await world.user1Core.move(...moveArgs);
    }
    // queue should be full

    await expect(world.user1Core.move(...moveArgs)).to.be.revertedWith('Planet is rate-limited');

    await ethers.provider.send('evm_increaseTime', [20]);

    // first move should be done

    world.user1Core.move(...moveArgs);
  });

  it('should not allow 7 incoming enemy arrivals', async function () {
    const planet3 = LVL1_PLANET_NEBULA.id;
    const from = await world.contract.planets(planet3);

    for (let i = 0; i < 6; i++) {
      await world.user1Core.move(
        ...makeMoveArgs(
          LVL1_PLANET_NEBULA,
          SPAWN_PLANET_2,
          from.range.toNumber(),
          from.populationCap.toNumber() / 8,
          0
        )
      );
    }

    await expect(
      world.user1Core.move(
        ...makeMoveArgs(
          LVL1_PLANET_NEBULA,
          SPAWN_PLANET_2,
          from.range.toNumber(),
          from.populationCap.toNumber() / 8,
          0
        )
      )
    ).to.be.revertedWith('Planet is rate-limited');
  });

  it('should allow owner to move to planet even if there are 7 enemy arrivals', async function () {
    const planet3 = LVL1_PLANET_NEBULA.id;
    const planet2 = SPAWN_PLANET_2.id;
    const enemyFrom = await world.contract.planets(planet2);
    const myFrom = await world.contract.planets(planet3);

    for (let i = 0; i < 6; i++) {
      await world.user2Core.move(
        ...makeMoveArgs(
          SPAWN_PLANET_2,
          SPAWN_PLANET_1,
          enemyFrom.range.toNumber(),
          enemyFrom.populationCap.toNumber() / 8,
          0
        )
      );
    }
    for (let i = 0; i < 6; i++) {
      await world.user1Core.move(
        ...makeMoveArgs(
          LVL1_PLANET_NEBULA,
          SPAWN_PLANET_1,
          myFrom.range.toNumber(),
          myFrom.populationCap.toNumber() / 8,
          0
        )
      );
    }
  });

  it('should not allow more than 6 ship movements to uncontrolled planet', async function () {
    for (let i = 0; i < 6; i++) {
      await world.contract.adminGiveSpaceShip(
        SPAWN_PLANET_1.id,
        world.user1.address,
        ArtifactType.ShipMothership
      );

      const ship = (await world.user1Core.getArtifactsOnPlanet(SPAWN_PLANET_1.id))[0].artifact;

      await world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_1, LVL2_PLANET_SPACE, 10, 0, 0, ship.id)
      );
    }

    await world.contract.adminGiveSpaceShip(
      SPAWN_PLANET_1.id,
      world.user1.address,
      ArtifactType.ShipMothership
    );

    const ship = (await world.user1Core.getArtifactsOnPlanet(SPAWN_PLANET_1.id))[0].artifact;

    await expect(
      world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, LVL2_PLANET_SPACE, 1000, 0, 0, ship.id))
    ).to.be.revertedWith('Planet is rate-limited');

    await increaseBlockchainTime();
    await world.user1Core.refreshPlanet(LVL2_PLANET_SPACE.id);

    const numShipsOnPlanet = (await world.user1Core.getArtifactsOnPlanet(LVL2_PLANET_SPACE.id))
      .length;

    expect(numShipsOnPlanet).to.be.eq(6);
  });

  it('when moving 6 ships to planet, should not allow an enemy attack', async function () {
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL2_PLANET_SPACE);
    await increaseBlockchainTime();

    for (let i = 0; i < 6; i++) {
      await world.contract.adminGiveSpaceShip(
        SPAWN_PLANET_1.id,
        world.user1.address,
        ArtifactType.ShipMothership
      );

      const ship = (await world.user1Core.getArtifactsOnPlanet(SPAWN_PLANET_1.id))[0].artifact;

      await world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_1, LVL2_PLANET_SPACE, 10, 0, 0, ship.id)
      );
    }

    await expect(
      world.user2Core.move(...makeMoveArgs(SPAWN_PLANET_2, LVL2_PLANET_SPACE, 1, 10000, 0))
    ).to.be.revertedWith('Planet is rate-limited');

    await increaseBlockchainTime();
    await world.user1Core.refreshPlanet(LVL2_PLANET_SPACE.id);

    const numShipsOnPlanet = (await world.user1Core.getArtifactsOnPlanet(LVL2_PLANET_SPACE.id))
      .length;

    expect(numShipsOnPlanet).to.be.eq(6);
  });
});
