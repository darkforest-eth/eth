// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/MathUpgradeable.sol";
import "./ABDKMath64x64.sol";
import "./DarkForestTypes.sol";
import "./DarkForestUtils.sol";

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

    function _updateSilver(uint256 _location, uint256 _updateToTime) private {
        // This function should never be called directly and should only be called
        // by the refresh planet function. This require is in place to make sure
        // no one tries to updateSilver on non silver producing planet.
        DarkForestTypes.Planet storage _planet = s().planets[_location];
        DarkForestTypes.PlanetExtendedInfo storage _planetExtendedInfo =
            s().planetsExtendedInfo[_location];
        require(
            _planet.planetType == DarkForestTypes.PlanetType.SILVER_MINE,
            "Can only update silver on silver producing planet"
        );
        if (_planet.owner == address(0)) {
            // unowned planet doesn't gain silver
            return;
        }

        if (_planet.silver < _planet.silverCap) {
            uint256 _timeDiff =
                SafeMathUpgradeable.sub(_updateToTime, _planetExtendedInfo.lastUpdated);
            uint256 _silverMined = SafeMathUpgradeable.mul(_planet.silverGrowth, _timeDiff);

            _planet.silver = MathUpgradeable.min(
                _planet.silverCap,
                SafeMathUpgradeable.add(_planet.silver, _silverMined)
            );
        }
    }

    function _updatePopulation(uint256 _location, uint256 _updateToTime) private {
        DarkForestTypes.Planet storage _planet = s().planets[_location];
        DarkForestTypes.PlanetExtendedInfo storage _planetExtendedInfo =
            s().planetsExtendedInfo[_location];
        if (_planet.owner == address(0)) {
            // unowned planet doesn't increase in population
            return;
        }

        int128 _timeElapsed =
            ABDKMath64x64.sub(
                ABDKMath64x64.fromUInt(_updateToTime),
                ABDKMath64x64.fromUInt(_planetExtendedInfo.lastUpdated)
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
                                    ABDKMath64x64.fromUInt(_planet.populationGrowth)
                                ),
                                _timeElapsed
                            ),
                            ABDKMath64x64.fromUInt(_planet.populationCap)
                        )
                    ),
                    ABDKMath64x64.sub(
                        ABDKMath64x64.div(
                            ABDKMath64x64.fromUInt(_planet.populationCap),
                            ABDKMath64x64.fromUInt(_planet.population)
                        ),
                        _one
                    )
                ),
                _one
            );

        _planet.population = ABDKMath64x64.toUInt(
            ABDKMath64x64.div(ABDKMath64x64.fromUInt(_planet.populationCap), _denominator)
        );

        // quasars have 0 energy growth, so they have 0 energy decay as well
        // so don't allow them to become overful
        if (_planet.planetType == DarkForestTypes.PlanetType.SILVER_BANK) {
            if (_planet.population > _planet.populationCap) {
                _planet.population = _planet.populationCap;
            }
        }
    }

    function updatePlanet(uint256 _location, uint256 _updateToTime) public {
        DarkForestTypes.Planet storage _planet = s().planets[_location];
        DarkForestTypes.PlanetExtendedInfo storage _planetExtendedInfo =
            s().planetsExtendedInfo[_location];
        // assumes planet is already initialized
        _updatePopulation(_location, _updateToTime);

        if (_planet.planetType == DarkForestTypes.PlanetType.SILVER_MINE) {
            _updateSilver(_location, _updateToTime);
        }

        _planetExtendedInfo.lastUpdated = _updateToTime;
    }

    // assumes that the planet last updated time is equal to the arrival time trigger
    function applyArrival(uint256 planetId, uint256 arrivalId) private {
        DarkForestTypes.Planet storage _planet = s().planets[planetId];
        DarkForestTypes.ArrivalData storage _arrival = s().planetArrivals[arrivalId];

        // for readability, trust me.

        // checks whether the planet is owned by the player sending ships
        if (_arrival.player == _planet.owner) {
            // simply increase the population if so
            _planet.population = SafeMathUpgradeable.add(_planet.population, _arrival.popArriving);
        } else {
            if (_arrival.arrivalType == DarkForestTypes.ArrivalType.Wormhole) {
                // if this is a wormhole arrival to a planet that isn't owned by the initiator of
                // the move, then don't move any energy
            } else if (_planet.population > (_arrival.popArriving * 100) / _planet.defense) {
                // handles if the planet population is bigger than the arriving ships
                // simply reduce the amount of planet population by the arriving ships
                _planet.population = SafeMathUpgradeable.sub(
                    _planet.population,
                    (_arrival.popArriving * 100) / _planet.defense
                );
            } else {
                // handles if the planet population is equal or less the arriving ships
                // reduce the arriving ships amount with the current population and the
                // result is the new population of the planet now owned by the attacking
                // player
                _planet.owner = _arrival.player;
                _planet.population = SafeMathUpgradeable.sub(
                    _arrival.popArriving,
                    (_planet.population * _planet.defense) / 100
                );
                if (_planet.population == 0) {
                    // make sure pop is never 0
                    _planet.population = 1;
                }
            }
        }

        // quasars have 0 energy growth, so they have 0 energy decay as well
        // so don't allow them to become overful
        if (_planet.planetType == DarkForestTypes.PlanetType.SILVER_BANK) {
            if (_planet.population > _planet.populationCap) {
                _planet.population = _planet.populationCap;
            }
        }

        _planet.silver = MathUpgradeable.min(
            _planet.silverCap,
            SafeMathUpgradeable.add(_planet.silver, _arrival.silverMoved)
        );

        // if there is an artifact on this voyage, put it on the planet
        uint256 artifactId = _arrival.carriedArtifactId;
        if (artifactId != 0) {
            s().artifactIdToVoyageId[artifactId] = 0;
            DarkForestUtils._putArtifactOnPlanet(artifactId, planetId);
        }
    }

    function _applyPendingEvents(uint256 _location) public {
        DarkForestTypes.PlanetEventMetadata[] storage events = s().planetEvents[_location];

        uint256 _earliestEventTime;
        uint256 _bestIndex;
        do {
            // set to to the upperbound of uint256
            _earliestEventTime = 115792089237316195423570985008687907853269984665640564039457584007913129639935;

            // loops through the array and fine the earliest event times
            for (uint256 i = 0; i < events.length; i++) {
                if (events[i].timeTrigger < _earliestEventTime) {
                    _earliestEventTime = events[i].timeTrigger;
                    _bestIndex = i;
                }
            }

            // only process the event if it occurs not after the current time and the timeTrigger is not 0
            // which comes from uninitialized PlanetEventMetadata
            if (events.length != 0 && events[_bestIndex].timeTrigger <= block.timestamp) {
                updatePlanet(_location, events[_bestIndex].timeTrigger);

                // process event based on event type
                if (
                    events[_bestIndex].eventType == DarkForestTypes.PlanetEventType.ARRIVAL &&
                    !s().planetsExtendedInfo[_location].destroyed
                ) {
                    applyArrival(_location, events[_bestIndex].id);
                }

                // swaps the array element with the one in the end, and pop it
                events[_bestIndex] = events[events.length - 1];
                events.pop();
            }
        } while (_earliestEventTime <= block.timestamp);
    }
}
