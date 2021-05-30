import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  conquerUnownedPlanet,
  hexToBigNumber,
  increaseBlockchainTime,
  makeInitArgs,
  makeMoveArgs,
} from './utils/TestUtils';
import {
  asteroid1,
  asteroid2,
  SMALL_INTERVAL,
  star4,
  lvl4Location1,
  silverStar2,
  silverStar1,
  star1,
  outOfBoundsLocation,
  silverBank1,
} from './utils/WorldConstants';
import { initializeWorld, World } from './utils/TestWorld';

const { BigNumber: BN } = ethers;

describe('DarkForestMove', function () {
  let world: World;

  describe('move to new planet', function () {
    before(async function () {
      world = await initializeWorld();
      const initArgs = makeInitArgs(asteroid1);

      await world.user1Core.initializePlayer(...initArgs);
      await increaseBlockchainTime();
    });

    it('should emit event', async function () {
      const dist = 100;
      const shipsSent = 50000;
      const silverSent = 0;

      await expect(
        world.user1Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent))
      )
        .to.emit(world.contracts.core, 'ArrivalQueued')
        .withArgs(
          world.user1.address,
          BN.from(1),
          BN.from('0x' + asteroid1.hex),
          BN.from('0x' + asteroid2.hex),
          BN.from(0)
        );
    });

    it('should init new toPlanet', async function () {
      const toId = hexToBigNumber(asteroid2.hex);
      const toPlanetExtended = await world.contracts.core.planetsExtendedInfo(toId);
      expect(toPlanetExtended.isInitialized).to.equal(true);
    });

    it('should create new event and arrival with correct delay', async function () {
      const fromId = hexToBigNumber(asteroid1.hex);
      const toId = hexToBigNumber(asteroid2.hex);
      const planetEventsCount = await world.contracts.core.planetEventsCount();
      const planetEvent0 = await world.contracts.core.getPlanetEvent(toId, 0);
      const planetArrivals = await world.contracts.getters.getPlanetArrivals(toId);

      // check planet events: arrival and departure
      expect(planetEvent0.id).to.be.equal(1);
      expect(planetEvent0.eventType).to.be.equal(0);

      // check planet arrival
      expect(planetArrivals[planetEventsCount.toNumber() - 1].player).to.be.equal(
        world.user1.address
      );
      expect(planetArrivals[planetEventsCount.toNumber() - 1].fromPlanet).to.be.equal(fromId);

      // check that time delay is correct
      const fromPlanet = await world.contracts.core.planets(fromId);

      const dist = 100;
      const expectedTime = Math.floor((dist * 100) / fromPlanet.speed.toNumber());
      const planetArrival = (await world.contracts.getters.getPlanetArrivals(toId))[0];
      expect(planetArrival.arrivalTime.sub(planetArrival.departureTime)).to.be.equal(expectedTime);
    });

    it('should decay ships', async function () {
      const fromId = hexToBigNumber(asteroid1.hex);
      const toId = hexToBigNumber(asteroid2.hex);

      const fromPlanet = await world.contracts.core.planets(fromId);
      const range = fromPlanet.range.toNumber();
      const popCap = fromPlanet.populationCap.toNumber();
      const shipsSent = 50000;
      const dist = 100;
      const decayFactor = Math.pow(2, dist / range);
      const approxArriving = shipsSent / decayFactor - 0.05 * popCap;

      const planetArrivals = await world.contracts.getters.getPlanetArrivals(toId);

      expect(planetArrivals[0].popArriving.toNumber()).to.be.above(approxArriving - 1000);
      expect(planetArrivals[0].popArriving.toNumber()).to.be.below(approxArriving + 1000);
    });

    it('should not apply event before arrival time', async function () {
      const toId = hexToBigNumber(asteroid2.hex);
      const planetExtendedInfo = await world.contracts.core.planetsExtendedInfo(toId);
      expect(planetExtendedInfo.lastUpdated).to.be.equal(
        (await ethers.provider.getBlock('latest')).timestamp
      );

      await increaseBlockchainTime(SMALL_INTERVAL);
      await world.contracts.core.refreshPlanet(toId);

      const lvl0PlanetStartingPop = 0.0 * 100000;

      expect((await world.contracts.core.planets(toId)).population).to.be.equal(
        lvl0PlanetStartingPop
      );
    });

    it('should apply event after arrival time', async function () {
      const toId = hexToBigNumber(asteroid2.hex);
      const planetExtendedInfo = await world.contracts.core.planetsExtendedInfo(toId);
      expect(planetExtendedInfo.lastUpdated).to.be.equal(
        (await ethers.provider.getBlock('latest')).timestamp
      );

      await increaseBlockchainTime();
      await world.contracts.core.refreshPlanet(toId);

      expect((await world.contracts.core.planets(toId)).population).to.be.above(0);
    });

    it('should select and apply multiple arrivals', async function () {
      const toId = hexToBigNumber(asteroid1.hex);
      const dist = 100;
      const shipsSent = 30000;
      const silverSent = 0;

      // drain the population first
      await world.user1Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, 99999, silverSent));

      // queue multiple moves from asteroid2 to asteroid
      const moveArgs = makeMoveArgs(asteroid2, asteroid1, dist, shipsSent, silverSent);

      await world.user1Core.move(...moveArgs);
      await world.user1Core.move(...moveArgs);
      await world.user1Core.move(...moveArgs);

      let planetArrivals = await world.contracts.getters.getPlanetArrivals(toId);
      const popArrivingTotal = planetArrivals[0].popArriving
        .add(planetArrivals[1].popArriving)
        .add(planetArrivals[2].popArriving);
      expect(planetArrivals.length).to.equal(3);

      await increaseBlockchainTime(200);
      await world.contracts.core.refreshPlanet(toId);

      planetArrivals = await world.contracts.getters.getPlanetArrivals(toId);
      expect(planetArrivals.length).to.equal(0);

      const planets = await world.contracts.core.planets(toId);
      // above because need to take into account some pop growth
      expect(planets.population).to.be.above(popArrivingTotal);
    });

    it('should init high level planet with barbarians', async function () {
      const toId = hexToBigNumber(star4.hex);
      const dist = 100;
      const shipsSent = 50000;
      const silverSent = 0;

      await world.user1Core.move(...makeMoveArgs(asteroid2, star4, dist, shipsSent, silverSent));

      expect((await world.contracts.core.planets(toId)).population).to.be.above(0);
    });

    it('should expand world radius when init high level planet', async function () {
      await world.contracts.core.changeTarget4RadiusConstant(1); // basically no min radius
      const initialRadius = await world.contracts.core.worldRadius();
      const dist = 100;
      const shipsSent = 40000;
      const silverSent = 0;

      await world.user1Core.move(
        ...makeMoveArgs(asteroid2, lvl4Location1, dist, shipsSent, silverSent)
      );

      expect(await world.contracts.core.worldRadius()).to.be.above(initialRadius);
    });
  });
});

