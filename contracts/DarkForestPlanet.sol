// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.9;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./DarkForestTypes.sol";
import "./DarkForestLazyUpdate.sol";

library DarkForestPlanet {
    function isPopCapBoost(uint256 _location) public pure returns (bool) {
        bytes memory _b = abi.encodePacked(_location);
        return uint256(uint8(_b[11])) < 16;
    }

    function isPopGroBoost(uint256 _location) public pure returns (bool) {
        bytes memory _b = abi.encodePacked(_location);
        return uint256(uint8(_b[12])) < 16;
    }

    function isResCapBoost(uint256 _location) public pure returns (bool) {
        bytes memory _b = abi.encodePacked(_location);
        return uint256(uint8(_b[13])) < 16;
    }

    function isResGroBoost(uint256 _location) public pure returns (bool) {
        bytes memory _b = abi.encodePacked(_location);
        return uint256(uint8(_b[14])) < 16;
    }

    function isRangeBoost(uint256 _location) public pure returns (bool) {
        bytes memory _b = abi.encodePacked(_location);
        return uint256(uint8(_b[15])) < 16;
    }

    function _getDecayedPop(
        uint256 _popMoved,
        uint256 _maxDist,
        uint256 _range,
        uint256 _populationCap
    ) public pure returns (uint256 _decayedPop) {
        int128 _scaleInv = ABDKMath64x64.exp_2(
            ABDKMath64x64.divu(_maxDist, _range)
        );
        int128 _bigPlanetDebuff = ABDKMath64x64.divu(_populationCap, 20);
        int128 _beforeDebuff = ABDKMath64x64.div(
            ABDKMath64x64.fromUInt(_popMoved),
            _scaleInv
        );
        if (_beforeDebuff > _bigPlanetDebuff) {
            _decayedPop = ABDKMath64x64.toUInt(
                ABDKMath64x64.sub(_beforeDebuff, _bigPlanetDebuff)
            );
        } else {
            _decayedPop = 0;
        }
    }

    function _createArrival(
        uint256 _oldLoc,
        uint256 _newLoc,
        uint256 _maxDist,
        uint256 _popMoved,
        uint256 _silverMoved,
        uint256 GLOBAL_SPEED_IN_HUNDRETHS,
        uint256 planetEventsCount,
        mapping(uint256 => DarkForestTypes.Planet) storage planets,
        mapping(uint256 => DarkForestTypes.ArrivalData) storage planetArrivals
    ) internal {
        // enter the arrival data for event id planetEventsCount
        DarkForestTypes.Planet memory planet = planets[_oldLoc];
        uint256 _popArriving = _getDecayedPop(
            _popMoved,
            _maxDist,
            planet.range,
            planet.populationCap
        );
        require(_popArriving > 0, "Not enough forces to make move");
        planetArrivals[planetEventsCount] = DarkForestTypes.ArrivalData({
            id: planetEventsCount,
            player: msg.sender,
            fromPlanet: _oldLoc,
            toPlanet: _newLoc,
            popArriving: _popArriving,
            silverMoved: _silverMoved,
            departureTime: block.timestamp,
            arrivalTime: block.timestamp +
                (_maxDist * 100) /
                GLOBAL_SPEED_IN_HUNDRETHS
        });
    }

    function initializePlanet(
        DarkForestTypes.Planet storage _planet,
        DarkForestTypes.PlanetExtendedInfo storage _planetExtendedInfo,
        DarkForestTypes.PlanetDefaultStats storage _planetDefaultStats,
        uint256 _version,
        DarkForestTypes.PlanetType _planetType,
        DarkForestTypes.PlanetResource _planetResource,
        uint256 _planetLevel,
        uint256 _location
    ) public {
        _planetExtendedInfo.isInitialized = true;
        // planet initialize should set the planet to default state, including having the owner be adress 0x0
        // then it's the responsibility for the mechanics to set the owner to the player
        _planet.owner = address(0);
        _planet.range = isRangeBoost(_location)
            ? _planetDefaultStats.range * 2
            : _planetDefaultStats.range;

        _planet.populationCap = isPopCapBoost(_location)
            ? _planetDefaultStats.populationCap * 2
            : _planetDefaultStats.populationCap;

        _planet.population = _planetType ==
            DarkForestTypes.PlanetType.TRADING_POST
            ? 1500000
            : SafeMath.div(
                SafeMath.mul(
                    _planet.populationCap,
                    _planetDefaultStats.barbarianPercentage
                ),
                100
            );

        _planet.populationGrowth = isPopGroBoost(_location)
            ? _planetDefaultStats.populationGrowth * 2
            : _planetDefaultStats.populationGrowth;
        // TESTING
        // _planet.populationGrowth *= 100;

        _planet.planetResource = _planetResource;

        _planet.silverCap = isResCapBoost(_location)
            ? _planetDefaultStats.silverCap * 2
            : _planetDefaultStats.silverCap;
        _planet.silverGrowth = 0;
        if (_planetResource == DarkForestTypes.PlanetResource.SILVER) {
            _planet.silverGrowth = isResGroBoost(_location)
                ? _planetDefaultStats.silverGrowth * 2
                : _planetDefaultStats.silverGrowth;
            // TESTING
            // _planet.silverGrowth *= 100;
        }

        _planet.silver = 0;
        _planet.silverMax = _planetDefaultStats.silverMax;
        _planet.planetLevel = _planetLevel;

        _planetExtendedInfo.version = _version;
        _planetExtendedInfo.lastUpdated = block.timestamp;
        _planetExtendedInfo.upgradeState0 = 0;
        _planetExtendedInfo.upgradeState1 = 0;
        _planetExtendedInfo.upgradeState2 = 0;
    }

    function upgradePlanet(
        DarkForestTypes.Planet storage _planet,
        DarkForestTypes.PlanetExtendedInfo storage _planetExtendedInfo,
        uint256 _branch,
        DarkForestTypes.PlanetDefaultStats[] storage planetDefaultStats,
        DarkForestTypes.Upgrade[4][3] storage upgrades
    ) public {
        // do checks
        require(
            _planet.owner == msg.sender,
            "Only owner can perform operation on planets"
        );
        uint256 planetLevel = _planet.planetLevel;
        require(
            planetLevel > 0,
            "Planet level is not high enough for this upgrade"
        );
        require(_branch < 3, "Upgrade branch not valid");
        uint256 upgradeBranchCurrentLevel;
        if (_branch == 0) {
            upgradeBranchCurrentLevel = _planetExtendedInfo.upgradeState0;
        } else if (_branch == 1) {
            upgradeBranchCurrentLevel = _planetExtendedInfo.upgradeState1;
        } else if (_branch == 2) {
            upgradeBranchCurrentLevel = _planetExtendedInfo.upgradeState2;
        }
        require(upgradeBranchCurrentLevel < 4, "Upgrade branch already maxed");
        if (upgradeBranchCurrentLevel == 2) {
            if (_branch == 0) {
                require(
                    _planetExtendedInfo.upgradeState1 < 3 &&
                        _planetExtendedInfo.upgradeState2 < 3,
                    "Can't upgrade a second branch to level 3"
                );
            }
            if (_branch == 1) {
                require(
                    _planetExtendedInfo.upgradeState0 < 3 &&
                        _planetExtendedInfo.upgradeState2 < 3,
                    "Can't upgrade a second branch to level 3"
                );
            }
            if (_branch == 2) {
                require(
                    _planetExtendedInfo.upgradeState0 < 3 &&
                        _planetExtendedInfo.upgradeState1 < 3,
                    "Can't upgrade a second branch to level 3"
                );
            }
        }


            DarkForestTypes.Upgrade memory upgrade
         = upgrades[_branch][upgradeBranchCurrentLevel];
        uint256 upgradeCost = (planetDefaultStats[planetLevel].silverCap *
            upgrade.silverCostMultiplier) / 100;
        require(
            _planet.silver >= upgradeCost,
            "Insufficient silver to upgrade"
        );

        // do upgrade
        _planet.populationCap =
            (_planet.populationCap * upgrade.popCapMultiplier) /
            100;
        _planet.populationGrowth =
            (_planet.populationGrowth * upgrade.popGroMultiplier) /
            100;
        _planet.silverCap =
            (_planet.silverCap * upgrade.silverCapMultiplier) /
            100;
        _planet.silverGrowth =
            (_planet.silverGrowth * upgrade.silverGroMultiplier) /
            100;
        _planet.silverMax =
            (_planet.silverMax * upgrade.silverMaxMultiplier) /
            100;
        _planet.range = (_planet.range * upgrade.rangeMultiplier) / 100;
        _planet.silver -= upgradeCost;
        if (_branch == 0) {
            _planetExtendedInfo.upgradeState0 += 1;
        } else if (_branch == 1) {
            _planetExtendedInfo.upgradeState1 += 1;
        } else if (_branch == 2) {
            _planetExtendedInfo.upgradeState2 += 1;
        }
    }

    function move(
        uint256 _oldLoc,
        uint256 _newLoc,
        uint256 _maxDist,
        uint256 _popMoved,
        uint256 _silverMoved,
        uint256 GLOBAL_SPEED_IN_HUNDRETHS,
        uint256 planetEventsCount,
        mapping(uint256 => DarkForestTypes.Planet) storage planets,
        mapping(uint256 => DarkForestTypes.PlanetEventMetadata[])
            storage planetEvents,
        mapping(uint256 => DarkForestTypes.ArrivalData) storage planetArrivals
    ) public {
        require(
            planets[_oldLoc].owner == msg.sender,
            "Only owner can perform operation on planets"
        );
        // we want strict > so that the population can't go to 0
        require(
            planets[_oldLoc].population > _popMoved,
            "Tried to move more population that what exists"
        );
        require(
            planets[_oldLoc].silver >= _silverMoved,
            "Tried to move more silver than what exists"
        );

        // all checks pass. execute move
        // push the new move into the planetEvents array for _newLoc
        planetEvents[_newLoc].push(
            DarkForestTypes.PlanetEventMetadata({
                id: planetEventsCount,
                eventType: DarkForestTypes.PlanetEventType.ARRIVAL,
                timeTrigger: block.timestamp +
                    (_maxDist * 100) /
                    GLOBAL_SPEED_IN_HUNDRETHS,
                timeAdded: block.timestamp
            })
        );

        _createArrival(
            _oldLoc,
            _newLoc,
            _maxDist,
            _popMoved,
            _silverMoved,
            GLOBAL_SPEED_IN_HUNDRETHS,
            planetEventsCount,
            planets,
            planetArrivals
        );

        // subtract ships and silver sent
        planets[_oldLoc].population -= _popMoved;
        planets[_oldLoc].silver -= _silverMoved;
    }
}
