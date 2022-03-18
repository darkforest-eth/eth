import { ArtifactRarity, ArtifactType, Biome } from '@darkforest_eth/types';
import { expect } from 'chai';
import { BigNumberish } from 'ethers';
import hre from 'hardhat';
import { TestLocation } from './utils/TestLocation';
import {
  conquerUnownedPlanet,
  createArtifactOnPlanet,
  fixtureLoader,
  getArtifactsOwnedBy,
  getCurrentTime,
  getStatSum,
  hexToBigNumber,
  increaseBlockchainTime,
  makeFindArtifactArgs,
  makeInitArgs,
  makeMoveArgs,
  user1MintArtifactPlanet,
  ZERO_ADDRESS,
} from './utils/TestUtils';
import { defaultWorldFixture, World } from './utils/TestWorld';
import {
  ARTIFACT_PLANET_1,
  LVL0_PLANET,
  LVL0_PLANET_DEAD_SPACE,
  LVL3_SPACETIME_1,
  LVL3_SPACETIME_2,
  LVL3_SPACETIME_3,
  LVL3_UNOWNED_NEBULA,
  LVL4_UNOWNED_DEEP_SPACE,
  LVL6_SPACETIME,
  SPACE_PERLIN,
  SPAWN_PLANET_1,
  SPAWN_PLANET_2,
} from './utils/WorldConstants';

