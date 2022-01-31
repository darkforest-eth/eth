import { DarkForestCore, DarkForestGetters } from '@darkforest_eth/contracts/typechain';
import { modPBigInt } from '@darkforest_eth/hashing';
import { BigNumber, BigNumberish } from 'ethers';
import { ethers, waffle } from 'hardhat';
import { TestLocation } from './TestLocation';
import { World } from './TestWorld';
import { ARTIFACT_PLANET_1, initializers, shrinkingInitializers, LARGE_INTERVAL } from './WorldConstants';

const { constants } = ethers;

const {
  PLANETHASH_KEY,
  SPACETYPE_KEY,
  BIOMEBASE_KEY,
  PERLIN_LENGTH_SCALE,
  PERLIN_MIRROR_X,
  PERLIN_MIRROR_Y,
} = initializers;

export const ZERO_ADDRESS = constants.AddressZero;
export const BN_ZERO = constants.Zero;

export const fixtureLoader = waffle.createFixtureLoader();

export function shrinkAlgorithm(
  shrinkStart: number, 
  roundEnd: number,
  currTime: number
):number 
{
  const shrinkFactor = shrinkingInitializers.SHRINK;
  const totalTime = roundEnd - shrinkStart;
  const now = currTime // in Seconds.

  // Only shrink after START_TIME has occurred. Allows for delaying of shrinking.
  const startTime = shrinkStart > now ? now : shrinkStart;
  const minRadius = shrinkingInitializers.MIN_RADIUS;
  var timeElapsed = now - startTime;
  // // Clip timeElapsed to max totalTime
  if(timeElapsed > totalTime) timeElapsed = totalTime;
  // // only shrink after initial time elapsed.
  var radius = (
      shrinkingInitializers.INITIAL_WORLD_RADIUS * 
          (
              (Math.pow(totalTime,shrinkFactor)) - 
              (Math.pow(timeElapsed,shrinkFactor))
          )
      ) 
      / Math.pow(totalTime,shrinkFactor);

  // // set minimum
  if (radius < minRadius) radius = minRadius;

  return Math.floor(radius);
}

export function hexToBigNumber(hex: string): BigNumber {
  return BigNumber.from(`0x${hex}`);
}

export function makeRevealArgs(
  planetLoc: TestLocation,
  x: number,
  y: number
): [
  [BigNumberish, BigNumberish],
  [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]],
  [BigNumberish, BigNumberish],
  [
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish
  ]
] {
  return [
    [BN_ZERO, BN_ZERO],
    [
      [BN_ZERO, BN_ZERO],
      [BN_ZERO, BN_ZERO],
    ],
    [BN_ZERO, BN_ZERO],
    [
      planetLoc.id,
      planetLoc.perlin,
      modPBigInt(x).toString(),
      modPBigInt(y).toString(),
      PLANETHASH_KEY,
      SPACETYPE_KEY,
      PERLIN_LENGTH_SCALE,
      PERLIN_MIRROR_X ? '1' : '0',
      PERLIN_MIRROR_Y ? '1' : '0',
    ],
  ];
}

export function makeInitArgs(
  planetLoc: TestLocation,
  spawnRadius: number = initializers.INITIAL_WORLD_RADIUS
): [
  [BigNumberish, BigNumberish],
  [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]],
  [BigNumberish, BigNumberish],
  [
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish
  ]
] {
  return [
    [BN_ZERO, BN_ZERO],
    [
      [BN_ZERO, BN_ZERO],
      [BN_ZERO, BN_ZERO],
    ],
    [BN_ZERO, BN_ZERO],
    [
      planetLoc.id,
      planetLoc.perlin,
      spawnRadius,
      PLANETHASH_KEY,
      SPACETYPE_KEY,
      PERLIN_LENGTH_SCALE,
      PERLIN_MIRROR_X ? '1' : '0',
      PERLIN_MIRROR_Y ? '1' : '0',
    ],
  ];
}

export function makeMoveArgs(
  oldLoc: TestLocation,
  newLoc: TestLocation,
  maxDist: BigNumberish,
  popMoved: BigNumberish,
  silverMoved: BigNumberish,
  movedArtifactId: BigNumberish = 0
): [
  [BigNumberish, BigNumberish],
  [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]],
  [BigNumberish, BigNumberish],
  [
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish
  ]
] {
  return [
    [0, 0],
    [
      [0, 0],
      [0, 0],
    ],
    [0, 0],
    [
      oldLoc.id,
      newLoc.id,
      newLoc.perlin,
      newLoc.distFromOrigin + 1,
      maxDist,
      PLANETHASH_KEY,
      SPACETYPE_KEY,
      PERLIN_LENGTH_SCALE,
      PERLIN_MIRROR_X ? '1' : '0',
      PERLIN_MIRROR_Y ? '1' : '0',
      popMoved,
      silverMoved,
      movedArtifactId,
    ],
  ];
}

