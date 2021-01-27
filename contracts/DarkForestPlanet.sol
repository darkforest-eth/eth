// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.9;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "./DarkForestTypes.sol";
import "./DarkForestTokens.sol";
import "./DarkForestLazyUpdate.sol";
import "./DarkForestUtils.sol";

library DarkForestPlanet {
    function isPopCapBoost(uint256 _location) public pure returns (bool) {
        bytes memory _b = abi.encodePacked(_location);
        return uint256(uint8(_b[9])) < 16;
    }

    function isPopGroBoost(uint256 _location) public pure returns (bool) {
        bytes memory _b = abi.encodePacked(_location);
        return uint256(uint8(_b[10])) < 16;
    }

    function isRangeBoost(uint256 _location) public pure returns (bool) {
        bytes memory _b = abi.encodePacked(_location);
        return uint256(uint8(_b[11])) < 16;
    }

    function isSpeedBoost(uint256 _location) public pure returns (bool) {
        bytes memory _b = abi.encodePacked(_location);
        return uint256(uint8(_b[12])) < 16;
    }

    function isDefBoost(uint256 _location) public pure returns (bool) {
        bytes memory _b = abi.encodePacked(_location);
        return uint256(uint8(_b[13])) < 16;
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
        uint256 travelTime,
        uint256 id,
        mapping(uint256 => DarkForestTypes.Planet) storage planets,
        mapping(uint256 => DarkForestTypes.ArrivalData) storage planetArrivals
    ) internal {
        // enter the arrival data for event id
        DarkForestTypes.Planet memory planet = planets[_oldLoc];
        uint256 _popArriving = _getDecayedPop(
            _popMoved,
            _maxDist,
            planet.range,
            planet.populationCap
        );
        require(_popArriving > 0, "Not enough forces to make move");
        planetArrivals[id] = DarkForestTypes.ArrivalData({
            id: id,
            player: planet.owner,
            fromPlanet: _oldLoc,
            toPlanet: _newLoc,
            popArriving: _popArriving,
            silverMoved: _silverMoved,
            departureTime: block.timestamp,
            arrivalTime: block.timestamp + travelTime
        });
    }

    function initializePlanet(
        DarkForestTypes.Planet storage _planet,
        DarkForestTypes.PlanetExtendedInfo storage _planetExtendedInfo,
        DarkForestTypes.PlanetDefaultStats storage _planetDefaultStats,
        uint256 _perlin,
        uint256 TIME_FACTOR_HUNDREDTHS,
        uint256 PERLIN_THRESHOLD_1,
        uint256 PERLIN_THRESHOLD_2,
        DarkForestTypes.PlanetResource _planetResource,
        uint256 _planetLevel,
        uint256 _location
    ) public {
        // planet initialize should set the planet to default state, including having the owner be adress 0x0
        // then it's the responsibility for the mechanics to set the owner to the player
        bool deepSpace = _perlin >= PERLIN_THRESHOLD_2;
        bool mediumSpace = _perlin < PERLIN_THRESHOLD_2 &&
            _perlin >= PERLIN_THRESHOLD_1;

        bool silverMine = _planetResource ==
            DarkForestTypes.PlanetResource.SILVER;

        _planet.owner = address(0);
        _planet.planetLevel = _planetLevel;

        _planet.populationCap = _planetDefaultStats.populationCap;
        _planet.populationGrowth = _planetDefaultStats.populationGrowth;
        _planet.range = _planetDefaultStats.range;
        _planet.speed = _planetDefaultStats.speed;
        _planet.defense = _planetDefaultStats.defense;
        _planet.silverCap = _planetDefaultStats.silverCap;

        if (isPopCapBoost(_location)) {
            _planet.populationCap *= 2;
        }
        if (isPopGroBoost(_location)) {
            _planet.populationGrowth *= 2;
        }
        if (isRangeBoost(_location)) {
            _planet.range *= 2;
        }
        if (isSpeedBoost(_location)) {
            _planet.speed *= 2;
        }
        if (isDefBoost(_location)) {
            _planet.defense *= 2;
        }

        _planet.planetResource = _planetResource;
        if (silverMine) {
            _planet.silverGrowth = _planetDefaultStats.silverGrowth;
            _planet.silverCap *= 2;

            _planet.populationCap /= 2;
            _planet.populationGrowth /= 2;
            _planet.defense /= 2;
        }

        // deep space buffs and debuffs
        if (deepSpace) {
            // deep space buff
            _planet.range = (_planet.range * 3) / 2;
            _planet.speed = (_planet.speed * 3) / 2;
            _planet.populationCap = (_planet.populationCap * 3) / 2;
            _planet.populationGrowth = (_planet.populationGrowth * 3) / 2;
            _planet.silverCap = (_planet.silverCap * 3) / 2;
            _planet.silverGrowth = (_planet.silverGrowth * 3) / 2;

            // deep space debuff
            _planet.defense = _planet.defense / 4;
        } else if (mediumSpace) {
            // buff
            _planet.range = (_planet.range * 5) / 4;
            _planet.speed = (_planet.speed * 5) / 4;
            _planet.populationCap = (_planet.populationCap * 5) / 4;
            _planet.populationGrowth = (_planet.populationGrowth * 5) / 4;
            _planet.silverCap = (_planet.silverCap * 5) / 4;
            _planet.silverGrowth = (_planet.silverGrowth * 5) / 4;

            // debuff
            _planet.defense = _planet.defense / 2;
        }

        // initial population (barbarians) and silver
        _planet.population = SafeMathUpgradeable.div(
            SafeMathUpgradeable.mul(
                _planet.populationCap,
                _planetDefaultStats.barbarianPercentage
            ),
            100
        );
        // barbarians adjusted for def debuffs, and buffed in space/deepspace
        if (deepSpace) {
            _planet.population *= 6;
        } else if (mediumSpace) {
            _planet.population = (_planet.population * 5) / 2;
        }

        _planet.silver = 0;
        if (silverMine) {
            _planet.silver = _planet.silverCap / 2;
        }

        // apply time factor
        _planet.speed *= TIME_FACTOR_HUNDREDTHS / 100;
        _planet.populationGrowth *= TIME_FACTOR_HUNDREDTHS / 100;
        _planet.silverGrowth *= TIME_FACTOR_HUNDREDTHS / 100;

        // metadata
        _planetExtendedInfo.isInitialized = true;
        _planetExtendedInfo.perlin = _perlin;
        if (mediumSpace) {
            _planetExtendedInfo.spaceType = DarkForestTypes.SpaceType.SPACE;
        }
        if (deepSpace) {
            _planetExtendedInfo.spaceType = DarkForestTypes
                .SpaceType
                .DEEP_SPACE;
        }
        _planetExtendedInfo.createdAt = block.timestamp;
        _planetExtendedInfo.lastUpdated = block.timestamp;
        _planetExtendedInfo.upgradeState0 = 0;
        _planetExtendedInfo.upgradeState1 = 0;
        _planetExtendedInfo.upgradeState2 = 0;
    }

    function _buffPlanet(
        DarkForestTypes.Planet storage planet,
        DarkForestTypes.Upgrade memory upgrade
    ) public {
        planet.populationCap =
            (planet.populationCap * upgrade.popCapMultiplier) /
            100;
        planet.populationGrowth =
            (planet.populationGrowth * upgrade.popGroMultiplier) /
            100;
        planet.range = (planet.range * upgrade.rangeMultiplier) / 100;
        planet.speed = (planet.speed * upgrade.speedMultiplier) / 100;
        planet.defense = (planet.defense * upgrade.defMultiplier) / 100;
    }

    function _debuffPlanet(
        DarkForestTypes.Planet storage planet,
        DarkForestTypes.Upgrade memory upgrade
    ) public {
        planet.populationCap =
            (planet.populationCap * 100) /
            upgrade.popCapMultiplier;
        planet.populationGrowth =
            (planet.populationGrowth * 100) /
            upgrade.popGroMultiplier;
        planet.range = (planet.range * 100) / upgrade.rangeMultiplier;
        planet.speed = (planet.speed * 100) / upgrade.speedMultiplier;
        planet.defense = (planet.defense * 100) / upgrade.defMultiplier;
    }

    function upgradePlanet(
        uint256 _location,
        uint256 _branch,
        mapping(uint256 => DarkForestTypes.Planet) storage planets,
        mapping(uint256 => DarkForestTypes.PlanetExtendedInfo)
            storage planetsExtendedInfo,
        DarkForestTypes.PlanetDefaultStats[] storage planetDefaultStats,
        DarkForestTypes.Upgrade[4][3] storage upgrades
    ) public {
        // do checks

        require(
            planets[_location].owner == msg.sender,
            "Only owner account can perform operation on planets"
        );
        uint256 planetLevel = planets[_location].planetLevel;
        require(
            planetLevel > 0,
            "Planet level is not high enough for this upgrade"
        );
        require(_branch < 3, "Upgrade branch not valid");
        require(
            planets[_location].planetResource !=
                DarkForestTypes.PlanetResource.SILVER,
            "Can't upgrade silver mine"
        );
        uint256 totalLevel = planetsExtendedInfo[_location].upgradeState0 +
            planetsExtendedInfo[_location].upgradeState1 +
            planetsExtendedInfo[_location].upgradeState2;
        require(
            (planetsExtendedInfo[_location].spaceType ==
                DarkForestTypes.SpaceType.NEBULA &&
                totalLevel < 3) ||
                (planetsExtendedInfo[_location].spaceType ==
                    DarkForestTypes.SpaceType.SPACE &&
                    totalLevel < 4) ||
                (planetsExtendedInfo[_location].spaceType ==
                    DarkForestTypes.SpaceType.DEEP_SPACE &&
                    totalLevel < 5),
            "Planet at max total level"
        );

        uint256 upgradeBranchCurrentLevel;
        if (_branch == uint256(DarkForestTypes.UpgradeBranch.DEFENSE)) {
            upgradeBranchCurrentLevel = planetsExtendedInfo[_location]
                .upgradeState0;
        } else if (_branch == uint256(DarkForestTypes.UpgradeBranch.RANGE)) {
            upgradeBranchCurrentLevel = planetsExtendedInfo[_location]
                .upgradeState1;
        } else if (_branch == uint256(DarkForestTypes.UpgradeBranch.SPEED)) {
            upgradeBranchCurrentLevel = planetsExtendedInfo[_location]
                .upgradeState2;
        }
        require(upgradeBranchCurrentLevel < 4, "Upgrade branch already maxed");

        if (
            planetsExtendedInfo[_location].spaceType ==
            DarkForestTypes.SpaceType.DEEP_SPACE &&
            _branch == uint256(DarkForestTypes.UpgradeBranch.DEFENSE)
        ) {
            require(
                upgradeBranchCurrentLevel < 2,
                "Can't upgrade DEF past level 2 in deep space"
            );
        }


            DarkForestTypes.Upgrade memory upgrade
         = upgrades[_branch][upgradeBranchCurrentLevel];
        uint256 upgradeCost = (planets[_location].silverCap *
            20 *
            (totalLevel + 1)) / 100;
        require(
            planets[_location].silver >= upgradeCost,
            "Insufficient silver to upgrade"
        );

        // do upgrade
        _buffPlanet(planets[_location], upgrade);
        planets[_location].silver -= upgradeCost;
        if (_branch == uint256(DarkForestTypes.UpgradeBranch.DEFENSE)) {
            planetsExtendedInfo[_location].upgradeState0 += 1;
        } else if (_branch == uint256(DarkForestTypes.UpgradeBranch.RANGE)) {
            planetsExtendedInfo[_location].upgradeState1 += 1;
        } else if (_branch == uint256(DarkForestTypes.UpgradeBranch.SPEED)) {
            planetsExtendedInfo[_location].upgradeState2 += 1;
        }
    }

    function checkInit(
        uint256 _location,
        uint256 _perlin,
        uint256 _radius,
        mapping(address => bool) storage isPlayerInitialized,
        mapping(uint256 => DarkForestTypes.PlanetExtendedInfo)
            storage planetsExtendedInfo,
        uint256 worldRadius,
        uint256 PERLIN_THRESHOLD_1
    ) public view returns (bool) {
        require(
            !isPlayerInitialized[msg.sender],
            "Player is already initialized"
        );
        require(
            !planetsExtendedInfo[_location].isInitialized,
            "Planet is already initialized"
        );
        require(
            _radius <= worldRadius,
            "Init radius is bigger than the current world radius"
        );
        require(
            _perlin < PERLIN_THRESHOLD_1,
            "Init not allowed in perlin value greater than or equal to the threshold"
        );
        return true;
    }

    function move(
        uint256 _oldLoc,
        uint256 _newLoc,
        uint256 _maxDist,
        uint256 _popMoved,
        uint256 _silverMoved,
        uint256 planetEventsCount,
        mapping(uint256 => DarkForestTypes.Planet) storage planets,
        mapping(uint256 => DarkForestTypes.PlanetExtendedInfo)
            storage planetsExtendedInfo,
        mapping(uint256 => DarkForestTypes.PlanetEventMetadata[])
            storage planetEvents,
        mapping(uint256 => DarkForestTypes.ArrivalData) storage planetArrivals
    ) public {
        require(
            planets[_oldLoc].owner == msg.sender,
            "Only owner account can perform operation on planets"
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

        uint256 travelTime = (_maxDist * 100) / planets[_oldLoc].speed;
        // all checks pass. execute move
        // push the new move into the planetEvents array for _newLoc
        planetEvents[_newLoc].push(
            DarkForestTypes.PlanetEventMetadata({
                id: planetEventsCount,
                eventType: DarkForestTypes.PlanetEventType.ARRIVAL,
                timeTrigger: block.timestamp + travelTime,
                timeAdded: block.timestamp
            })
        );

        _createArrival(
            _oldLoc,
            _newLoc,
            _maxDist,
            _popMoved,
            _silverMoved,
            travelTime,
            planetEventsCount,
            planets,
            planetArrivals
        );

        planets[_oldLoc].population -= _popMoved;
        planets[_oldLoc].silver -= _silverMoved;
    }

    function refreshPlanet(
        uint256 _location,
        mapping(uint256 => DarkForestTypes.Planet) storage planets,
        mapping(uint256 => DarkForestTypes.PlanetExtendedInfo)
            storage planetsExtendedInfo,
        mapping(uint256 => DarkForestTypes.PlanetEventMetadata[])
            storage planetEvents,
        mapping(uint256 => DarkForestTypes.ArrivalData) storage planetArrivals
    ) public {
        require(
            planetsExtendedInfo[_location].isInitialized,
            "Planet has not been initialized"
        );

        // apply all pending events until the current timestamp
        DarkForestLazyUpdate._applyPendingEvents(
            _location,
            planetEvents,
            planets,
            planetsExtendedInfo,
            planetArrivals
        );

        // we need to do another updatePlanet call to sync the planet's data
        // to current time.
        DarkForestLazyUpdate.updatePlanet(
            planets[_location],
            planetsExtendedInfo[_location],
            block.timestamp
        );
    }

    // transfers ownership of artifact to core contract and assigns it to a planet
    function _putArtifactOnPlanet(
        DarkForestTokens tokens,
        uint256 artifactId,
        uint256 locationId,
        DarkForestTypes.Planet storage planet,
        DarkForestTypes.PlanetExtendedInfo storage planetInfo,
        mapping(uint256 => uint256) storage contractOwnedArtifactLocations
    ) public {
        tokens.transferToCoreContract(artifactId);
        contractOwnedArtifactLocations[artifactId] = locationId;
        planetInfo.heldArtifactId = artifactId;
        planetInfo.artifactLockedTimestamp = block.timestamp;
        DarkForestTypes.Upgrade memory upgrade = DarkForestUtils
            ._getUpgradeForArtifact(tokens.getArtifact(artifactId));
        _buffPlanet(planet, upgrade);
    }

    function _takeArtifactOffPlanet(
        DarkForestTokens tokens,
        address coreContractAddr,
        DarkForestTypes.Planet storage planet,
        DarkForestTypes.PlanetExtendedInfo storage planetInfo,
        mapping(uint256 => uint256) storage contractOwnedArtifactLocations
    ) public {
        uint256 artifactId = planetInfo.heldArtifactId;
        contractOwnedArtifactLocations[artifactId] = 0;
        planetInfo.heldArtifactId = 0;
        planetInfo.artifactLockedTimestamp = 0;
        tokens.safeTransferFrom(coreContractAddr, msg.sender, artifactId);
        DarkForestTypes.Upgrade memory upgrade = DarkForestUtils
            ._getUpgradeForArtifact(tokens.getArtifact(artifactId));
        _debuffPlanet(planet, upgrade);
    }
}
