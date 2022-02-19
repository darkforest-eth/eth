import { fakeHash, mimcHash, modPBigInt, perlin } from '@darkforest_eth/hashing';
import {
  buildContractCallArgs,
  fakeProof,
  RevealSnarkContractCallArgs,
  revealSnarkWasmPath,
  revealSnarkZkeyPath,
  SnarkJSProofAndSignals,
} from '@darkforest_eth/snarks';
import { BigNumber } from 'ethers';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
// @ts-ignore
import * as snarkjs from 'snarkjs';

task('game:pause', 'pause the game').setAction(gamePause);

async function gamePause({}, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  const contract = await hre.ethers.getContractAt('DarkForest', hre.contracts.CONTRACT_ADDRESS);

  const pauseReceipt = await contract.pause();
  await pauseReceipt.wait();
}

task('game:resume', 'resume the game').setAction(gameResume);

async function gameResume({}, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  const contract = await hre.ethers.getContractAt('DarkForest', hre.contracts.CONTRACT_ADDRESS);

  const unpauseReceipt = await contract.unpause();
  await unpauseReceipt.wait();
}

task('game:setRadius', 'change the radius')
  .addPositionalParam('radius', 'the radius', undefined, types.int)
  .setAction(gameSetRadius);

async function gameSetRadius(args: { radius: number }, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  const contract = await hre.ethers.getContractAt('DarkForest', hre.contracts.CONTRACT_ADDRESS);

  const setRadiusReceipt = await contract.adminSetWorldRadius(args.radius);
  await setRadiusReceipt.wait();
}

task('game:setWorldRadiusMin', 'change the WORLD_RADIUS_MIN')
  .addPositionalParam('radius', 'the minimum radius of the world', undefined, types.int)
  .setAction(gameSetWorldRadiusMin);

async function gameSetWorldRadiusMin(args: { radius: number }, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  const contract = await hre.ethers.getContractAt('DarkForest', hre.contracts.CONTRACT_ADDRESS);

  const changeWorldRadiusMinReceipt = await contract.changeWorldRadiusMin(args.radius);
  await changeWorldRadiusMinReceipt.wait();
}

task('game:setTokenMintEnd', 'change the token mint end timestamp')
  .addPositionalParam(
    'tokenend',
    'the timestamp (seconds since epoch) of the token mint endtime',
    undefined,
    types.int
  )
  .setAction(setTokenMintEnd);

async function setTokenMintEnd(args: { tokenend: number }, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  const contract = await hre.ethers.getContractAt('DarkForest', hre.contracts.CONTRACT_ADDRESS);

  const setRadiusReceipt = await contract.setTokenMintEndTime(args.tokenend);
  await setRadiusReceipt.wait();
}

// 0d0847138e379ddf66742eb0d25b21f87b6295444dd74309e22973fab695140c

task('game:setPlanetOwner', 'sets the owner of the given planet to be the given address')
  .addPositionalParam('planetId', 'non-0x-prefixed planet locationId', undefined, types.string)
  .addPositionalParam('address', '0x-prefixed address of a player', undefined, types.string)
  .setAction(setPlanetOwner);

async function setPlanetOwner(
  { planetId, address }: { planetId: string; address: string },
  hre: HardhatRuntimeEnvironment
) {
  await hre.run('utils:assertChainId');
  const contract = await hre.ethers.getContractAt('DarkForest', hre.contracts.CONTRACT_ADDRESS);

  const setPlanetOwnerReciept = await contract.setOwner(BigNumber.from('0x' + planetId), address);
  await setPlanetOwnerReciept.wait();
}

task(
  'game:createPlanets',
  'creates the planets defined in the darkforest.toml [[planets]] key. Only works when zk checks are enabled (using regular mimc fn)'
).setAction(createPlanets);