describe('move to friendly planet', function () {
  let world: World;

  before(async function () {
    world = await initializeWorld();

    const dist = 10;
    const shipsSent = 40000;
    const silverSent = 0;

    const initArgs = makeInitArgs(asteroid1);

    world.user1Core.initializePlayer(...initArgs);

    const moveArgs = makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent);

    await world.user1Core.move(...moveArgs);
  });

  it('should increase population', async function () {
    const toId = hexToBigNumber(asteroid2.hex);
    const planet = await world.contracts.core.planets(toId);
    const initialPlanetPopulation = planet.population;

    await increaseBlockchainTime();
    await world.contracts.core.refreshPlanet(toId);

    expect((await world.contracts.core.planets(toId)).population).to.be.above(
      initialPlanetPopulation
    );
  });

  it('should allow overpopulation', async function () {
    const fromId = hexToBigNumber(asteroid1.hex);
    const toId = hexToBigNumber(asteroid2.hex);
    await world.contracts.core.refreshPlanet(fromId);
    await world.contracts.core.refreshPlanet(toId);
    const planet2 = await world.contracts.core.planets(toId);

    const dist = 100;
    const shipsSent = 50000;
    const silverSent = 0;

    await world.user1Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent));

    await increaseBlockchainTime(200);

    await world.contracts.core.refreshPlanet(toId);

    expect((await world.contracts.core.planets(toId)).population).to.be.above(
      planet2.populationCap
    );
  });

  it('should send silver', async function () {
    const toId = hexToBigNumber(silverStar2.hex);
    const toId2 = hexToBigNumber(silverStar1.hex);

    const dist = 100;
    const shipsSent = 90000;
    const silverSent = 0;

    await world.user1Core.move(
      ...makeMoveArgs(asteroid1, silverStar2, dist, shipsSent, silverSent)
    );
    await increaseBlockchainTime();
    await world.contracts.core.refreshPlanet(toId);

    expect((await world.contracts.core.planets(toId)).silver).to.be.above(0);

    // send silver to toId2 but don't conquer it. 30000 is just enough (25000 fails)
    await world.user1Core.move(...makeMoveArgs(silverStar2, silverStar1, 0, 30000, 100));
    const oldTo2 = await world.contracts.core.planets(toId2);
    const oldSilverValue = oldTo2.silver;
    const silverCap = oldTo2.silverCap;

    await increaseBlockchainTime();
    await world.contracts.core.refreshPlanet(toId2);

    expect((await world.contracts.core.planets(toId2)).silver).to.be.above(oldSilverValue);
    expect((await world.contracts.core.planets(toId2)).silver).to.be.below(silverCap);
  });

  it('should not allow overpopulation of quasars', async function () {
    const planetId = hexToBigNumber(star1.hex);
    const quasarId = hexToBigNumber(silverBank1.hex);

    await conquerUnownedPlanet(world, world.user1Core, asteroid1, star1);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, silverBank1);

    const star1Data = await world.contracts.core.planets(planetId);
    for (let i = 0; i < 15; i++) {
      await increaseBlockchainTime();
      await world.user1Core.move(
        ...makeMoveArgs(star1, silverBank1, 0, star1Data.populationCap.toNumber() * 0.9, 0)
      );
    }

    // quasar should be full
    await increaseBlockchainTime();
    await world.contracts.core.refreshPlanet(quasarId);
    let quasarData = await world.contracts.core.planets(quasarId);
    expect(quasarData.populationCap.toNumber()).to.equal(quasarData.population.toNumber());

    // shouldn't accept any more population
    await world.user1Core.move(
      ...makeMoveArgs(star1, silverBank1, 0, star1Data.populationCap.toNumber() * 0.9, 0)
    );
    await world.contracts.core.refreshPlanet(quasarId);
    quasarData = await world.contracts.core.planets(quasarId);
    expect(quasarData.populationCap.toNumber()).to.equal(quasarData.population.toNumber());
  });
});

