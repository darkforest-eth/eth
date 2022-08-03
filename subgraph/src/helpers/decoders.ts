/* eslint-disable eqeqeq */
import { BigInt } from '@graphprotocol/graph-ts';
import {
  DarkForest__bulkGetArtifactsByIdsResultRetStruct,
  DarkForest__bulkGetPlanetsDataByIdsResultRetInfo2Struct,
  DarkForest__bulkGetPlanetsDataByIdsResultRetInfoStruct,
  DarkForest__bulkGetPlanetsDataByIdsResultRetPlanetStruct,
  DarkForest__bulkGetVoyagesByIdsResultRetStruct,
} from '../../../generated/DarkForest/DarkForest';
import { Arrival, Artifact, Planet, Spaceship } from '../../../generated/schema';
import {
  hexStringToPaddedUnprefixed,
  isDefenseBoosted,
  isEnergyCapBoosted,
  isEnergyGrowthBoosted,
  isRangeBoosted,
  isSpaceJunkHalved,
  isSpeedBoosted,
  toArrivalType,
  toArtifactRarity,
  toArtifactType,
  toBiome,
  toPlanetType,
  toSpaceshipType,
  toSpaceType,
} from './converters';

export function refreshPlanetFromContractData(
  locationDec: BigInt,
  rawPlanet: DarkForest__bulkGetPlanetsDataByIdsResultRetPlanetStruct,
  rawInfo: DarkForest__bulkGetPlanetsDataByIdsResultRetInfoStruct,
  rawInfo2: DarkForest__bulkGetPlanetsDataByIdsResultRetInfo2Struct
): Planet {
  const locationId = hexStringToPaddedUnprefixed(locationDec);

  // this preserves synthetic fields not found in the contract like hat and revealedCoordinate
  let planet = Planet.load(locationId);
  if (!planet) planet = new Planet(locationId);

  planet.locationDec = locationDec;
  planet.owner = rawPlanet.owner.toHexString(); // addresses gets 0x prefixed and 0 padded in toHexString
  planet.isInitialized = rawInfo.isInitialized;
  planet.createdAt = rawInfo.createdAt.toI32();
  planet.lastUpdated = rawInfo.lastUpdated.toI32();
  planet.perlin = rawInfo.perlin.toI32();
  planet.range = rawPlanet.range.toI32();
  planet.speed = rawPlanet.speed.toI32();
  planet.defense = rawPlanet.defense.toI32();
  planet.milliEnergyLazy = rawPlanet.population;
  planet.milliEnergyCap = rawPlanet.populationCap;
  planet.milliEnergyGrowth = rawPlanet.populationGrowth;
  planet.milliSilverLazy = rawPlanet.silver;
  planet.milliSilverCap = rawPlanet.silverCap;
  planet.milliSilverGrowth = rawPlanet.silverGrowth;
  planet.planetLevel = rawPlanet.planetLevel.toI32();
  planet.defenseUpgrades = rawInfo.upgradeState0.toI32();
  planet.rangeUpgrades = rawInfo.upgradeState1.toI32();
  planet.speedUpgrades = rawInfo.upgradeState2.toI32();
  planet.isEnergyCapBoosted = isEnergyCapBoosted(locationId);
  planet.isEnergyGrowthBoosted = isEnergyGrowthBoosted(locationId);
  planet.isRangeBoosted = isRangeBoosted(locationId);
  planet.isSpeedBoosted = isSpeedBoosted(locationId);
  planet.isDefenseBoosted = isDefenseBoosted(locationId);
  planet.isSpaceJunkHalved = isSpaceJunkHalved(locationId);
  planet.hatLevel = rawInfo.hatLevel.toI32();
  planet.planetType = toPlanetType(rawPlanet.planetType);
  planet.spaceType = toSpaceType(rawInfo.spaceType);
  planet.destroyed = rawInfo.destroyed;
  planet.isHomePlanet = rawPlanet.isHomePlanet;
  planet.spaceJunk = rawInfo.spaceJunk.toI32();
  planet.pausers = rawInfo2.pausers.toI32();
  planet.invadeStartBlock = rawInfo2.invadeStartBlock;
  planet.invader = rawInfo2.invader.toHexString();
  planet.capturer = rawInfo2.capturer.toHexString();

  // artifacts
  planet.hasTriedFindingArtifact = rawInfo.hasTriedFindingArtifact;
  if (rawInfo.prospectedBlockNumber.notEqual(BigInt.fromI32(0))) {
    planet.prospectedBlockNumber = rawInfo.prospectedBlockNumber.toI32();
  } // no else clause, because can't set prospectedBlockNumber to null
  // and also because once prospectedBlockNumber is set to nonnull for first time, it's never changed

  return planet;
}

