import { expect } from 'chai';
import { fixtureLoader, makeInitArgs, makeRevealArgs, ZERO_ADDRESS } from './utils/TestUtils';
import { defaultWorldFixture, World } from './utils/TestWorld';
import {
  ADMIN_PLANET,
  ADMIN_PLANET_CLOAKED,
  INVALID_PLANET,
  INVALID_TOO_CLOSE_SPAWN,
  INVALID_TOO_FAR_SPAWN,
  LVL0_PLANET_DEEP_SPACE,
  LVL0_PLANET_OUT_OF_BOUNDS,
  LVL1_PLANET_NEBULA,
  SPAWN_PLANET_1,
  SPAWN_PLANET_2,
} from './utils/WorldConstants';

describe('DarkForestInit', function () {
  let world: World;

  beforeEach('load fixture', async function () {
    world = await fixtureLoader(defaultWorldFixture);
  });

  it('initializes player successfully with the correct planet value', async function () {
    await expect(world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1)))
      .to.emit(world.contract, 'PlayerInitialized')
      .withArgs(world.user1.address, SPAWN_PLANET_1.id.toString());

    const planetData = await world.contract.planets(SPAWN_PLANET_1.id);

    await expect((await world.contract.players(world.user1.address)).isInitialized).equal(true);
    expect(planetData.owner).to.equal(world.user1.address);
    expect(planetData.population).to.be.equal('50000');
    expect(planetData.populationCap).to.be.equal('100000');
    expect(planetData.planetType).to.be.equal(0); // regular planet
    expect(planetData.isHomePlanet).to.be.equal(true);
  });

  it('rejects player trying to initialize a second time', async function () {
    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));

    await expect(
      world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_2))
    ).to.be.revertedWith('Player is already initialized');
  });

  it('rejects player trying to initialize on existing planet', async function () {
    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));

    await expect(
      world.user2Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1))
    ).to.be.revertedWith('Planet is already initialized');
  });

  it('rejects player trying to initialize on invalid planet location', async function () {
    await expect(
      world.user1Core.initializePlayer(...makeInitArgs(INVALID_PLANET))
    ).to.be.revertedWith('Not a valid planet location');
  });

  it('rejects player trying to initialize on planet level above 0', async function () {
    await expect(
      world.user1Core.initializePlayer(...makeInitArgs(LVL1_PLANET_NEBULA))
    ).to.be.revertedWith('Can only initialize on planet level 0');
  });

  it('rejects player trying to init out of bounds', async function () {
    await expect(
      world.user1Core.initializePlayer(
        ...makeInitArgs(LVL0_PLANET_OUT_OF_BOUNDS, INVALID_TOO_FAR_SPAWN)
      )
    ).to.be.revertedWith('Init radius is bigger than the current world radius');
  });

  it('rejects player trying to initialize out of init perlin bounds', async function () {
    await expect(
      world.user1Core.initializePlayer(...makeInitArgs(LVL0_PLANET_DEEP_SPACE))
    ).to.be.revertedWith(
      'Init not allowed in perlin value greater than or equal to the INIT_PERLIN_MAX'
    );
  });

  it('rejects player trying to initialize inside the valid spawn ring', async function () {
    await expect(
      world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1, INVALID_TOO_CLOSE_SPAWN))
    ).to.be.revertedWith('Player can only spawn at the universe rim');
  });

  it('changes the spawn radius as the world grows', async function () {
    await expect(world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1)))
      .to.emit(world.contract, 'PlayerInitialized')
      .withArgs(world.user1.address, SPAWN_PLANET_1.id.toString());

    const tx = await world.contract.adminSetWorldRadius(INVALID_TOO_FAR_SPAWN);
    await tx.wait();

    await expect(
      world.user2Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_2, INVALID_TOO_FAR_SPAWN))
    )
      .to.emit(world.contract, 'PlayerInitialized')
      .withArgs(world.user2.address, SPAWN_PLANET_2.id.toString());
  });

  it('allows initialization while paused', async function () {
    await world.contract.pause();

    // Ensure world is paused for this test
    await expect(await world.contract.paused()).equal(true);

    await expect((await world.contract.players(world.user1.address)).isInitialized).equal(false);

    await expect(world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1)))
      .to.emit(world.contract, 'PlayerInitialized')
      .withArgs(world.user1.address, SPAWN_PLANET_1.id.toString());

    await expect((await world.contract.players(world.user1.address)).isInitialized).equal(true);
    await expect((await world.contract.planets(SPAWN_PLANET_1.id)).owner).to.equal(
      world.user1.address
    );
    await expect((await world.contract.planets(SPAWN_PLANET_1.id)).population).to.be.equal('50000');
    await expect((await world.contract.planets(SPAWN_PLANET_1.id)).populationCap).to.be.equal(
      '100000'
    );
  });

  it('allows admin to create a planet with arbitrary location, perlin, type, level', async function () {
    const perlin = 20;
    const level = 5;
    const planetType = 1; // asteroid field
    await world.contract.createPlanet({
      location: ADMIN_PLANET.id,
      perlin,
      level,
      planetType,
      requireValidLocationId: true,
    });

    const adminPlanetData = await world.contract.planets(ADMIN_PLANET.id);
    const adminPlanetInfo = await world.contract.planetsExtendedInfo(ADMIN_PLANET.id);
    expect(adminPlanetData.owner).to.equal(ZERO_ADDRESS);
    expect(adminPlanetData.planetLevel.toNumber()).to.equal(level);
    expect(adminPlanetData.planetType).to.equal(planetType);
    expect(adminPlanetInfo.perlin.toNumber()).to.equal(perlin);

    // compare to a newly initialized planet
    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));
    const user1Planet = await world.contract.planets(SPAWN_PLANET_1.id);
    expect(adminPlanetData.populationCap.toNumber()).to.be.greaterThan(
      user1Planet.populationCap.toNumber()
    );
  });

  it('allows admin to create a cloaked planet only if requireValidLocationId set to false', async function () {
    const perlin = 20;
    const planetType = 1; // asteroid field
    const level = 5;

    // should fail
    await expect(
      world.contract.createPlanet({
        location: ADMIN_PLANET_CLOAKED.id,
        perlin,
        level,
        planetType,
        requireValidLocationId: true,
      })
    ).to.be.revertedWith('Not a valid planet location');

    // should succeed
    world.contract.createPlanet({
      location: ADMIN_PLANET_CLOAKED.id,
      perlin,
      level,
      planetType,
      requireValidLocationId: false,
    });
  });
  it('allows admin to create a planet whose location is revealed', async function () {
    const perlin = 20;
    const level = 5;
    const planetType = 1; // asteroid field
    const x = 10;
    const y = 20;
    await world.contract.createPlanet({
      location: ADMIN_PLANET.id,
      perlin,
      level,
      planetType,
      requireValidLocationId: true,
    });

    await world.contract.revealLocation(...makeRevealArgs(ADMIN_PLANET, x, y));

    const revealedCoords = await world.contract.revealedCoords(ADMIN_PLANET.id);
    expect(revealedCoords.x.toNumber()).to.equal(x);
    expect(revealedCoords.y.toNumber()).to.equal(y);
    await expect((await world.contract.getNRevealedPlanets()).toNumber()).to.equal(1);
    await expect(await world.contract.revealedPlanetIds(0)).to.be.equal(ADMIN_PLANET.id);
  });

  it('allows admin to create a planet with invalid location ID whose location is revealed', async function () {
    const perlin = 20;
    const level = 5;
    const planetType = 1; // asteroid field
    const x = 10;
    const y = 20;
    await world.contract.createPlanet({
      location: ADMIN_PLANET_CLOAKED.id,
      perlin,
      level,
      planetType,
      requireValidLocationId: false,
    });

    await world.contract.revealLocation(...makeRevealArgs(ADMIN_PLANET_CLOAKED, x, y));

    const revealedCoords = await world.contract.revealedCoords(ADMIN_PLANET_CLOAKED.id);
    expect(revealedCoords.x.toNumber()).to.equal(x);
    expect(revealedCoords.y.toNumber()).to.equal(y);
    await expect((await world.contract.getNRevealedPlanets()).toNumber()).to.equal(1);
    await expect(await world.contract.revealedPlanetIds(0)).to.be.equal(ADMIN_PLANET_CLOAKED.id);
  });
});