describe('move to enemy planet', function () {
  let world: World;

  before(async function () {
    world = await initializeWorld();

    await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));
    await world.user2Core.initializePlayer(...makeInitArgs(asteroid2));
  });

  it('should decrease population if insufficient to conquer', async function () {
    const planet2Id = hexToBigNumber(asteroid2.hex);
    const dist = 0; // instant move - just for testing correct decay application
    const shipsSent = 40000;
    const silverSent = 0;

    await increaseBlockchainTime();

    await world.user1Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent));

    const toPlanetDef = (await world.contracts.core.planets(planet2Id)).defense.toNumber();
    const planetArrival = (await world.contracts.getters.getPlanetArrivals(planet2Id))[0];
    const shipsMoved = planetArrival.popArriving.toNumber();
    const attackForce = Math.floor((shipsMoved * 100) / toPlanetDef);

    await world.contracts.core.refreshPlanet(planet2Id);

    const planet2 = await world.contracts.core.planets(planet2Id);
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

    const planet2Id = hexToBigNumber(asteroid2.hex);
    const dist = 0; // instant move - just for testing correct decay application
    const silverSent = 0;

    // drain planet first

    await world.user2Core.move(...makeMoveArgs(asteroid2, silverStar1, dist, 95000, silverSent));

    await world.contracts.core.refreshPlanet(planet2Id);
    let planet2 = await world.contracts.core.planets(planet2Id);
    const planet2Pop = planet2.population.toNumber();
    const planet2Def = planet2.defense.toNumber();
    const defenseForce = Math.floor((planet2Pop * planet2Def) / 100);

    await world.user1Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, 50000, silverSent));

    const planetArrival = (await world.contracts.getters.getPlanetArrivals(planet2Id))[0];
    const shipsMoved = planetArrival.popArriving.toNumber();

    await world.contracts.core.refreshPlanet(planet2Id);
    planet2 = await world.contracts.core.planets(planet2Id);

    expect(planet2.owner).to.equal(world.user1.address);

    // range of tolerances
    expect(planet2.population.toNumber()).to.be.above(shipsMoved - defenseForce - 1000);
    expect(planet2.population.toNumber()).to.be.below(shipsMoved - defenseForce + 1000);
  });

  it('should send silver', async function () {
    await increaseBlockchainTime();

    const planet2Id = hexToBigNumber(silverStar2.hex);
    const dist = 100;
    const silverSent = 100;

    await world.user1Core.move(...makeMoveArgs(asteroid2, silverStar2, dist, 99999, 0));
    await increaseBlockchainTime();
    await world.user2Core.move(...makeMoveArgs(silverStar1, silverStar2, dist, 99999, silverSent));
    await increaseBlockchainTime();
    await world.contracts.core.refreshPlanet(planet2Id);

    const planet2 = await world.contracts.core.planets(planet2Id);
    expect(planet2.silver).to.be.above(0);
  });
});

