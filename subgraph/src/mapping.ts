/* eslint-disable eqeqeq */
import { CONTRACT_ADDRESS } from '@darkforest_eth/contracts';
import { Address, BigInt, ethereum, log } from '@graphprotocol/graph-ts';
import {
  AdminPlanetCreated,
  ArrivalQueued,
  ArtifactActivated,
  ArtifactDeactivated,
  ArtifactDeposited,
  ArtifactFound,
  ArtifactWithdrawn,
  DarkForest,
  DarkForest__bulkGetArtifactsByIdsResultRetStruct,
  LobbyCreated,
  LocationRevealed,
  PlanetCaptured,
  PlanetHatBought,
  PlanetInvaded,
  PlanetProspected,
  PlanetSilverWithdrawn,
  PlanetTransferred,
  PlanetUpgraded,
  PlayerInitialized,
  Transfer,
} from '../generated/DarkForest/DarkForest';
import {
  Arrival,
  ArrivalQueue,
  Artifact,
  Hat,
  Lobby,
  Meta,
  Planet,
  Player,
  RevealedCoordinate,
  Spaceship,
} from '../generated/schema';
import { arrive } from './helpers/arrivalHelpers';
import {
  bjjFieldElementToSignedInt,
  hexStringToPaddedUnprefixed,
  isSpaceship,
  toLowercase,
} from './helpers/converters';
import {
  refreshArtifactFromContractData,
  refreshPlanetFromContractData,
  refreshSpaceshipFromContractData,
  refreshVoyageFromContractData,
} from './helpers/decoders';

// NOTE: the timestamps within are all unix epoch in seconds NOT MILLISECONDS
// like in all the JS code where youll see divided by contractPrecision. As a
// result be very careful with your copy pastes. And TODO, unify the codebases

// NOTE: in most event handlers we attempt not to do a lot of contract calls as
// they are expensive. We also attempt to let the contract do a lot of math for
// us, and simple copy its homework. Thus we can mostly get away with scheduling
// planet refreshes for when the blockhandler fires after all events finish
// allowing us to batch those calls. For for synthetic fields like hat or
// artifactfound or revealedCoordinate assuming planet exists we can pretty
// cheaply add that data to the planet entity where the planet refresh will find
// it. Thus another quandry exists, we generally have to create planets in
// handlers even though that can be costly, but so those other handlers can
// planet.load successfully

