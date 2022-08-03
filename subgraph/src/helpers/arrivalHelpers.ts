/* eslint-disable eqeqeq */
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { Arrival, Planet } from '../../../generated/schema';

function isZeroAddress(address: string): boolean {
  return '0x0000000000000000000000000000000000000000' == address;
}

function hasOwner(planet: Planet): boolean {
  return !isZeroAddress(planet.owner);
}

function getSilverOverTime(planet: Planet, startTimeS: i32, endTimeS: i32): BigInt {
  if (endTimeS <= startTimeS) {
    return planet.milliSilverLazy;
  }

  if (!hasOwner(planet)) {
    return planet.milliSilverLazy;
  }

  if (planet.milliSilverLazy > planet.milliSilverCap) {
    return planet.milliSilverCap;
  }

  const newMilliSilver = BigInt.fromI32(endTimeS - startTimeS)
    .times(planet.milliSilverGrowth)
    .plus(planet.milliSilverLazy);
  if (newMilliSilver.gt(planet.milliSilverCap)) {
    return planet.milliSilverCap;
  }
  return newMilliSilver;
}

function getEnergyAtTime(planet: Planet, atTimeS: i32): BigInt {
  if (atTimeS <= planet.lastUpdated) {
    return planet.milliEnergyLazy;
  }

  if (!hasOwner(planet)) {
    return planet.milliEnergyLazy;
  }

  // we divide by energyGro further down, so special case to avoid div by 0
  if (planet.milliEnergyGrowth.equals(BigInt.fromI32(0))) {
    return planet.milliEnergyLazy;
  }

  if (planet.milliEnergyLazy.equals(BigInt.fromI32(0))) {
    return BigInt.fromI32(0);
  }

  let timeElapsed = BigInt.fromI32(atTimeS - planet.lastUpdated);

  // see v0.6 spec for notes on error bounds and why we pick this cap
  const timeElapsedCap = BigInt.fromI32(56 / 4)
    .times(planet.milliEnergyCap)
    .div(planet.milliEnergyGrowth);
  if (timeElapsed.gt(timeElapsedCap)) {
    timeElapsed = timeElapsedCap;
  }

  // milliEnergyCap can exceed the i32 maximum by a factor of up to 1000,
  // so we divide by 1000, convert to i32, convert to f64, then multiply by 1000
  const exponent =
    (-4.0 * f64(planet.milliEnergyGrowth.toI32()) * f64(timeElapsed.toI32())) /
    f64(planet.milliEnergyCap.div(BigInt.fromI32(1000)).toI32()) /
    1000.0;
  const exponentiated: f64 = Math.exp(exponent);
  // @ts-ignore: ts linter will complain about f64.toString(), but this is fine for AS compiler
  const exponentiatedBD = BigDecimal.fromString(exponentiated.toString());

  const milliEnergyBD = new BigDecimal(planet.milliEnergyLazy);
  const milliEnergyCapBD = new BigDecimal(planet.milliEnergyCap);
  const denominator = exponentiatedBD
    .times(milliEnergyCapBD.div(milliEnergyBD).minus(BigDecimal.fromString('1')))
    .plus(BigDecimal.fromString('1'));

  //could be as big as energyCap
  return milliEnergyCapBD.div(denominator).truncate(0).digits;
}

function updatePlanetToTime(planet: Planet, atTimeS: i32): Planet {
  if (planet.pausers <= 0) {
    planet.milliSilverLazy = getSilverOverTime(planet, planet.lastUpdated, atTimeS);
    planet.milliEnergyLazy = getEnergyAtTime(planet, atTimeS);
    planet.lastUpdated = atTimeS;
  }

  return planet;
}

// applies arrival to a planet. modifies planet, but not arrival or artifact (if one exists)
export function arrive(toPlanet: Planet, arrival: Arrival): Planet {
  // update toPlanet energy and silver right before arrival
  toPlanet = updatePlanetToTime(toPlanet, arrival.arrivalTime);

  if (toPlanet.destroyed) {
    return toPlanet;
  }

  // apply energy
  const shipsMoved = arrival.milliEnergyArriving;

  if (arrival.player !== toPlanet.owner) {
    // attacking enemy - includes emptyAddress
    const effectiveEnergy = shipsMoved
      .times(BigInt.fromI32(100))
      .div(BigInt.fromI32(toPlanet.defense));

    if (arrival.arrivalType == 'WORMHOLE') {
      // if this is a wormhole arrival to a planet that isn't owned by the initiator of
      // the move, then don't move any energy
    } else if (toPlanet.milliEnergyLazy > effectiveEnergy) {
      // attack reduces target planet's garrison but doesn't conquer it
      toPlanet.milliEnergyLazy = toPlanet.milliEnergyLazy.minus(effectiveEnergy);
    } else {
      // conquers planet
      toPlanet.owner = isZeroAddress(arrival.player) ? toPlanet.owner : arrival.player;
      const effectiveDefendingEnergy = toPlanet.milliEnergyLazy
        .times(BigInt.fromI32(toPlanet.defense))
        .div(BigInt.fromI32(100));
      toPlanet.milliEnergyLazy = shipsMoved.minus(effectiveDefendingEnergy);
    }
  } else {
    // moving between my own planets
    toPlanet.milliEnergyLazy = toPlanet.milliEnergyLazy.plus(shipsMoved);
  }

  // apply silver
  if (toPlanet.milliSilverLazy.plus(arrival.milliSilverMoved).gt(toPlanet.milliSilverCap)) {
    toPlanet.milliSilverLazy = toPlanet.milliSilverCap;
  } else {
    toPlanet.milliSilverLazy = arrival.milliSilverMoved.plus(toPlanet.milliSilverLazy);
  }

  return toPlanet;
}
