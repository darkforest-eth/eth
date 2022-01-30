// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./Verifier.sol";
import "./DarkForestStorageV1.sol";
import "./DarkForestTokens.sol";
import "./DarkForestUtils.sol";
import "./DarkForestPlanet.sol";
import "./DarkForestInitialize.sol";
import "./DarkForestArtifactUtils.sol";

// .______       _______     ___       _______  .___  ___.  _______
// |   _  \     |   ____|   /   \     |       \ |   \/   | |   ____|
// |  |_)  |    |  |__     /  ^  \    |  .--.  ||  \  /  | |  |__
// |      /     |   __|   /  /_\  \   |  |  |  ||  |\/|  | |   __|
// |  |\  \----.|  |____ /  _____  \  |  '--'  ||  |  |  | |  |____
// | _| `._____||_______/__/     \__\ |_______/ |__|  |__| |_______|
//
// READ THIS FIRST BEFORE EDITING ANYTHING IN THIS FILE:
// https://docs.openzeppelin.com/learn/upgrading-smart-contracts#limitations-of-contract-upgrades
//
// DO NOT ADD ANY STORAGE VARIABLES IN THIS FILE
// IT SHOULD BELONG AT STORAGE CONTRACTS
// ADDING STORAGE VARIABLES HERE WI LL BLOCK ANY STORAGE CONTRACTS FROM EVER
// ADDING THEIR OWN VARIABLES EVER AGAIN.

