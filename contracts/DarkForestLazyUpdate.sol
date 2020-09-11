pragma solidity ^0.6.9;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
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

        // WE NEED TO MAKE SURE WE NEVER TAKE LOG(0)
        uint256 _startSilverProd;

        if (_planet.population > _planet.populationCap / 2) {
            // midpoint was before lastUpdated, so start prod from lastUpdated
            _startSilverProd = _planetExtendedInfo.lastUpdated;
        } else {
            // midpoint was after lastUpdated, so calculate & start prod from lastUpdated
            int128 _popCap = ABDKMath64x64.fromUInt(_planet.populationCap);
            int128 _pop = ABDKMath64x64.fromUInt(_planet.population);
            int128 _logVal = ABDKMath64x64.ln(
                ABDKMath64x64.div(ABDKMath64x64.sub(_popCap, _pop), _pop)
            );

            int128 _diffNumerator = ABDKMath64x64.mul(_logVal, _popCap);
            int128 _diffDenominator = ABDKMath64x64.mul(
                ABDKMath64x64.fromUInt(4),
                ABDKMath64x64.fromUInt(_planet.populationGrowth)
            );

            int128 _popCurveMidpoint = ABDKMath64x64.add(
                ABDKMath64x64.div(_diffNumerator, _diffDenominator),
                ABDKMath64x64.fromUInt(_planetExtendedInfo.lastUpdated)
            );

            _startSilverProd = ABDKMath64x64.toUInt(_popCurveMidpoint);
        }

        // Check if the pop curve midpoint happens in the past
        if (_startSilverProd < _updateToTime) {
            uint256 _timeDiff;

            if (_startSilverProd > _planetExtendedInfo.lastUpdated) {
                _timeDiff = SafeMath.sub(_updateToTime, _startSilverProd);
            } else {
                _timeDiff = SafeMath.sub(
                    _updateToTime,
                    _planetExtendedInfo.lastUpdated
                );
            }

            if (_planet.silver < _planet.silverCap) {
                uint256 _silverMined = SafeMath.mul(
                    _planet.silverGrowth,
                    _timeDiff
                );

                _planet.silver = Math.min(
                    _planet.silverCap,
                    SafeMath.add(_planet.silver, _silverMined)
                );
            }
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
            _planet.population = SafeMath.add(
                _planet.population,
                _planetArrival.popArriving
            );
        } else {
            if (_planet.population > _planetArrival.popArriving) {
                // handles if the planet population is bigger than the arriving ships
                // simply reduce the amount of planet population by the arriving ships
                _planet.population = SafeMath.sub(
                    _planet.population,
                    _planetArrival.popArriving
                );
            } else {
                // handles if the planet population is equal or less the arriving ships
                // reduce the arriving ships amount with the current population and the
                // result is the new population of the planet now owned by the attacking
                // player
                _planet.owner = _planetArrival.player;
                _planet.population = SafeMath.sub(
                    _planetArrival.popArriving,
                    _planet.population
                );
                if (_planet.population == 0) {
                    // make sure pop is never 0
                    _planet.population = 1;
                }
            }
        }

        _planet.silver = Math.min(
            _planet.silverMax,
            SafeMath.add(_planet.silver, _planetArrival.silverMoved)
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

            // TODO: the invalid opcode error is somewhere in this block
            // only process the event if it occurs before the current time and the timeTrigger is not 0
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
