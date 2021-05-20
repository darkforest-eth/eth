import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  hexToBigNumber,
  increaseBlockchainTime,
  makeInitArgs,
  makeMoveArgs,
} from './utils/TestUtils';
import { asteroid1, asteroid2, asteroid3 } from './utils/WorldConstants';
import { initializeWorld, World } from './utils/TestWorld';

const { BigNumber: BN } = ethers;

describe('DarkForestTransferOwnership', function () {
  describe('transfering, moving, transfering back, moving again', function () {
    let world: World;

    before(async function () {
      world = await initializeWorld();
      await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));
    });

    it("can't move forces from planet you don't own", async function () {
      const dist = 100;
      const shipsSent = 40000;
      const silverSent = 100;

      await expect(
        world.user2Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent))
      ).to.be.revertedWith('Only owner account can perform operation on planets');
    });

    it('transfer to user 2, emits event on planet ownership transfer', async function () {
      const planet = hexToBigNumber(asteroid1.hex);

      await world.user2Core.initializePlayer(...makeInitArgs(asteroid3));

      await expect(world.user1Core.transferOwnership(planet, world.user2.address))
        .to.emit(world.contracts.core, 'PlanetTransferred')
        .withArgs(world.user1.address, planet, world.user2.address);
    });

    it("new planet's owner must be the new owner", async function () {
      const planet1Id = hexToBigNumber(asteroid1.hex);
      const planetExtendedInfo = await world.contracts.core.planetsExtendedInfo(planet1Id);
      await expect(planetExtendedInfo.lastUpdated).to.be.equal(
        (
          await ethers.provider.getBlock('latest')
        ).timestamp
      );

      await increaseBlockchainTime();

      await world.contracts.core.refreshPlanet(planet1Id);

      expect((await world.contracts.core.planets(planet1Id)).owner).to.be.equal(
        world.user2.address
      );
    });

    it('moving works fine by user to whom the planet was transferred', async function () {
      const dist = 100;
      const shipsSent = 40000;
      const silverSent = 0;

      await expect(
        world.user2Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent))
      )
        .to.emit(world.contracts.core, 'ArrivalQueued')
        .withArgs(
          world.user2.address,
          BN.from(1),
          BN.from('0x' + asteroid1.hex),
          BN.from('0x' + asteroid2.hex),
          BN.from(0)
        );
    });

    it('should transfer back to original owner fine', async function () {
      const planet = hexToBigNumber(asteroid1.hex);

      await expect(world.user2Core.transferOwnership(planet, world.user1.address))
        .to.emit(world.contracts.core, 'PlanetTransferred')
        .withArgs(world.user2.address, planet, world.user1.address);
    });
  });
});
