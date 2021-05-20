import { Arrival, Artifact, Planet } from '../../generated/schema';

function hasOwner(planet: Planet): boolean {
  return planet.owner !== '0x0000000000000000000000000000000000000000';
}

// Bigint returns to js as a string which is unfortunate for downstream users.
// Also a lot of the Math fn aren't available as BigInt. BigInt only has i32
// conversions which shoould be safe to hold all variables. However due to
// overflows we must upcast everything to f64 during calculations then safely
// back down to i32 at the end avoid overflows.

function getSilverOverTime(planet: Planet, startTimeS: i32, endTimeS: i32): i32 {
  if (endTimeS <= startTimeS) {
    return planet.milliSilverLazy;
  }

  if (!hasOwner(planet)) {
    return planet.milliSilverLazy;
  }

  if (planet.milliSilverLazy > planet.milliSilverCap) {
    return planet.milliSilverCap;
  }

  let milliSilver = f64(planet.milliSilverLazy);
  let milliSilverCap = f64(planet.milliSilverCap); // 60000000000 current max
  let milliSilverGrowth = f64(planet.milliSilverGrowth); // 3333000 current max
  let timeElapsed = f64(endTimeS - startTimeS); // this can be arbitrarily large if months passed~2 weeks is 902725

  // timeElapsed * silverGrowth + silver <= i32.MAX_VALUE
  // assert(timeElapsed <= (i32.MAX_VALUE - silver) / silverGrowth);
  if (timeElapsed > (f64(i32.MAX_VALUE) - milliSilver) / milliSilverGrowth) {
    timeElapsed = (f64(i32.MAX_VALUE) - milliSilver) / milliSilverGrowth;
  }

  return i32(Math.min(timeElapsed * milliSilverGrowth + milliSilver, milliSilverCap));
}

function getEnergyAtTime(planet: Planet, atTimeS: i32): i32 {
  if (atTimeS <= planet.lastUpdated) {
    return planet.milliEnergyLazy;
  }

  if (!hasOwner(planet)) {
    return planet.milliEnergyLazy;
  }

  if (planet.milliEnergyLazy === 0) {
    return 0;
  }

  let milliEnergy = f64(planet.milliEnergyLazy);
  let milliEnergyCap = f64(planet.milliEnergyCap); // 65000000 current max
  let milliEnergyGrowth = f64(planet.milliEnergyGrowth); // 3000 current max
  let timeElapsed = f64(atTimeS - planet.lastUpdated); // this can be arbitrarily large if months passed ~2 weeks is 902725

  // (-4 * energyGrowth * timeElapsed) / energyCap >= f64.MIN_VALUE
  // assert(timeElapsed <= (f64.MIN_VALUE * energyCap) * -4 * energyGrowth)
  if (timeElapsed > f64.MIN_VALUE * milliEnergyCap * -4.0 * milliEnergyGrowth) {
    timeElapsed = f64.MIN_VALUE * milliEnergyCap * -4.0 * milliEnergyGrowth;
  }

  // Math.exp between 0 and 1 as long as inside stays negative, so could be as big as energyCap+1
  let denominator: f64 =
    Math.exp((-4.0 * milliEnergyGrowth * timeElapsed) / milliEnergyCap) *
      (milliEnergyCap / milliEnergy - 1.0) +
    1.0;

  //could be as big as energyCap
  return i32(milliEnergyCap / denominator);
}

function updatePlanetToTime(planet: Planet, atTimeS: i32): Planet {
  planet.milliSilverLazy = getSilverOverTime(planet, planet.lastUpdated, atTimeS);
  planet.milliEnergyLazy = getEnergyAtTime(planet, atTimeS);
  planet.lastUpdated = atTimeS;
  return planet;
}

export function arrive(
  toPlanet: Planet,
  arrival: Arrival,
  artifact: Artifact = new Artifact('0')
): Planet {
  // update toPlanet energy and silver right before arrival
  toPlanet = updatePlanetToTime(toPlanet, arrival.arrivalTime);

  // apply energy
  let shipsMoved = arrival.milliEnergyArriving;

  if (arrival.player !== toPlanet.owner) {
    // attacking enemy - includes emptyAddress
    let abc = i32(Math.trunc(f64(shipsMoved) * 100.0) / f64(toPlanet.defense));
    if (arrival.arrivalType === 'WORMHOLE') {
      // if this is a wormhole arrival to a planet that isn't owned by the initiator of
      // the move, then don't move any energy
    } else if (toPlanet.milliEnergyLazy > abc) {
      // attack reduces target planet's garrison but doesn't conquer it
      toPlanet.milliEnergyLazy -= abc;
    } else {
      // conquers planet
      toPlanet.owner = arrival.player;
      toPlanet.milliEnergyLazy =
        shipsMoved -
        i32(Math.trunc((f64(toPlanet.milliEnergyLazy) * f64(toPlanet.defense)) / 100.0));
    }
  } else {
    // moving between my own planets
    toPlanet.milliEnergyLazy += shipsMoved;
  }

  // apply silver
  if (toPlanet.milliSilverLazy + arrival.milliSilverMoved > toPlanet.milliSilverCap) {
    toPlanet.milliSilverLazy = toPlanet.milliSilverCap;
  } else {
    toPlanet.milliSilverLazy += arrival.milliSilverMoved;
  }

  // move artifact if necessary
  if (artifact.id !== '0000000000000000000000000000000000000000000000000000000000000000') {
    artifact.onVoyage = null;
    artifact.onPlanet = toPlanet.id;
  }

  // mark arrival as arrived
  arrival.arrived = true;

  return toPlanet;
}
