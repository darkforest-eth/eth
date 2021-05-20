import { expect } from 'chai';
import {
  hexToBigNumber,
  increaseBlockchainTime,
  makeInitArgs,
  makeRevealArgs,
} from './utils/TestUtils';
import { asteroid1, asteroid2, invalidPlanet } from './utils/WorldConstants';
import { initializeWorld, World } from './utils/TestWorld';

describe('DarkForestReveal', function () {
  let world: World;

  beforeEach(async function () {
    world = await initializeWorld();
    const initArgs = makeInitArgs(asteroid1);

    await world.user1Core.initializePlayer(...initArgs);
  });

  it("allows player to reveal location of planet that doesn't exist in contract yet", async function () {
    const x = 10;
    const y = 20;
    await world.user1Core.revealLocation(...makeRevealArgs(asteroid2, x, y));
    const revealedCoords = await world.contracts.core.revealedCoords(hexToBigNumber(asteroid2.hex));
    expect(revealedCoords.x.toNumber()).to.equal(x);
    expect(revealedCoords.y.toNumber()).to.equal(y);
    expect(revealedCoords.revealer).to.equal(world.user1.address);
    await expect((await world.contracts.core.getNRevealedPlanets()).toNumber()).to.equal(1);
    await expect(await world.contracts.core.revealedPlanetIds(0)).to.be.equal(
      hexToBigNumber(asteroid2.hex)
    );
  });

  it('allows player to reveal location of planet owned by another player', async function () {
    const initArgs = makeInitArgs(asteroid2);
    await world.user2Core.initializePlayer(...initArgs);

    const x = 10;
    const y = 20;
    await world.user1Core.revealLocation(...makeRevealArgs(asteroid2, x, y));
    const revealedCoords = await world.contracts.core.revealedCoords(hexToBigNumber(asteroid2.hex));
    expect(revealedCoords.x.toNumber()).to.equal(x);
    expect(revealedCoords.y.toNumber()).to.equal(y);
    await expect((await world.contracts.core.getNRevealedPlanets()).toNumber()).to.equal(1);
    await expect(await world.contracts.core.revealedPlanetIds(0)).to.be.equal(
      hexToBigNumber(asteroid2.hex)
    );
  });

  it('allows player to reveal location of planet owned by self', async function () {
    const x = 10;
    const y = 20;
    await world.user1Core.revealLocation(...makeRevealArgs(asteroid1, x, y));
    const revealedCoords = await world.contracts.core.revealedCoords(hexToBigNumber(asteroid1.hex));
    expect(revealedCoords.x.toNumber()).to.equal(x);
    expect(revealedCoords.y.toNumber()).to.equal(y);
    await expect((await world.contracts.core.getNRevealedPlanets()).toNumber()).to.equal(1);
    await expect(await world.contracts.core.revealedPlanetIds(0)).to.be.equal(
      hexToBigNumber(asteroid1.hex)
    );
  });

  it("player can't reveal location of second planet without waiting for cooldown", async function () {
    await world.contracts.core.changeLocationRevealCooldown(60);

    const x1 = 30;
    const y1 = 40;
    const x2 = 10;
    const y2 = 20;
    await world.user1Core.revealLocation(...makeRevealArgs(asteroid2, x2, y2));
    await expect(
      world.user1Core.revealLocation(...makeRevealArgs(asteroid1, x1, y1))
    ).to.be.revertedWith('wait for cooldown before revealing again');

    await increaseBlockchainTime();
    await world.user1Core.revealLocation(...makeRevealArgs(asteroid1, x1, y1));
    await expect((await world.contracts.core.getNRevealedPlanets()).toNumber()).to.equal(2);
  });

  it("player can't reveal invalid location that doesn't already exist in contract", async function () {
    const x = 30;
    const y = 40;
    await expect(
      world.user1Core.revealLocation(...makeRevealArgs(invalidPlanet, x, y))
    ).to.be.revertedWith('Not a valid planet location');
  });

  it("can't reveal same location twice", async function () {
    await world.contracts.core.changeLocationRevealCooldown(60);

    const x = 30;
    const y = 40;
    await world.user1Core.revealLocation(...makeRevealArgs(asteroid1, x, y));
    await increaseBlockchainTime();
    await expect(
      world.user1Core.revealLocation(...makeRevealArgs(asteroid1, x, y))
    ).to.be.revertedWith('Location already revealed');

    await expect((await world.contracts.core.getNRevealedPlanets()).toNumber()).to.equal(1);
  });

  it('player must pass in valid perlin flags for zk checks', async function () {
    const x = 10;
    const y = 20;
    const args = makeRevealArgs(asteroid1, x, y);
    args[3][4] = parseInt(args[3][4].toString()) + 1;
    await expect(world.user1Core.revealLocation(...args)).to.be.revertedWith(
      'bad planethash mimc key'
    );
  });
});
