// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// Library imports
import {LibGameUtils} from "./LibGameUtils.sol";
import {LibLazyUpdate} from "./LibLazyUpdate.sol";
import {Verifier} from "../Verifier.sol";

// Storage imports
import {LibStorage, GameStorage, GameConstants, SnarkConstants} from "./LibStorage.sol";

// Type imports
import {
    Artifact,
    ArtifactType,
    DFPInitPlanetArgs,
    Planet,
    PlanetEventMetadata,
    PlanetExtendedInfo,
    PlanetExtendedInfo2,
    PlanetType,
    RevealedCoords,
    SpaceType,
    Upgrade,
    UpgradeBranch
} from "../DFTypes.sol";

library LibPlanet {
    function gs() internal pure returns (GameStorage storage) {
        return LibStorage.gameStorage();
    }

    function snarkConstants() internal pure returns (SnarkConstants storage sc) {
        return LibStorage.snarkConstants();
    }

    function gameConstants() internal pure returns (GameConstants storage) {
        return LibStorage.gameConstants();
    }

    // also need to copy some of DFCore's event signatures
    event ArtifactActivated(address player, uint256 artifactId, uint256 loc);
    event ArtifactDeactivated(address player, uint256 artifactId, uint256 loc);
    event PlanetUpgraded(address player, uint256 loc, uint256 branch, uint256 toBranchLevel);

    function revealLocation(
        uint256 location,
        uint256 perlin,
        uint256 x,
        uint256 y,
        bool checkTimestamp
    ) public {
        if (checkTimestamp) {
            require(
                block.timestamp - gs().players[msg.sender].lastRevealTimestamp >
                    gameConstants().LOCATION_REVEAL_COOLDOWN,
                "wait for cooldown before revealing again"
            );
        }
        require(gs().revealedCoords[location].locationId == 0, "Location already revealed");
        gs().revealedPlanetIds.push(location);
        gs().revealedCoords[location] = RevealedCoords({
            locationId: location,
            x: x,
            y: y,
            revealer: msg.sender
        });
        gs().players[msg.sender].lastRevealTimestamp = block.timestamp;
    }

    function getDefaultInitPlanetArgs(
        uint256 _location,
        uint256 _perlin,
        bool _isHomePlanet
    ) public view returns (DFPInitPlanetArgs memory) {
        (uint256 level, PlanetType planetType, SpaceType spaceType) =
            LibGameUtils._getPlanetLevelTypeAndSpaceType(_location, _perlin);

        if (_isHomePlanet) {
            require(level == 0, "Can only initialize on planet level 0");
            require(planetType == PlanetType.PLANET, "Can only initialize on regular planets");
        }

        return
            DFPInitPlanetArgs(
                _location,
                _perlin,
                level,
                gameConstants().TIME_FACTOR_HUNDREDTHS,
                spaceType,
                planetType,
                _isHomePlanet
            );
    }

    /**
     * Same SNARK args as `initializePlayer`. Adds a planet to the smart contract without setting an owner.
     */
    function initializePlanet(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[8] memory _input,
        bool isHomePlanet
    ) public {
        if (!snarkConstants().DISABLE_ZK_CHECKS) {
            require(Verifier.verifyInitProof(_a, _b, _c, _input), "Failed init proof check");
        }

        uint256 _location = _input[0];
        uint256 _perlin = _input[1];

        LibGameUtils.revertIfBadSnarkPerlinFlags(
            [_input[3], _input[4], _input[5], _input[6], _input[7]],
            false
        );

        // Initialize planet information
        initializePlanetWithDefaults(_location, _perlin, isHomePlanet);
    }

    function initializePlanetWithDefaults(
        uint256 _location,
        uint256 _perlin,
        bool _isHomePlanet
    ) public {
        require(LibGameUtils._locationIdValid(_location), "Not a valid planet location");

        DFPInitPlanetArgs memory initArgs =
            getDefaultInitPlanetArgs(_location, _perlin, _isHomePlanet);

        _initializePlanet(initArgs);
        gs().planetIds.push(_location);
        gs().initializedPlanetCountByLevel[initArgs.level] += 1;
    }

    function _initializePlanet(DFPInitPlanetArgs memory args) public {
        Planet storage _planet = gs().planets[args.location];
        PlanetExtendedInfo storage _planetExtendedInfo = gs().planetsExtendedInfo[args.location];
        PlanetExtendedInfo2 storage _planetExtendedInfo2 = gs().planetsExtendedInfo2[args.location];
        // can't initialize a planet twice
        require(!_planetExtendedInfo.isInitialized, "Planet is already initialized");

        // planet initialize should set the planet to default state, including having the owner be adress 0x0
        // then it's the responsibility for the mechanics to set the owner to the player

        Planet memory defaultPlanet =
            LibGameUtils._defaultPlanet(
                args.location,
                args.level,
                args.planetType,
                args.spaceType,
                args.TIME_FACTOR_HUNDREDTHS
            );
        _planet.owner = defaultPlanet.owner;
        _planet.isHomePlanet = defaultPlanet.isHomePlanet;
        _planet.range = defaultPlanet.range;
        _planet.speed = defaultPlanet.speed;
        _planet.defense = defaultPlanet.defense;
        _planet.population = defaultPlanet.population;
        _planet.populationCap = defaultPlanet.populationCap;
        _planet.populationGrowth = defaultPlanet.populationGrowth;
        _planet.silverCap = defaultPlanet.silverCap;
        _planet.silverGrowth = defaultPlanet.silverGrowth;
        _planet.silver = defaultPlanet.silver;
        _planet.planetLevel = defaultPlanet.planetLevel;
        _planet.planetType = defaultPlanet.planetType;

        _planetExtendedInfo.isInitialized = true;
        _planetExtendedInfo.perlin = args.perlin;
        _planetExtendedInfo.spaceType = args.spaceType;
        _planetExtendedInfo.createdAt = block.timestamp;
        _planetExtendedInfo.lastUpdated = block.timestamp;
        _planetExtendedInfo.upgradeState0 = 0;
        _planetExtendedInfo.upgradeState1 = 0;
        _planetExtendedInfo.upgradeState2 = 0;

        _planetExtendedInfo2.isInitialized = true;
        _planetExtendedInfo2.pausers = 0;

        if (args.isHomePlanet) {
            _planet.isHomePlanet = true;
            _planet.owner = msg.sender;
            _planet.population = 50000;
        } else {
            _planetExtendedInfo.spaceJunk = LibGameUtils.getPlanetDefaultSpaceJunk(_planet);

            if (LibGameUtils.isHalfSpaceJunk(args.location)) {
                _planetExtendedInfo.spaceJunk /= 2;
            }
        }
    }

    function upgradePlanet(uint256 _location, uint256 _branch) public {
        Planet storage planet = gs().planets[_location];
        PlanetExtendedInfo storage info = gs().planetsExtendedInfo[_location];
        require(
            planet.owner == msg.sender,
            "Only owner account can perform that operation on planet."
        );
        uint256 planetLevel = planet.planetLevel;
        require(planetLevel > 0, "Planet level is not high enough for this upgrade");
        require(_branch < 3, "Upgrade branch not valid");
        require(planet.planetType == PlanetType.PLANET, "Can only upgrade regular planets");
        require(!info.destroyed, "planet is destroyed");

        uint256 totalLevel = info.upgradeState0 + info.upgradeState1 + info.upgradeState2;
        require(
            (info.spaceType == SpaceType.NEBULA && totalLevel < 3) ||
                (info.spaceType == SpaceType.SPACE && totalLevel < 4) ||
                (info.spaceType == SpaceType.DEEP_SPACE && totalLevel < 5) ||
                (info.spaceType == SpaceType.DEAD_SPACE && totalLevel < 5),
            "Planet at max total level"
        );

        uint256 upgradeBranchCurrentLevel;
        if (_branch == uint256(UpgradeBranch.DEFENSE)) {
            upgradeBranchCurrentLevel = info.upgradeState0;
        } else if (_branch == uint256(UpgradeBranch.RANGE)) {
            upgradeBranchCurrentLevel = info.upgradeState1;
        } else if (_branch == uint256(UpgradeBranch.SPEED)) {
            upgradeBranchCurrentLevel = info.upgradeState2;
        }
        require(upgradeBranchCurrentLevel < 4, "Upgrade branch already maxed");

        Upgrade memory upgrade = LibStorage.upgrades()[_branch][upgradeBranchCurrentLevel];
        uint256 upgradeCost = (planet.silverCap * 20 * (totalLevel + 1)) / 100;
        require(planet.silver >= upgradeCost, "Insufficient silver to upgrade");

        // do upgrade
        LibGameUtils._buffPlanet(_location, upgrade);
        planet.silver -= upgradeCost;
        if (_branch == uint256(UpgradeBranch.DEFENSE)) {
            info.upgradeState0 += 1;
        } else if (_branch == uint256(UpgradeBranch.RANGE)) {
            info.upgradeState1 += 1;
        } else if (_branch == uint256(UpgradeBranch.SPEED)) {
            info.upgradeState2 += 1;
        }
        emit PlanetUpgraded(msg.sender, _location, _branch, upgradeBranchCurrentLevel + 1);
    }

    function checkPlayerInit(
        uint256 _location,
        uint256 _perlin,
        uint256 _radius
    ) public view returns (bool) {
        require(!gs().players[msg.sender].isInitialized, "Player is already initialized");
        require(_radius <= gs().worldRadius, "Init radius is bigger than the current world radius");

        if (gameConstants().SPAWN_RIM_AREA != 0) {
            require(
                (_radius**2 * 314) / 100 + gameConstants().SPAWN_RIM_AREA >=
                    (gs().worldRadius**2 * 314) / 100,
                "Player can only spawn at the universe rim"
            );
        }

        require(
            _perlin >= gameConstants().INIT_PERLIN_MIN,
            "Init not allowed in perlin value less than INIT_PERLIN_MIN"
        );
        require(
            _perlin < gameConstants().INIT_PERLIN_MAX,
            "Init not allowed in perlin value greater than or equal to the INIT_PERLIN_MAX"
        );
        return true;
    }

    function getRefreshedPlanet(uint256 location, uint256 timestamp)
        public
        view
        returns (
            Planet memory,
            PlanetExtendedInfo memory,
            PlanetExtendedInfo2 memory,
            uint256[12] memory eventsToRemove,
            uint256[12] memory artifactsToAdd
        )
    {
        Planet memory planet = gs().planets[location];
        PlanetExtendedInfo memory planetExtendedInfo = gs().planetsExtendedInfo[location];
        PlanetExtendedInfo2 memory planetExtendedInfo2 = gs().planetsExtendedInfo2[location];

        // first 12 are event ids to remove
        // last 12 are artifact ids that are new on the planet
        uint256[24] memory updates;

        PlanetEventMetadata[] memory events = gs().planetEvents[location];

        (planet, planetExtendedInfo, planetExtendedInfo2, updates) = LibLazyUpdate
            .applyPendingEvents(timestamp, planet, planetExtendedInfo, planetExtendedInfo2, events);

        for (uint256 i = 0; i < 12; i++) {
            eventsToRemove[i] = updates[i];
            artifactsToAdd[i] = updates[i + 12];
        }

        for (uint256 i = 0; i < artifactsToAdd.length; i++) {
            Artifact memory artifact = gs().artifacts[artifactsToAdd[i]];

            (planet, planetExtendedInfo, planetExtendedInfo2) = applySpaceshipArrive(
                artifact,
                planet,
                planetExtendedInfo,
                planetExtendedInfo2
            );
        }

        (planet, planetExtendedInfo, planetExtendedInfo2) = LibLazyUpdate.updatePlanet(
            timestamp,
            planet,
            planetExtendedInfo,
            planetExtendedInfo2
        );

        return (planet, planetExtendedInfo, planetExtendedInfo2, eventsToRemove, artifactsToAdd);
    }

    function applySpaceshipArrive(
        Artifact memory artifact,
        Planet memory planet,
        PlanetExtendedInfo memory planetExtendedInfo,
        PlanetExtendedInfo2 memory planetExtendedInfo2
    )
        public
        pure
        returns (
            Planet memory,
            PlanetExtendedInfo memory,
            PlanetExtendedInfo2 memory
        )
    {
        if (planet.isHomePlanet) {
            return (planet, planetExtendedInfo, planetExtendedInfo2);
        }

        if (artifact.artifactType == ArtifactType.ShipMothership) {
            planet.populationGrowth *= 2;
        } else if (artifact.artifactType == ArtifactType.ShipWhale) {
            planet.silverGrowth *= 2;
        } else if (artifact.artifactType == ArtifactType.ShipTitan) {
            planetExtendedInfo2.pausers++;
        }

        return (planet, planetExtendedInfo, planetExtendedInfo2);
    }

    function refreshPlanet(uint256 location) public {
        require(
            gs().planetsExtendedInfo[location].isInitialized,
            "Planet has not been initialized"
        );

        (
            Planet memory planet,
            PlanetExtendedInfo memory planetInfo,
            PlanetExtendedInfo2 memory planetInfo2,
            uint256[12] memory eventsToRemove,
            uint256[12] memory artifactIdsToAddToPlanet
        ) = getRefreshedPlanet(location, block.timestamp);

        gs().planets[location] = planet;
        gs().planetsExtendedInfo[location] = planetInfo;
        gs().planetsExtendedInfo2[location] = planetInfo2;

        PlanetEventMetadata[] storage events = gs().planetEvents[location];

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
                gs().artifactIdToVoyageId[artifactIdsToAddToPlanet[i]] = 0;
                LibGameUtils._putArtifactOnPlanet(artifactIdsToAddToPlanet[i], location);
            }
        }
    }

    function withdrawSilver(uint256 locationId, uint256 silverToWithdraw) public {
        Planet storage planet = gs().planets[locationId];
        PlanetExtendedInfo storage info = gs().planetsExtendedInfo[locationId];
        require(planet.owner == msg.sender, "you must own this planet");
        require(
            planet.planetType == PlanetType.TRADING_POST,
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
        uint256 scoreGained = silverToWithdraw / 1000;
        scoreGained = (scoreGained * gameConstants().SILVER_SCORE_VALUE) / 100;
        gs().players[msg.sender].score += scoreGained;
    }
}
