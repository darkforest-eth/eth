import { expect } from 'chai';
import { hexToBigNumber, makeInitArgs, makeRevealArgs, ZERO_ADDRESS } from './utils/TestUtils';
import {
  adminPlanet,
  adminPlanetCloaked,
  asteroid1,
  asteroid2,
  deepSpaceAsteroid,
  invalidPlanet,
  outOfBoundsLocation,
  star1,
} from './utils/WorldConstants';
import { initializeWorld, World } from './utils/TestWorld';

describe('DarkForestInit', function () {
  let world: World;

  beforeEach(async function () {
    world = await initializeWorld();
  });

  it('initializes player successfully with the correct planet value', async function () {
    const planetId = hexToBigNumber(asteroid1.hex);

    await expect(world.user1Core.initializePlayer(...makeInitArgs(asteroid1)))
      .to.emit(world.contracts.core, 'PlayerInitialized')
      .withArgs(world.user1.address, planetId.toString());

    const planetData = await world.contracts.core.planets(planetId);

    await expect((await world.contracts.core.players(world.user1.address)).isInitialized).equal(
      true
    );
    expect(planetData.owner).to.equal(world.user1.address);
    expect(planetData.population).to.be.equal('50000');
    expect(planetData.populationCap).to.be.equal('100000');
    expect(planetData.planetType).to.be.equal(0); // regular planet
    expect(planetData.isHomePlanet).to.be.equal(true);
  });

  it('rejects player trying to initialize a second time', async function () {
    await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));

    await expect(world.user1Core.initializePlayer(...makeInitArgs(asteroid2))).to.be.revertedWith(
      'Player is already initialized'
    );
  });

  it('rejects player trying to initialize on existing planet', async function () {
    await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));

    await expect(world.user2Core.initializePlayer(...makeInitArgs(asteroid1))).to.be.revertedWith(
      'Planet is already initialized'
    );
  });

  it('rejects player trying to initialize on invalid planet location', async function () {
    await expect(
      world.user1Core.initializePlayer(...makeInitArgs(invalidPlanet))
    ).to.be.revertedWith('Not a valid planet location');
  });

  it('rejects player trying to initialize on planet level above 0', async function () {
    await expect(world.user1Core.initializePlayer(...makeInitArgs(star1))).to.be.revertedWith(
      'Can only initialize on planet level 0'
    );
  });

  it('rejects player trying to init out of bounds', async function () {
    await expect(
      world.user1Core.initializePlayer(...makeInitArgs(outOfBoundsLocation))
    ).to.be.revertedWith('Init radius is bigger than the current world radius');
  });

  it('rejects player trying to initialize in deep space', async function () {
    await expect(
      world.user1Core.initializePlayer(...makeInitArgs(deepSpaceAsteroid))
    ).to.be.revertedWith(
      'Init not allowed in perlin value greater than or equal to the INIT_PERLIN_MAX'
    );
  });

  it('allows initialization while paused', async function () {
    await world.contracts.core.pause();

    // Ensure world is paused for this test
    await expect(await world.contracts.core.paused()).equal(true);

    await expect((await world.contracts.core.players(world.user1.address)).isInitialized).equal(
      false
    );

    const planetId = hexToBigNumber(asteroid1.hex);

    await expect(world.user1Core.initializePlayer(...makeInitArgs(asteroid1)))
      .to.emit(world.contracts.core, 'PlayerInitialized')
      .withArgs(world.user1.address, planetId.toString());

    await expect((await world.contracts.core.players(world.user1.address)).isInitialized).equal(
      true
    );
    await expect((await world.contracts.core.planets(planetId)).owner).to.equal(
      world.user1.address
    );
    await expect((await world.contracts.core.planets(planetId)).population).to.be.equal('50000');
    await expect((await world.contracts.core.planets(planetId)).populationCap).to.be.equal(
      '100000'
    );
  });

  it('allows admin to create a planet with arbitrary location, perlin, type, level', async function () {
    const planetId = hexToBigNumber(adminPlanet.hex);
    const perlin = 20;
    const level = 5;
    const planetType = 1; // asteroid field
    await world.contracts.core.createPlanet({
      location: planetId,
      perlin,
      level,
      planetType,
      requireValidLocationId: true,
    });

    const adminPlanetData = await world.contracts.core.planets(planetId);
    const adminPlanetInfo = await world.contracts.core.planetsExtendedInfo(planetId);
    expect(adminPlanetData.owner).to.equal(ZERO_ADDRESS);
    expect(adminPlanetData.planetLevel.toNumber()).to.equal(level);
    expect(adminPlanetData.planetType).to.equal(planetType);
    expect(adminPlanetInfo.perlin.toNumber()).to.equal(perlin);

    // compare to a newly initialized planet
    const user1PlanetLocation = hexToBigNumber(asteroid1.hex);
    await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));
    const user1Planet = await world.contracts.core.planets(user1PlanetLocation);
    expect(adminPlanetData.populationCap.toNumber()).to.be.greaterThan(
      user1Planet.populationCap.toNumber()
    );
  });

  it('allows admin to create a cloaked planet only if requireValidLocationId set to false', async function () {
    const planetId = hexToBigNumber(adminPlanetCloaked.hex);
    const perlin = 20;
    const planetType = 1; // asteroid field
    const level = 5;

    // should fail
    await expect(
      world.contracts.core.createPlanet({
        location: planetId,
        perlin,
        level,
        planetType,
        requireValidLocationId: true,
      })
    ).to.be.revertedWith('Not a valid planet location');

    // should succeed
    world.contracts.core.createPlanet({
      location: planetId,
      perlin,
      level,
      planetType,
      requireValidLocationId: false,
    });
  });

  it('allows admin to create a planet whose location is revealed', async function () {
    const planetId = hexToBigNumber(adminPlanet.hex);
    const perlin = 20;
    const level = 5;
    const planetType = 1; // asteroid field
    const x = 10;
    const y = 20;
    await world.contracts.core.createPlanet({
      location: planetId,
      perlin,
      level,
      planetType,
      requireValidLocationId: true,
    });

    await world.contracts.core.revealLocation(...makeRevealArgs(adminPlanet, x, y));

    const revealedCoords = await world.contracts.core.revealedCoords(planetId);
    expect(revealedCoords.x.toNumber()).to.equal(x);
    expect(revealedCoords.y.toNumber()).to.equal(y);
    await expect((await world.contracts.core.getNRevealedPlanets()).toNumber()).to.equal(1);
    await expect(await world.contracts.core.revealedPlanetIds(0)).to.be.equal(planetId);
  });

  it('allows admin to create a planet with invalid location ID whose location is revealed', async function () {
    const planetId = hexToBigNumber(adminPlanetCloaked.hex);
    const perlin = 20;
    const level = 5;
    const planetType = 1; // asteroid field
    const x = 10;
    const y = 20;
    await world.contracts.core.createPlanet({
      location: planetId,
      perlin,
      level,
      planetType,
      requireValidLocationId: false,
    });

    await world.contracts.core.revealLocation(...makeRevealArgs(adminPlanetCloaked, x, y));

    const revealedCoords = await world.contracts.core.revealedCoords(planetId);
    expect(revealedCoords.x.toNumber()).to.equal(x);
    expect(revealedCoords.y.toNumber()).to.equal(y);
    await expect((await world.contracts.core.getNRevealedPlanets()).toNumber()).to.equal(1);
    await expect(await world.contracts.core.revealedPlanetIds(0)).to.be.equal(planetId);
  });
});
