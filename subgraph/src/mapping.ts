import { Address, ethereum, BigInt } from '@graphprotocol/graph-ts';

import {
  ArrivalQueued,
  PlanetUpgraded,
  PlayerInitialized,
  PlanetHatBought,
  PlanetTransferred,
  PlanetProspected,
  DarkForestCore__planetsResultValue0Struct,
  DarkForestCore__planetsExtendedInfoResultValue0Struct,
  DarkForestCore__revealedCoordsResultValue0Struct,
  DarkForestCore__planetArrivalsResultValue0Struct,
  PlanetSilverWithdrawn,
  LocationRevealed,
  ArtifactFound,
  ArtifactDeposited,
  ArtifactWithdrawn,
  ArtifactActivated,
  ArtifactDeactivated,
} from '../generated/DarkForestCore/DarkForestCore';
import {
  DarkForestGetters,
  DarkForestGetters__bulkGetArtifactsByIdsResultRetStruct,
} from '../generated/DarkForestCore/DarkForestGetters';

import { CORE_CONTRACT_ADDRESS, GETTERS_CONTRACT_ADDRESS } from '@darkforest_eth/contracts';

import { Arrival, ArrivalQueue, Meta, Player, Planet, Hat, Artifact } from '../generated/schema';
import { hexStringToPaddedUnprefixed, toLowercase } from './helpers/converters';
import {
  refreshArtifactFromContractData,
  refreshPlanetFromContractData,
  refreshVoyageFromContractData,
} from './helpers/decoders';
import { log } from '@graphprotocol/graph-ts';
import { arrive } from './helpers/arrivalHelpers';

// NOTE: the timestamps within are all unix epoch in seconds NOT MILLISECONDS
// like in all the JS code where youll see divided by contractPrecision. As a
// result be very careful with your copy pastes. And TODO, unify the codebases

