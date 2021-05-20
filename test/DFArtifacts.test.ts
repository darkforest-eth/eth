import { expect } from 'chai';
import {
  asteroid1,
  asteroid2,
  planetWithArtifact1,
  tradingPost1,
  tradingPost2,
  asteroid3,
  lvl3Location1,
  spacePerlin,
  lvl4Location1,
  tradingPost3,
  lvl3Location2,
} from './utils/WorldConstants';
import {
  hexToBigNumber,
  makeMoveArgs,
  makeInitArgs,
  increaseBlockchainTime,
  makeFindArtifactArgs,
  getArtifactsOwnedBy,
  getStatSum,
  user1MintArtifactPlanet,
  conquerUnownedPlanet,
  getCurrentTime,
} from './utils/TestUtils';
import { initializeWorld, World } from './utils/TestWorld';

describe('DarkForestArtifacts', function () {
  let world: World;

  beforeEach(async function () {
    world = await initializeWorld();

    await world.user1Core.initializePlayer(...makeInitArgs(asteroid1));
  });

  it('be able to mint artifact on ruins, activate/buff, deactivate/debuff', async function () {
    const planetWithArtifact1Id = hexToBigNumber(planetWithArtifact1.hex);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, planetWithArtifact1);
    await increaseBlockchainTime();
    const statSumInitial = getStatSum(await world.contracts.core.planets(planetWithArtifact1Id));
    await user1MintArtifactPlanet(world.user1Core);
    const statSumAfterFound = getStatSum(await world.contracts.core.planets(planetWithArtifact1Id));
    const artifactsOnPlanet = await world.contracts.core.planetArtifacts(planetWithArtifact1Id);
    expect(artifactsOnPlanet.length).to.not.be.equal(0);
    // artifact should be owned by contract
    const artifactsBefore = await getArtifactsOwnedBy(
      world.contracts.getters,
      world.contracts.core.address
    );
    expect(artifactsBefore[0].discoverer).to.eq(world.user1.address);
    expect(artifactsBefore.length).to.equal(1);

    // let's update the planet to be one of the basic artifacts, so that
    // we know it's definitely going to buff the planet in some way. also,
    // this prevents the artifact from being one that requires valid parameter
    // in order to activate
    const updatedArtifact = Object.assign({}, artifactsBefore[0]);
    updatedArtifact.artifactType = 0;
    await world.contracts.tokens.updateArtifact(updatedArtifact);

    // planet should be buffed after discovered artifact
    await world.user1Core.activateArtifact(planetWithArtifact1Id, artifactsBefore[0].id, 0);
    const statSumAfterActivation = getStatSum(
      await world.contracts.core.planets(planetWithArtifact1Id)
    );
    await world.user1Core.deactivateArtifact(planetWithArtifact1Id);
    const statSumAfterDeactivate = getStatSum(
      await world.contracts.core.planets(planetWithArtifact1Id)
    );

    expect(statSumAfterActivation).to.not.be.within(statSumInitial - 5, statSumInitial + 5);
    expect(statSumAfterActivation).to.not.be.within(
      statSumAfterDeactivate - 5,
      statSumAfterDeactivate + 5
    );
    expect(statSumAfterDeactivate).to.be.within(statSumInitial - 5, statSumInitial + 5);
    expect(statSumAfterFound).to.be.within(statSumInitial - 5, statSumInitial + 5);
  });

  it('cannot prospect multiple times, cannot find artifact more than 256 blocks after prospecting', async function () {
    const planetWithArtifact1Id = hexToBigNumber(planetWithArtifact1.hex);

    await conquerUnownedPlanet(world, world.user1Core, asteroid1, planetWithArtifact1);
    await increaseBlockchainTime();

    await world.user1Core.prospectPlanet(planetWithArtifact1Id);

    await expect(world.user1Core.prospectPlanet(planetWithArtifact1Id)).to.be.revertedWith(
      'this planet has already been prospected'
    );

    for (let i = 0; i < 256; i++) {
      await increaseBlockchainTime();
    }

    await expect(
      world.user1Core.findArtifact(...makeFindArtifactArgs(planetWithArtifact1))
    ).to.be.revertedWith('planet prospect expired');
  });

  it('should return a correct token uri for a minted artifact', async function () {
    const planetWithArtifact1Id = hexToBigNumber(planetWithArtifact1.hex);

    await conquerUnownedPlanet(world, world.user1Core, asteroid1, planetWithArtifact1);
    await increaseBlockchainTime();
    await world.user1Core.prospectPlanet(planetWithArtifact1Id);
    await increaseBlockchainTime();
    await world.user1Core.findArtifact(...makeFindArtifactArgs(planetWithArtifact1));

    const artifactsOnPlanet = await world.contracts.core.planetArtifacts(planetWithArtifact1Id);
    const tokenUri = await world.contracts.tokens.tokenURI(artifactsOnPlanet[0]);

    expect(tokenUri).to.eq('https://zkga.me/token-uri/artifact/' + artifactsOnPlanet);
  });

  it('should be able to withdraw from / deposit onto trading posts you own', async function () {
    const tradingPost1Id = hexToBigNumber(tradingPost1.hex);
    const tradingPost2Id = hexToBigNumber(tradingPost2.hex);

    await conquerUnownedPlanet(world, world.user1Core, asteroid1, planetWithArtifact1);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost2);
    await increaseBlockchainTime();

    const newArtifactId = await user1MintArtifactPlanet(world.user1Core);

    // move artifact
    await world.user1Core.move(
      ...makeMoveArgs(planetWithArtifact1, tradingPost1, 0, 50000, 0, newArtifactId)
    );
    await world.user1Core.refreshPlanet(tradingPost1Id);

    // artifact should be on tradingPost1
    let artifact = await world.contracts.getters.getArtifactById(newArtifactId);
    await expect(artifact.locationId).to.eq(tradingPost1Id);
    let artifactsOnTP1 = await world.contracts.getters.getArtifactsOnPlanet(tradingPost1Id);
    let artifactsOnTP2 = await world.contracts.getters.getArtifactsOnPlanet(tradingPost2Id);
    await expect(artifactsOnTP1.length).to.eq(1);
    await expect(artifactsOnTP2.length).to.eq(0);

    // withdraw from tradingPost1
    await world.user1Core.withdrawArtifact(hexToBigNumber(tradingPost1.hex), newArtifactId);
    artifact = await world.contracts.getters.getArtifactById(newArtifactId);
    await expect(artifact.locationId).to.eq(0);
    artifactsOnTP1 = await world.contracts.getters.getArtifactsOnPlanet(tradingPost1Id);
    artifactsOnTP2 = await world.contracts.getters.getArtifactsOnPlanet(tradingPost2Id);
    await expect(artifactsOnTP1.length).to.eq(0);
    await expect(artifactsOnTP2.length).to.eq(0);

    // deposit onto tradingPost2
    await world.user1Core.depositArtifact(hexToBigNumber(tradingPost2.hex), newArtifactId);
    artifact = await world.contracts.getters.getArtifactById(newArtifactId);
    await expect(artifact.locationId).to.eq(tradingPost2Id);
    artifactsOnTP1 = await world.contracts.getters.getArtifactsOnPlanet(tradingPost1Id);
    artifactsOnTP2 = await world.contracts.getters.getArtifactsOnPlanet(tradingPost2Id);
    await expect(artifactsOnTP1.length).to.eq(0);
    await expect(artifactsOnTP2.length).to.eq(1);
  });

  it("should not be able to withdraw from / deposit onto trading post you don't own", async function () {
    await world.user2Core.initializePlayer(...makeInitArgs(asteroid2));

    await conquerUnownedPlanet(world, world.user1Core, asteroid1, planetWithArtifact1);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);
    await conquerUnownedPlanet(world, world.user2Core, asteroid2, tradingPost2);
    await increaseBlockchainTime();

    const newArtifactId = await user1MintArtifactPlanet(world.user1Core);

    // move artifact
    await world.user1Core.move(
      ...makeMoveArgs(planetWithArtifact1, tradingPost1, 0, 50000, 0, newArtifactId)
    );

    // user2 should not be able to withdraw from tradingPost1
    await expect(
      world.user2Core.withdrawArtifact(hexToBigNumber(tradingPost1.hex), newArtifactId)
    ).to.be.revertedWith('you can only withdraw from a planet you own');

    // user1 should not be able to deposit onto tradingPost2
    world.user1Core.withdrawArtifact(hexToBigNumber(tradingPost1.hex), newArtifactId);
    await expect(
      world.user1Core.depositArtifact(hexToBigNumber(tradingPost2.hex), newArtifactId)
    ).to.be.revertedWith('you can only deposit on a planet you own');
  });

  it('should not be able to withdraw an artifact from a trading post that is not on the trading post', async function () {
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, planetWithArtifact1);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);
    await increaseBlockchainTime();

    const newArtifactId = await user1MintArtifactPlanet(world.user1Core);

    // should not be able to withdraw newArtifactId from tradingPost1
    await expect(
      world.user1Core.withdrawArtifact(hexToBigNumber(tradingPost1.hex), newArtifactId)
    ).to.be.revertedWith('this artifact is not on this planet');
  });

  it("should not be able to deposit an artifact you don't own", async function () {
    await world.user2Core.initializePlayer(...makeInitArgs(asteroid2));

    await conquerUnownedPlanet(world, world.user1Core, asteroid1, planetWithArtifact1);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);
    await conquerUnownedPlanet(world, world.user2Core, asteroid2, tradingPost2);
    await increaseBlockchainTime();

    const newArtifactId = await user1MintArtifactPlanet(world.user1Core);

    // user1 moves artifact and withdraws
    await world.user1Core.move(
      ...makeMoveArgs(planetWithArtifact1, tradingPost1, 0, 50000, 0, newArtifactId)
    );

    world.user1Core.withdrawArtifact(hexToBigNumber(tradingPost1.hex), newArtifactId);

    // user2 should not be able to deposit artifact
    await expect(
      world.user2Core.depositArtifact(hexToBigNumber(tradingPost2.hex), newArtifactId)
    ).to.be.revertedWith('you can only deposit artifacts you own');
  });

  it('should not be able to withdraw/deposit onto a planet that is not a trading post', async function () {
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, asteroid2);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, planetWithArtifact1);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);
    await increaseBlockchainTime();

    const newArtifactId = await user1MintArtifactPlanet(world.user1Core);

    // should not be able to withdraw from ruins (which are not trading posts)
    await expect(
      world.user2Core.withdrawArtifact(hexToBigNumber(planetWithArtifact1.hex), newArtifactId)
    ).to.be.revertedWith('can only withdraw from trading posts');

    // move artifact and withdraw
    await world.user1Core.move(
      ...makeMoveArgs(planetWithArtifact1, tradingPost1, 0, 50000, 0, newArtifactId)
    );
    world.user1Core.withdrawArtifact(hexToBigNumber(tradingPost1.hex), newArtifactId);

    // should not be able to deposit onto asteroid2 (which is regular planet and not trading post)
    await expect(
      world.user1Core.depositArtifact(hexToBigNumber(asteroid2.hex), newArtifactId)
    ).to.be.revertedWith('can only deposit on trading posts');
  });

  it('should not be able to withdraw/deposit a high level artifact onto low level trading post', async function () {
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);
    await conquerUnownedPlanet(world, world.user1Core, tradingPost1, tradingPost3);
    await increaseBlockchainTime(); // allow planets to fill up energy again

    const newTokenId = hexToBigNumber('1');
    await world.contracts.tokens.createArtifact({
      tokenId: newTokenId,
      discoverer: world.user1.address,
      planetId: 1, // planet id
      rarity: 4, // rarity
      biome: 1, // biome
      artifactType: 1,
      owner: world.user1.address,
    });
    // deposit fails on low level trading post, succeeds on high level trading post
    await expect(
      world.user1Core.depositArtifact(hexToBigNumber(tradingPost1.hex), newTokenId)
    ).to.be.revertedWith('spacetime rip not high enough level to deposit this artifact');
    world.user1Core.depositArtifact(hexToBigNumber(tradingPost3.hex), newTokenId);

    // withdraw fails on low level trading post
    await world.user1Core.move(
      ...makeMoveArgs(tradingPost3, tradingPost1, 0, 250000000, 0, newTokenId)
    );
    await expect(
      world.user1Core.withdrawArtifact(hexToBigNumber(tradingPost1.hex), newTokenId)
    ).to.be.revertedWith('spacetime rip not high enough level to withdraw this artifact');

    // withdraw succeeds on high level post
    await world.user1Core.move(
      ...makeMoveArgs(tradingPost1, tradingPost3, 0, 500000, 0, newTokenId)
    );
    await world.user1Core.withdrawArtifact(hexToBigNumber(tradingPost3.hex), newTokenId);
  });

  it('should be able to move an artifact from a planet you own', async function () {
    const spawnPoint1Id = hexToBigNumber(asteroid1.hex);
    const planetWithArtifact1Id = hexToBigNumber(planetWithArtifact1.hex);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, planetWithArtifact1);
    await increaseBlockchainTime();

    const newArtifactId = await user1MintArtifactPlanet(world.user1Core);

    let artifactsOnRuins = await world.contracts.getters.getArtifactsOnPlanet(
      planetWithArtifact1Id
    );
    let artifactsOnSpawn = await world.contracts.getters.getArtifactsOnPlanet(spawnPoint1Id);
    await expect(artifactsOnRuins.length).to.eq(1);
    await expect(artifactsOnSpawn.length).to.eq(0);
    // after finding artifact, planet's popCap might get buffed
    // so let it fill up again
    await increaseBlockchainTime();

    // move artifact; check that artifact is placed on voyage
    const moveTx = await world.user1Core.move(
      ...makeMoveArgs(planetWithArtifact1, asteroid1, 10, 50000, 0, newArtifactId)
    );
    const moveReceipt = await moveTx.wait();
    const voyageId = moveReceipt.events?.[0].args?.[1]; // emitted by ArrivalQueued
    const artifactPreArrival = await world.contracts.getters.getArtifactById(newArtifactId);
    await expect(artifactPreArrival.voyageId).to.eq(voyageId);
    await expect(artifactPreArrival.locationId).to.eq(0);
    artifactsOnRuins = await world.contracts.getters.getArtifactsOnPlanet(planetWithArtifact1Id);
    artifactsOnSpawn = await world.contracts.getters.getArtifactsOnPlanet(spawnPoint1Id);
    await expect(artifactsOnRuins.length).to.eq(0);
    await expect(artifactsOnSpawn.length).to.eq(0);

    // check artifact is on the new planet
    await increaseBlockchainTime();
    await world.user1Core.refreshPlanet(spawnPoint1Id);
    const artifactPostArrival = await world.contracts.getters.getArtifactById(newArtifactId);
    await expect(artifactPostArrival.voyageId).to.eq(0);
    await expect(artifactPostArrival.locationId).to.eq(spawnPoint1Id);
    artifactsOnRuins = await world.contracts.getters.getArtifactsOnPlanet(planetWithArtifact1Id);
    artifactsOnSpawn = await world.contracts.getters.getArtifactsOnPlanet(spawnPoint1Id);
    await expect(artifactsOnRuins.length).to.eq(0);
    await expect(artifactsOnSpawn.length).to.eq(1);
  });

  it('should not be able to move more than some max amount of artifacts to a planet', async function () {
    const tradingPostId = hexToBigNumber(tradingPost2.hex);
    const asteroid1Id = hexToBigNumber(asteroid1.hex);

    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost2);

    const maxArtifactsOnPlanet = 4;

    for (let i = 0; i <= maxArtifactsOnPlanet; i++) {
      // place an artifact on the trading post
      const newTokenId = hexToBigNumber(i + 1 + '');
      await world.contracts.tokens.createArtifact({
        tokenId: newTokenId,
        discoverer: world.user1.address,
        planetId: 1,
        rarity: 1,
        biome: 1,
        artifactType: 5,
        owner: world.user1.address,
      });
      await world.user1Core.depositArtifact(tradingPostId, newTokenId);

      // wait for the planet to fill up and download its stats
      await increaseBlockchainTime();
      await world.user1Core.refreshPlanet(hexToBigNumber(tradingPost2.hex));
      const tradingPost2Planet = await world.user1Core.planets(tradingPostId);

      if (i > maxArtifactsOnPlanet) {
        await expect(
          world.user1Core.move(
            ...makeMoveArgs(
              tradingPost2,
              asteroid1,
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
            tradingPost2,
            asteroid1,
            0,
            tradingPost2Planet.population.toNumber() - 1,
            0,
            newTokenId
          )
        );
        await increaseBlockchainTime();
        await world.user1Core.refreshPlanet(asteroid1Id);
        const artifactsOnPlanet = await world.user1Core.planetArtifacts(asteroid1Id);
        expect(artifactsOnPlanet.length).to.eq(i + 1);
      }
    }
  });

  it("should be able to conquer another player's planet and move their artifact", async function () {
    const planetWithArtifact1Id = hexToBigNumber(planetWithArtifact1.hex);

    await world.user2Core.initializePlayer(...makeInitArgs(asteroid2));
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, planetWithArtifact1);
    await conquerUnownedPlanet(world, world.user2Core, asteroid2, tradingPost1);

    await increaseBlockchainTime();

    const newArtifactId = await user1MintArtifactPlanet(world.user1Core);

    // after finding artifact, planet's popCap might get buffed
    // so let it fill up again
    await increaseBlockchainTime();

    const artifactPlanetPopCap = (
      await world.contracts.core.planets(planetWithArtifact1Id)
    ).populationCap.toNumber();

    await world.user1Core.move(
      ...makeMoveArgs(
        planetWithArtifact1,
        asteroid1,
        10,
        Math.floor(artifactPlanetPopCap * 0.999), // if only 0.99 it's still untakeable, bc high def
        0
      )
    );

    // steal planet
    await world.user2Core.move(...makeMoveArgs(asteroid2, planetWithArtifact1, 0, 50000, 0));

    await increaseBlockchainTime();

    // move artifact
    await world.user2Core.move(
      ...makeMoveArgs(planetWithArtifact1, tradingPost1, 0, 50000, 0, newArtifactId)
    );

    await increaseBlockchainTime();

    // verify that artifact was moved
    await world.user2Core.withdrawArtifact(hexToBigNumber(tradingPost1.hex), newArtifactId);
    const artifacts = await getArtifactsOwnedBy(world.contracts.getters, world.user2.address);

    expect(artifacts.length).to.be.equal(1);
  });

  it('not be able to prospect a planet if it has less than 95% of its energy cap', async function () {
    const planetWithArtifact1Id = hexToBigNumber(planetWithArtifact1.hex);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, planetWithArtifact1);

    // increase a small amt of time so that you get SOME energy, only a little though!
    await increaseBlockchainTime(10);
    await world.contracts.core.refreshPlanet(planetWithArtifact1Id);
    const planet = (await world.contracts.getters.bulkGetPlanetsByIds([planetWithArtifact1Id]))[0];

    expect(planet.population.toNumber()).to.be.lessThan(planet.populationCap.toNumber() * 0.95);

    await expect(world.user1Core.prospectPlanet(planetWithArtifact1Id)).to.be.revertedWith(
      'you must have 95% of the max energy'
    );

    const artifactsOnPlanet = await world.user1Core.planetArtifacts(planetWithArtifact1Id);

    expect(artifactsOnPlanet.length).to.be.equal(0);
  });

  it('not be able to prospect for an artifact on planets that are not ruins', async function () {
    const spawnPointId = hexToBigNumber(asteroid1.hex);
    await increaseBlockchainTime();

    await expect(world.user1Core.prospectPlanet(spawnPointId)).to.be.revertedWith(
      "you can't find an artifact on this planet"
    );
  });

  it('should mint randomly', async function () {
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);
    this.timeout(1000 * 60);
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let artifacts: any;
    let prevLocation = asteroid1;

    for (let i = 0; i < 20; i++) {
      // byte #8 is 18_16 = 24_10 so it's a ruins planet
      const randomId =
        `00007c2512896efb182d462faee0000fb33d58930eb9e6b4fbae6d048e9c44` +
        (i >= 10 ? i.toString()[0] : 0) +
        '' +
        (i % 10);

      const planetWithArtifactLoc = {
        hex: randomId,
        perlin: spacePerlin,
        distFromOrigin: 1998,
      };

      await increaseBlockchainTime();
      await world.user1Core.move(...makeMoveArgs(prevLocation, planetWithArtifactLoc, 0, 80000, 0)); // move 80000 from asteroids but 160000 from ruins since ruins are higher level
      await increaseBlockchainTime();
      await world.user1Core.prospectPlanet(hexToBigNumber(randomId));
      await increaseBlockchainTime();
      await world.user1Core.findArtifact(...makeFindArtifactArgs(planetWithArtifactLoc));
      await increaseBlockchainTime();
      const artifactsOnPlanet = await world.user1Core.planetArtifacts(hexToBigNumber(randomId));
      const artifactId = artifactsOnPlanet[0];

      await world.user1Core.move(
        ...makeMoveArgs(planetWithArtifactLoc, tradingPost1, 0, 40000, 0, artifactId)
      );
      await world.user1Core.withdrawArtifact(hexToBigNumber(tradingPost1.hex), artifactId);
      artifacts = await getArtifactsOwnedBy(world.contracts.getters, world.user1.address);

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
    const planetWithArtifact1Id = hexToBigNumber(planetWithArtifact1.hex);

    await conquerUnownedPlanet(world, world.user1Core, asteroid1, planetWithArtifact1);
    await increaseBlockchainTime();
    await world.user1Core.prospectPlanet(planetWithArtifact1Id);
    await increaseBlockchainTime();
    await world.user1Core.findArtifact(...makeFindArtifactArgs(planetWithArtifact1));
    await increaseBlockchainTime();
    await expect(
      world.user1Core.findArtifact(...makeFindArtifactArgs(planetWithArtifact1))
    ).to.be.revertedWith('artifact already minted from this planet');
  });

  it('should not be able to move an activated artifact', async function () {
    const planetWithArtifact1Id = hexToBigNumber(planetWithArtifact1.hex);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, planetWithArtifact1);
    await increaseBlockchainTime();

    const newArtifactId = await user1MintArtifactPlanet(world.user1Core);
    // after finding artifact, planet's popCap might get buffed
    // so let it fill up again
    await increaseBlockchainTime();

    // now activate the artifact
    // admin-force-update the planet to be one of the basic artifacts;
    // this prevents the artifact from being one that requires valid parameter
    // in order to activate (like wormholes, which require wormholeTo)
    const artifactsBefore = await getArtifactsOwnedBy(
      world.contracts.getters,
      world.contracts.core.address
    );
    const updatedArtifact = Object.assign({}, artifactsBefore[0]);
    updatedArtifact.artifactType = 0;
    await world.contracts.tokens.updateArtifact(updatedArtifact);
    await world.user1Core.activateArtifact(planetWithArtifact1Id, newArtifactId, 0);

    // attempt to move artifact; should fail
    await expect(
      world.user1Core.move(
        ...makeMoveArgs(planetWithArtifact1, asteroid1, 10, 50000, 0, newArtifactId)
      )
    ).to.be.revertedWith('you cannot take an activated artifact off a planet');
  });

  it("should not be able to move an artifact from a planet it's not on", async function () {
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, planetWithArtifact1);
    await increaseBlockchainTime();

    const newArtifactId = await user1MintArtifactPlanet(world.user1Core);
    // after finding artifact, planet's popCap might get buffed
    // so let it fill up again
    await increaseBlockchainTime();

    // move artifact
    world.user1Core.move(
      ...makeMoveArgs(planetWithArtifact1, asteroid1, 10, 50000, 0, newArtifactId)
    );

    // try moving artifact again; should fail
    await expect(
      world.user1Core.move(
        ...makeMoveArgs(planetWithArtifact1, asteroid1, 10, 50000, 0, newArtifactId)
      )
    ).to.be.revertedWith('this artifact was not present on this planet');

    // try moving nonexistent artifact
    await expect(
      world.user1Core.move(...makeMoveArgs(planetWithArtifact1, asteroid1, 10, 50000, 0, 12345))
    ).to.be.revertedWith('this artifact was not present on this planet');
  });

  it('wormhole should increase movement speed, in both directions', async function () {
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, lvl3Location2);
    await conquerUnownedPlanet(world, world.user1Core, lvl3Location2, tradingPost3);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, asteroid2);
    const fromId = hexToBigNumber(asteroid1.hex);
    const toId = hexToBigNumber(asteroid2.hex);

    const dist = 50;
    const shipsSent = 10000;
    const silverSent = 0;

    const artifactRarities = [1, 2, 3, 4, 5]; // 0 is unknown, so we start at 1
    const wormholeSpeedups = [2, 4, 8, 16, 32];

    for (let i = 0; i < artifactRarities.length; i++) {
      await increaseBlockchainTime();

      const newTokenId = hexToBigNumber(i + 1 + ''); // artifact ids can't be 0
      await world.contracts.tokens.createArtifact({
        tokenId: newTokenId,
        discoverer: world.user1.address,
        planetId: 1, // planet id
        rarity: artifactRarities[i],
        biome: 1, // biome
        artifactType: 5, // wormhole
        owner: world.user1.address,
      });

      const userArtifacts = await world.contracts.tokens.getPlayerArtifactIds(world.user1.address);

      expect(userArtifacts[userArtifacts.length - 1]).to.eq(newTokenId);

      await world.user1Core.depositArtifact(hexToBigNumber(tradingPost3.hex), newTokenId);
      await world.user1Core.move(
        ...makeMoveArgs(tradingPost3, asteroid1, 0, 150000000, 0, newTokenId)
      );
      await world.user1Core.activateArtifact(fromId, newTokenId, toId);

      // move from planet with artifact to its wormhole destination
      await increaseBlockchainTime();
      await world.user1Core.move(
        ...makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent)
      );

      const fromPlanet = await world.contracts.core.planets(fromId);
      const planetArrivals = await world.contracts.getters.getPlanetArrivals(toId);
      const arrival = planetArrivals[0];
      const expectedTime = Math.floor(
        Math.floor((dist * 100) / wormholeSpeedups[i]) / fromPlanet.speed.toNumber()
      );

      expect(arrival.arrivalTime.sub(arrival.departureTime)).to.be.equal(expectedTime);

      // move from the wormhole destination planet back to the planet whose wormhole is pointing at
      // it
      await increaseBlockchainTime();
      await world.user1Core.move(
        ...makeMoveArgs(asteroid2, asteroid1, dist, shipsSent, silverSent)
      );
      const fromPlanetInverted = await world.contracts.core.planets(toId);
      const planetArrivalsInverted = await world.contracts.getters.getPlanetArrivals(fromId);
      const arrivalInverted = planetArrivalsInverted[0];
      const expectedTimeInverted = Math.floor(
        Math.floor((dist * 100) / wormholeSpeedups[i]) / fromPlanetInverted.speed.toNumber()
      );

      expect(arrivalInverted.arrivalTime.sub(arrivalInverted.departureTime)).to.be.equal(
        expectedTimeInverted
      );

      await increaseBlockchainTime();
      await world.user1Core.deactivateArtifact(fromId);
      await world.user1Core.move(
        ...makeMoveArgs(asteroid1, tradingPost3, 0, shipsSent, 0, newTokenId)
      );
      await world.user1Core.withdrawArtifact(hexToBigNumber(tradingPost3.hex), newTokenId);
    }
  });

  it("wormhole moves shouldn't transfer energy to planets that aren't owned by the sender", async function () {
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);

    const fromPlanetId = hexToBigNumber(asteroid1.hex);
    const toPlanetId = hexToBigNumber(asteroid2.hex);
    const largePlanetId = hexToBigNumber(lvl3Location1.hex);

    // initialize 2nd player
    await world.user2Core.initializePlayer(...makeInitArgs(asteroid3));

    // user 2 takes over a larger planet
    await conquerUnownedPlanet(world, world.user2Core, asteroid3, lvl3Location1);

    // user 1 takes over the 2nd planet
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, asteroid2);
    await world.user1Core.refreshPlanet(toPlanetId);
    const toPlanet = await world.contracts.core.planets(toPlanetId);
    expect(toPlanet.owner).to.eq(world.user1.address);

    // create a wormhole
    const newTokenId = hexToBigNumber('5');
    await world.contracts.tokens.createArtifact({
      tokenId: newTokenId,
      discoverer: world.user1.address,
      planetId: 1, // planet id
      rarity: 1,
      biome: 1, // biome
      artifactType: 5, // wormhole
      owner: world.user1.address,
    });
    const userArtifacts = await world.contracts.tokens.getPlayerArtifactIds(world.user1.address);
    expect(userArtifacts[0]).to.eq(newTokenId);

    // activate the wormhole to the 2nd planet
    await world.user1Core.depositArtifact(hexToBigNumber(tradingPost1.hex), newTokenId);
    await world.user1Core.move(...makeMoveArgs(tradingPost1, asteroid1, 0, 500000, 0, newTokenId));
    await world.user1Core.activateArtifact(fromPlanetId, newTokenId, toPlanetId);

    const dist = 50;
    const shipsSent = 10000;
    const silverSent = 0;

    await increaseBlockchainTime();

    // user 2 takes over the wormhole's destination
    const largePlanet = await world.contracts.core.planets(largePlanetId);
    await world.user2Core.move(
      ...makeMoveArgs(lvl3Location1, asteroid2, 10, largePlanet.populationCap.div(2), 0)
    );
    await increaseBlockchainTime();
    await world.user1Core.refreshPlanet(toPlanetId);
    const toPlanetOwnedBySecond = await world.contracts.core.planets(toPlanetId);
    expect(toPlanetOwnedBySecond.owner).to.eq(world.user2.address);

    // ok, now for the test: move from the planet with the wormhole to its wormhole target
    await increaseBlockchainTime();
    await world.user1Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent));

    // check that the move is sped up
    const fromPlanet = await world.contracts.core.planets(fromPlanetId);
    const planetArrivals = await world.contracts.getters.getPlanetArrivals(toPlanetId);
    const arrival = planetArrivals[0];
    const expectedTime = Math.floor((Math.floor(dist / 2) * 100) / fromPlanet.speed.toNumber());
    expect(arrival.arrivalTime.sub(arrival.departureTime)).to.be.equal(expectedTime);

    // fast forward to the time that the arrival is scheduled to arrive
    const currentTime = await getCurrentTime();
    await increaseBlockchainTime(arrival.arrivalTime.toNumber() - currentTime - 5);
    await world.user1Core.refreshPlanet(toPlanetId);
    const planetPreArrival = await world.contracts.core.planets(toPlanetId);
    const arrivalsPreArrival = await world.contracts.getters.getPlanetArrivals(toPlanetId);

    await increaseBlockchainTime(6);
    await world.user1Core.refreshPlanet(toPlanetId);
    const planetPostArrival = await world.contracts.core.planets(toPlanetId);
    const arrivalsPostArrival = await world.contracts.getters.getPlanetArrivals(toPlanetId);

    // expect that the arrival transfered precisely zero energy.
    expect(planetPreArrival.population).to.eq(planetPostArrival.population);
    expect(arrivalsPreArrival.length).to.eq(1);
    expect(arrivalsPostArrival.length).to.eq(0);
  });

  it('bloom filter is burnt after usage, and should fill energy and silver', async function () {
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);
    const fromId = hexToBigNumber(asteroid1.hex);

    const dist = 50;
    const shipsSent = 10000;
    const silverSent = 0;

    await world.user1Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent));

    const planetBeforeBloomFilter = await world.user1Core.planets(fromId);
    expect(planetBeforeBloomFilter.population.toNumber()).to.be.lessThan(
      planetBeforeBloomFilter.populationCap.toNumber()
    );
    expect(planetBeforeBloomFilter.silver).to.eq(0);

    const newTokenId = hexToBigNumber('1');
    await world.contracts.tokens.createArtifact({
      tokenId: newTokenId,
      discoverer: world.user1.address,
      planetId: 1, // planet id
      rarity: 1, // rarity
      biome: 1, // biome
      artifactType: 8, // bloom filter
      owner: world.user1.address,
    });
    await increaseBlockchainTime(); // so that trading post can fill up to max energy
    await world.user1Core.depositArtifact(hexToBigNumber(tradingPost1.hex), newTokenId);
    await world.user1Core.move(...makeMoveArgs(tradingPost1, asteroid1, 0, 500000, 0, newTokenId));
    await world.user1Core.activateArtifact(fromId, newTokenId, 0);

    const planetAfterBloomFilter = await world.user1Core.planets(fromId);
    expect(planetAfterBloomFilter.population).to.eq(planetAfterBloomFilter.populationCap);
    expect(planetAfterBloomFilter.silver).to.eq(planetAfterBloomFilter.silverCap);

    const bloomFilterPostActivation = await world.contracts.getters.getArtifactById(newTokenId);

    // bloom filter is immediately deactivated after activation
    expect(bloomFilterPostActivation.artifact.lastActivated).to.eq(
      bloomFilterPostActivation.artifact.lastDeactivated
    );

    // bloom filter is no longer on a planet (is instead owned by contract), and so is effectively burned
    expect(bloomFilterPostActivation.locationId.toString()).to.eq('0');
  });

  it('black domain is burnt after usage, and prevents moves from being made to it and from it', async function () {
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);
    await increaseBlockchainTime(); // allow asteroid1 to fill up energy again
    const toId = hexToBigNumber(asteroid2.hex);

    const dist = 50;
    const shipsSent = 50000;
    const silverSent = 0;

    await world.user1Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent));

    await increaseBlockchainTime();
    await world.user1Core.refreshPlanet(toId);
    const conqueredSecondPlanet = await world.user1Core.planets(toId);
    expect(conqueredSecondPlanet.owner).to.eq(world.user1.address);

    const newTokenId = hexToBigNumber('1');
    await world.contracts.tokens.createArtifact({
      tokenId: newTokenId,
      discoverer: world.user1.address,
      planetId: 1, // planet id
      rarity: 1, // rarity
      biome: 1, // biome
      artifactType: 9, // black domain
      owner: world.user1.address,
    });
    await world.user1Core.depositArtifact(hexToBigNumber(tradingPost1.hex), newTokenId);
    await world.user1Core.move(...makeMoveArgs(tradingPost1, asteroid2, 0, 500000, 0, newTokenId));
    await world.user1Core.activateArtifact(toId, newTokenId, 0);

    // black domain is no longer on a planet (is instead owned by contract), and so is effectively burned
    const blackDomainPostActivation = await world.contracts.getters.getArtifactById(newTokenId);
    expect(blackDomainPostActivation.locationId.toString()).to.eq('0');

    // check the planet is destroyed
    const newInfo = await world.user1Core.planetsExtendedInfo(toId);
    expect(newInfo.destroyed).to.eq(true);

    await increaseBlockchainTime();

    // moves to destroyed planets don't work
    await expect(
      world.user1Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent))
    ).to.be.revertedWith('planet is destroyed');

    // moves from destroyed planets also don't work
    await expect(
      world.user1Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent))
    ).to.be.revertedWith('planet is destroyed');
  });

  it("can't use a bloom filter on a planet of too high level", async function () {
    this.timeout(1000 * 60);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);
    await conquerUnownedPlanet(world, world.user1Core, tradingPost1, lvl4Location1);
    const fromId = hexToBigNumber(asteroid1.hex);

    const dist = 50;
    const shipsSent = 10000;
    const silverSent = 0;

    await world.user1Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent));

    const planetBeforeBloomFilter = await world.user1Core.planets(fromId);
    expect(planetBeforeBloomFilter.population.toNumber()).to.be.lessThan(
      planetBeforeBloomFilter.populationCap.toNumber()
    );
    expect(planetBeforeBloomFilter.silver).to.eq(0);

    const newTokenId = hexToBigNumber('1');
    await world.contracts.tokens.createArtifact({
      tokenId: newTokenId,
      discoverer: world.user1.address,
      planetId: 1, // planet id
      rarity: 1, // rarity
      biome: 1, // biome
      artifactType: 9, // bloom filter
      owner: world.user1.address,
    });
    await increaseBlockchainTime(); // so that trading post can fill up to max energy
    await world.user1Core.depositArtifact(hexToBigNumber(tradingPost1.hex), newTokenId);
    await world.user1Core.move(
      ...makeMoveArgs(tradingPost1, lvl4Location1, 0, 500000, 0, newTokenId)
    );
    await expect(
      world.user1Core.activateArtifact(hexToBigNumber(lvl4Location1.hex), newTokenId, 0)
    ).to.be.revertedWith('artifact is not powerful enough to apply effect to this planet level');
  });

  it("can't use a black domain on a planet of too high level", async function () {
    this.timeout(1000 * 60);
    await conquerUnownedPlanet(world, world.user1Core, asteroid1, tradingPost1);
    await conquerUnownedPlanet(world, world.user1Core, tradingPost1, lvl4Location1);
    const fromId = hexToBigNumber(asteroid1.hex);

    const dist = 50;
    const shipsSent = 10000;
    const silverSent = 0;

    await world.user1Core.move(...makeMoveArgs(asteroid1, asteroid2, dist, shipsSent, silverSent));

    const planetBeforeBlackDomain = await world.user1Core.planets(fromId);
    expect(planetBeforeBlackDomain.population.toNumber()).to.be.lessThan(
      planetBeforeBlackDomain.populationCap.toNumber()
    );
    expect(planetBeforeBlackDomain.silver).to.eq(0);

    const newTokenId = hexToBigNumber('1');
    await world.contracts.tokens.createArtifact({
      tokenId: newTokenId,
      discoverer: world.user1.address,
      planetId: 1, // planet id
      rarity: 1, // rarity
      biome: 1, // biome
      artifactType: 8, // bloom filter
      owner: world.user1.address,
    });
    await increaseBlockchainTime(); // so that trading post can fill up to max energy
    await world.user1Core.depositArtifact(hexToBigNumber(tradingPost1.hex), newTokenId);
    await world.user1Core.move(
      ...makeMoveArgs(tradingPost1, lvl4Location1, 0, 500000, 0, newTokenId)
    );
    await expect(
      world.user1Core.activateArtifact(hexToBigNumber(lvl4Location1.hex), newTokenId, 0)
    ).to.be.revertedWith('artifact is not powerful enough to apply effect to this planet level');
  });

  // TODO: tests for photoid cannon and planetary shield?
});
