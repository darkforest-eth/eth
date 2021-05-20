import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BN_ZERO, hexToBigNumber, makeInitArgs } from './utils/TestUtils';
import { asteroid1 } from './utils/WorldConstants';
import { initializeWorld, World } from './utils/TestWorld';

describe('DarkForestHat', function () {
  let world: World;

  beforeEach(async function () {
    world = await initializeWorld();

    await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));
  });

  it('should buy hats', async function () {
    const planetId = hexToBigNumber(asteroid1.hex);

    let planetExtendedInfo = await world.contracts.core.planetsExtendedInfo(planetId);
    expect(planetExtendedInfo.hatLevel.toNumber()).to.be.equal(0);

    await world.user1Core.buyHat(planetId, {
      value: '1000000000000000000',
    });
    await world.user1Core.buyHat(planetId, {
      value: '2000000000000000000',
    });

    planetExtendedInfo = await world.contracts.core.planetsExtendedInfo(planetId);

    expect(planetExtendedInfo.hatLevel.toNumber()).to.be.equal(2);
  });

  it('should only allow owner to buy hat', async function () {
    const planetId = hexToBigNumber(asteroid1.hex);

    const planetExtendedInfo = await world.contracts.core.planetsExtendedInfo(planetId);
    expect(planetExtendedInfo.hatLevel.toNumber()).to.be.equal(0);

    await expect(
      world.user2Core.buyHat(planetId, {
        value: '1000000000000000000',
      })
    ).to.be.revertedWith('Only owner can buy hat for planet');
  });

  it('should not buy hat with insufficient value', async function () {
    const planetId = hexToBigNumber(asteroid1.hex);
    const planetExtendedInfo = await world.contracts.core.planetsExtendedInfo(planetId);

    expect(planetExtendedInfo.hatLevel.toNumber()).to.be.equal(0);

    await world.user1Core.buyHat(planetId, {
      value: '1000000000000000000',
    });
    await expect(
      world.user1Core.buyHat(planetId, {
        value: '1500000000000000000',
      })
    ).to.be.revertedWith('Insufficient value sent');
  });

  it('should allow admin to withdraw all funds', async function () {
    const planetId = hexToBigNumber(asteroid1.hex);
    await world.user1Core.buyHat(planetId, {
      value: '1000000000000000000',
    });

    await world.contracts.core.withdraw();

    expect(await ethers.provider.getBalance(world.contracts.core.address)).to.equal(BN_ZERO);
  });

  it('should not allow non-admin to withdraw funds', async function () {
    const planetId = hexToBigNumber(asteroid1.hex);

    await world.user1Core.buyHat(planetId, {
      value: '1000000000000000000',
    });

    await expect(world.user1Core.withdraw()).to.be.revertedWith('Sender is not a game master');
  });
});