contract DarkForestCore is Initializable, DarkForestStorageV1 {
    using ABDKMath64x64 for *;

    event PlayerInitialized(address player, uint256 loc);
    event ArrivalQueued(
        address player,
        uint256 arrivalId,
        uint256 from,
        uint256 to,
        uint256 artifactId
    );
    event PlanetUpgraded(address player, uint256 loc, uint256 branch, uint256 toBranchLevel); // emitted in DFPlanet library
    event PlanetHatBought(address player, uint256 loc, uint256 tohatLevel);
    event PlanetTransferred(address sender, uint256 loc, address receiver);
    event LocationRevealed(address revealer, uint256 loc, uint256 x, uint256 y);

    event PlanetProspected(address player, uint256 loc);
    event ArtifactFound(address player, uint256 artifactId, uint256 loc);
    event ArtifactDeposited(address player, uint256 artifactId, uint256 loc);
    event ArtifactWithdrawn(address player, uint256 artifactId, uint256 loc);
    event ArtifactActivated(address player, uint256 artifactId, uint256 loc); // emitted in DFPlanet library
    event ArtifactDeactivated(address player, uint256 artifactId, uint256 loc); // emitted in DFPlanet library

    event PlanetSilverWithdrawn(address player, uint256 loc, uint256 amount);

    // initialization functions are only called once during deployment. They are not called during upgrades.

    function initialize(
        address payable _tokensAddress,
        DarkForestTypes.DFInitArgs memory initArgs
    ) public initializer {
        s.tokens = DarkForestTokens(_tokensAddress);

        s.planetLevelsCount = 10;
        s.planetLevelThresholds = [
            16777216,
            4194292,
            1048561,
            262128,
            65520,
            16368,
            4080,
            1008,
            240,
            48
        ];
        s.paused = false;

        s.snarkConstants = DarkForestTypes.SnarkConstants({
            PLANETHASH_KEY: initArgs.PLANETHASH_KEY,
            SPACETYPE_KEY: initArgs.SPACETYPE_KEY,
            BIOMEBASE_KEY: initArgs.BIOMEBASE_KEY,
            PERLIN_MIRROR_X: initArgs.PERLIN_MIRROR_X,
            PERLIN_MIRROR_Y: initArgs.PERLIN_MIRROR_Y,
            PERLIN_LENGTH_SCALE: initArgs.PERLIN_LENGTH_SCALE
        });
        s.gameConstants = DarkForestTypes.GameConstants({
            MAX_NATURAL_PLANET_LEVEL: initArgs.MAX_NATURAL_PLANET_LEVEL,
            TIME_FACTOR_HUNDREDTHS: initArgs.TIME_FACTOR_HUNDREDTHS,
            PERLIN_THRESHOLD_1: initArgs.PERLIN_THRESHOLD_1,
            PERLIN_THRESHOLD_2: initArgs.PERLIN_THRESHOLD_2,
            PERLIN_THRESHOLD_3: initArgs.PERLIN_THRESHOLD_3,
            INIT_PERLIN_MIN: initArgs.INIT_PERLIN_MIN,
            INIT_PERLIN_MAX: initArgs.INIT_PERLIN_MAX,
            SPAWN_RIM_AREA: initArgs.SPAWN_RIM_AREA,
            BIOME_THRESHOLD_1: initArgs.BIOME_THRESHOLD_1,
            BIOME_THRESHOLD_2: initArgs.BIOME_THRESHOLD_2,
            PLANET_RARITY: initArgs.PLANET_RARITY,
            PHOTOID_ACTIVATION_DELAY: initArgs.PHOTOID_ACTIVATION_DELAY,
            LOCATION_REVEAL_COOLDOWN: initArgs.LOCATION_REVEAL_COOLDOWN,
            PLANET_TYPE_WEIGHTS: initArgs.PLANET_TYPE_WEIGHTS,
            ARTIFACT_POINT_VALUES: initArgs.ARTIFACT_POINT_VALUES
        });

        s.worldRadius = initArgs.INITIAL_WORLD_RADIUS; // will be overridden by TARGET4_RADIUS if !WORLD_RADIUS_LOCKED
        s.WORLD_RADIUS_LOCKED = initArgs.WORLD_RADIUS_LOCKED;
        s.TARGET4_RADIUS = initArgs.TARGET4_RADIUS;

        DarkForestInitialize.initializeDefaults();
        DarkForestInitialize.initializeUpgrades();

        s.initializedPlanetCountByLevel = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (uint256 i = 0; i < s.planetLevelThresholds.length; i += 1) {
            s.cumulativeRarities.push(
                (2**24 / s.planetLevelThresholds[i]) * initArgs.PLANET_RARITY
            );
        }

        _updateWorldRadius();
    }

    //////////////
    /// Helper ///
    //////////////

    // Private helpers that modify state
    function _updateWorldRadius() private {
        if (!s.WORLD_RADIUS_LOCKED) {
            s.worldRadius = DarkForestUtils._getRadius();
        }
    }

    function initializePlanet(
        uint256 location,
        uint256 perlin,
        bool isHomePlanet
    ) private {
        DarkForestPlanet.initializePlanetWithDefaults(location, perlin, isHomePlanet);
    }

    //////////////////////
    /// Game Mechanics ///
    //////////////////////

    function refreshPlanet(uint256 location) public {
        DarkForestPlanet.refreshPlanet(location);
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
        return DarkForestPlanet.getRefreshedPlanet(location, timestamp);
    }

    function checkRevealProof(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[9] memory _input
    ) public view returns (bool) {
        require(Verifier.verifyRevealProof(_a, _b, _c, _input), "Failed reveal pf check");

        DarkForestUtils.revertIfBadSnarkPerlinFlags(
            [_input[4], _input[5], _input[6], _input[7], _input[8]],
            false
        );

        return true;
    }

    function revealLocation(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[9] memory _input
    ) public returns (uint256) {
        require(checkRevealProof(_a, _b, _c, _input), "Failed reveal pf check");

        if (!s.planetsExtendedInfo[_input[0]].isInitialized) {
            initializePlanet(_input[0], _input[1], false);
        }

        DarkForestPlanet.revealLocation(
            _input[0],
            _input[1],
            _input[2],
            _input[3],
        );
        emit LocationRevealed(msg.sender, _input[0], _input[2], _input[3]);
    }

    function initializePlayer(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[8] memory _input
    ) public returns (uint256) {
        require(Verifier.verifyInitProof(_a, _b, _c, _input), "Failed init proof check");

        uint256 _location = _input[0];
        uint256 _perlin = _input[1];
        uint256 _radius = _input[2];

        DarkForestUtils.revertIfBadSnarkPerlinFlags(
            [_input[3], _input[4], _input[5], _input[6], _input[7]],
            false
        );

        require(DarkForestPlanet.checkPlayerInit(_location, _perlin, _radius));
        // Initialize player data
        s.playerIds.push(msg.sender);
        s.players[msg.sender] = DarkForestTypes.Player(
            true,
            msg.sender,
            block.timestamp,
            _location,
            0,
            0
        );

        // Initialize planet information
        initializePlanet(_location, _perlin, true);
        _updateWorldRadius();
        emit PlayerInitialized(msg.sender, _location);
        return _location;
    }

    function move(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[13] memory _input
    ) public returns (uint256) {
        DarkForestUtils.revertIfBadSnarkPerlinFlags(
            [_input[5], _input[6], _input[7], _input[8], _input[9]],
            false
        );

        uint256 oldLoc = _input[0];
        uint256 newLoc = _input[1];
        uint256 newPerlin = _input[2];
        uint256 newRadius = _input[3];
        uint256 maxDist = _input[4];
        uint256 popMoved = _input[10];
        uint256 silverMoved = _input[11];
        uint256 movedArtifactId = _input[12];

        uint256[10] memory _proofInput =
            [
                oldLoc,
                newLoc,
                newPerlin,
                newRadius,
                maxDist,
                _input[5],
                _input[6],
                _input[7],
                _input[8],
                _input[9]
            ];
        require(Verifier.verifyMoveProof(_a, _b, _c, _proofInput), "Failed move proof check");

        // check radius
        require(newRadius <= s.worldRadius, "Attempting to move out of bounds");

        // Only perform if the toPlanet have never initialized previously
        if (!s.planetsExtendedInfo[newLoc].isInitialized) {
            initializePlanet(newLoc, newPerlin, false);
        } else {
            // need to do this so people can't deny service to planets with gas limit
            refreshPlanet(newLoc);
            DarkForestUtils.checkPlanetDOS(newLoc);
        }

        // Refresh fromPlanet first before doing any action on it
        refreshPlanet(oldLoc);

        s.planetEventsCount++;

        DarkForestPlanet.move(
            DarkForestTypes.DFPMoveArgs(
                oldLoc,
                newLoc,
                maxDist,
                popMoved,
                silverMoved,
                movedArtifactId
            )
        );

        _updateWorldRadius();
        emit ArrivalQueued(msg.sender, s.planetEventsCount, oldLoc, newLoc, movedArtifactId);
        return (s.planetEventsCount);
    }

    function upgradePlanet(uint256 _location, uint256 _branch)
        public
        notPaused
        returns (uint256, uint256)
    {
        // _branch specifies which of the three upgrade branches player is leveling up
        // 0 improves silver production and capacity
        // 1 improves population
        // 2 improves range
        refreshPlanet(_location);
        DarkForestPlanet.upgradePlanet(_location, _branch);
        return (_location, _branch);
    }

    function transferOwnership(uint256 _location, address _player) public {
        require(
            s.planetsExtendedInfo[_location].isInitialized == true,
            "Planet is not initialized"
        );

        refreshPlanet(_location);

        require(s.planets[_location].owner == msg.sender, "Only owner can transfer planet");

        require(_player != msg.sender, "Cannot transfer planet to self");

        require(
            s.players[_player].isInitialized,
            "Can only transfer ownership to initialized players"
        );

        require(!s.planetsExtendedInfo[_location].destroyed, "can't transfer a destroyed planet");

        s.planets[_location].owner = _player;

        emit PlanetTransferred(msg.sender, _location, _player);
    }

    function buyHat(uint256 _location) public payable {
        require(
            s.planetsExtendedInfo[_location].isInitialized == true,
            "Planet is not initialized"
        );
        refreshPlanet(_location);

        require(s.planets[_location].owner == msg.sender, "Only owner can buy hat for planet");

        uint256 cost = (1 << s.planetsExtendedInfo[_location].hatLevel) * 1 ether;

        require(msg.value == cost, "Wrong value sent");

        s.planetsExtendedInfo[_location].hatLevel += 1;
        emit PlanetHatBought(msg.sender, _location, s.planetsExtendedInfo[_location].hatLevel);
    }

    function findArtifact(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[7] memory _input
    ) public notTokenEnded {
        uint256 planetId = _input[0];
        uint256 biomebase = _input[1];

        DarkForestUtils.revertIfBadSnarkPerlinFlags(
            [_input[2], _input[3], _input[4], _input[5], _input[6]],
            true
        );

        refreshPlanet(planetId);

        require(
            Verifier.verifyBiomebaseProof(_a, _b, _c, _input),
            "biome zkSNARK failed doesn't check out"
        );

        uint256 foundArtifactId =
            DarkForestArtifactUtils.findArtifact(
                DarkForestTypes.DFPFindArtifactArgs(planetId, biomebase, address(this))
            );

        emit ArtifactFound(msg.sender, foundArtifactId, planetId);
    }

    function depositArtifact(uint256 locationId, uint256 artifactId) public {
        // should this be implemented as logic that is triggered when a player sends
        // an artifact to the contract with locationId in the extra data?
        // might be better use of the ERC721 standard - can use safeTransfer then
        refreshPlanet(locationId);

        DarkForestArtifactUtils.depositArtifact(locationId, artifactId, address(this));

        emit ArtifactDeposited(msg.sender, artifactId, locationId);
    }

    // withdraws the given artifact from the given planet. you must own the planet,
    // the artifact must be on the given planet
    function withdrawArtifact(uint256 locationId, uint256 artifactId) public {
        refreshPlanet(locationId);

        DarkForestArtifactUtils.withdrawArtifact(locationId, artifactId);

        emit ArtifactWithdrawn(msg.sender, artifactId, locationId);
    }

    // activates the given artifact on the given planet. the artifact must have
    // been previously deposited on this planet. the artifact cannot be activated
    // within a certain cooldown period, depending on the artifact type
    function activateArtifact(
        uint256 locationId,
        uint256 artifactId,
        uint256 wormholeTo
    ) public {
        refreshPlanet(locationId);

        if (wormholeTo != 0) {
            refreshPlanet(wormholeTo);
        }

        DarkForestArtifactUtils.activateArtifact(locationId, artifactId, wormholeTo);
        // event is emitted in the above library function
    }

    // if there's an activated artifact on this planet, deactivates it. otherwise reverts.
    // deactivating an artifact this debuffs the planet, and also removes whatever special
    // effect that the artifact bestowned upon this planet.
    function deactivateArtifact(uint256 locationId) public {
        refreshPlanet(locationId);

        DarkForestArtifactUtils.deactivateArtifact(locationId);
        // event is emitted in the above library function
    }

    // in order to be able to find an artifact on a planet, the planet
    // must first be 'prospected'. prospecting commits to a currently-unknown
    // seed that is used to randomly generate the artifact that will be
    // found on this planet.
    function prospectPlanet(uint256 locationId) public {
        refreshPlanet(locationId);
        DarkForestArtifactUtils.prospectPlanet(locationId);
        emit PlanetProspected(msg.sender, locationId);
    }

    // withdraw silver
    function withdrawSilver(uint256 locationId, uint256 amount) public {
        refreshPlanet(locationId);
        DarkForestPlanet.withdrawSilver(locationId, amount);
        emit PlanetSilverWithdrawn(msg.sender, locationId, amount);
    }
}
