// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "./DarkForestTypes.sol";
import "./DarkForestTokens.sol";
import "./DarkForestLazyUpdate.sol";
import "./DarkForestUtils.sol";
import "./DarkForestArtifactUtils.sol";

library DarkForestPlanet {
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

    // also need to copy some of DFCore's event signatures
    event ArtifactActivated(address player, uint256 artifactId, uint256 loc);
    event ArtifactDeactivated(address player, uint256 artifactId, uint256 loc);
    event PlanetUpgraded(address player, uint256 loc, uint256 branch, uint256 toBranchLevel);

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
        uint256 distTimesHundred,
        uint256 _range,
        uint256 _populationCap
    ) public pure returns (uint256 _decayedPop) {
        int128 _scaleInv = ABDKMath64x64.exp_2(ABDKMath64x64.divu(distTimesHundred, _range * 100));
        int128 _bigPlanetDebuff = ABDKMath64x64.divu(_populationCap, 20);
        int128 _beforeDebuff = ABDKMath64x64.div(ABDKMath64x64.fromUInt(_popMoved), _scaleInv);
        if (_beforeDebuff > _bigPlanetDebuff) {
            _decayedPop = ABDKMath64x64.toUInt(ABDKMath64x64.sub(_beforeDebuff, _bigPlanetDebuff));
        } else {
            _decayedPop = 0;
        }
    }

    function _createArrival(DarkForestTypes.DFPCreateArrivalArgs memory args) internal {
        // enter the arrival data for event id
        DarkForestTypes.Planet memory planet = s().planets[args.oldLoc];
        uint256 popArriving =
            _getDecayedPop(
                args.popMoved,
                args.effectiveDistTimesHundred,
                planet.range,
                planet.populationCap
            );
        require(popArriving > 0, "Not enough forces to make move");
        s().planetArrivals[s().planetEventsCount] = DarkForestTypes.ArrivalData({
            id: s().planetEventsCount,
            player: planet.owner,
            fromPlanet: args.oldLoc,
            toPlanet: args.newLoc,
            popArriving: popArriving,
            silverMoved: args.silverMoved,
            departureTime: block.timestamp,
            arrivalTime: block.timestamp + args.travelTime,
            arrivalType: args.arrivalType,
            carriedArtifactId: args.movedArtifactId,
            distance: args.actualDist
        });

        if (args.movedArtifactId != 0) {
            DarkForestUtils._takeArtifactOffPlanet(args.movedArtifactId, args.oldLoc);
            s().artifactIdToVoyageId[args.movedArtifactId] = s().planetEventsCount;
        }
    }

    function revealLocation(
        uint256 location,
        uint256 perlin,
        uint256 x,
        uint256 y,
        bool checkTimestamp
    ) public {
        if (checkTimestamp) {
            require(
                block.timestamp - s().players[msg.sender].lastRevealTimestamp >
                    s().gameConstants.LOCATION_REVEAL_COOLDOWN,
                "wait for cooldown before revealing again"
            );
        }
        require(s().revealedCoords[location].locationId == 0, "Location already revealed");
        s().revealedPlanetIds.push(location);
        s().revealedCoords[location] = DarkForestTypes.RevealedCoords({
            locationId: location,
            x: x,
            y: y,
            revealer: msg.sender
        });
        s().players[msg.sender].lastRevealTimestamp = block.timestamp;
    }

    function getDefaultInitPlanetArgs(
        uint256 _location,
        uint256 _perlin,
        bool _isHomePlanet
    ) public returns (DarkForestTypes.DFPInitPlanetArgs memory) {
        (
            uint256 level,
            DarkForestTypes.PlanetType planetType,
            DarkForestTypes.SpaceType spaceType
        ) = DarkForestUtils._getPlanetLevelTypeAndSpaceType(_location, _perlin);

        if (_isHomePlanet) {
            require(level == 0, "Can only initialize on planet level 0");
            require(
                planetType == DarkForestTypes.PlanetType.PLANET,
                "Can only initialize on regular planets"
            );
        }

        return
            DarkForestTypes.DFPInitPlanetArgs(
                _location,
                _perlin,
                level,
                s().gameConstants.TIME_FACTOR_HUNDREDTHS,
                spaceType,
                planetType,
                _isHomePlanet
            );
    }

    function initializePlanetWithDefaults(
        uint256 _location,
        uint256 _perlin,
        bool _isHomePlanet
    ) public {
        require(DarkForestUtils._locationIdValid(_location), "Not a valid planet location");

        DarkForestTypes.DFPInitPlanetArgs memory initArgs =
            getDefaultInitPlanetArgs(_location, _perlin, _isHomePlanet);

        _initializePlanet(initArgs);
        s().planetIds.push(_location);
        s().initializedPlanetCountByLevel[initArgs.level] += 1;
    }

    function _initializePlanet(DarkForestTypes.DFPInitPlanetArgs memory args) public {
        DarkForestTypes.Planet storage _planet = s().planets[args.location];
        DarkForestTypes.PlanetExtendedInfo storage _planetExtendedInfo =
            s().planetsExtendedInfo[args.location];
        DarkForestTypes.PlanetDefaultStats storage _planetDefaultStats =
            s().planetDefaultStats[args.level];
        // can't initialize a planet twice
        require(!_planetExtendedInfo.isInitialized, "Planet is already initialized");

        // planet initialize should set the planet to default state, including having the owner be adress 0x0
        // then it's the responsibility for the mechanics to set the owner to the player
        bool deadSpace = args.spaceType == DarkForestTypes.SpaceType.DEAD_SPACE;
        bool deepSpace = args.spaceType == DarkForestTypes.SpaceType.DEEP_SPACE;
        bool mediumSpace = args.spaceType == DarkForestTypes.SpaceType.SPACE;

        _planet.owner = address(0);
        _planet.planetLevel = args.level;

        _planet.populationCap = _planetDefaultStats.populationCap;
        _planet.populationGrowth = _planetDefaultStats.populationGrowth;
        _planet.range = _planetDefaultStats.range;
        _planet.speed = _planetDefaultStats.speed;
        _planet.defense = _planetDefaultStats.defense;
        _planet.silverCap = _planetDefaultStats.silverCap;
        if (args.planetType == DarkForestTypes.PlanetType.SILVER_MINE) {
            _planet.silverGrowth = _planetDefaultStats.silverGrowth;
        }

        if (isPopCapBoost(args.location)) {
            _planet.populationCap *= 2;
        }
        if (isPopGroBoost(args.location)) {
            _planet.populationGrowth *= 2;
        }
        if (isRangeBoost(args.location)) {
            _planet.range *= 2;
        }
        if (isSpeedBoost(args.location)) {
            _planet.speed *= 2;
        }
        if (isDefBoost(args.location)) {
            _planet.defense *= 2;
        }

        // space type buffs and debuffs
        if (deadSpace) {
            // dead space buff
            _planet.range = _planet.range * 2;
            _planet.speed = _planet.speed * 2;
            _planet.populationCap = _planet.populationCap * 2;
            _planet.populationGrowth = _planet.populationGrowth * 2;
            _planet.silverCap = _planet.silverCap * 2;
            _planet.silverGrowth = _planet.silverGrowth * 2;

            // dead space debuff
            _planet.defense = (_planet.defense * 3) / 20;
        } else if (deepSpace) {
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

        // apply buffs/debuffs for nonstandard planets
        // generally try to make division happen later than multiplication to avoid weird rounding
        _planet.planetType = args.planetType;

        if (args.planetType == DarkForestTypes.PlanetType.SILVER_MINE) {
            _planet.silverCap *= 2;
            _planet.defense /= 2;
        } else if (args.planetType == DarkForestTypes.PlanetType.SILVER_BANK) {
            // TODO: Enabled for future rounds
            // _planet.speed /= 2;
            _planet.silverCap *= 10;
            _planet.populationGrowth = 0;
            _planet.populationCap *= 5;
        } else if (args.planetType == DarkForestTypes.PlanetType.TRADING_POST) {
            _planet.defense /= 2;
            _planet.silverCap *= 2;
        }

        // initial population (pirates) and silver
        _planet.population = SafeMathUpgradeable.div(
            SafeMathUpgradeable.mul(_planet.populationCap, _planetDefaultStats.barbarianPercentage),
            100
        );

        // pirates adjusted for def debuffs, and buffed in space/deepspace
        if (deadSpace) {
            _planet.population *= 20;
        } else if (deepSpace) {
            _planet.population *= 10;
        } else if (mediumSpace) {
            _planet.population *= 4;
        }
        if (args.planetType == DarkForestTypes.PlanetType.SILVER_BANK) {
            _planet.population /= 2;
        }

        // Adjust silver cap for mine
        if (args.planetType == DarkForestTypes.PlanetType.SILVER_MINE) {
            _planet.silver = _planet.silverCap / 2;
        }

        // apply time factor
        _planet.speed *= args.TIME_FACTOR_HUNDREDTHS / 100;
        _planet.populationGrowth *= args.TIME_FACTOR_HUNDREDTHS / 100;
        _planet.silverGrowth *= args.TIME_FACTOR_HUNDREDTHS / 100;

        // metadata
        _planetExtendedInfo.isInitialized = true;
        _planetExtendedInfo.perlin = args.perlin;
        _planetExtendedInfo.spaceType = args.spaceType;
        _planetExtendedInfo.createdAt = block.timestamp;
        _planetExtendedInfo.lastUpdated = block.timestamp;
        _planetExtendedInfo.upgradeState0 = 0;
        _planetExtendedInfo.upgradeState1 = 0;
        _planetExtendedInfo.upgradeState2 = 0;

        if (args.isHomePlanet) {
            _planet.isHomePlanet = true;
            _planet.owner = msg.sender;
            _planet.population = 50000;
        }
    }

    function upgradePlanet(uint256 _location, uint256 _branch) public {
        DarkForestTypes.Planet storage planet = s().planets[_location];
        DarkForestTypes.PlanetExtendedInfo storage info = s().planetsExtendedInfo[_location];
        require(planet.owner == msg.sender, "Only owner account can perform operation on planets");
        uint256 planetLevel = planet.planetLevel;
        require(planetLevel > 0, "Planet level is not high enough for this upgrade");
        require(_branch < 3, "Upgrade branch not valid");
        require(
            planet.planetType == DarkForestTypes.PlanetType.PLANET,
            "Can only upgrade regular planets"
        );
        require(!info.destroyed, "planet is destroyed");

        uint256 totalLevel = info.upgradeState0 + info.upgradeState1 + info.upgradeState2;
        require(
            (info.spaceType == DarkForestTypes.SpaceType.NEBULA && totalLevel < 3) ||
                (info.spaceType == DarkForestTypes.SpaceType.SPACE && totalLevel < 4) ||
                (info.spaceType == DarkForestTypes.SpaceType.DEEP_SPACE && totalLevel < 5) ||
                (info.spaceType == DarkForestTypes.SpaceType.DEAD_SPACE && totalLevel < 5),
            "Planet at max total level"
        );

        uint256 upgradeBranchCurrentLevel;
        if (_branch == uint256(DarkForestTypes.UpgradeBranch.DEFENSE)) {
            upgradeBranchCurrentLevel = info.upgradeState0;
        } else if (_branch == uint256(DarkForestTypes.UpgradeBranch.RANGE)) {
            upgradeBranchCurrentLevel = info.upgradeState1;
        } else if (_branch == uint256(DarkForestTypes.UpgradeBranch.SPEED)) {
            upgradeBranchCurrentLevel = info.upgradeState2;
        }
        require(upgradeBranchCurrentLevel < 4, "Upgrade branch already maxed");

        DarkForestTypes.Upgrade memory upgrade = s().upgrades[_branch][upgradeBranchCurrentLevel];
        uint256 upgradeCost = (planet.silverCap * 20 * (totalLevel + 1)) / 100;
        require(planet.silver >= upgradeCost, "Insufficient silver to upgrade");

        // do upgrade
        DarkForestUtils._buffPlanet(_location, upgrade);
        planet.silver -= upgradeCost;
        if (_branch == uint256(DarkForestTypes.UpgradeBranch.DEFENSE)) {
            info.upgradeState0 += 1;
        } else if (_branch == uint256(DarkForestTypes.UpgradeBranch.RANGE)) {
            info.upgradeState1 += 1;
        } else if (_branch == uint256(DarkForestTypes.UpgradeBranch.SPEED)) {
            info.upgradeState2 += 1;
        }
        emit PlanetUpgraded(msg.sender, _location, _branch, upgradeBranchCurrentLevel + 1);
    }

    function checkPlayerInit(
        uint256 _location,
        uint256 _perlin,
        uint256 _radius
    ) public view returns (bool) {
        require(!s().players[msg.sender].isInitialized, "Player is already initialized");
        require(_radius <= s().worldRadius, "Init radius is bigger than the current world radius");

        if (s().gameConstants.SPAWN_RIM_AREA != 0) {
            require(
                (_radius**2 * 314) / 100 + s().gameConstants.SPAWN_RIM_AREA >=
                    (s().worldRadius**2 * 314) / 100,
                "Player can only spawn at the universe rim"
            );
        }

        require(
            _perlin >= s().gameConstants.INIT_PERLIN_MIN,
            "Init not allowed in perlin value less than INIT_PERLIN_MIN"
        );
        require(
            _perlin < s().gameConstants.INIT_PERLIN_MAX,
            "Init not allowed in perlin value greater than or equal to the INIT_PERLIN_MAX"
        );
        return true;
    }

    function move(DarkForestTypes.DFPMoveArgs memory args) public {
        DarkForestTypes.Artifact memory activeArtifactFrom =
            DarkForestUtils.getActiveArtifact(args.oldLoc);
        DarkForestTypes.Artifact memory activeArtifactTo =
            DarkForestUtils.getActiveArtifact(args.newLoc);
        require(
            !s().planetsExtendedInfo[args.newLoc].destroyed &&
                !s().planetsExtendedInfo[args.oldLoc].destroyed,
            "planet is destroyed"
        );
        require(
            s().planets[args.oldLoc].owner == msg.sender,
            "Only owner account can perform operation on planets"
        );
        // we want strict > so that the population can't go to 0
        require(
            s().planets[args.oldLoc].population > args.popMoved,
            "Tried to move more population that what exists"
        );
        require(
            s().planets[args.oldLoc].silver >= args.silverMoved,
            "Tried to move more silver than what exists"
        );

        if (args.movedArtifactId != 0) {
            require(
                s().planetArtifacts[args.newLoc].length < 5,
                "too many artifacts on this planet"
            );
        }

        uint256 effectiveDistTimesHundred = args.maxDist * 100; // for precision
        DarkForestTypes.ArrivalType arrivalType = DarkForestTypes.ArrivalType.Normal;
        DarkForestTypes.Upgrade memory temporaryUpgrade = DarkForestUtils.defaultUpgrade();

        {
            DarkForestTypes.Artifact memory relevantWormhole;

            // TODO: take the greater rarity of these, or disallow wormholes between planets that
            // already have a wormhole between them
            if (
                activeArtifactFrom.isInitialized &&
                activeArtifactFrom.artifactType == DarkForestTypes.ArtifactType.Wormhole &&
                activeArtifactFrom.wormholeTo == args.newLoc
            ) {
                relevantWormhole = activeArtifactFrom;
            } else if (
                activeArtifactTo.isInitialized &&
                activeArtifactTo.artifactType == DarkForestTypes.ArtifactType.Wormhole &&
                activeArtifactTo.wormholeTo == args.oldLoc
            ) {
                relevantWormhole = activeArtifactTo;
            }

            if (relevantWormhole.isInitialized) {
                uint256[6] memory speedBoosts = [uint256(1), 2, 4, 8, 16, 32];
                effectiveDistTimesHundred /= speedBoosts[uint256(relevantWormhole.rarity)];
                arrivalType = DarkForestTypes.ArrivalType.Wormhole;
            }
        }

        if (
            activeArtifactFrom.isInitialized &&
            activeArtifactFrom.artifactType == DarkForestTypes.ArtifactType.PhotoidCannon &&
            block.timestamp - activeArtifactFrom.lastActivated >=
            s().gameConstants.PHOTOID_ACTIVATION_DELAY
        ) {
            arrivalType = DarkForestTypes.ArrivalType.Photoid;
            DarkForestArtifactUtils.deactivateArtifact(args.oldLoc);
            temporaryUpgrade = DarkForestUtils.timeDelayUpgrade(activeArtifactFrom);
        }

        DarkForestUtils._buffPlanet(args.oldLoc, temporaryUpgrade);

        uint256 travelTime = effectiveDistTimesHundred / s().planets[args.oldLoc].speed;

        // don't allow 0 second voyages, so that arrival can't be processed in same block
        if (travelTime == 0) {
            travelTime = 1;
        }

        // all checks pass. execute move
        // push the new move into the planetEvents array for args.newLoc
        s().planetEvents[args.newLoc].push(
            DarkForestTypes.PlanetEventMetadata(
                s().planetEventsCount,
                DarkForestTypes.PlanetEventType.ARRIVAL,
                block.timestamp + travelTime,
                block.timestamp
            )
        );

        _createArrival(
            DarkForestTypes.DFPCreateArrivalArgs(
                args.oldLoc,
                args.newLoc,
                args.maxDist,
                effectiveDistTimesHundred,
                args.popMoved,
                args.silverMoved,
                travelTime,
                args.movedArtifactId,
                arrivalType
            )
        );
        DarkForestUtils._debuffPlanet(args.oldLoc, temporaryUpgrade);

        s().planets[args.oldLoc].population -= args.popMoved;
        s().planets[args.oldLoc].silver -= args.silverMoved;
    }

    function getRefreshedPlanet(uint256 location, uint256 timestamp)
        public
        view
        returns (
            DarkForestTypes.Planet memory,
            DarkForestTypes.PlanetExtendedInfo memory,
            uint256[12] memory eventsToRemove,
            uint256[12] memory artifactsToAdd
        )
    {
        DarkForestTypes.Planet memory planet = s().planets[location];
        DarkForestTypes.PlanetExtendedInfo memory planetExtendedInfo =
            s().planetsExtendedInfo[location];
        DarkForestTypes.PlanetEventMetadata[] memory events = s().planetEvents[location];

        (planet, planetExtendedInfo, eventsToRemove, artifactsToAdd) = DarkForestLazyUpdate
            .applyPendingEvents(timestamp, planet, planetExtendedInfo, events);

        (planet, planetExtendedInfo) = DarkForestLazyUpdate.updatePlanet(
            timestamp,
            planet,
            planetExtendedInfo
        );

        return (planet, planetExtendedInfo, eventsToRemove, artifactsToAdd);
    }

    function refreshPlanet(uint256 location) public {
        require(s().planetsExtendedInfo[location].isInitialized, "Planet has not been initialized");

        (
            DarkForestTypes.Planet memory planet,
            DarkForestTypes.PlanetExtendedInfo memory planetInfo,
            uint256[12] memory eventsToRemove,
            uint256[12] memory artifactIdsToAddToPlanet
        ) = getRefreshedPlanet(location, block.timestamp);

        s().planets[location] = planet;
        s().planetsExtendedInfo[location] = planetInfo;

        DarkForestTypes.PlanetEventMetadata[] storage events = s().planetEvents[location];

        for (uint256 toRemoveIdx = 0; toRemoveIdx < 12; toRemoveIdx++) {
            for (uint256 i = 0; i < events.length; i++) {
                if (events[i].id == eventsToRemove[toRemoveIdx]) {
                    events[i] = events[events.length - 1];
                    events.pop();
                }
            }
        }

        for (uint256 i = 0; i < 12; i++) {
            if (artifactIdsToAddToPlanet[i] != 0) {
                s().artifactIdToVoyageId[artifactIdsToAddToPlanet[i]] = 0;
                DarkForestUtils._putArtifactOnPlanet(artifactIdsToAddToPlanet[i], location);
            }
        }
    }

    function withdrawSilver(uint256 locationId, uint256 silverToWithdraw) public {
        DarkForestTypes.Planet storage planet = s().planets[locationId];
        DarkForestTypes.PlanetExtendedInfo storage info = s().planetsExtendedInfo[locationId];
        require(planet.owner == msg.sender, "you must own this planet");
        require(
            planet.planetType == DarkForestTypes.PlanetType.TRADING_POST,
            "can only withdraw silver from trading posts"
        );
        require(!info.destroyed, "planet is destroyed");
        require(
            planet.silver >= silverToWithdraw,
            "tried to withdraw more silver than exists on planet"
        );

        planet.silver -= silverToWithdraw;

        // Energy and Silver are not stored as floats in the smart contracts,
        // so any of those values coming from the contracts need to be divided by
        // `CONTRACT_PRECISION` to get their true integer value.
        s().players[msg.sender].score += silverToWithdraw / 1000;
    }
}