export function makeFindArtifactArgs(
  location: TestLocation
): [
  [BigNumberish, BigNumberish],
  [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]],
  [BigNumberish, BigNumberish],
  [BigNumberish, BigNumberish, BigNumberish, BigNumberish, BigNumberish, BigNumberish, BigNumberish]
] {
  return [
    [1, 2],
    [
      [1, 2],
      [3, 4],
    ],
    [5, 6],
    [
      location.id,
      1,
      PLANETHASH_KEY,
      BIOMEBASE_KEY,
      PERLIN_LENGTH_SCALE,
      PERLIN_MIRROR_X ? '1' : '0',
      PERLIN_MIRROR_Y ? '1' : '0',
    ],
  ];
}

/**
 * interval is measured in seconds
 */
export async function increaseBlockchainTime(interval = LARGE_INTERVAL) {
  await ethers.provider.send('evm_increaseTime', [interval]);
  await ethers.provider.send('evm_mine', []);
}

export async function getCurrentTime() {
  return (await ethers.provider.getBlock('latest')).timestamp;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function getStatSum(planet: any) {
  let statSum = 0;
  for (const stat of ['speed', 'range', 'defense', 'populationCap', 'populationGrowth']) {
    statSum += planet[stat].toNumber();
  }
  return statSum;
}

// conquers an untouched planet `to` by repeatedly sending attacks from `from`
// assumes that `to` is owned by `signer` and that `from` is an unowned planet
// throws if `to` is owned
export async function conquerUnownedPlanet(
  world: World,
  signer: DarkForestCore,
  from: TestLocation,
  to: TestLocation
) {
  const fromData = await world.contracts.core.planets(from.id);
  let toData = await world.contracts.core.planets(to.id);
  if (toData.owner !== ZERO_ADDRESS) {
    throw new Error('called conquerUnownedPlanet to conquer owned planet');
  }
  const attackEnergyCost = fromData.populationCap.toNumber() * 0.9;
  await increaseBlockchainTime();
  await (await signer.move(...makeMoveArgs(from, to, 0, attackEnergyCost, 0))).wait(); // creates planet in contract
  toData = await world.contracts.core.planets(to.id);
  const toPlanetStartingPop = toData.population.toNumber(); // move hasn't yet been applied

  await (await signer.refreshPlanet(to.id)).wait(); // applies move, since 0 moveDist
  toData = await world.contracts.core.planets(to.id);

  if (toData.owner === ZERO_ADDRESS) {
    // send additional attacks if not yet conquered
    const attackDamage = toPlanetStartingPop - toData.population.toNumber();
    const attacksNeeded = Math.floor(toData.population.toNumber() / attackDamage) + 1;
    for (let i = 0; i < attacksNeeded; i++) {
      await increaseBlockchainTime();
      await signer.move(...makeMoveArgs(from, to, 0, attackEnergyCost, 0));
    }
  }
}

// shuttles silver from `silverProducer` to `to` until `to` is maxed on silver
export async function feedSilverToCap(
  world: World,
  signer: DarkForestCore,
  silverMine: TestLocation,
  to: TestLocation
) {
  const silverMineData = await world.contracts.core.planets(silverMine.id);
  const toData = await world.contracts.core.planets(to.id);
  const attackEnergyCost = silverMineData.populationCap.toNumber() * 0.1;
  const silverMineSilverCap = silverMineData.silverCap.toNumber();
  const toSilverCap = toData.silverCap.toNumber();

  for (let i = 0; i < Math.ceil(toSilverCap / silverMineSilverCap); i++) {
    await increaseBlockchainTime();
    await signer.move(...makeMoveArgs(silverMine, to, 0, attackEnergyCost, silverMineSilverCap));
  }
}

// returns the ID of the artifact minted
export async function user1MintArtifactPlanet(user1Core: DarkForestCore) {
  await user1Core.prospectPlanet(ARTIFACT_PLANET_1.id);
  await increaseBlockchainTime();
  const findArtifactTx = await user1Core.findArtifact(...makeFindArtifactArgs(ARTIFACT_PLANET_1));
  const findArtifactReceipt = await findArtifactTx.wait();
  // 0th event is erc721 transfer (i think); 1st event is UpdateArtifact, 2nd argument of this event is artifactId
  const artifactId = findArtifactReceipt.events?.[1].args?.[1];
  return artifactId;
}

export async function getArtifactsOwnedBy(getters: DarkForestGetters, addr: string) {
  const artifactsIds = await getters.getPlayerArtifactIds(addr);
  return (await getters.bulkGetArtifactsByIds(artifactsIds)).map(
    (artifactWithMetadata) => artifactWithMetadata[0]
  );
}
