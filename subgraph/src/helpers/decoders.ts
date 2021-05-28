import { log, BigInt } from '@graphprotocol/graph-ts';
import {
  bjjFieldElementToSignedInt,
  hexStringToPaddedUnprefixed,
  isDefenseBoosted,
  isEnergyCapBoosted,
  isEnergyGrowthBoosted,
  isRangeBoosted,
  isSpeedBoosted,
  toArrivalType,
  toArtifactRarity,
  toArtifactType,
  toBiome,
  toPlanetType,
  toSpaceType,
} from './converters';

import { Arrival, Artifact, Planet } from '../../generated/schema';

import {
  DarkForestCore__planetArrivalsResultValue0Struct,
  DarkForestCore__planetsExtendedInfoResultValue0Struct,
  DarkForestCore__planetsResultValue0Struct,
  DarkForestCore__revealedCoordsResultValue0Struct,
} from '../../generated/DarkForestCore/DarkForestCore';
import { DarkForestGetters__bulkGetArtifactsByIdsResultRetStruct } from '../../generated/DarkForestCore/DarkForestGetters';

export function refreshPlanetFromContractData(
  locationDec: BigInt,
  rawPlanet: DarkForestCore__planetsResultValue0Struct,
  rawInfo: DarkForestCore__planetsExtendedInfoResultValue0Struct,
  rawRevealedCoords: DarkForestCore__revealedCoordsResultValue0Struct
): Planet {
  let locationId = hexStringToPaddedUnprefixed(locationDec.toHexString());

  let planet = Planet.load(locationId) || new Planet(locationId);

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
  planet.hatLevel = rawInfo.hatLevel.toI32();
  planet.planetType = toPlanetType(rawPlanet.planetType);
  planet.spaceType = toSpaceType(rawInfo.spaceType);
  planet.destroyed = rawInfo.destroyed;
  planet.isHomePlanet = rawPlanet.isHomePlanet;

  // revealed coords
  if (!rawRevealedCoords.locationId.equals(BigInt.fromI32(0))) {
    planet.isRevealed = true;
    planet.x = bjjFieldElementToSignedInt(rawRevealedCoords.x);
    planet.y = bjjFieldElementToSignedInt(rawRevealedCoords.y);
    planet.revealer = rawRevealedCoords.revealer.toHexString();
  } else {
    planet.isRevealed = false;
  }

  // artifacts
  planet.hasTriedFindingArtifact = rawInfo.hasTriedFindingArtifact;
  if (rawInfo.prospectedBlockNumber.notEqual(BigInt.fromI32(0))) {
    planet.prospectedBlockNumber = rawInfo.prospectedBlockNumber.toI32();
  } // no else clause, because can't set prospectedBlockNumber to null
  // and also because once prospectedBlockNumber is set to nonnull for first time, it's never changed

  return planet as Planet;
}

export function refreshVoyageFromContractData(
  voyageIdDec: BigInt,
  rawVoyage: DarkForestCore__planetArrivalsResultValue0Struct
): Arrival {
  let voyageId = voyageIdDec.toString(); // ts linter complains about i32.toString()

  let voyage = Arrival.load(voyageId) || new Arrival(voyageId);

  voyage.arrivalId = voyageIdDec.toI32();
  voyage.player = rawVoyage.player.toHexString();
  voyage.fromPlanet = hexStringToPaddedUnprefixed(rawVoyage.fromPlanet.toHexString());
  voyage.toPlanet = hexStringToPaddedUnprefixed(rawVoyage.toPlanet.toHexString());
  voyage.milliEnergyArriving = rawVoyage.popArriving;
  voyage.milliSilverMoved = rawVoyage.silverMoved;
  voyage.departureTime = rawVoyage.departureTime.toI32();
  voyage.arrivalTime = rawVoyage.arrivalTime.toI32();
  voyage.arrivalType = toArrivalType(rawVoyage.arrivalType);
  voyage.distance = rawVoyage.distance.toI32();

  if (rawVoyage.carriedArtifactId.equals(BigInt.fromI32(0))) {
    voyage.carriedArtifact = null;
  } else {
    voyage.carriedArtifact = hexStringToPaddedUnprefixed(rawVoyage.carriedArtifactId.toHexString());
  }

  return voyage as Arrival;
}

export function refreshArtifactFromContractData(
  artifactIdDec: BigInt,
  rawArtifact: DarkForestGetters__bulkGetArtifactsByIdsResultRetStruct
): Artifact {
  let artifactId = hexStringToPaddedUnprefixed(artifactIdDec.toHexString());

  let artifact = Artifact.load(artifactId) || new Artifact(artifactId);

  artifact.idDec = artifactIdDec;
  artifact.planetDiscoveredOn = hexStringToPaddedUnprefixed(
    rawArtifact.artifact.planetDiscoveredOn.toHexString()
  );
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
    artifact.wormholeTo = hexStringToPaddedUnprefixed(
      rawArtifact.artifact.wormholeTo.toHexString()
    );
  }

  artifact.energyCapMultiplier = rawArtifact.upgrade.popCapMultiplier.toI32();
  artifact.energyGrowthMultiplier = rawArtifact.upgrade.popGroMultiplier.toI32();
  artifact.rangeMultiplier = rawArtifact.upgrade.rangeMultiplier.toI32();
  artifact.speedMultiplier = rawArtifact.upgrade.speedMultiplier.toI32();
  artifact.defenseMultiplier = rawArtifact.upgrade.defMultiplier.toI32();

  artifact.owner = rawArtifact.owner.toHexString();

  if (rawArtifact.locationId.equals(BigInt.fromI32(0))) {
    artifact.onPlanet = null;
  } else {
    artifact.onPlanet = hexStringToPaddedUnprefixed(rawArtifact.locationId.toHexString());
  }

  if (rawArtifact.voyageId.equals(BigInt.fromI32(0))) {
    artifact.onVoyage = null;
  } else {
    artifact.onVoyage = rawArtifact.voyageId.toString();
  }

  return artifact as Artifact;
}
