pragma solidity ^0.6.9;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/MathUpgradeable.sol";
import "./ABDKMath64x64.sol";
import "./DarkForestTypes.sol";

library DarkForestLazyUpdate {
    function _updateSilver(
        DarkForestTypes.Planet storage _planet,
        DarkForestTypes.PlanetExtendedInfo storage _planetExtendedInfo,
        uint256 _updateToTime
    ) private {
        // This function should never be called directly and should only be called
        // by the refresh planet function. This require is in place to make sure
        // no one tries to updateSilver on non silver producing planet.
        require(
            _planet.planetResource == DarkForestTypes.PlanetResource.SILVER,
            "Can only update silver on silver producing planet"
        );
        if (_planet.owner == address(0)) {
            // unowned planet doesn't gain silver
            return;
        }

        if (_planet.silver < _planet.silverCap) {

            uint256 _timeDiff = SafeMathUpgradeable.sub(
                _updateToTime,
                _planetExtendedInfo.lastUpdated
            );
            uint256 _silverMined = SafeMathUpgradeable.mul(
                _planet.silverGrowth,
                _timeDiff
            );

            _planet.silver = MathUpgradeable.min(
                _planet.silverCap,
                SafeMathUpgradeable.add(_planet.silver, _silverMined)
            );
        }
    }

    function _updatePopulation(
        DarkForestTypes.Planet storage _planet,
        DarkForestTypes.PlanetExtendedInfo storage _planetExtendedInfo,
        uint256 _updateToTime
    ) private {
        if (_planet.owner == address(0)) {
            // unowned planet doesn't increase in population
            return;
        }

        int128 _timeElapsed = ABDKMath64x64.sub(
            ABDKMath64x64.fromUInt(_updateToTime),
            ABDKMath64x64.fromUInt(_planetExtendedInfo.lastUpdated)
        );

        int128 _one = ABDKMath64x64.fromUInt(1);

        int128 _denominator = ABDKMath64x64.add(
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
            ABDKMath64x64.div(
                ABDKMath64x64.fromUInt(_planet.populationCap),
                _denominator
            )
        );
    }

    function updatePlanet(
        DarkForestTypes.Planet storage _planet,
        DarkForestTypes.PlanetExtendedInfo storage _planetExtendedInfo,
        uint256 _updateToTime
    ) public {
        // assumes planet is already initialized
        _updatePopulation(_planet, _planetExtendedInfo, _updateToTime);

        if (_planet.planetResource == DarkForestTypes.PlanetResource.SILVER) {
            _updateSilver(_planet, _planetExtendedInfo, _updateToTime);
        }

        _planetExtendedInfo.lastUpdated = _updateToTime;
    }

    // assumes that the planet last updated time is equal to the arrival time trigger
    function applyArrival(
        DarkForestTypes.Planet storage _planet,
        DarkForestTypes.ArrivalData storage _planetArrival
    ) private {
        // for readability, trust me.

        // checks whether the planet is owned by the player sending ships
        if (_planetArrival.player == _planet.owner) {
            // simply increase the population if so
            _planet.population = SafeMathUpgradeable.add(
                _planet.population,
                _planetArrival.popArriving
            );
        } else {
            if (_planet.population > _planetArrival.popArriving * 100 / _planet.defense) {
                // handles if the planet population is bigger than the arriving ships
                // simply reduce the amount of planet population by the arriving ships
                _planet.population = SafeMathUpgradeable.sub(
                    _planet.population,
                    _planetArrival.popArriving * 100 / _planet.defense
                );
            } else {
                // handles if the planet population is equal or less the arriving ships
                // reduce the arriving ships amount with the current population and the
                // result is the new population of the planet now owned by the attacking
                // player
                _planet.owner = _planetArrival.player;
                _planet.population = SafeMathUpgradeable.sub(
                    _planetArrival.popArriving,
                    _planet.population * _planet.defense / 100
                );
                if (_planet.population == 0) {
                    // make sure pop is never 0
                    _planet.population = 1;
                }
            }
        }

        _planet.silver = MathUpgradeable.min(
            _planet.silverCap,
            SafeMathUpgradeable.add(_planet.silver, _planetArrival.silverMoved)
        );
    }

    function _applyPendingEvents(
        uint256 _location,
        mapping(uint256 => DarkForestTypes.PlanetEventMetadata[]) storage planetEvents,
        mapping(uint256 => DarkForestTypes.Planet) storage planets,
        mapping(uint256 => DarkForestTypes.PlanetExtendedInfo) storage planetsExtendedInfo,
        mapping(uint256 => DarkForestTypes.ArrivalData) storage planetArrivals
    ) public {
        uint256 _earliestEventTime;
        uint256 _bestIndex;
        do {
            // set to to the upperbound of uint256
            _earliestEventTime = 115792089237316195423570985008687907853269984665640564039457584007913129639935;

            // loops through the array and fine the earliest event times
            for (uint256 i = 0; i < planetEvents[_location].length; i++) {
                if (
                    planetEvents[_location][i].timeTrigger < _earliestEventTime
                ) {
                    _earliestEventTime = planetEvents[_location][i].timeTrigger;
                    _bestIndex = i;
                }
            }

            // only process the event if it occurs not after the current time and the timeTrigger is not 0
            // which comes from uninitialized PlanetEventMetadata
            if (
                planetEvents[_location].length != 0 &&
                planetEvents[_location][_bestIndex].timeTrigger <=
                block.timestamp
            ) {
                updatePlanet(
                    planets[_location],
                    planetsExtendedInfo[_location],
                    planetEvents[_location][_bestIndex].timeTrigger
                );

                // process event based on event type
                if (
                    planetEvents[_location][_bestIndex].eventType ==
                    DarkForestTypes.PlanetEventType.ARRIVAL
                ) {
                    applyArrival(
                        planets[planetArrivals[planetEvents[_location][_bestIndex]
                            .id]
                            .toPlanet],
                        planetArrivals[planetEvents[_location][_bestIndex].id]
                    );
                }

                // swaps the array element with the one in the end, and pop it
                planetEvents[_location][_bestIndex] = planetEvents[_location][planetEvents[_location]
                    .length - 1];
                planetEvents[_location].pop();
            }
        } while (_earliestEventTime <= block.timestamp);
    }
}