export function handleArtifactFound(event: ArtifactFound): void {
  let meta = getMeta(event.block.timestamp.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  meta.save();

  // instead of adding to artifact refresh queue, which is processed at end of block
  // make a contract call to save the artifact immediately, in case we need to grab
  // it from store in any additional handler in this block
  refreshTouchedArtifact(event.params.artifactId);
}

export function handleArtifactDeposited(event: ArtifactDeposited): void {
  let meta = getMeta(event.block.timestamp.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  addToArtifactRefreshQueue(meta, event.params.artifactId);
  meta.save();
}

export function handleArtifactWithdrawn(event: ArtifactWithdrawn): void {
  let meta = getMeta(event.block.timestamp.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  addToArtifactRefreshQueue(meta, event.params.artifactId);
  meta.save();
}

export function handleArtifactActivated(event: ArtifactActivated): void {
  let meta = getMeta(event.block.timestamp.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  addToArtifactRefreshQueue(meta, event.params.artifactId);
  meta.save();

  // set planet's activatedArtifact
  let planetId = hexStringToPaddedUnprefixed(event.params.loc.toHexString());
  let planet = Planet.load(planetId);
  if (planet) {
    planet.activatedArtifact = hexStringToPaddedUnprefixed(event.params.artifactId.toHexString());
    planet.save();
  } else {
    log.error('tried to process artifact activate on unknown planet: {}', [planetId]);
    throw new Error();
  }
}

export function handleArtifactDeactivated(event: ArtifactDeactivated): void {
  let meta = getMeta(event.block.timestamp.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  addToArtifactRefreshQueue(meta, event.params.artifactId);
  meta.save();

  let planetId = hexStringToPaddedUnprefixed(event.params.loc.toHexString());
  let planet = Planet.load(planetId);
  if (planet) {
    planet.activatedArtifact = null;
    planet.save();
  } else {
    log.error('tried to process artifact activate on unknown planet: {}', [planetId]);
    throw new Error();
  }
}

export function handlePlanetProspected(event: PlanetProspected): void {
  let meta = getMeta(event.block.timestamp.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  meta.save();
}

export function handlePlanetTransferred(event: PlanetTransferred): void {
  let meta = getMeta(event.block.timestamp.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  meta.save();
}

export function handlePlayerInitialized(event: PlayerInitialized): void {
  let locationDec = event.params.loc;
  let locationId = hexStringToPaddedUnprefixed(locationDec.toHexString());

  // addresses gets 0x prefixed and 0 padded in toHexString
  let player = new Player(event.params.player.toHexString());
  player.initTimestamp = event.block.timestamp.toI32();
  player.homeWorld = locationId;
  player.milliWithdrawnSilver = 0;
  player.lastRevealTimestamp = 0;
  player.save();

  let meta = getMeta(event.block.timestamp.toI32());
  addToPlanetRefreshQueue(meta, locationDec);
  meta.save();
}

export function handleBlock(block: ethereum.Block): void {
  let current = block.timestamp.toI32();
  let meta = getMeta(current);

  processScheduledArrivalsSinceLastBlock(meta, current);
  refreshTouchedPlanets(meta);
  refreshTouchedArtifacts(meta);
  addNewDepartures(meta);

  meta.lastProcessed = current;
  meta.save();
}

// Sadly I can't use mini refresh to save a call as I need the upgrades from the
// planetExtendedInfo
export function handlePlanetHatBought(event: PlanetHatBought): void {
  let locationDec = event.params.loc;

  // queue planet to refresh
  let meta = getMeta(event.block.timestamp.toI32());
  addToPlanetRefreshQueue(meta, locationDec);
  meta.save();

  // update Hat in store, or create if doesn't exist
  let locationId = hexStringToPaddedUnprefixed(locationDec.toHexString());
  let hat = Hat.load(locationId);
  if (hat) {
    hat.hatLevel = hat.hatLevel + 1;
    let purchaseTimestamps = hat.purchaseTimestamps.map<i32>((x) => x);
    let purchasers = hat.purchasers.map<string>((x) => x); // need to change ref otherwise won't save
    purchaseTimestamps.push(event.block.timestamp.toI32());
    purchasers.push(event.params.player.toHexString());
    hat.purchaseTimestamps = purchaseTimestamps;
    hat.purchasers = purchasers;
  } else {
    hat = new Hat(locationId);
    hat.planet = locationId;
    hat.hatLevel = 1;
    hat.purchaseTimestamps = [event.block.timestamp.toI32()];
    hat.purchasers = [event.params.player.toHexString()];
    let planet = Planet.load(locationId);
    if (planet) {
      planet.hat = locationId;
      planet.save();
    } else {
      log.error('hat bought on unknown planet: {}', [locationId]);
      throw new Error();
    }
  }
  hat.save();
}

// A departure (or ArrivalQueued) event. We add these arrivalIds to a
// DepartureQueue for later processing in handleBlock
// We delay minirefresh to the blockhandler
export function handleArrivalQueued(event: ArrivalQueued): void {
  let current = event.block.timestamp.toI32();
  let meta = getMeta(current);

  // add voyage ID to Meta, for later processing
  addToVoyageAddQueue(meta, event.params.arrivalId);

  // add fromPlanet/toPlanet IDs to Meta, if not already in, for later processing
  addToPlanetRefreshQueue(meta, event.params.from);
  addToPlanetRefreshQueue(meta, event.params.to);

  if (event.params.artifactId.notEqual(BigInt.fromI32(0))) {
    addToArtifactRefreshQueue(meta, event.params.artifactId);
  }

  meta.save();
}

export function handlePlanetUpgraded(event: PlanetUpgraded): void {
  // queue planet to refresh
  let meta = getMeta(event.block.timestamp.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  meta.save();
}

export function handlePlanetSilverWithdrawn(event: PlanetSilverWithdrawn): void {
  // queue planet to refresh
  let meta = getMeta(event.block.timestamp.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  meta.save();

  let playerAddress = event.params.player.toHexString();
  let player = Player.load(playerAddress);
  if (player) {
    player.milliWithdrawnSilver = player.milliWithdrawnSilver + event.params.amount.toI32();
    player.save();
  } else {
    log.error('attempting to process silver withdraw for unknown player: {}', [playerAddress]);
    throw new Error();
  }
}

export function handleLocationRevealed(event: LocationRevealed): void {
  // queue planet to refresh
  let meta = getMeta(event.block.timestamp.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  meta.save();

  let revealerAddress = event.params.revealer.toHexString();
  let player = Player.load(revealerAddress);
  if (player) {
    player.lastRevealTimestamp = event.block.timestamp.toI32();
    player.save();
  } else {
    // revealed by admin, who is not included as a player
    player = new Player(revealerAddress);
    player.initTimestamp = event.block.timestamp.toI32();
    player.milliWithdrawnSilver = 0;
    player.lastRevealTimestamp = 0;
    player.save();
  }
}

function processScheduledArrivalsSinceLastBlock(meta: Meta, current: i32): void {
  // process last+1 up to and including current
  for (let i = meta.lastProcessed + 1; i <= current; i++) {
    // @ts-ignore: ts linter will complain about i32.toString(), but this is fine for AS compiler
    let bucket = ArrivalQueue.load(i.toString());
    if (bucket !== null) {
      // multiple arrivals are in order of arrivalid
      let arrivals = bucket.arrivals.map<Arrival | null>((aid) => Arrival.load(aid));

      for (let i = 0; i < arrivals.length; i++) {
        let a = arrivals[i];

        if (!a) {
          log.error('attempting to process unknown arrival', []);
          throw new Error();
        }

        let toPlanet = Planet.load(a.toPlanet);
        if (!toPlanet) {
          log.error('attempting to process unknown planet: {}', [a.toPlanet]);
          throw new Error();
        }

        if (a.carriedArtifact) {
          let artifact = Artifact.load(a.carriedArtifact);
          if (artifact) {
            toPlanet = arrive(toPlanet as Planet, a as Arrival, artifact as Artifact);
            artifact.save();
          } else {
            log.error('attempting to process arrival with unknown artifact: {}', [
              a.carriedArtifact,
            ]);
            throw new Error();
          }
        } else {
          toPlanet = arrive(toPlanet as Planet, a as Arrival); // we know these aren't null but AS gets mad
        }
        a.save();
        toPlanet.save();
      }
    }
  }
}

function addToPlanetRefreshQueue(meta: Meta, planetId: BigInt): void {
  let alreadyContains = false;
  // in AS we can't index into meta._currentlyRefreshingPlanets within a for loop
  // (see https://github.com/AssemblyScript/assemblyscript/issues/222)
  // so we copy into memory array and index into that
  let containedPlanetDecIds = meta._currentlyRefreshingPlanets.map<BigInt>((x) => x);

  for (let j = 0; j < meta._currentlyRefreshingPlanets.length; j++) {
    if (containedPlanetDecIds[j].equals(planetId)) {
      alreadyContains = true;
      break;
    }
  }
  if (!alreadyContains) {
    let _currentlyRefreshingPlanets = meta._currentlyRefreshingPlanets;
    _currentlyRefreshingPlanets.push(planetId);
    meta._currentlyRefreshingPlanets = _currentlyRefreshingPlanets; // need to change ref otherwise won't save
  }
}

function addToArtifactRefreshQueue(meta: Meta, artifactId: BigInt): void {
  let alreadyContains = false;
  // in AS we can't index into meta._currentlyRefreshingPlanets within a for loop
  // (see https://github.com/AssemblyScript/assemblyscript/issues/222)
  // so we copy into memory array and index into that
  let containedArtifactDecIds = meta._currentlyRefreshingArtifacts.map<BigInt>((x) => x);

  for (let j = 0; j < meta._currentlyRefreshingArtifacts.length; j++) {
    if (containedArtifactDecIds[j].equals(artifactId)) {
      alreadyContains = true;
      break;
    }
  }
  if (!alreadyContains) {
    let _currentlyRefreshingArtifacts = meta._currentlyRefreshingArtifacts;
    _currentlyRefreshingArtifacts.push(artifactId);
    meta._currentlyRefreshingArtifacts = _currentlyRefreshingArtifacts; // need to change ref otherwise won't save
  }
}

function addToVoyageAddQueue(meta: Meta, voyageId: BigInt): void {
  let _currentlyAddingVoyages = meta._currentlyAddingVoyages;
  _currentlyAddingVoyages.push(voyageId);
  meta._currentlyAddingVoyages = _currentlyAddingVoyages; // need to change ref otherwise won't save
}

function refreshTouchedPlanets(meta: Meta): void {
  if (meta._currentlyRefreshingPlanets.length === 0) {
    // save a contract call by just returning
    return;
  }

  let getters = DarkForestGetters.bind(Address.fromString(GETTERS_CONTRACT_ADDRESS));
  let planetDatas = getters.bulkGetPlanetsDataByIds(meta._currentlyRefreshingPlanets);
  // in AS we can't index into meta._currentlyRefreshingPlanets within a for loop
  // (see https://github.com/AssemblyScript/assemblyscript/issues/222)
  // so we copy into memory array and index into that
  let planetDecIds = meta._currentlyRefreshingPlanets.map<BigInt>((x) => x);
  for (let i = 0; i < meta._currentlyRefreshingPlanets.length; i++) {
    let rawData = planetDatas[i];
    let planet = refreshPlanetFromContractData(
      planetDecIds[i],
      rawData.planet as DarkForestCore__planetsResultValue0Struct,
      rawData.info as DarkForestCore__planetsExtendedInfoResultValue0Struct,
      rawData.revealedCoords as DarkForestCore__revealedCoordsResultValue0Struct
    );
    planet.save();
  }

  meta._currentlyRefreshingPlanets = [];
  meta.save();
}

/**
 * refresh a single artifact from contract data
 */
function refreshTouchedArtifact(artifactId: BigInt): void {
  let getters = DarkForestGetters.bind(Address.fromString(GETTERS_CONTRACT_ADDRESS));
  let rawArtifact = getters.bulkGetArtifactsByIds([artifactId]);

  let artifact = refreshArtifactFromContractData(artifactId, rawArtifact[0]);
  artifact.save();
}

function refreshTouchedArtifacts(meta: Meta): void {
  if (meta._currentlyRefreshingArtifacts.length === 0) {
    // save a contract call by just returning
    return;
  }

  let getters = DarkForestGetters.bind(Address.fromString(GETTERS_CONTRACT_ADDRESS));
  // TODO production: uncomment the following line
  // let rawArtifacts = getters.bulkGetArtifactsByIds(meta._currentlyRefreshingArtifacts);
  // in AS we can't index into meta._currentlyRefreshingArtifacts within a for loop
  // (see https://github.com/AssemblyScript/assemblyscript/issues/222)
  // so we copy into memory array and index into that
  let artifactDecIds = meta._currentlyRefreshingArtifacts.map<BigInt>((x) => x);
  for (let i = 0; i < meta._currentlyRefreshingArtifacts.length; i++) {
    // TODO production: uncomment these lines
    /*
    let rawData = rawArtifacts[i];
    let artifact = refreshArtifactFromContractData(artifactDecIds[i], rawData);
    artifact.save();
    */
    // TODO production: kill the below. this is just because the staging getter is bad :/
    let rawArtifactRes = getters.try_getArtifactById(artifactDecIds[i]);
    if (rawArtifactRes.reverted) {
      let artifactId = hexStringToPaddedUnprefixed(artifactDecIds[i].toHexString());
      let artifact = Artifact.load(artifactId) as Artifact;
      artifact.owner = toLowercase(CORE_CONTRACT_ADDRESS);
      artifact.onPlanet = null;
      artifact.onVoyage = null;
      artifact.wormholeTo = null;
      artifact.save();
    } else {
      let artifact = refreshArtifactFromContractData(
        artifactDecIds[i],
        rawArtifactRes.value as DarkForestGetters__bulkGetArtifactsByIdsResultRetStruct
      );
      artifact.save();
    }
  }

  meta._currentlyRefreshingArtifacts = [];
  meta.save();
}

function addNewDepartures(meta: Meta): void {
  if (meta._currentlyAddingVoyages.length === 0) {
    // save a contract call by just returning
    return;
  }

  let getters = DarkForestGetters.bind(Address.fromString(GETTERS_CONTRACT_ADDRESS));
  let voyageDatas = getters.bulkGetVoyagesByIds(meta._currentlyAddingVoyages);
  // in AS we can't index into meta._currentlyAddingVoyages within a for loop
  // (see https://github.com/AssemblyScript/assemblyscript/issues/222)
  // so we copy into memory array and index into that
  let voyageIds = meta._currentlyAddingVoyages.map<BigInt>((x) => x);
  for (let i = 0; i < voyageDatas.length; i++) {
    let rawVoyage = voyageDatas[i];
    let voyage = refreshVoyageFromContractData(
      voyageIds[i],
      rawVoyage as DarkForestCore__planetArrivalsResultValue0Struct
    );
    voyage.arrived = false;
    voyage.save();
    let arrivalTime = voyage.arrivalTime;
    // @ts-ignore: ts linter will complain about i32.toString(), but this is fine for AS compiler
    let pending = ArrivalQueue.load(arrivalTime.toString());
    let pendingArrivals: string[] = [];
    if (pending === null) {
      // @ts-ignore: ts linter will complain about i32.toString(), but this is fine for AS compiler
      pending = new ArrivalQueue(arrivalTime.toString());
    } else {
      pendingArrivals = pending.arrivals;
    }
    pendingArrivals.push(voyage.id);
    pending.arrivals = pendingArrivals; // need to change ref otherwise won't save
    pending.save();
  }

  meta._currentlyAddingVoyages = [];
  meta.save();
}

function getMeta(timestamp: i32): Meta {
  let meta = Meta.load('0');

  if (meta === null) {
    // not instantiated yet, so instantiate it
    meta = new Meta('0');
    meta.lastProcessed = timestamp;
    meta._currentlyRefreshingPlanets = [];
    meta._currentlyAddingVoyages = [];
    meta._currentlyRefreshingArtifacts = [];

    // add the null player, representing barbarian-owned planets
    let nullPlayer = new Player('0x0000000000000000000000000000000000000000');
    nullPlayer.initTimestamp = timestamp;
    nullPlayer.milliWithdrawnSilver = 0;
    nullPlayer.lastRevealTimestamp = 0;
    nullPlayer.save();

    // add the core contract into Player store, because it can own artifacts
    let coreContract = new Player(toLowercase(CORE_CONTRACT_ADDRESS));
    coreContract.initTimestamp = timestamp;
    coreContract.milliWithdrawnSilver = 0;
    coreContract.lastRevealTimestamp = 0;
    coreContract.save();
  }
  return meta as Meta;
}