export function refreshVoyageFromContractData(
  voyageIdDec: BigInt,
  rawVoyage: DarkForest__bulkGetVoyagesByIdsResultRetStruct
): Arrival {
  const voyageId = voyageIdDec.toString(); // ts linter complains about i32.toString()

  let voyage = Arrival.load(voyageId);
  if (!voyage) voyage = new Arrival(voyageId);

  voyage.arrivalId = voyageIdDec.toI32();
  voyage.player = rawVoyage.player.toHexString();
  voyage.fromPlanet = hexStringToPaddedUnprefixed(rawVoyage.fromPlanet);
  voyage.toPlanet = hexStringToPaddedUnprefixed(rawVoyage.toPlanet);
  voyage.milliEnergyArriving = rawVoyage.popArriving;
  voyage.milliSilverMoved = rawVoyage.silverMoved;
  voyage.departureTime = rawVoyage.departureTime.toI32();
  voyage.arrivalTime = rawVoyage.arrivalTime.toI32();
  voyage.arrivalType = toArrivalType(rawVoyage.arrivalType);
  voyage.distance = rawVoyage.distance.toI32();

  if (rawVoyage.carriedArtifactId.equals(BigInt.fromI32(0))) {
    voyage.carriedArtifact = null;
  } else {
    voyage.carriedArtifact = hexStringToPaddedUnprefixed(rawVoyage.carriedArtifactId);
  }

  return voyage;
}

export function refreshSpaceshipFromContractData(
  artifactIdDec: BigInt,
  rawSpaceship: DarkForest__bulkGetArtifactsByIdsResultRetStruct
): Spaceship {
  const artifactId = hexStringToPaddedUnprefixed(artifactIdDec);

  let spaceship = Spaceship.load(artifactId);
  if (!spaceship) spaceship = new Spaceship(artifactId);

  spaceship.idDec = artifactIdDec;
  spaceship.mintedAtTimestamp = rawSpaceship.artifact.mintedAtTimestamp.toI32();
  spaceship.spaceshipType = toSpaceshipType(rawSpaceship.artifact.artifactType);
  spaceship.lastActivated = rawSpaceship.artifact.lastActivated.toI32();
  spaceship.lastDeactivated = rawSpaceship.artifact.lastDeactivated.toI32();
  spaceship.isActivated = spaceship.lastActivated > spaceship.lastDeactivated;

  if (rawSpaceship.locationId.equals(BigInt.fromI32(0))) {
    spaceship.onPlanet = null;
  } else {
    spaceship.onPlanet = hexStringToPaddedUnprefixed(rawSpaceship.locationId);
  }

  if (rawSpaceship.voyageId.equals(BigInt.fromI32(0))) {
    spaceship.onVoyage = null;
  } else {
    spaceship.onVoyage = rawSpaceship.voyageId.toString();
  }

  spaceship.controller = rawSpaceship.artifact.controller.toHexString();

  return spaceship;
}

export function refreshArtifactFromContractData(
  artifactIdDec: BigInt,
  rawArtifact: DarkForest__bulkGetArtifactsByIdsResultRetStruct
): Artifact {
  const artifactId = hexStringToPaddedUnprefixed(artifactIdDec);

  let artifact = Artifact.load(artifactId);
  if (!artifact) artifact = new Artifact(artifactId);

  artifact.idDec = artifactIdDec;
  if (rawArtifact.artifact.planetDiscoveredOn.equals(BigInt.fromI32(0))) {
    artifact.planetDiscoveredOn = null;
  } else {
    artifact.planetDiscoveredOn = hexStringToPaddedUnprefixed(
      rawArtifact.artifact.planetDiscoveredOn
    );
  }
  artifact.rarity = toArtifactRarity(rawArtifact.artifact.rarity);
  artifact.planetBiome = toBiome(rawArtifact.artifact.planetBiome);
  artifact.mintedAtTimestamp = rawArtifact.artifact.mintedAtTimestamp.toI32();
  artifact.discoverer = rawArtifact.artifact.discoverer.toHexString();
  artifact.artifactType = toArtifactType(rawArtifact.artifact.artifactType);
  artifact.lastActivated = rawArtifact.artifact.lastActivated.toI32();
  artifact.lastDeactivated = rawArtifact.artifact.lastDeactivated.toI32();
  artifact.isActivated = artifact.lastActivated > artifact.lastDeactivated;
  if (rawArtifact.artifact.wormholeTo.equals(BigInt.fromI32(0))) {
    artifact.wormholeTo = null;
  } else {
    artifact.wormholeTo = hexStringToPaddedUnprefixed(rawArtifact.artifact.wormholeTo);
  }

  artifact.energyCapMultiplier = rawArtifact.upgrade.popCapMultiplier.toI32();
  artifact.energyGrowthMultiplier = rawArtifact.upgrade.popGroMultiplier.toI32();
  artifact.rangeMultiplier = rawArtifact.upgrade.rangeMultiplier.toI32();
  artifact.speedMultiplier = rawArtifact.upgrade.speedMultiplier.toI32();
  artifact.defenseMultiplier = rawArtifact.upgrade.defMultiplier.toI32();

  artifact.ownerAddress = rawArtifact.owner.toHexString();

  if (rawArtifact.locationId.equals(BigInt.fromI32(0))) {
    artifact.onPlanet = null;
  } else {
    artifact.onPlanet = hexStringToPaddedUnprefixed(rawArtifact.locationId);
  }

  if (rawArtifact.voyageId.equals(BigInt.fromI32(0))) {
    artifact.onVoyage = null;
  } else {
    artifact.onVoyage = rawArtifact.voyageId.toString();
  }

  return artifact;
}