describe('DarkForestArtifacts', function () {
  let world: World;

  async function worldFixture() {
    const world = await fixtureLoader(defaultWorldFixture);

    // Initialize player
    await world.user1Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_1));
    await world.user1Core.giveSpaceShips(SPAWN_PLANET_1.id);
    await world.user2Core.initializePlayer(...makeInitArgs(SPAWN_PLANET_2));

    // Conquer initial planets
    //// Player 1
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, ARTIFACT_PLANET_1);
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL3_SPACETIME_1);
    //// Player 2
    await conquerUnownedPlanet(world, world.user2Core, SPAWN_PLANET_2, LVL3_SPACETIME_2);
    await increaseBlockchainTime();

    // Move the Gear ship into position
    const gearShip = (await world.user1Core.getArtifactsOnPlanet(SPAWN_PLANET_1.id)).find(
      (a) => a.artifact.artifactType === ArtifactType.ShipGear
    );
    const gearId = gearShip?.artifact.id;
    await world.user1Core.move(
      ...makeMoveArgs(SPAWN_PLANET_1, ARTIFACT_PLANET_1, 100, 0, 0, gearId)
    );
    await increaseBlockchainTime();
    await world.user1Core.refreshPlanet(ARTIFACT_PLANET_1.id);

    // Conquer another planet for artifact storage
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL0_PLANET_DEAD_SPACE);

    return world;
  }

  beforeEach('load fixture', async function () {
    this.timeout(0);
    world = await fixtureLoader(worldFixture);
  });

  async function getArtifactsOnPlanet(world: World, locationId: BigNumberish) {
    return (await world.contract.getArtifactsOnPlanet(locationId))
      .map((metadata) => metadata.artifact)
      .filter((artifact) => artifact.artifactType < ArtifactType.ShipMothership);
  }

  it('be able to mint artifact on ruins, activate/buff, deactivate/debuff', async function () {
    const statSumInitial = getStatSum(await world.contract.planets(ARTIFACT_PLANET_1.id));

    await user1MintArtifactPlanet(world.user1Core);

    const statSumAfterFound = getStatSum(await world.contract.planets(ARTIFACT_PLANET_1.id));

    // artifact should be on planet
    const artifactsOnPlanet = await getArtifactsOnPlanet(world, ARTIFACT_PLANET_1.id);
    expect(artifactsOnPlanet.length).to.be.equal(1);

    // artifact should be owned by contract
    expect(artifactsOnPlanet[0].discoverer).to.eq(world.user1.address);

    // let's update the planet to be one of the basic artifacts, so that
    // we know it's definitely going to buff the planet in some way. also,
    // this prevents the artifact from being one that requires valid parameter
    // in order to activate
    const updatedArtifact = Object.assign({}, artifactsOnPlanet[0]);
    updatedArtifact.artifactType = 0;
    await world.contract.updateArtifact(updatedArtifact);

    // planet should be buffed after discovered artifact
    await world.user1Core.activateArtifact(ARTIFACT_PLANET_1.id, artifactsOnPlanet[0].id, 0);
    const statSumAfterActivation = getStatSum(await world.contract.planets(ARTIFACT_PLANET_1.id));

    // planet buff should be removed after artifact deactivated
    await world.user1Core.deactivateArtifact(ARTIFACT_PLANET_1.id);
    const statSumAfterDeactivate = getStatSum(await world.contract.planets(ARTIFACT_PLANET_1.id));

    expect(statSumAfterActivation).to.not.be.within(statSumInitial - 5, statSumInitial + 5);
    expect(statSumAfterActivation).to.not.be.within(
      statSumAfterDeactivate - 5,
      statSumAfterDeactivate + 5
    );
    expect(statSumAfterDeactivate).to.be.within(statSumInitial - 5, statSumInitial + 5);
    expect(statSumAfterFound).to.be.within(statSumInitial - 5, statSumInitial + 5);
  });

  it('cannot prospect multiple times, cannot find artifact more than 256 blocks after prospecting', async function () {
    await world.user1Core.prospectPlanet(ARTIFACT_PLANET_1.id);

    await expect(world.user1Core.prospectPlanet(ARTIFACT_PLANET_1.id)).to.be.revertedWith(
      'this planet has already been prospected'
    );

    for (let i = 0; i < 256; i++) {
      await increaseBlockchainTime();
    }

    await expect(
      world.user1Core.findArtifact(...makeFindArtifactArgs(ARTIFACT_PLANET_1))
    ).to.be.revertedWith('planet prospect expired');
  });

  it('should return a correct token uri for a minted artifact', async function () {
    await world.user1Core.prospectPlanet(ARTIFACT_PLANET_1.id);
    await increaseBlockchainTime();
    await world.user1Core.findArtifact(...makeFindArtifactArgs(ARTIFACT_PLANET_1));

    const artifactsOnPlanet = await world.contract.planetArtifacts(ARTIFACT_PLANET_1.id);
    const tokenUri = await world.contract.tokenURI(artifactsOnPlanet[0]);

    const networkId = hre.network.config.chainId;
    const contractAddress = world.contract.address;

    expect(tokenUri).to.eq(
      `https://nft-test.zkga.me/token-uri/artifact/${networkId}-${contractAddress}/` +
        artifactsOnPlanet[0]
    );
  });

  it("should not be able to deposit an artifact you don't own", async function () {
    const newArtifactId = await user1MintArtifactPlanet(world.user1Core);

    // user1 moves artifact and withdraws
    await world.user1Core.move(
      ...makeMoveArgs(ARTIFACT_PLANET_1, LVL3_SPACETIME_1, 0, 50000, 0, newArtifactId)
    );

    world.user1Core.withdrawArtifact(LVL3_SPACETIME_1.id, newArtifactId);

    // user2 should not be able to deposit artifact
    await expect(
      world.user2Core.depositArtifact(LVL3_SPACETIME_2.id, newArtifactId)
    ).to.be.revertedWith('you can only deposit artifacts you own');
  });

  it('should be able to move an artifact from a planet you own', async function () {
    const newArtifactId = await user1MintArtifactPlanet(world.user1Core);

    let artifactsOnRuins = await getArtifactsOnPlanet(world, ARTIFACT_PLANET_1.id);
    let artifactsOnSpawn = await getArtifactsOnPlanet(world, SPAWN_PLANET_1.id);

    // ruins should have artifact, spawn planet should not.
    expect(artifactsOnRuins.length).to.eq(1);
    expect(artifactsOnSpawn.length).to.eq(0);

    // after finding artifact, planet's popCap might get buffed
    // so let it fill up again
    await increaseBlockchainTime();

    // move artifact; check that artifact is placed on voyage
    const moveTx = await world.user1Core.move(
      ...makeMoveArgs(ARTIFACT_PLANET_1, SPAWN_PLANET_1, 10, 50000, 0, newArtifactId)
    );
    const moveReceipt = await moveTx.wait();
    const voyageId = moveReceipt.events?.[0].args?.[1]; // emitted by ArrivalQueued
    const artifactPreArrival = await world.contract.getArtifactById(newArtifactId);
    expect(artifactPreArrival.voyageId).to.eq(voyageId);
    expect(artifactPreArrival.locationId).to.eq(0);

    // when moving, both the ruins and the spawn planet should not have artifacts
    artifactsOnRuins = await getArtifactsOnPlanet(world, ARTIFACT_PLANET_1.id);
    artifactsOnSpawn = await getArtifactsOnPlanet(world, SPAWN_PLANET_1.id);
    expect(artifactsOnRuins.length).to.eq(0);
    expect(artifactsOnSpawn.length).to.eq(0);

    // fast forward to arrival
    await increaseBlockchainTime();
    await world.user1Core.refreshPlanet(SPAWN_PLANET_1.id);

    // check artifact is on the new planet
    const artifactPostArrival = await world.contract.getArtifactById(newArtifactId);
    expect(artifactPostArrival.voyageId).to.eq(0);
    expect(artifactPostArrival.locationId).to.eq(SPAWN_PLANET_1.id);
    artifactsOnRuins = await getArtifactsOnPlanet(world, ARTIFACT_PLANET_1.id);
    artifactsOnSpawn = await getArtifactsOnPlanet(world, SPAWN_PLANET_1.id);
    expect(artifactsOnRuins.length).to.eq(0);
    expect(artifactsOnSpawn.length).to.eq(1);
  });

  it('should not be able to move more than some max amount of artifacts to a planet', async function () {
    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL3_SPACETIME_1);

    const maxArtifactsOnPlanet = 4;
    for (let i = 0; i <= maxArtifactsOnPlanet; i++) {
      // place an artifact on the trading post
      const newTokenId = hexToBigNumber(i + 1 + '');
      await world.contract.createArtifact({
        tokenId: newTokenId,
        discoverer: world.user1.address,
        planetId: 1,
        rarity: 1,
        biome: 1,
        artifactType: 5,
        owner: world.user1.address,
        controller: ZERO_ADDRESS,
      });
      await world.user1Core.depositArtifact(LVL3_SPACETIME_1.id, newTokenId);

      // wait for the planet to fill up and download its stats
      await increaseBlockchainTime();
      await world.user1Core.refreshPlanet(LVL3_SPACETIME_1.id);
      const tradingPost2Planet = await world.user1Core.planets(LVL3_SPACETIME_1.id);

      if (i > maxArtifactsOnPlanet) {
        await expect(
          world.user1Core.move(
            ...makeMoveArgs(
              LVL3_SPACETIME_1,
              LVL0_PLANET_DEAD_SPACE,
              0,
              tradingPost2Planet.population.toNumber() - 1,
              0,
              newTokenId
            )
          )
        ).to.be.revertedWith(
          'the planet you are moving an artifact to can have at most 5 artifacts on it'
        );
      } else {
        // move the artifact from the trading post
        await world.user1Core.move(
          ...makeMoveArgs(
            LVL3_SPACETIME_1,
            LVL0_PLANET_DEAD_SPACE,
            0,
            tradingPost2Planet.population.toNumber() - 1,
            0,
            newTokenId
          )
        );
        await increaseBlockchainTime();
        await world.user1Core.refreshPlanet(LVL0_PLANET_DEAD_SPACE.id);
        const artifactsOnPlanet = await getArtifactsOnPlanet(world, LVL0_PLANET_DEAD_SPACE.id);
        expect(artifactsOnPlanet.length).to.eq(i + 1);
      }
    }
  });

  it("should be able to conquer another player's planet and move their artifact", async function () {
    const newArtifactId = await user1MintArtifactPlanet(world.user1Core);

    // after finding artifact, planet's popCap might get buffed
    // so let it fill up again
    await increaseBlockchainTime();

    const artifactPlanetPopCap = (
      await world.contract.planets(ARTIFACT_PLANET_1.id)
    ).populationCap.toNumber();

    await world.user1Core.move(
      ...makeMoveArgs(
        ARTIFACT_PLANET_1,
        SPAWN_PLANET_1,
        10,
        Math.floor(artifactPlanetPopCap * 0.999), // if only 0.99 it's still untakeable, bc high def
        0
      )
    );

    // steal planet
    await world.user2Core.move(...makeMoveArgs(SPAWN_PLANET_2, ARTIFACT_PLANET_1, 0, 50000, 0));
    await increaseBlockchainTime();

    // move artifact
    await world.user2Core.move(
      ...makeMoveArgs(ARTIFACT_PLANET_1, LVL3_SPACETIME_2, 0, 50000, 0, newArtifactId)
    );
    await increaseBlockchainTime();

    // verify that artifact was moved
    await world.user2Core.withdrawArtifact(LVL3_SPACETIME_2.id, newArtifactId);
    const artifacts = await getArtifactsOwnedBy(world.contract, world.user2.address);

    expect(artifacts.length).to.be.equal(1);
  });

  it('not be able to prospect for an artifact on planets that are not ruins', async function () {
    await expect(world.user1Core.prospectPlanet(SPAWN_PLANET_1.id)).to.be.revertedWith(
      "you can't find an artifact on this planet"
    );
  });

  it('should mint randomly', async function () {
    this.timeout(1000 * 60);

    await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL3_SPACETIME_1);

    /* eslint-disable @typescript-eslint/no-explicit-any */
    let artifacts: any;
    let prevLocation = SPAWN_PLANET_1;

    for (let i = 0; i < 20; i++) {
      // byte #8 is 18_16 = 24_10 so it's a ruins planet
      const randomHex =
        `00007c2512896efb182d462faee0000fb33d58930eb9e6b4fbae6d048e9c44` +
        (i >= 10 ? i.toString()[0] : 0) +
        '' +
        (i % 10);

      const planetWithArtifactLoc = new TestLocation({
        hex: randomHex,
        perlin: SPACE_PERLIN,
        distFromOrigin: 1998,
      });

      await world.contract.adminInitializePlanet(
        planetWithArtifactLoc.id,
        planetWithArtifactLoc.perlin
      );

      await world.contract.adminGiveSpaceShip(
        planetWithArtifactLoc.id,
        world.user1.address,
        ArtifactType.ShipGear
      );

      await increaseBlockchainTime();

      await world.user1Core.move(...makeMoveArgs(prevLocation, planetWithArtifactLoc, 0, 80000, 0)); // move 80000 from asteroids but 160000 from ruins since ruins are higher level
      await increaseBlockchainTime();

      await world.user1Core.prospectPlanet(planetWithArtifactLoc.id);
      await increaseBlockchainTime();

      await world.user1Core.findArtifact(...makeFindArtifactArgs(planetWithArtifactLoc));
      await increaseBlockchainTime();

      const artifactsOnPlanet = await getArtifactsOnPlanet(world, planetWithArtifactLoc.id);
      const artifactId = artifactsOnPlanet[0].id;

      await world.user1Core.move(
        ...makeMoveArgs(planetWithArtifactLoc, LVL3_SPACETIME_1, 0, 40000, 0, artifactId)
      );
      await world.user1Core.withdrawArtifact(LVL3_SPACETIME_1.id, artifactId);
      artifacts = await getArtifactsOwnedBy(world.contract, world.user1.address);

      expect(artifacts[artifacts.length - 1].planetBiome).to.eq(4); // tundra
      expect(artifacts[artifacts.length - 1].discoverer).to.eq(world.user1.address);
      expect(artifacts[artifacts.length - 1].rarity).to.be.at.least(1);

      prevLocation = planetWithArtifactLoc;
    }

    const artifactTypeSet = new Set();

    for (let i = 0; i < artifacts.length; i++) {
      artifactTypeSet.add(artifacts[i].artifactType);
    }

    expect(artifactTypeSet.size).to.be.greaterThan(1);
  });

  it('should not mint an artifact on the same planet twice', async function () {
    await world.user1Core.prospectPlanet(ARTIFACT_PLANET_1.id);
    await increaseBlockchainTime();
    await world.user1Core.findArtifact(...makeFindArtifactArgs(ARTIFACT_PLANET_1));
    await increaseBlockchainTime();
    await expect(
      world.user1Core.findArtifact(...makeFindArtifactArgs(ARTIFACT_PLANET_1))
    ).to.be.revertedWith('artifact already minted from this planet');
  });

  it('should not be able to move an activated artifact', async function () {
    const artifactId = await createArtifactOnPlanet(
      world.contract,
      world.user1.address,
      ARTIFACT_PLANET_1,
      ArtifactType.Monolith
    );
    await world.user1Core.activateArtifact(ARTIFACT_PLANET_1.id, artifactId, 0);

    await expect(
      world.user1Core.move(
        ...makeMoveArgs(ARTIFACT_PLANET_1, SPAWN_PLANET_1, 10, 50000, 0, artifactId)
      )
    ).to.be.revertedWith('you cannot take an activated artifact off a planet');
  });

  it("should not be able to move an artifact from a planet it's not on", async function () {
    const newArtifactId = await user1MintArtifactPlanet(world.user1Core);
    // after finding artifact, planet's popCap might get buffed
    // so let it fill up again
    await increaseBlockchainTime();

    // move artifact
    world.user1Core.move(
      ...makeMoveArgs(ARTIFACT_PLANET_1, SPAWN_PLANET_1, 10, 50000, 0, newArtifactId)
    );

    // try moving artifact again; should fail
    await expect(
      world.user1Core.move(
        ...makeMoveArgs(ARTIFACT_PLANET_1, SPAWN_PLANET_1, 10, 50000, 0, newArtifactId)
      )
    ).to.be.revertedWith('this artifact was not present on this planet');

    // try moving nonexistent artifact
    await expect(
      world.user1Core.move(...makeMoveArgs(ARTIFACT_PLANET_1, SPAWN_PLANET_1, 10, 50000, 0, 12345))
    ).to.be.revertedWith('this artifact was not present on this planet');
  });

  describe('trading post', function () {
    it('should be able to withdraw from / deposit onto trading posts you own', async function () {
      await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL3_SPACETIME_3);
      await increaseBlockchainTime();

      const newArtifactId = await user1MintArtifactPlanet(world.user1Core);

      // move artifact to LVL3_SPACETIME_1
      await world.user1Core.move(
        ...makeMoveArgs(ARTIFACT_PLANET_1, LVL3_SPACETIME_1, 0, 50000, 0, newArtifactId)
      );
      await world.user1Core.refreshPlanet(LVL3_SPACETIME_1.id);

      // artifact should be on LVL3_SPACETIME_1
      let artifact = await world.contract.getArtifactById(newArtifactId);
      let artifactsOnTP1 = await world.contract.getArtifactsOnPlanet(LVL3_SPACETIME_1.id);
      let artifactsOnTP2 = await world.contract.getArtifactsOnPlanet(LVL3_SPACETIME_3.id);
      await expect(artifact.locationId).to.eq(LVL3_SPACETIME_1.id);
      await expect(artifactsOnTP1.length).to.eq(1);
      await expect(artifactsOnTP2.length).to.eq(0);

      // withdraw from LVL3_SPACETIME_1
      await world.user1Core.withdrawArtifact(LVL3_SPACETIME_1.id, newArtifactId);

      // artifact should be on voyage
      artifact = await world.contract.getArtifactById(newArtifactId);
      artifactsOnTP1 = await world.contract.getArtifactsOnPlanet(LVL3_SPACETIME_1.id);
      artifactsOnTP2 = await world.contract.getArtifactsOnPlanet(LVL3_SPACETIME_3.id);
      await expect(artifact.locationId).to.eq(0);
      await expect(artifactsOnTP1.length).to.eq(0);
      await expect(artifactsOnTP2.length).to.eq(0);

      // deposit onto LVL3_SPACETIME_3
      await world.user1Core.depositArtifact(LVL3_SPACETIME_3.id, newArtifactId);

      // artifact should be on LVL3_SPACETIME_3
      artifact = await world.contract.getArtifactById(newArtifactId);
      artifactsOnTP1 = await world.contract.getArtifactsOnPlanet(LVL3_SPACETIME_1.id);
      artifactsOnTP2 = await world.contract.getArtifactsOnPlanet(LVL3_SPACETIME_3.id);
      await expect(artifact.locationId).to.eq(LVL3_SPACETIME_3.id);
      await expect(artifactsOnTP1.length).to.eq(0);
      await expect(artifactsOnTP2.length).to.eq(1);
    });

    it("should not be able to withdraw from / deposit onto trading post you don't own", async function () {
      const newArtifactId = await user1MintArtifactPlanet(world.user1Core);

      // move artifact
      await world.user1Core.move(
        ...makeMoveArgs(ARTIFACT_PLANET_1, LVL3_SPACETIME_1, 0, 50000, 0, newArtifactId)
      );

      // user2 should not be able to withdraw from LVL3_SPACETIME_1
      await expect(
        world.user2Core.withdrawArtifact(LVL3_SPACETIME_1.id, newArtifactId)
      ).to.be.revertedWith('you can only withdraw from a planet you own');

      // user1 should not be able to deposit onto LVL3_SPACETIME_2
      world.user1Core.withdrawArtifact(LVL3_SPACETIME_1.id, newArtifactId);
      await expect(
        world.user1Core.depositArtifact(LVL3_SPACETIME_2.id, newArtifactId)
      ).to.be.revertedWith('you can only deposit on a planet you own');
    });

    it('should not be able to withdraw an artifact from a trading post that is not on the trading post', async function () {
      const newArtifactId = await user1MintArtifactPlanet(world.user1Core);

      // should not be able to withdraw newArtifactId from LVL3_SPACETIME_1
      await expect(
        world.user1Core.withdrawArtifact(LVL3_SPACETIME_1.id, newArtifactId)
      ).to.be.revertedWith('this artifact is not on this planet');
    });

    it('should not be able to withdraw/deposit onto a planet that is not a trading post', async function () {
      await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, LVL0_PLANET);
      await increaseBlockchainTime();

      const newArtifactId = await user1MintArtifactPlanet(world.user1Core);

      // should not be able to withdraw from ruins (which are not trading posts)
      await expect(
        world.user2Core.withdrawArtifact(ARTIFACT_PLANET_1.id, newArtifactId)
      ).to.be.revertedWith('can only withdraw from trading posts');

      // move artifact and withdraw
      await world.user1Core.move(
        ...makeMoveArgs(ARTIFACT_PLANET_1, LVL3_SPACETIME_1, 0, 50000, 0, newArtifactId)
      );
      world.user1Core.withdrawArtifact(LVL3_SPACETIME_1.id, newArtifactId);

      // should not be able to deposit onto LVL0_PLANET (which is regular planet and not trading post)
      await expect(
        world.user1Core.depositArtifact(LVL0_PLANET.id, newArtifactId)
      ).to.be.revertedWith('can only deposit on trading posts');
    });

    it('should not be able to withdraw/deposit a high level artifact onto low level trading post', async function () {
      await conquerUnownedPlanet(world, world.user1Core, LVL3_SPACETIME_1, LVL6_SPACETIME);
      await increaseBlockchainTime(); // allow planets to fill up energy again

      const newTokenId = hexToBigNumber('1');
      await world.contract.createArtifact({
        tokenId: newTokenId,
        discoverer: world.user1.address,
        planetId: 1, // planet id
        rarity: 4, // rarity
        biome: 1, // biome
        artifactType: 1,
        owner: world.user1.address,
        controller: ZERO_ADDRESS,
      });
      // deposit fails on low level trading post, succeeds on high level trading post
      await expect(
        world.user1Core.depositArtifact(LVL3_SPACETIME_1.id, newTokenId)
      ).to.be.revertedWith('spacetime rip not high enough level to deposit this artifact');
      world.user1Core.depositArtifact(LVL6_SPACETIME.id, newTokenId);

      // withdraw fails on low level trading post
      await world.user1Core.move(
        ...makeMoveArgs(LVL6_SPACETIME, LVL3_SPACETIME_1, 0, 250000000, 0, newTokenId)
      );
      await expect(
        world.user1Core.withdrawArtifact(LVL3_SPACETIME_1.id, newTokenId)
      ).to.be.revertedWith('spacetime rip not high enough level to withdraw this artifact');

      // withdraw succeeds on high level post
      await world.user1Core.move(
        ...makeMoveArgs(LVL3_SPACETIME_1, LVL6_SPACETIME, 0, 500000, 0, newTokenId)
      );
      await world.user1Core.withdrawArtifact(LVL6_SPACETIME.id, newTokenId);
    });
  });

  describe('wormhole', function () {
    it('should increase movement speed, in both directions', async function () {
      const from = SPAWN_PLANET_1;
      const to = LVL0_PLANET;
      await conquerUnownedPlanet(world, world.user1Core, from, LVL3_UNOWNED_NEBULA);
      await conquerUnownedPlanet(world, world.user1Core, LVL3_UNOWNED_NEBULA, LVL6_SPACETIME);
      await conquerUnownedPlanet(world, world.user1Core, from, LVL0_PLANET);

      const dist = 50;
      const shipsSent = 10000;
      const silverSent = 0;

      const artifactRarities = [1, 2, 3, 4, 5]; // 0 is unknown, so we start at 1
      const wormholeSpeedups = [2, 4, 8, 16, 32];

      for (let i = 0; i < artifactRarities.length; i++) {
        const artifactId = await createArtifactOnPlanet(
          world.contract,
          world.user1.address,
          from,
          ArtifactType.Wormhole,
          { rarity: artifactRarities[i] as ArtifactRarity, biome: Biome.OCEAN }
        );
        await world.user1Core.activateArtifact(from.id, artifactId, to.id);

        // move from planet with artifact to its wormhole destination
        await increaseBlockchainTime();
        await world.user1Core.move(...makeMoveArgs(from, to, dist, shipsSent, silverSent));
        const fromPlanet = await world.contract.planets(from.id);
        const planetArrivals = await world.contract.getPlanetArrivals(to.id);
        const arrival = planetArrivals[0];
        const expectedTime = Math.floor(
          Math.floor((dist * 100) / wormholeSpeedups[i]) / fromPlanet.speed.toNumber()
        );

        expect(arrival.arrivalTime.sub(arrival.departureTime)).to.be.equal(expectedTime);

        // move from the wormhole destination planet back to the planet whose wormhole is pointing at
        // it
        await increaseBlockchainTime();
        await world.user1Core.move(...makeMoveArgs(to, from, dist, shipsSent, silverSent));
        const fromPlanetInverted = await world.contract.planets(to.id);
        const planetArrivalsInverted = await world.contract.getPlanetArrivals(from.id);
        const arrivalInverted = planetArrivalsInverted[0];
        const expectedTimeInverted = Math.floor(
          Math.floor((dist * 100) / wormholeSpeedups[i]) / fromPlanetInverted.speed.toNumber()
        );

        expect(arrivalInverted.arrivalTime.sub(arrivalInverted.departureTime)).to.be.equal(
          expectedTimeInverted
        );

        await world.user1Core.deactivateArtifact(from.id);
      }
    });

    it("shouldn't transfer energy to planets that aren't owned by the sender", async function () {
      const from = SPAWN_PLANET_1;
      const to = LVL0_PLANET;

      // user 2 takes over a larger planet
      await conquerUnownedPlanet(world, world.user2Core, SPAWN_PLANET_2, LVL3_UNOWNED_NEBULA);

      // user 1 takes over the 2nd planet
      await conquerUnownedPlanet(world, world.user1Core, SPAWN_PLANET_1, to);
      await world.user1Core.refreshPlanet(to.id);
      const toPlanet = await world.contract.planets(to.id);
      expect(toPlanet.owner).to.eq(world.user1.address);

      // create a wormhole
      const newTokenId = hexToBigNumber('5');
      await world.contract.createArtifact({
        tokenId: newTokenId,
        discoverer: world.user1.address,
        planetId: 1, // planet id
        rarity: 1,
        biome: 1, // biome
        artifactType: 5, // wormhole
        owner: world.user1.address,
        controller: ZERO_ADDRESS,
      });
      const userArtifacts = await world.contract.getPlayerArtifactIds(world.user1.address);
      expect(userArtifacts[0]).to.eq(newTokenId);

      // activate the wormhole to the 2nd planet
      await world.user1Core.depositArtifact(LVL3_SPACETIME_1.id, newTokenId);
      await world.user1Core.move(
        ...makeMoveArgs(LVL3_SPACETIME_1, SPAWN_PLANET_1, 0, 500000, 0, newTokenId)
      );
      await world.user1Core.activateArtifact(from.id, newTokenId, to.id);

      const dist = 50;
      const shipsSent = 10000;
      const silverSent = 0;

      await increaseBlockchainTime();

      // user 2 takes over the wormhole's destination
      const largePlanet = await world.contract.planets(LVL3_UNOWNED_NEBULA.id);
      await world.user2Core.move(
        ...makeMoveArgs(LVL3_UNOWNED_NEBULA, to, 10, largePlanet.populationCap.div(2), 0)
      );
      await increaseBlockchainTime();
      await world.user1Core.refreshPlanet(to.id);
      const toPlanetOwnedBySecond = await world.contract.planets(to.id);
      expect(toPlanetOwnedBySecond.owner).to.eq(world.user2.address);

      // ok, now for the test: move from the planet with the wormhole to its wormhole target
      await increaseBlockchainTime();
      await world.user1Core.move(...makeMoveArgs(from, to, dist, shipsSent, silverSent));

      // check that the move is sped up
      const fromPlanet = await world.contract.planets(from.id);
      const planetArrivals = await world.contract.getPlanetArrivals(to.id);
      const arrival = planetArrivals[0];
      const expectedTime = Math.floor((Math.floor(dist / 2) * 100) / fromPlanet.speed.toNumber());
      expect(arrival.arrivalTime.sub(arrival.departureTime)).to.be.equal(expectedTime);

      // fast forward to the time that the arrival is scheduled to arrive
      const currentTime = await getCurrentTime();
      await increaseBlockchainTime(arrival.arrivalTime.toNumber() - currentTime - 5);
      await world.user1Core.refreshPlanet(to.id);
      const planetPreArrival = await world.contract.planets(to.id);
      const arrivalsPreArrival = await world.contract.getPlanetArrivals(to.id);

      await increaseBlockchainTime(6);
      await world.user1Core.refreshPlanet(to.id);
      const planetPostArrival = await world.contract.planets(to.id);
      const arrivalsPostArrival = await world.contract.getPlanetArrivals(to.id);

      // expect that the arrival transfered precisely zero energy.
      expect(planetPreArrival.population).to.eq(planetPostArrival.population);
      expect(arrivalsPreArrival.length).to.eq(1);
      expect(arrivalsPostArrival.length).to.eq(0);
    });
  });

  describe('bloom filter', function () {
    it('is burnt after usage, and should fill energy and silver', async function () {
      const from = SPAWN_PLANET_1;
      const dist = 50;
      const shipsSent = 10000;
      const silverSent = 0;

      await world.user1Core.move(...makeMoveArgs(from, LVL0_PLANET, dist, shipsSent, silverSent));

      const planetBeforeBloomFilter = await world.user1Core.planets(from.id);
      expect(planetBeforeBloomFilter.population.toNumber()).to.be.lessThan(
        planetBeforeBloomFilter.populationCap.toNumber()
      );
      expect(planetBeforeBloomFilter.silver).to.eq(0);

      const newTokenId = hexToBigNumber('1');
      await world.contract.createArtifact({
        tokenId: newTokenId,
        discoverer: world.user1.address,
        planetId: 1, // planet id
        rarity: 1, // rarity
        biome: 1, // biome
        artifactType: 8, // bloom filter
        owner: world.user1.address,
        controller: ZERO_ADDRESS,
      });
      await increaseBlockchainTime(); // so that trading post can fill up to max energy
      await world.user1Core.depositArtifact(LVL3_SPACETIME_1.id, newTokenId);
      await world.user1Core.move(
        ...makeMoveArgs(LVL3_SPACETIME_1, SPAWN_PLANET_1, 0, 500000, 0, newTokenId)
      );
      await world.user1Core.activateArtifact(from.id, newTokenId, 0);

      const planetAfterBloomFilter = await world.user1Core.planets(from.id);
      expect(planetAfterBloomFilter.population).to.eq(planetAfterBloomFilter.populationCap);
      expect(planetAfterBloomFilter.silver).to.eq(planetAfterBloomFilter.silverCap);

      const bloomFilterPostActivation = await world.contract.getArtifactById(newTokenId);

      // bloom filter is immediately deactivated after activation
      expect(bloomFilterPostActivation.artifact.lastActivated).to.eq(
        bloomFilterPostActivation.artifact.lastDeactivated
      );

      // bloom filter is no longer on a planet (is instead owned by contract), and so is effectively burned
      expect(bloomFilterPostActivation.locationId.toString()).to.eq('0');
    });

    it("can't be used on a planet of too high level", async function () {
      this.timeout(1000 * 60);
      await conquerUnownedPlanet(world, world.user1Core, LVL3_SPACETIME_1, LVL4_UNOWNED_DEEP_SPACE);
      const from = SPAWN_PLANET_1;

      const dist = 50;
      const shipsSent = 10000;
      const silverSent = 0;

      await world.user1Core.move(...makeMoveArgs(from, LVL0_PLANET, dist, shipsSent, silverSent));

      const planetBeforeBloomFilter = await world.user1Core.planets(from.id);
      expect(planetBeforeBloomFilter.population.toNumber()).to.be.lessThan(
        planetBeforeBloomFilter.populationCap.toNumber()
      );
      expect(planetBeforeBloomFilter.silver).to.eq(0);

      const newTokenId = hexToBigNumber('1');
      await world.contract.createArtifact({
        tokenId: newTokenId,
        discoverer: world.user1.address,
        planetId: 1, // planet id
        rarity: 1, // rarity
        biome: 1, // biome
        artifactType: 9, // bloom filter
        owner: world.user1.address,
        controller: ZERO_ADDRESS,
      });
      await increaseBlockchainTime(); // so that trading post can fill up to max energy
      await world.user1Core.depositArtifact(LVL3_SPACETIME_1.id, newTokenId);
      await world.user1Core.move(
        ...makeMoveArgs(LVL3_SPACETIME_1, LVL4_UNOWNED_DEEP_SPACE, 0, 500000, 0, newTokenId)
      );
      await expect(
        world.user1Core.activateArtifact(LVL4_UNOWNED_DEEP_SPACE.id, newTokenId, 0)
      ).to.be.revertedWith('artifact is not powerful enough to apply effect to this planet level');
    });
  });

  describe('black domain', function () {
    it('is burnt after usage, and prevents moves from being made to it and from it', async function () {
      const to = LVL0_PLANET;
      const dist = 50;
      const shipsSent = 10000;
      const silverSent = 0;

      await world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, to, dist, shipsSent, silverSent));
      await increaseBlockchainTime();

      await world.user1Core.refreshPlanet(to.id);
      const conqueredSecondPlanet = await world.user1Core.planets(to.id);
      expect(conqueredSecondPlanet.owner).to.eq(world.user1.address);

      const newTokenId = hexToBigNumber('1');
      await world.contract.createArtifact({
        tokenId: newTokenId,
        discoverer: world.user1.address,
        planetId: 1, // planet id
        rarity: 1, // rarity
        biome: 1, // biome
        artifactType: 9, // black domain
        owner: world.user1.address,
        controller: ZERO_ADDRESS,
      });
      await world.user1Core.depositArtifact(LVL3_SPACETIME_1.id, newTokenId);
      await world.user1Core.move(...makeMoveArgs(LVL3_SPACETIME_1, to, 0, 500000, 0, newTokenId));
      await world.user1Core.activateArtifact(to.id, newTokenId, 0);

      // black domain is no longer on a planet (is instead owned by contract), and so is effectively burned
      const blackDomainPostActivation = await world.contract.getArtifactById(newTokenId);
      expect(blackDomainPostActivation.locationId.toString()).to.eq('0');

      // check the planet is destroyed
      const newInfo = await world.user1Core.planetsExtendedInfo(to.id);
      expect(newInfo.destroyed).to.eq(true);

      await increaseBlockchainTime();

      // moves to destroyed planets don't work
      await expect(
        world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, to, dist, shipsSent, silverSent))
      ).to.be.revertedWith('planet is destroyed');

      // moves from destroyed planets also don't work
      await expect(
        world.user1Core.move(...makeMoveArgs(SPAWN_PLANET_1, to, dist, shipsSent, silverSent))
      ).to.be.revertedWith('planet is destroyed');
    });

    it("can't be used on a planet of too high level", async function () {
      this.timeout(1000 * 60);
      await conquerUnownedPlanet(world, world.user1Core, LVL3_SPACETIME_1, LVL4_UNOWNED_DEEP_SPACE);
      const from = SPAWN_PLANET_1;
      const dist = 50;
      const shipsSent = 10000;
      const silverSent = 0;

      await world.user1Core.move(...makeMoveArgs(from, LVL0_PLANET, dist, shipsSent, silverSent));

      const planetBeforeBlackDomain = await world.user1Core.planets(from.id);
      expect(planetBeforeBlackDomain.population.toNumber()).to.be.lessThan(
        planetBeforeBlackDomain.populationCap.toNumber()
      );
      expect(planetBeforeBlackDomain.silver).to.eq(0);

      const newTokenId = hexToBigNumber('1');
      await world.contract.createArtifact({
        tokenId: newTokenId,
        discoverer: world.user1.address,
        planetId: 1, // planet id
        rarity: 1, // rarity
        biome: 1, // biome
        artifactType: 8, // bloom filter
        owner: world.user1.address,
        controller: ZERO_ADDRESS,
      });
      await increaseBlockchainTime(); // so that trading post can fill up to max energy
      await world.user1Core.depositArtifact(LVL3_SPACETIME_1.id, newTokenId);
      await world.user1Core.move(
        ...makeMoveArgs(LVL3_SPACETIME_1, LVL4_UNOWNED_DEEP_SPACE, 0, 500000, 0, newTokenId)
      );
      await expect(
        world.user1Core.activateArtifact(LVL4_UNOWNED_DEEP_SPACE.id, newTokenId, 0)
      ).to.be.revertedWith('artifact is not powerful enough to apply effect to this planet level');
    });
  });

  // TODO: tests for photoid cannon and planetary shield?
});
