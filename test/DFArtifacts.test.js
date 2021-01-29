const { web3 } = require("@openzeppelin/test-environment");
const { time, expectRevert } = require("@openzeppelin/test-helpers");
const {
  initializeTest,
  getPlanetIdFromHex,
  makeInitArgs,
  deployer,
  user1,
  user2,
  makeMoveArgs,
  asteroid1Location,
  asteroid2Location,
  silverStar1Location,
  planetWithArtifact1,
  planetWithArtifact2,
  LARGE_INTERVAL,
  SMALL_INTERVAL,
} = require("./DFTestUtils");
const { expect } = require("chai");

function getStatSum(planet) {
  let statSum = 0;
  for (let stat of [
    "speed",
    "range",
    "defense",
    "populationCap",
    "populationGrowth",
  ]) {
    statSum += planet[stat].toNumber();
  }
  return statSum;
}

describe("DarkForestArtifacts", function () {
  async function conquerArtifactPlanet(test) {
    const spawnPointId = getPlanetIdFromHex(asteroid1Location.hex);
    const planetWithArtifact1Id = getPlanetIdFromHex(planetWithArtifact1.hex);

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await test.contract.move(
      ...makeMoveArgs(
        spawnPointId,
        planetWithArtifact1Id,
        10,
        1999,
        0,
        80000,
        0
      ),
      {
        from: user1,
      }
    );
  }

  async function getArtifactsOwnedBy(test, addr) {
    const artifactsIds = await test.contract.getPlayerArtifactIds(addr);
    return (await test.contract.bulkGetArtifactsByIds(artifactsIds)).map(
      (artifactWithMetadata) => artifactWithMetadata[0]
    );
  }

  beforeEach(async function () {
    await initializeTest(this);

    await this.contract.changeTokenMintEndTime(999999999999999, {
      from: deployer,
    });

    await web3.eth.sendTransaction({
      from: deployer,
      to: user1,
      value: "10000000000000000000",
    });

    let planetId = getPlanetIdFromHex(asteroid1Location.hex);

    await this.contract.initializePlayer(...makeInitArgs(planetId, 10, 1999), {
      from: user1,
    });
  });

  it("be able to mint/buff and withdraw/debuff an artifact on lvl1+ planets where the 14th byte is zero", async function () {
    this.timeout(10000);

    const planetWithArtifact1Id = getPlanetIdFromHex(planetWithArtifact1.hex);

    await conquerArtifactPlanet(this);

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    let planet = await this.contract.planets(planetWithArtifact1Id);
    const statSumBefore = getStatSum(planet);

    await this.contract.findArtifact(
      [1, 2],
      [
        [1, 2],
        [3, 4],
      ],
      [5, 6],
      [planetWithArtifact1Id, 1],
      {
        from: user1,
      }
    );

    let planetInfo = await this.contract.planetsExtendedInfo(
      planetWithArtifact1Id
    );
    expect(planetInfo.heldArtifactId).to.not.be.bignumber.equal("0");

    // artifact should be owned by contract
    const artifactsBefore = await getArtifactsOwnedBy(
      this,
      this.contract.address
    );
    expect(artifactsBefore[0].discoverer).to.eq(user1);
    expect(artifactsBefore.length).to.equal(1);

    // planet should be buffed after discovered artifact
    planet = await this.contract.planets(planetWithArtifact1Id);
    const statSumMiddle = getStatSum(planet);
    expect(statSumMiddle).to.be.not.equal(statSumBefore);

    // after a while should be able to withdraw artifact
    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.withdrawArtifact(planetWithArtifact1Id, {
      from: user1,
    });

    planetInfo = await this.contract.planetsExtendedInfo(planetWithArtifact1Id);
    expect(planetInfo.heldArtifactId).to.be.bignumber.equal("0");

    const artifactsAfter = await getArtifactsOwnedBy(this, user1);
    expect(artifactsAfter.length).to.equal(1);

    // planet should be debuffed after withdrew artifact
    planet = await this.contract.planets(planetWithArtifact1Id);
    const statSumAfter = getStatSum(planet);
    expect(statSumMiddle).to.be.not.equal(statSumAfter);
  });

  it("should return a correct token uri for a minted artifact", async function () {
    this.timeout(10000);

    const planetWithArtifact1Id = getPlanetIdFromHex(planetWithArtifact1.hex);

    await conquerArtifactPlanet(this);

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.findArtifact(
      [1, 2],
      [
        [1, 2],
        [3, 4],
      ],
      [5, 6],
      [planetWithArtifact1Id, 1],
      {
        from: user1,
      }
    );

    let planetInfo = await this.contract.planetsExtendedInfo(
      planetWithArtifact1Id
    );

    const tokenUri = await this.tokensContract.tokenURI(
      planetInfo.heldArtifactId
    );

    expect(tokenUri).to.eq(
      "https://zkga.me/token-uri/artifact/" + planetInfo.heldArtifactId
    );
  });

  it("should not be able to withdraw artifact before lockup period", async function () {
    this.timeout(10000);

    const planetWithArtifact1Id = getPlanetIdFromHex(planetWithArtifact1.hex);

    await conquerArtifactPlanet(this);

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.findArtifact(
      [1, 2],
      [
        [1, 2],
        [3, 4],
      ],
      [5, 6],
      [planetWithArtifact1Id, 1],
      {
        from: user1,
      }
    );

    time.increase(SMALL_INTERVAL);
    time.advanceBlock();

    expectRevert(
      this.contract.withdrawArtifact(planetWithArtifact1Id, {
        from: user1,
      }),
      "planet's artifact is in lockup period"
    );
  });

  it("should be able to deposit an artifact you own to buff a planet you own", async function () {
    this.timeout(10000);

    const spawnPointId = getPlanetIdFromHex(asteroid1Location.hex);
    const planetWithArtifact1Id = getPlanetIdFromHex(planetWithArtifact1.hex);

    await conquerArtifactPlanet(this);

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.findArtifact(
      [1, 2],
      [
        [1, 2],
        [3, 4],
      ],
      [5, 6],
      [planetWithArtifact1Id, 1],
      {
        from: user1,
      }
    );

    // withdraw artifact after lockup period is over
    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.withdrawArtifact(planetWithArtifact1Id, {
      from: user1,
    });

    let spawnPlanet = await this.contract.planets(spawnPointId);
    const spawnStatSumBefore = getStatSum(spawnPlanet);

    const artifacts = await getArtifactsOwnedBy(this, user1);
    await this.contract.depositArtifact(spawnPointId, artifacts[0].id, {
      from: user1,
    });

    const planetInfo = await this.contract.planetsExtendedInfo(spawnPointId);
    expect(planetInfo.heldArtifactId).to.not.be.bignumber.equal("0");

    // planet should be buffed
    spawnPlanet = await this.contract.planets(spawnPointId);
    const spawnStatSumAfter = getStatSum(spawnPlanet);
    expect(spawnStatSumAfter).to.be.not.equal(spawnStatSumBefore);
  });

  it("not be able to deposit an artifact onto silver mine you own", async function () {
    this.timeout(10000);

    const spawnPointId = getPlanetIdFromHex(asteroid1Location.hex);
    const planetWithArtifact1Id = getPlanetIdFromHex(planetWithArtifact1.hex);
    const silverMineId = getPlanetIdFromHex(silverStar1Location.hex);

    await conquerArtifactPlanet(this);

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.move(
      ...makeMoveArgs(spawnPointId, silverMineId, 10, 1999, 0, 80000, 0),
      {
        from: user1,
      }
    );

    await this.contract.findArtifact(
      [1, 2],
      [
        [1, 2],
        [3, 4],
      ],
      [5, 6],
      [planetWithArtifact1Id, 1],
      {
        from: user1,
      }
    );

    // withdraw artifact after lockup period is over
    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.withdrawArtifact(planetWithArtifact1Id, {
      from: user1,
    });

    const artifacts = await getArtifactsOwnedBy(this, user1);
    expectRevert(
      this.contract.depositArtifact(silverMineId, artifacts[0].id, {
        from: user1,
      }),
      "can't deposit artifact on silver mine"
    );
  });

  it("should not be able to withdraw from planet you don't own, withdraw from planet w no artifact, deposit onto planet you don't own, or deposit artifact you don't own", async function () {
    this.timeout(10000);

    const spawnPoint2Id = getPlanetIdFromHex(asteroid2Location.hex);
    const planetWithArtifact1Id = getPlanetIdFromHex(planetWithArtifact1.hex);

    await this.contract.initializePlayer(
      ...makeInitArgs(spawnPoint2Id, 10, 1999),
      {
        from: user2,
      }
    );

    await conquerArtifactPlanet(this);

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.findArtifact(
      [1, 2],
      [
        [1, 2],
        [3, 4],
      ],
      [5, 6],
      [planetWithArtifact1Id, 1],
      {
        from: user1,
      }
    );

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    expectRevert(
      this.contract.withdrawArtifact(planetWithArtifact1Id, {
        from: user2,
      }),
      "you can only withdraw from a planet you own"
    );

    await this.contract.withdrawArtifact(planetWithArtifact1Id, {
      from: user1,
    });
    const artifactId = (await getArtifactsOwnedBy(this, user1))[0].id;

    expectRevert(
      this.contract.depositArtifact(spawnPoint2Id, artifactId, {
        from: user1,
      }),
      "you can only deposit on a planet you own"
    );

    expectRevert(
      this.contract.depositArtifact(spawnPoint2Id, artifactId, {
        from: user2,
      }),
      "you can only deposit artifacts you own"
    );
  });

  it("should not be able to deposit artifact onto planet that already has artifact", async function () {
    const spawnPointId = getPlanetIdFromHex(asteroid1Location.hex);
    const planetWithArtifact1Id = getPlanetIdFromHex(planetWithArtifact1.hex);
    const planetWithArtifact2Id = getPlanetIdFromHex(planetWithArtifact2.hex);

    for (let planetId of [planetWithArtifact1Id, planetWithArtifact2Id]) {
      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(spawnPointId, planetId, 10, 1999, 0, 80000, 0),
        {
          from: user1,
        }
      );
    }

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    for (let planetId of [planetWithArtifact1Id, planetWithArtifact2Id]) {
      await this.contract.findArtifact(
        [1, 2],
        [
          [1, 2],
          [3, 4],
        ],
        [5, 6],
        [planetId, 1],
        {
          from: user1,
        }
      );
    }

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.withdrawArtifact(planetWithArtifact1Id, {
      from: user1,
    });
    const artifactId = (await getArtifactsOwnedBy(this, user1))[0].id;
    expectRevert(
      this.contract.depositArtifact(planetWithArtifact2Id, artifactId, {
        from: user1,
      }),
      "planet already has an artifact"
    );
  });

  it("should be able to conquer another player's planet and take their artifact", async function () {
    this.timeout(10000);

    const spawnPoint1Id = getPlanetIdFromHex(asteroid1Location.hex);
    const spawnPoint2Id = getPlanetIdFromHex(asteroid2Location.hex);
    const planetWithArtifact1Id = getPlanetIdFromHex(planetWithArtifact1.hex);

    await this.contract.initializePlayer(
      ...makeInitArgs(spawnPoint2Id, 10, 1999),
      {
        from: user2,
      }
    );

    await conquerArtifactPlanet(this);

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.findArtifact(
      [1, 2],
      [
        [1, 2],
        [3, 4],
      ],
      [5, 6],
      [planetWithArtifact1Id, 1],
      {
        from: user1,
      }
    );

    // after finding artifact, planet's popCap might get buffed
    // so let it fill up again
    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    const artifactPlanetPopCap = (
      await this.contract.planets(planetWithArtifact1Id)
    ).populationCap.toNumber();
    await this.contract.move(
      ...makeMoveArgs(
        planetWithArtifact1Id,
        spawnPoint1Id,
        10,
        1999,
        10,
        Math.floor(artifactPlanetPopCap * 0.999), // if only 0.99 it's still untakeable, bc high def
        0
      ),
      { from: user1 }
    );

    // steal planet
    await this.contract.move(
      ...makeMoveArgs(
        spawnPoint2Id,
        planetWithArtifact1Id,
        10,
        1999,
        0,
        50000,
        0
      ),
      { from: user2 }
    );

    // withdraw artifact after lockup period is over
    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.withdrawArtifact(planetWithArtifact1Id, {
      from: user2,
    });
    const artifacts = await getArtifactsOwnedBy(this, user2);
    expect(artifacts.length).to.be.equal(1);
  });

  it("not be able to mint an artifact if you have less than 95% of its energy", async function () {
    this.timeout(10000);

    const planetWithArtifact1Id = getPlanetIdFromHex(planetWithArtifact1.hex);

    await conquerArtifactPlanet(this);

    // increase a small amt of time so that you get SOME energy, only a little though!
    time.increase(10);
    time.advanceBlock();

    await this.contract.refreshPlanet(planetWithArtifact1Id);
    const planet = (
      await this.contract.bulkGetPlanetsByIds([planetWithArtifact1Id])
    )[0];

    expect(parseInt(planet.population)).to.be.lessThan(
      0.95 * parseInt(planet.populationCap)
    );

    expectRevert(
      this.contract.findArtifact(
        [1, 2],
        [
          [1, 2],
          [3, 4],
        ],
        [5, 6],
        [planetWithArtifact1Id, 1],
        {
          from: user1,
        }
      ),
      "you must have 95% of the max energy."
    );

    const planetInfo = await this.contract.planetsExtendedInfo(
      planetWithArtifact1Id
    );
    expect(planetInfo.heldArtifactId).to.be.bignumber.equal("0");
  });

  it("not be able to mint an artifact on a silver mine", async function () {
    this.timeout(10000);

    const spawnPointId = getPlanetIdFromHex(asteroid1Location.hex);
    const silverMineWithArtifactId = getPlanetIdFromHex(
      "00007c2512896efb002d462faee6041fb33d58930eb9e6b4fbae6d048e9c44c3"
    );

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.move(
      ...makeMoveArgs(
        spawnPointId,
        silverMineWithArtifactId,
        10,
        1999,
        0,
        80000,
        0
      ),
      {
        from: user1,
      }
    );
    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    expectRevert(
      this.contract.findArtifact(
        [1, 2],
        [
          [1, 2],
          [3, 4],
        ],
        [5, 6],
        [silverMineWithArtifactId, 1],
        {
          from: user1,
        }
      ),
      "can't mint artifact on silver mine"
    );
  });

  it("not be able to mint an artifact on planets where the 14th byte is not zero", async function () {
    this.timeout(10000);

    const spawnPointId = getPlanetIdFromHex(asteroid1Location.hex);

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await expectRevert(
      this.contract.findArtifact(
        [1, 2],
        [
          [1, 2],
          [3, 4],
        ],
        [5, 6],
        [spawnPointId, 1],
        {
          from: user1,
        }
      ),
      "you can't find an artifact on this planet"
    );

    const planetInfo = await this.contract.planetsExtendedInfo(spawnPointId);
    expect(planetInfo.heldArtifactId).to.be.bignumber.equal("0");
  });

  it("should mint randomly", async function () {
    this.timeout(1000 * 60);
    let artifacts = [];

    let prevLocationId = getPlanetIdFromHex(asteroid1Location.hex);

    for (let i = 0; i < 20; i++) {
      const randomId =
        `00007c2512896efbcc2d462faee0000fb33d58930eb9e6b4fbae6d048e9c44` +
        (i >= 10 ? i.toString()[0] : 0) +
        "" +
        (i % 10);

      const planetWithArtifactId = getPlanetIdFromHex(randomId);
      console.log(
        `token randomness check ${i + 1}/20 - ${planetWithArtifactId}`
      );

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.move(
        ...makeMoveArgs(
          prevLocationId,
          planetWithArtifactId,
          10,
          1999,
          0,
          80000,
          0
        ),
        {
          from: user1,
        }
      );

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.findArtifact(
        [1, 2],
        [
          [1, 2],
          [3, 4],
        ],
        [5, 6],
        [planetWithArtifactId, 1],
        {
          from: user1,
        }
      );

      time.increase(LARGE_INTERVAL);
      time.advanceBlock();

      await this.contract.withdrawArtifact(planetWithArtifactId, {
        from: user1,
      });
      artifacts = await getArtifactsOwnedBy(this, user1);

      expect(artifacts[artifacts.length - 1].planetBiome).to.eq("1");
      expect(artifacts[artifacts.length - 1].discoverer).to.eq(user1);
      expect(
        parseInt(artifacts[artifacts.length - 1].planetLevel)
      ).to.be.at.least(1);

      prevLocationId = planetWithArtifactId;
    }

    analyzeMintedArtifacts(artifacts);
  });

  function analyzeMintedArtifacts(minted) {
    let artifactTypeSet = new Set();

    for (let i = 0; i < minted.length; i++) {
      artifactTypeSet.add(minted[i].artifactType);
    }

    console.log(`attempted finding an artifact ${minted.length} times`);
    console.log(`minted a total of ${artifactTypeSet.size} artifact types`);

    expect(artifactTypeSet.size).to.be.greaterThan(1);
  }

  it("should not mint an artifact on the same planet twice", async function () {
    this.timeout(10000);

    const planetWithArtifact1Id = getPlanetIdFromHex(planetWithArtifact1.hex);

    await conquerArtifactPlanet(this);
    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await this.contract.findArtifact(
      [1, 2],
      [
        [1, 2],
        [3, 4],
      ],
      [5, 6],
      [planetWithArtifact1Id, 1],
      {
        from: user1,
      }
    );

    time.increase(LARGE_INTERVAL);
    time.advanceBlock();

    await expectRevert(
      this.contract.findArtifact(
        [1, 2],
        [
          [1, 2],
          [3, 4],
        ],
        [5, 6],
        [planetWithArtifact1Id, 1],
        {
          from: user1,
        }
      ),
      "planet already plundered"
    );
  });
});
