import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  fixtureLoader,
  increaseBlockchainTime,
  makeInitArgs,
  makeMoveArgs,
} from './utils/TestUtils';
import { defaultWorldFixture, noPlanetTransferFixture, World } from './utils/TestWorld';
import { LVL0_PLANET_POPCAP_BOOSTED, SPAWN_PLANET_1, SPAWN_PLANET_2 } from './utils/WorldConstants';

const { BigNumber: BN } = ethers;

describe('DarkForestTransferPlanet', function () {
  let world: World;

  describe("when transferring is disabled it doesn't work", async function () {
    before(async function () {
      world = await fixtureLoader(noPlanetTransferFixture);
      await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));
    });

    it('transfer to user 2 fails', async function () {
      const planet = SPAWN_PLANET_1.id;

      await world.user2Core.initializePlayer(...makeInitArgs(LVL0_PLANET_POPCAP_BOOSTED));

      await expect(world.user1Core.transferPlanet(planet, world.user2.address)).to.be.revertedWith(
        'planet transferring is disabled'
      );
    });
  });

  describe('transfering, moving, transfering back, moving again', function () {
    let world: World;

    before(async function () {
      world = await fixtureLoader(defaultWorldFixture);
      await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));
    });

    it("can't move forces from planet you don't own", async function () {
      const dist = 100;
      const shipsSent = 40000;
      const silverSent = 100;

      await expect(
        world.user2Core.move(
          ...makeMoveArgs(SPAWN_PLANET_1, SPAWN_PLANET_2, dist, shipsSent, silverSent)
        )
      ).to.be.revertedWith('Only owner account can perform that operation on planet.');
    });
    it('transfer to user 2, emits event on planet ownership transfer', async function () {
      const planet = SPAWN_PLANET_1.id;

      await world.user2Core.initializePlayer(...makeInitArgs(LVL0_PLANET_POPCAP_BOOSTED));

      await expect(world.user1Core.transferPlanet(planet, world.user2.address))
        .to.emit(world.contract, 'PlanetTransferred')
        .withArgs(world.user1.address, planet, world.user2.address);
    });

    it("new planet's owner must be the new owner", async function () {
      const planet1Id = SPAWN_PLANET_1.id;
      const planetExtendedInfo = await world.contract.planetsExtendedInfo(planet1Id);
      await expect(planetExtendedInfo.lastUpdated).to.be.equal(
        (
          await ethers.provider.getBlock('latest')
        ).timestamp
      );

      await increaseBlockchainTime();

      await world.contract.refreshPlanet(planet1Id);

      expect((await world.contract.planets(planet1Id)).owner).to.be.equal(world.user2.address);
    });

    it('moving works fine by user to whom the planet was transferred', async function () {
      const dist = 100;
      const shipsSent = 40000;
      const silverSent = 0;

      await expect(
        world.user2Core.move(
          ...makeMoveArgs(SPAWN_PLANET_1, SPAWN_PLANET_2, dist, shipsSent, silverSent)
        )
      )
        .to.emit(world.contract, 'ArrivalQueued')
        .withArgs(
          world.user2.address,
          BN.from(1),
          BN.from('0x' + SPAWN_PLANET_1.hex),
          BN.from('0x' + SPAWN_PLANET_2.hex),
          BN.from(0),
          BN.from(0)
        );
    });

    it('should transfer back to original owner fine', async function () {
      const planet = SPAWN_PLANET_1.id;

      await expect(world.user2Core.transferPlanet(planet, world.user1.address))
        .to.emit(world.contract, 'PlanetTransferred')
        .withArgs(world.user2.address, planet, world.user1.address);
    });
  });
});
