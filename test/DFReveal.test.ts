import { expect } from 'chai';
import {
  fixtureLoader,
  increaseBlockchainTime,
  makeInitArgs,
  makeRevealArgs,
} from './utils/TestUtils';
import { defaultWorldFixture, World } from './utils/TestWorld';
import { INVALID_PLANET, SPAWN_PLANET_1, SPAWN_PLANET_2 } from './utils/WorldConstants';

describe('DarkForestReveal', function () {
  let world: World;

  async function worldFixture() {
    const world = await fixtureLoader(defaultWorldFixture);
    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));
    return world;
  }

  beforeEach('load fixture', async function () {
    world = await fixtureLoader(worldFixture);
  });

  it("allows player to reveal location of planet that doesn't exist in contract yet", async function () {
    const x = 10;
    const y = 20;
    await world.user1Core.revealLocation(...makeRevealArgs(SPAWN_PLANET_2, x, y));
    const revealedCoords = await world.contract.revealedCoords(SPAWN_PLANET_2.id);
    expect(revealedCoords.x.toNumber()).to.equal(x);
    expect(revealedCoords.y.toNumber()).to.equal(y);
    expect(revealedCoords.revealer).to.equal(world.user1.address);
    await expect((await world.contract.getNRevealedPlanets()).toNumber()).to.equal(1);
    await expect(await world.contract.revealedPlanetIds(0)).to.be.equal(SPAWN_PLANET_2.id);
  });

  it('allows player to reveal location of planet owned by another player', async function () {
    const initArgs = makeInitArgs(SPAWN_PLANET_2);
    await world.user2Core.initializePlayer(...initArgs);

    const x = 10;
    const y = 20;
    await world.user1Core.revealLocation(...makeRevealArgs(SPAWN_PLANET_2, x, y));
    const revealedCoords = await world.contract.revealedCoords(SPAWN_PLANET_2.id);
    expect(revealedCoords.x.toNumber()).to.equal(x);
    expect(revealedCoords.y.toNumber()).to.equal(y);
    await expect((await world.contract.getNRevealedPlanets()).toNumber()).to.equal(1);
    await expect(await world.contract.revealedPlanetIds(0)).to.be.equal(SPAWN_PLANET_2.id);
  });

  it('allows player to reveal location of planet owned by self', async function () {
    const x = 10;
    const y = 20;
    await world.user1Core.revealLocation(...makeRevealArgs(SPAWN_PLANET_1, x, y));
    const revealedCoords = await world.contract.revealedCoords(SPAWN_PLANET_1.id);
    expect(revealedCoords.x.toNumber()).to.equal(x);
    expect(revealedCoords.y.toNumber()).to.equal(y);
    await expect((await world.contract.getNRevealedPlanets()).toNumber()).to.equal(1);
    await expect(await world.contract.revealedPlanetIds(0)).to.be.equal(SPAWN_PLANET_1.id);
  });

  it("player can't reveal location of second planet without waiting for cooldown", async function () {
    await world.contract.changeLocationRevealCooldown(60);

    const x1 = 30;
    const y1 = 40;
    const x2 = 10;
    const y2 = 20;
    await world.user1Core.revealLocation(...makeRevealArgs(SPAWN_PLANET_2, x2, y2));
    await expect(
      world.user1Core.revealLocation(...makeRevealArgs(SPAWN_PLANET_1, x1, y1))
    ).to.be.revertedWith('wait for cooldown before revealing again');

    await increaseBlockchainTime();
    await world.user1Core.revealLocation(...makeRevealArgs(SPAWN_PLANET_1, x1, y1));
    await expect((await world.contract.getNRevealedPlanets()).toNumber()).to.equal(2);
  });

  it("player can't reveal invalid location that doesn't already exist in contract", async function () {
    const x = 30;
    const y = 40;
    await expect(
      world.user1Core.revealLocation(...makeRevealArgs(INVALID_PLANET, x, y))
    ).to.be.revertedWith('Not a valid planet location');
  });

  it("can't reveal same location twice", async function () {
    await world.contract.changeLocationRevealCooldown(60);

    const x = 30;
    const y = 40;
    await world.user1Core.revealLocation(...makeRevealArgs(SPAWN_PLANET_1, x, y));
    await increaseBlockchainTime();
    await expect(
      world.user1Core.revealLocation(...makeRevealArgs(SPAWN_PLANET_1, x, y))
    ).to.be.revertedWith('Location already revealed');

    await expect((await world.contract.getNRevealedPlanets()).toNumber()).to.equal(1);
  });

  it('player must pass in valid perlin flags for zk checks', async function () {
    const x = 10;
    const y = 20;
    const args = makeRevealArgs(SPAWN_PLANET_1, x, y);
    args[3][4] = parseInt(args[3][4].toString()) + 1;
    await expect(world.user1Core.revealLocation(...args)).to.be.revertedWith(
      'bad planethash mimc key'
    );
  });
});
