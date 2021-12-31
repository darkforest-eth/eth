import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers, initializers } from 'hardhat';
import {
  conquerUnownedPlanet,
  fixtureLoader,
  increaseBlockchainTime,
  makeInitArgs,
  makeMoveArgs,
  getCurrentTime,
  feedSilverToCap,
  shrinkAlgorithm
} from './utils/TestUtils';
import { defaultWorldFixture, growingWorldFixture, shrinkingWorldFixture, World } from './utils/TestWorld';
import {
  LVL1_ASTEROID_1,
  SMALL_INTERVAL,
  SPAWN_PLANET_1,
  SPAWN_PLANET_2,
  shrinkingInitializers,
  INVALID_TOO_CLOSE_SPAWN,
  LVL3_SPACETIME_1,
} from './utils/WorldConstants';

const { BigNumber: BN } = ethers;

describe('DarkForestShrink', function () {
  let world: World;

  describe('in a shrinking universe', async function () {
    let initialRadius: BigNumber;
    let time: number

    beforeEach(async function () {
      world = await fixtureLoader(shrinkingWorldFixture);

      time = await getCurrentTime();

      await world.contracts.core.setShrinkStart(time);
      await world.contracts.core.setRoundEnd(time + 5000);
      await world.contracts.core.adminSetWorldRadius(shrinkingInitializers.INITIAL_WORLD_RADIUS);

      await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1, SPAWN_PLANET_1.distFromOrigin));
    });

    it('should decrease radius size after move', async function () {
      const initRadius = await world.contracts.core.worldRadius();
      await increaseBlockchainTime(500);

      // Recall that universe will only shrink when a player makes a move.
      await world.user1Core.move(
        ...makeMoveArgs(SPAWN_PLANET_1, SPAWN_PLANET_2, 0, 40000, 0)
      );    

      const radius = shrinkAlgorithm(time, time + 5000, time + 500);
      console.log("radius from algo", radius)

      const currRadius = await world.contracts.core.worldRadius();
      console.log("radius from chain", currRadius.toNumber());
      expect(currRadius.toNumber()).lessThan(initRadius.toNumber());
    });

    it('rejects a player spawning outside of middle ring', async function () {
      const initRadius = await world.contracts.core.worldRadius();
      await expect(
        world.user2Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_2, initRadius.toNumber()))
      ).to.be.revertedWith("Init radius is too high");
    });
  
    it('rejects a player spawning inside of middle ring', async function () {
      await expect(
        world.user2Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_2, 0))
      ).to.be.revertedWith("Init radius is too low");
    });

    it('accepts a player spawning in middle ring and shrinks radius', async function () {
      const initRadius = await world.contracts.core.worldRadius();
      await increaseBlockchainTime(500);

      await expect(world.user2Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_2, SPAWN_PLANET_2.distFromOrigin)))
        .to.emit(world.contracts.core, 'PlayerInitialized')
        .withArgs(world.user2.address, SPAWN_PLANET_2.id.toString());

      const currRadius = await world.contracts.core.worldRadius();
      expect(currRadius.toNumber()).lessThan(initRadius.toNumber());
    });

    it('radius cant go below minRadius', async function () {
      const minRadius = (await world.contracts.core.gameConstants()).MIN_RADIUS;
      const initRadius = (await world.contracts.core.worldRadius()).toNumber();

      await increaseBlockchainTime();

      const currRadius = (await world.contracts.core.worldRadius()).toNumber();

      expect(currRadius).to.equal(initRadius);

      // player initializes before radius is shrunk. 
      // hopefully this is taken care of by spawning in middle ring.
      await expect(world.user2Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_2, Math.floor(currRadius / 2))))
        .to.emit(world.contracts.core, 'PlayerInitialized')
        .withArgs(world.user2.address, SPAWN_PLANET_2.id.toString());

      const finalRadius = await world.contracts.core.worldRadius();
      console.log("finalRadius ", finalRadius.toNumber());
      expect(finalRadius.toNumber()).to.equal(minRadius.toNumber());
    });
  

  });

  describe('in a manually shrinking universe', async function () {
    let initialRadius: BigNumber;

    beforeEach(async function () {
      world = await fixtureLoader(defaultWorldFixture);

      // await world.contracts.core.adminSetWorldRadius(initializers.INITIAL_WORLD_RADIUS);
      await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));

      // Conquer MINE_REGULAR and LVL3_SPACETIME_1 to accumulate silver
      await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL1_ASTEROID_1);
      await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL3_SPACETIME_1);
  
      // Fill up LVL3_SPACETIME_1 with silvers
      await feedSilverToCap(world, world.user1Core, LVL1_ASTEROID_1, LVL3_SPACETIME_1);
  
    });

    it('should allow a silver withdrawal from outside of radius', async function () {
      const withdrawnAmount = (await world.contracts.core.planets(LVL3_SPACETIME_1.id)).silverCap;

      expect(
        await world.contracts.core.adminSetWorldRadius(SPAWN_PLANET_1.distFromOrigin - 10)
      ).to.emit(world.user1Core, "RadiusUpdated")
      .withArgs(SPAWN_PLANET_1.distFromOrigin - 10);
      
      const radius = (await world.user1Core.worldRadius()).toNumber();
      expect(radius).to.equal(SPAWN_PLANET_1.distFromOrigin - 10);

      await expect(world.user1Core.withdrawSilver(LVL3_SPACETIME_1.id, withdrawnAmount))
      .to.emit(world.contracts.core, 'PlanetSilverWithdrawn')
      .withArgs(world.user1.address, LVL3_SPACETIME_1.id, withdrawnAmount);

    expect(
      (await world.contracts.core.players(world.user1.address)).score)
      .to.equal(withdrawnAmount.div(1000));
    });  

    it('should reject a move to outside of radius', async function () {
      const dist = 100;
      const shipsSent = 50000;
      const silverSent = 0;

      await world.contracts.core.adminSetWorldRadius(SPAWN_PLANET_1.distFromOrigin - 10);
      const radius = (await world.user1Core.worldRadius()).toNumber();

      await expect(
        world.user1Core.move(
          ...makeMoveArgs(SPAWN_PLANET_1, LVL3_SPACETIME_1, dist, shipsSent, silverSent)
        )
      ).to.be.revertedWith('Attempting to move out of bounds');
      });
  });
});