export function handlePlanetInvaded(event: PlanetInvaded): void {
  const meta = getMeta(event.block.timestamp.toI32(), event.block.number.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  meta.save();
}

export function handlePlanetCaptured(event: PlanetCaptured): void {
  const meta = getMeta(event.block.timestamp.toI32(), event.block.number.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  meta.save();
}

export function handleArtifactFound(event: ArtifactFound): void {
  const meta = getMeta(event.block.timestamp.toI32(), event.block.number.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  meta.save();

  // instead of adding to artifact refresh queue, which is processed at end of block
  // make a contract call to save the artifact immediately, in case we need to grab
  // it from store in any additional handler in this block
  const contract = DarkForest.bind(Address.fromString(CONTRACT_ADDRESS));
  const rawArtifact = contract.bulkGetArtifactsByIds([event.params.artifactId]);

  refreshArtifactOrSpaceship(event.params.artifactId, rawArtifact[0]);
  addPlayerToRefreshQueue(meta, event.params.player.toHexString());
}

export function handleArtifactDeposited(event: ArtifactDeposited): void {
  const meta = getMeta(event.block.timestamp.toI32(), event.block.number.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  addToArtifactRefreshQueue(meta, event.params.artifactId);
  meta.save();
}

export function handleArtifactWithdrawn(event: ArtifactWithdrawn): void {
  const meta = getMeta(event.block.timestamp.toI32(), event.block.number.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  addToArtifactRefreshQueue(meta, event.params.artifactId);

  const artifactId = hexStringToPaddedUnprefixed(event.params.artifactId);
  const artifact = Artifact.load(artifactId);
  if (artifact) {
    // synthetic field, not updated on refresh so done here
    artifact.onPlanet = null;
    artifact.save();
  } else {
    log.error('attempting to withdraw unknown artifactid: {}', [artifactId]);
    throw new Error();
  }

  meta.save();
}

export function handleArtifactActivated(event: ArtifactActivated): void {
  const meta = getMeta(event.block.timestamp.toI32(), event.block.number.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  addToArtifactRefreshQueue(meta, event.params.artifactId);
  meta.save();

  // set planet's activatedArtifact
  const planetId = hexStringToPaddedUnprefixed(event.params.loc);
  const planet = Planet.load(planetId);
  if (planet) {
    planet.activatedArtifact = hexStringToPaddedUnprefixed(event.params.artifactId);
    planet.save();
  } else {
    log.error('tried to process artifact activate on unknown planet: {}', [planetId]);
    throw new Error();
  }
}

export function handleArtifactDeactivated(event: ArtifactDeactivated): void {
  const meta = getMeta(event.block.timestamp.toI32(), event.block.number.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  addToArtifactRefreshQueue(meta, event.params.artifactId);
  meta.save();

  const planetId = hexStringToPaddedUnprefixed(event.params.loc);
  const planet = Planet.load(planetId);
  if (planet) {
    planet.activatedArtifact = null;
    planet.save();
  } else {
    log.error('tried to process artifact activate on unknown planet: {}', [planetId]);
    throw new Error();
  }
}

export function handlePlanetProspected(event: PlanetProspected): void {
  const meta = getMeta(event.block.timestamp.toI32(), event.block.number.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  meta.save();
}

export function handlePlanetTransferred(event: PlanetTransferred): void {
  const meta = getMeta(event.block.timestamp.toI32(), event.block.number.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  meta.save();
}

export function handlePlayerInitialized(event: PlayerInitialized): void {
  const locationDec = event.params.loc;
  const locationId = hexStringToPaddedUnprefixed(locationDec);

  // addresses gets 0x prefixed and 0 padded in toHexString
  const player = new Player(event.params.player.toHexString());
  player.initTimestamp = event.block.timestamp.toI32();
  player.homeWorld = locationId;
  player.score = BigInt.fromI32(0);
  player.lastRevealTimestamp = 0;
  player.spaceJunk = 0;
  player.spaceJunkLimit = 0;
  player.save();

  // expensive to create planet in handler, but needs to exist in case say a hat
  // bought in same block
  const contract = DarkForest.bind(Address.fromString(CONTRACT_ADDRESS));
  const planetDatas = contract.bulkGetPlanetsDataByIds([event.params.loc]);
  const rawData = planetDatas[0];
  const planet = refreshPlanetFromContractData(
    event.params.loc,
    rawData.planet,
    rawData.info,
    rawData.info2
  );
  planet.save();

  const meta = getMeta(event.block.timestamp.toI32(), event.block.number.toI32());
  addPlayerToRefreshQueue(meta, event.params.player.toHexString());
  meta.save();
}

export function handleBlock(block: ethereum.Block): void {
  const current = block.timestamp.toI32();
  const meta = getMeta(current, block.number.toI32());

  processScheduledArrivalsSinceLastBlock(meta, current);
  refreshTouchedPlanets(meta);
  refreshTouchedArtifacts(meta);
  addNewDepartures(meta);
  refreshPlayers(meta);

  meta.lastProcessed = current;
  meta.blockNumber = block.number.toI32();
  meta.save();
}

export function handlePlanetHatBought(event: PlanetHatBought): void {
  const locationDec = event.params.loc;

  // queue planet to refresh
  const meta = getMeta(event.block.timestamp.toI32(), event.block.number.toI32());
  addToPlanetRefreshQueue(meta, locationDec);
  meta.save();

  // update Hat in store, or create if doesn't exist
  const locationId = hexStringToPaddedUnprefixed(locationDec);
  let hat = Hat.load(locationId);
  if (hat) {
    hat.hatLevel = hat.hatLevel + 1;
    const purchaseTimestamps = hat.purchaseTimestamps.map<i32>((x) => x);
    const purchasers = hat.purchasers.map<string>((x) => x); // need to change ref otherwise won't save
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
    const planet = Planet.load(locationId);
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

// A move (or departure or ArrivalQueued) event. We add these arrivalIds to a
// DepartureQueue for later processing in handleBlock
export function handleArrivalQueued(event: ArrivalQueued): void {
  const current = event.block.timestamp.toI32();
  const meta = getMeta(current, event.block.number.toI32());

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
  const meta = getMeta(event.block.timestamp.toI32(), event.block.number.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  meta.save();
}

export function handlePlanetSilverWithdrawn(event: PlanetSilverWithdrawn): void {
  // queue planet to refresh
  const meta = getMeta(event.block.timestamp.toI32(), event.block.number.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  meta.save();

  const playerAddress = event.params.player.toHexString();
  const player = Player.load(playerAddress);
  if (player) {
    player.score = player.score.plus(event.params.amount.div(BigInt.fromI32(1000)));
    player.save();
  } else {
    log.error('attempting to process silver withdraw for unknown player: {}', [playerAddress]);
    throw new Error();
  }
}

export function handleAdminPlanetCreated(event: AdminPlanetCreated): void {
  // This request can be scheduled as much like move(handleArrivalQueued) to an
  // untouched planet, nothing should need to access the planet until the voyage
  // arrives and someone owns it. (except for LocationRevealed which creates
  // planet anyway)
  const meta = getMeta(event.block.timestamp.toI32(), event.block.number.toI32());
  addToPlanetRefreshQueue(meta, event.params.loc);
  meta.save();
}

export function handleLocationRevealed(event: LocationRevealed): void {
  const revealerAddress = event.params.revealer.toHexString();
  const planetId = hexStringToPaddedUnprefixed(event.params.loc);

  let player = Player.load(revealerAddress);
  if (!player) {
    // revealed by admin account, who is not included as a player, use 0x0 which
    // has to exist by now
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    player = Player.load('0x0000000000000000000000000000000000000000')!;
    player.initTimestamp = event.block.timestamp.toI32();
    player.score = BigInt.fromI32(0);
    player.lastRevealTimestamp = event.block.timestamp.toI32();
    player.save();
  }

  let planet = Planet.load(planetId);
  if (!planet) {
    // Expensive action for a handler but might not exist if never interacted
    // with before, or if it was an admin created planet that was scheduled but
    // refreshed yet
    const contract = DarkForest.bind(Address.fromString(CONTRACT_ADDRESS));
    const planetDatas = contract.bulkGetPlanetsDataByIds([event.params.loc]);
    const rawData = planetDatas[0];
    planet = refreshPlanetFromContractData(
      event.params.loc,
      rawData.planet,
      rawData.info,
      rawData.info2
    );
    planet.save();
  }

  const coord = new RevealedCoordinate(planet.id);
  coord.x = bjjFieldElementToSignedInt(event.params.x);
  coord.y = bjjFieldElementToSignedInt(event.params.y);
  coord.revealer = player.id;
  coord.save();

  planet.revealedCoordinate = planet.id;
  planet.isRevealed = true;
  planet.save();
}

export function handleTransfer(event: Transfer): void {
  let artifact = Artifact.load(event.params.tokenId.toHexString());
  let spaceship = Spaceship.load(event.params.tokenId.toHexString());
  if (artifact !== null) {
    artifact.ownerAddress = event.params.to.toHexString();
    artifact.save();
  } else {
    // artifact was just minted, so it's not in store yet
    // note that a _mint does emit a Transfer ERC721 event
    const contract = DarkForest.bind(Address.fromString(CONTRACT_ADDRESS));
    const rawArtifact = contract.bulkGetArtifactsByIds([event.params.tokenId]);

    refreshArtifactOrSpaceship(event.params.tokenId, rawArtifact[0]);
  }
}

export function handleLobbyCreated(event: LobbyCreated): void {
  const lobby = new Lobby(event.params.lobbyAddress.toHexString());
  lobby.ownerAddress = event.params.ownerAddress.toHexString();
  lobby.lobbyAddress = event.params.lobbyAddress.toHexString();
  lobby.save();
}

function processScheduledArrivalsSinceLastBlock(meta: Meta, current: i32): void {
  // process last+1 up to and including current
  for (let i = meta.lastProcessed + 1; i <= current; i++) {
    // @ts-ignore: ts linter will complain about i32.toString(), but this is fine for AS compiler
    const bucket = ArrivalQueue.load(i.toString());
    if (bucket !== null) {
      // multiple arrivals are in order of arrivalid
      const arrivals = bucket.arrivals.map<Arrival | null>((aid) => Arrival.load(aid));

      for (let i = 0; i < arrivals.length; i++) {
        const arrival = arrivals[i];

        if (!arrival) {
          log.error('attempting to process unknown arrival', []);
          throw new Error();
        }

        let toPlanet = Planet.load(arrival.toPlanet);
        if (!toPlanet) {
          log.error('attempting to process unknown planet: {}', [arrival.toPlanet]);
          throw new Error();
        }

        toPlanet = arrive(toPlanet, arrival);
        toPlanet.save();

        arrival.arrived = true;
        arrival.save();

        if (arrival.carriedArtifact) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const carriedArtifact = arrival.carriedArtifact!;
          const artifact = Artifact.load(carriedArtifact);
          const spaceship = Spaceship.load(carriedArtifact);
          if (spaceship) {
            spaceship.onVoyage = null;
            spaceship.onPlanet = toPlanet.id;
            spaceship.save();
          } else if (artifact) {
            artifact.onVoyage = null;
            artifact.onPlanet = toPlanet.id;
            artifact.save();
          } else {
            log.error('attempting to move apply arrival with artifact: {}', [carriedArtifact]);
            throw new Error();
          }
        }
      }
    }
  }
}

function addPlayerToRefreshQueue(meta: Meta, playerAddress: string): void {
  const players = meta._currentlyRefreshingPlayers;
  players.push(playerAddress);
  meta._currentlyRefreshingPlayers = players;
}

function addToPlanetRefreshQueue(meta: Meta, planetId: BigInt): void {
  let alreadyContains = false;
  // in AS we can't index into meta._currentlyRefreshingPlanets within a for loop
  // (see https://github.com/AssemblyScript/assemblyscript/issues/222)
  // so we copy into memory array and index into that
  const containedPlanetDecIds = meta._currentlyRefreshingPlanets.map<BigInt>((x) => x);

  for (let j = 0; j < meta._currentlyRefreshingPlanets.length; j++) {
    if (containedPlanetDecIds[j].equals(planetId)) {
      alreadyContains = true;
      break;
    }
  }
  if (!alreadyContains) {
    const _currentlyRefreshingPlanets = meta._currentlyRefreshingPlanets;
    _currentlyRefreshingPlanets.push(planetId);
    meta._currentlyRefreshingPlanets = _currentlyRefreshingPlanets; // need to change ref otherwise won't save
  }
}

function addToArtifactRefreshQueue(meta: Meta, artifactId: BigInt): void {
  let alreadyContains = false;
  // in AS we can't index into meta._currentlyRefreshingPlanets within a for loop
  // (see https://github.com/AssemblyScript/assemblyscript/issues/222)
  // so we copy into memory array and index into that
  const containedArtifactDecIds = meta._currentlyRefreshingArtifacts.map<BigInt>((x) => x);

  for (let j = 0; j < meta._currentlyRefreshingArtifacts.length; j++) {
    if (containedArtifactDecIds[j].equals(artifactId)) {
      alreadyContains = true;
      break;
    }
  }
  if (!alreadyContains) {
    const _currentlyRefreshingArtifacts = meta._currentlyRefreshingArtifacts;
    _currentlyRefreshingArtifacts.push(artifactId);
    meta._currentlyRefreshingArtifacts = _currentlyRefreshingArtifacts; // need to change ref otherwise won't save
  }
}

function addToVoyageAddQueue(meta: Meta, voyageId: BigInt): void {
  const _currentlyAddingVoyages = meta._currentlyAddingVoyages;
  _currentlyAddingVoyages.push(voyageId);
  meta._currentlyAddingVoyages = _currentlyAddingVoyages; // need to change ref otherwise won't save
}

function refreshPlayers(meta: Meta): void {
  const players = meta._currentlyRefreshingPlayers.map<string>((x) => x);
  const contract = DarkForest.bind(Address.fromString(CONTRACT_ADDRESS));

  for (let i = 0; i < players.length; i++) {
    const player = Player.load(players[i]);

    if (player) {
      const address = Address.fromString(players[i]);
      const contractPlayer = contract.players(address);

      player.score = contractPlayer.score;
      player.spaceJunk = contractPlayer.spaceJunk.toI32();
      player.spaceJunkLimit = contractPlayer.spaceJunkLimit.toI32();
      player.save();
    }
  }

  meta._currentlyRefreshingPlayers = [];
  meta.save();
}

function refreshTouchedPlanets(meta: Meta): void {
  if (meta._currentlyRefreshingPlanets.length === 0) {
    // save a contract call by just returning
    return;
  }

  const contract = DarkForest.bind(Address.fromString(CONTRACT_ADDRESS));
  const planetDatas = contract.bulkGetPlanetsDataByIds(meta._currentlyRefreshingPlanets);
  // in AS we can't index into meta._currentlyRefreshingPlanets within a for loop
  // (see https://github.com/AssemblyScript/assemblyscript/issues/222)
  // so we copy into memory array and index into that
  const planetDecIds = meta._currentlyRefreshingPlanets.map<BigInt>((x) => x);
  for (let i = 0; i < meta._currentlyRefreshingPlanets.length; i++) {
    const rawData = planetDatas[i];
    const planet = refreshPlanetFromContractData(
      planetDecIds[i],
      rawData.planet,
      rawData.info,
      rawData.info2
    );
    planet.save();
  }

  meta._currentlyRefreshingPlanets = [];
  meta.save();
}

function refreshTouchedArtifacts(meta: Meta): void {
  if (meta._currentlyRefreshingArtifacts.length === 0) {
    // save a contract call by just returning
    return;
  }

  const contract = DarkForest.bind(Address.fromString(CONTRACT_ADDRESS));
  const rawArtifacts = contract.bulkGetArtifactsByIds(meta._currentlyRefreshingArtifacts);
  // in AS we can't index into meta._currentlyRefreshingArtifacts within a for loop
  // (see https://github.com/AssemblyScript/assemblyscript/issues/222)
  // so we copy into memory array and index into that
  const artifactDecIds = meta._currentlyRefreshingArtifacts.map<BigInt>((x) => x);
  for (let i = 0; i < meta._currentlyRefreshingArtifacts.length; i++) {
    refreshArtifactOrSpaceship(artifactDecIds[i], rawArtifacts[i]);
  }

  meta._currentlyRefreshingArtifacts = [];
  meta.save();
}

export class RefreshArtifactOrSpaceshipResult {
  artifact: Artifact | null;
  spaceship: Spaceship | null;

  public constructor(artifact: Artifact | null, spaceship: Spaceship | null) {
    this.artifact = artifact;
    this.spaceship = spaceship;
  }
}

function refreshArtifactOrSpaceship(
  idDec: BigInt,
  rawData: DarkForest__bulkGetArtifactsByIdsResultRetStruct
): RefreshArtifactOrSpaceshipResult {
  const type = rawData.artifact.artifactType;

  if (isSpaceship(type)) {
    const spaceship = refreshSpaceshipFromContractData(idDec, rawData);
    spaceship.save();
    return new RefreshArtifactOrSpaceshipResult(null, spaceship);
  } else {
    const artifact = refreshArtifactFromContractData(idDec, rawData);
    artifact.save();
    return new RefreshArtifactOrSpaceshipResult(artifact, null);
  }
}

function addNewDepartures(meta: Meta): void {
  if (meta._currentlyAddingVoyages.length === 0) {
    // save a contract call by just returning
    return;
  }

  const contract = DarkForest.bind(Address.fromString(CONTRACT_ADDRESS));
  const voyageDatas = contract.bulkGetVoyagesByIds(meta._currentlyAddingVoyages);
  // in AS we can't index into meta._currentlyAddingVoyages within a for loop
  // (see https://github.com/AssemblyScript/assemblyscript/issues/222)
  // so we copy into memory array and index into that
  const voyageIds = meta._currentlyAddingVoyages.map<BigInt>((x) => x);
  for (let i = 0; i < voyageDatas.length; i++) {
    const rawVoyage = voyageDatas[i];
    const voyage = refreshVoyageFromContractData(voyageIds[i], rawVoyage);
    voyage.arrived = false;
    voyage.save();
    const arrivalTime = voyage.arrivalTime;
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

    addPlayerToRefreshQueue(meta, voyage.player);
  }

  meta._currentlyAddingVoyages = [];
  meta.save();
}

function getMeta(timestamp: i32, blockNumber: i32): Meta {
  let meta = Meta.load('0');

  if (meta === null) {
    // not instantiated yet, so instantiate it
    meta = new Meta('0');
    meta.lastProcessed = timestamp;
    meta.blockNumber = blockNumber;
    meta._currentlyRefreshingPlanets = [];
    meta._currentlyAddingVoyages = [];
    meta._currentlyRefreshingArtifacts = [];

    // add the null player, representing barbarian-owned planets
    const nullPlayer = new Player('0x0000000000000000000000000000000000000000');
    nullPlayer.initTimestamp = timestamp;
    nullPlayer.score = BigInt.fromI32(0);
    nullPlayer.lastRevealTimestamp = 0;
    nullPlayer.spaceJunk = 0;
    nullPlayer.spaceJunkLimit = 0;
    nullPlayer.save();

    // add the core contract into Player store, because it can own artifacts
    const coreContract = new Player(toLowercase(CONTRACT_ADDRESS));
    coreContract.initTimestamp = timestamp;
    coreContract.score = BigInt.fromI32(0);
    coreContract.lastRevealTimestamp = 0;
    coreContract.spaceJunk = 0;
    coreContract.spaceJunkLimit = 0;
    coreContract.save();
  }

  return meta as Meta;
}