describe('reject move with insufficient resources', function () {
  let world: World;

  beforeEach(async function () {
    world = await initializeWorld();

    await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));
  });

  // tried to send more silver than you had
  it('should reject if moving more silver than what the planet has', async function () {
    const dist = 100;
    const shipsSent = 40000;
    const silverSent = 100;

    await expect(
      world.user1Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent))
    ).to.be.revertedWith('Tried to move more silver than what exists');
  });

  // tried to send more pop than you had
  it('should reject if moving more population than what the planet has', async function () {
    const dist = 100;
    const shipsSent = 99999999999;
    const silverSent = 0;

    await expect(
      world.user1Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent))
    ).to.be.revertedWith('Tried to move more population that what exists');
  });

  // tried to send an amount of pop that would result in 0 arriving forces
  it('should reject if moving population that results in 0 arriving forces', async function () {
    const dist = 100;
    const shipsSent = 100;
    const silverSent = 0;

    await expect(
      world.user1Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent))
    ).to.be.revertedWith('Not enough forces to make move');
  });

  it('should reject if moving from planet not owned', async function () {
    const dist = 100;
    const shipsSent = 50000;
    const silverSent = 0;

    await world.user2Core.initializePlayer(...makeInitArgs(asteroid2));

    await expect(
      world.user1Core.move(...makeMoveArgs(asteroid2, asteroid1, dist, shipsSent, silverSent))
    ).to.be.revertedWith('Only owner account can perform operation on planets');
  });

  it('should reject if moving out of radius', async function () {
    const dist = 100;
    const shipsSent = 50000;
    const silverSent = 0;

    await expect(
      world.user1Core.move(
        ...makeMoveArgs(asteroid1, outOfBoundsLocation, dist, shipsSent, silverSent)
      )
    ).to.be.revertedWith('Attempting to move out of bounds');
  });
});

describe('move rate limits', function () {
  let world: World;

  beforeEach(async function () {
    world = await initializeWorld();

    await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));
    await world.user2Core.initializePlayer(...makeInitArgs(asteroid2));

    // conquer the star
    for (let i = 0; i < 2; i++) {
      await increaseBlockchainTime();

      await world.user1Core.move(...makeMoveArgs(asteroid1, star1, 0, 90000, 0));
    }
    await increaseBlockchainTime();
  });

  it("don't allow 7th incoming arrival until at least one has finished", async function () {
    const star1Id = hexToBigNumber(star1.hex);
    const from = await world.contracts.core.planets(star1Id);

    const moveArgs = makeMoveArgs(
      star1,
      asteroid1,
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
    const planet3 = hexToBigNumber(star1.hex);
    const from = await world.contracts.core.planets(planet3);

    for (let i = 0; i < 6; i++) {
      await world.user1Core.move(
        ...makeMoveArgs(
          star1,
          asteroid2,
          from.range.toNumber(),
          from.populationCap.toNumber() / 8,
          0
        )
      );
    }

    await expect(
      world.user1Core.move(
        ...makeMoveArgs(
          star1,
          asteroid2,
          from.range.toNumber(),
          from.populationCap.toNumber() / 8,
          0
        )
      )
    ).to.be.revertedWith('Planet is rate-limited');
  });

  it('should allow owner to move to planet even if there are 7 enemy arrivals', async function () {
    const planet3 = hexToBigNumber(star1.hex);
    const planet2 = hexToBigNumber(asteroid2.hex);
    const enemyFrom = await world.contracts.core.planets(planet2);
    const myFrom = await world.contracts.core.planets(planet3);

    for (let i = 0; i < 6; i++) {
      await world.user2Core.move(
        ...makeMoveArgs(
          asteroid2,
          asteroid1,
          enemyFrom.range.toNumber(),
          enemyFrom.populationCap.toNumber() / 8,
          0
        )
      );
    }
    for (let i = 0; i < 6; i++) {
      await world.user1Core.move(
        ...makeMoveArgs(
          star1,
          asteroid1,
          myFrom.range.toNumber(),
          myFrom.populationCap.toNumber() / 8,
          0
        )
      );
    }
  });
});
