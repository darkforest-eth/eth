// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/MathUpgradeable.sol";
import "./ABDKMath64x64.sol";
import "./DarkForestTypes.sol";

library DarkForestLazyUpdate {
    // the only contract that ever calls this is DarkForestCore, which has a known storage layout
    // we know that DFCore's GameStorage struct lives at storage slot 1
    function getGameStorage() public pure returns (DarkForestTypes.GameStorage storage ret) {
        bytes32 position = bytes32(uint256(1));
        assembly {
            ret.slot := position
        }
    }

    // alias for accessing storage vars
    function s() public pure returns (DarkForestTypes.GameStorage storage ret) {
        ret = getGameStorage();
    }

    function _updateSilver(
        uint256 updateToTime,
        DarkForestTypes.Planet memory planet,
        DarkForestTypes.PlanetExtendedInfo memory planetExtendedInfo
    ) private pure {
        // This function should never be called directly and should only be called
        // by the refresh planet function. This require is in place to make sure
        // no one tries to updateSilver on non silver producing planet.
        require(
            planet.planetType == DarkForestTypes.PlanetType.SILVER_MINE,
            "Can only update silver on silver producing planet"
        );
        if (planet.owner == address(0)) {
            // unowned planet doesn't gain silver
            return;
        }

        if (planet.silver < planet.silverCap) {
            uint256 _timeDiff =
                SafeMathUpgradeable.sub(updateToTime, planetExtendedInfo.lastUpdated);
            uint256 _silverMined = SafeMathUpgradeable.mul(planet.silverGrowth, _timeDiff);

            planet.silver = MathUpgradeable.min(
                planet.silverCap,
                SafeMathUpgradeable.add(planet.silver, _silverMined)
            );
        }
    }

    function _updatePopulation(
        uint256 updateToTime,
        DarkForestTypes.Planet memory planet,
        DarkForestTypes.PlanetExtendedInfo memory planetExtendedInfo
    ) private pure {
        if (planet.owner == address(0)) {
            // unowned planet doesn't increase in population
            return;
        }

        int128 _timeElapsed =
            ABDKMath64x64.sub(
                ABDKMath64x64.fromUInt(updateToTime),
                ABDKMath64x64.fromUInt(planetExtendedInfo.lastUpdated)
            );

        int128 _one = ABDKMath64x64.fromUInt(1);

        int128 _denominator =
            ABDKMath64x64.add(
                ABDKMath64x64.mul(
                    ABDKMath64x64.exp(
                        ABDKMath64x64.div(
                            ABDKMath64x64.mul(
                                ABDKMath64x64.mul(
                                    ABDKMath64x64.fromInt(-4),
                                    ABDKMath64x64.fromUInt(planet.populationGrowth)
                                ),
                                _timeElapsed
                            ),
                            ABDKMath64x64.fromUInt(planet.populationCap)
                        )
                    ),
                    ABDKMath64x64.sub(
                        ABDKMath64x64.div(
                            ABDKMath64x64.fromUInt(planet.populationCap),
                            ABDKMath64x64.fromUInt(planet.population)
                        ),
                        _one
                    )
                ),
                _one
            );

        planet.population = ABDKMath64x64.toUInt(
            ABDKMath64x64.div(ABDKMath64x64.fromUInt(planet.populationCap), _denominator)
        );

        // quasars have 0 energy growth, so they have 0 energy decay as well
        // so don't allow them to become overful
        if (planet.planetType == DarkForestTypes.PlanetType.SILVER_BANK) {
            if (planet.population > planet.populationCap) {
                planet.population = planet.populationCap;
            }
        }
    }

    function updatePlanet(
        uint256 updateToTime,
        DarkForestTypes.Planet memory planet,
        DarkForestTypes.PlanetExtendedInfo memory planetExtendedInfo
    )
        public
        pure
        returns (DarkForestTypes.Planet memory, DarkForestTypes.PlanetExtendedInfo memory)
    {
        _updatePopulation(updateToTime, planet, planetExtendedInfo);

        if (planet.planetType == DarkForestTypes.PlanetType.SILVER_MINE) {
            _updateSilver(updateToTime, planet, planetExtendedInfo);
        }

        planetExtendedInfo.lastUpdated = updateToTime;

        return (planet, planetExtendedInfo);
    }

    // assumes that the planet last updated time is equal to the arrival time trigger
    function applyArrival(
        DarkForestTypes.Planet memory planet,
        DarkForestTypes.ArrivalData memory arrival
    ) private pure returns (uint256 newArtifactOnPlanet, DarkForestTypes.Planet memory) {
        // checks whether the planet is owned by the player sending ships
        if (arrival.player == planet.owner) {
            // simply increase the population if so
            planet.population = SafeMathUpgradeable.add(planet.population, arrival.popArriving);
        } else {
            if (arrival.arrivalType == DarkForestTypes.ArrivalType.Wormhole) {
                // if this is a wormhole arrival to a planet that isn't owned by the initiator of
                // the move, then don't move any energy
            } else if (planet.population > (arrival.popArriving * 100) / planet.defense) {
                // handles if the planet population is bigger than the arriving ships
                // simply reduce the amount of planet population by the arriving ships
                planet.population = SafeMathUpgradeable.sub(
                    planet.population,
                    (arrival.popArriving * 100) / planet.defense
                );
            } else {
                // handles if the planet population is equal or less the arriving ships
                // reduce the arriving ships amount with the current population and the
                // result is the new population of the planet now owned by the attacking
                // player
                planet.owner = arrival.player;
                planet.population = SafeMathUpgradeable.sub(
                    arrival.popArriving,
                    (planet.population * planet.defense) / 100
                );
                if (planet.population == 0) {
                    // make sure pop is never 0
                    planet.population = 1;
                }
            }
        }

        // quasars have 0 energy growth, so they have 0 energy decay as well
        // so don't allow them to become overful
        if (planet.planetType == DarkForestTypes.PlanetType.SILVER_BANK) {
            if (planet.population > planet.populationCap) {
                planet.population = planet.populationCap;
            }
        }

        planet.silver = MathUpgradeable.min(
            planet.silverCap,
            SafeMathUpgradeable.add(planet.silver, arrival.silverMoved)
        );

        return (arrival.carriedArtifactId, planet);
    }

    function applyPendingEvents(
        uint256 currentTimestamp,
        DarkForestTypes.Planet memory planet,
        DarkForestTypes.PlanetExtendedInfo memory planetExtendedInfo,
        DarkForestTypes.PlanetEventMetadata[] memory events
    )
        public
        view
        returns (
            DarkForestTypes.Planet memory,
            DarkForestTypes.PlanetExtendedInfo memory,
            uint256[12] memory,
            uint256[12] memory
        )
    {
        uint256[12] memory eventIdsToRemove;
        uint256[12] memory newArtifactsOnPlanet;

        uint256 numEventsToRemove = 0;
        uint256 numNewArtifactsOnPlanet = 0;
        uint256 earliestEventTime = 0;
        uint256 earliestEventIndex = 0;

        do {
            if (events.length == 0 || planetExtendedInfo.destroyed) {
                break;
            }

            // set to to the upperbound of uint256
            earliestEventTime = 115792089237316195423570985008687907853269984665640564039457584007913129639935;

            // loops through the array and find the earliest event time that hasn't already been applied
            for (uint256 i = 0; i < events.length; i++) {
                if (events[i].timeTrigger < earliestEventTime) {
                    bool shouldApply = true;

                    // checks if this event has already been applied.
                    for (
                        uint256 alreadyRemovedIdx = 0;
                        alreadyRemovedIdx < numEventsToRemove;
                        alreadyRemovedIdx++
                    ) {
                        if (eventIdsToRemove[alreadyRemovedIdx] == events[i].id) {
                            shouldApply = false;
                            break;
                        }
                    }

                    if (shouldApply) {
                        earliestEventTime = events[i].timeTrigger;
                        earliestEventIndex = i;
                    }
                }
            }

            // only process the event if it occurs before the current time and the timeTrigger is not 0
            // which comes from uninitialized PlanetEventMetadata
            if (
                events[earliestEventIndex].timeTrigger <= currentTimestamp &&
                earliestEventTime !=
                115792089237316195423570985008687907853269984665640564039457584007913129639935
            ) {
                (planet, planetExtendedInfo) = updatePlanet(
                    events[earliestEventIndex].timeTrigger,
                    planet,
                    planetExtendedInfo
                );

                if (
                    events[earliestEventIndex].eventType == DarkForestTypes.PlanetEventType.ARRIVAL
                ) {
                    eventIdsToRemove[numEventsToRemove++] = events[earliestEventIndex].id;

                    uint256 newArtifactId;
                    (newArtifactId, planet) = applyArrival(
                        planet,
                        s().planetArrivals[events[earliestEventIndex].id]
                    );

                    if (newArtifactId != 0) {
                        newArtifactsOnPlanet[numNewArtifactsOnPlanet++] = newArtifactId;
                    }
                }
            }
        } while (earliestEventTime <= currentTimestamp);

        return (planet, planetExtendedInfo, eventIdsToRemove, newArtifactsOnPlanet);
    }
}