async function createPlanets({}, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  const contract = await hre.ethers.getContractAt('DarkForest', hre.contracts.CONTRACT_ADDRESS);

  for (const adminPlanetInfo of hre.adminPlanets) {
    try {
      const location = hre.initializers.DISABLE_ZK_CHECKS
        ? fakeHash(hre.initializers.PLANET_RARITY)(adminPlanetInfo.x, adminPlanetInfo.y).toString()
        : mimcHash(hre.initializers.PLANETHASH_KEY)(
            adminPlanetInfo.x,
            adminPlanetInfo.y
          ).toString();
      const adminPlanetCoords = {
        x: adminPlanetInfo.x,
        y: adminPlanetInfo.y,
      };
      const perlinValue = perlin(adminPlanetCoords, {
        key: hre.initializers.SPACETYPE_KEY,
        scale: hre.initializers.PERLIN_LENGTH_SCALE,
        mirrorX: hre.initializers.PERLIN_MIRROR_X,
        mirrorY: hre.initializers.PERLIN_MIRROR_Y,
        floor: true,
      });

      const createPlanetReceipt = await contract.createPlanet({
        ...adminPlanetInfo,
        location,
        perlin: perlinValue,
      });
      await createPlanetReceipt.wait();
      if (adminPlanetInfo.revealLocation) {
        const pfArgs = await makeRevealProof(
          adminPlanetInfo.x,
          adminPlanetInfo.y,
          hre.initializers.PLANETHASH_KEY,
          hre.initializers.SPACETYPE_KEY,
          hre.initializers.PERLIN_LENGTH_SCALE,
          hre.initializers.PERLIN_MIRROR_X,
          hre.initializers.PERLIN_MIRROR_Y,
          hre.initializers.DISABLE_ZK_CHECKS,
          hre.initializers.PLANET_RARITY
        );
        const revealPlanetReceipt = await contract.revealLocation(...pfArgs);
        await revealPlanetReceipt.wait();
      }
      console.log(`created admin planet at (${adminPlanetInfo.x}, ${adminPlanetInfo.y})`);
    } catch (e) {
      console.log(`error creating planet at (${adminPlanetInfo.x}, ${adminPlanetInfo.y}):`);
      console.log(e);
    }
  }
}

async function makeRevealProof(
  x: number,
  y: number,
  planetHashKey: number,
  spaceTypeKey: number,
  scale: number,
  mirrorX: boolean,
  mirrorY: boolean,
  zkChecksDisabled: boolean,
  planetRarity: number
): Promise<RevealSnarkContractCallArgs> {
  if (zkChecksDisabled) {
    const location = fakeHash(planetRarity)(x, y).toString();
    const perlinValue = perlin(
      { x, y },
      {
        key: spaceTypeKey,
        scale,
        mirrorX,
        mirrorY,
        floor: true,
      }
    );
    const { proof, publicSignals } = fakeProof([
      location,
      perlinValue.toString(),
      modPBigInt(x).toString(),
      modPBigInt(y).toString(),
      planetHashKey.toString(),
      spaceTypeKey.toString(),
      scale.toString(),
      mirrorX ? '1' : '0',
      mirrorY ? '1' : '0',
    ]);
    return buildContractCallArgs(proof, publicSignals) as RevealSnarkContractCallArgs;
  } else {
    const { proof, publicSignals }: SnarkJSProofAndSignals = await snarkjs.groth16.fullProve(
      {
        x: modPBigInt(x).toString(),
        y: modPBigInt(y).toString(),
        PLANETHASH_KEY: planetHashKey.toString(),
        SPACETYPE_KEY: spaceTypeKey.toString(),
        SCALE: scale.toString(),
        xMirror: mirrorX ? '1' : '0',
        yMirror: mirrorY ? '1' : '0',
      },
      revealSnarkWasmPath,
      revealSnarkZkeyPath
    );

    return buildContractCallArgs(proof, publicSignals) as RevealSnarkContractCallArgs;
  }
}
