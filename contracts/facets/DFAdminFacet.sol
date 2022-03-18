// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// Library imports
import {LibDiamond} from "../vendor/libraries/LibDiamond.sol";
import {LibGameUtils} from "../libraries/LibGameUtils.sol";
import {LibPlanet} from "../libraries/LibPlanet.sol";
import {LibArtifactUtils} from "../libraries/LibArtifactUtils.sol";

// Storage imports
import {WithStorage} from "../libraries/LibStorage.sol";

// Type imports
import {
    SpaceType,
    DFPInitPlanetArgs,
    AdminCreatePlanetArgs,
    Artifact,
    ArtifactType,
    Player,
    Planet,
    PlanetExtendedInfo,
    PlanetExtendedInfo2
} from "../DFTypes.sol";

contract DFAdminFacet is WithStorage {
    event AdminOwnershipChanged(uint256 loc, address newOwner);
    event AdminPlanetCreated(uint256 loc);
    event AdminGiveSpaceship(uint256 loc, address owner, ArtifactType artifactType);
    event PauseStateChanged(bool paused);

    /////////////////////////////
    /// Administrative Engine ///
    /////////////////////////////

    modifier onlyAdmin() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    function pause() public onlyAdmin {
        require(!gs().paused, "Game is already paused");
        gs().paused = true;
        emit PauseStateChanged(true);
    }

    function unpause() public onlyAdmin {
        require(gs().paused, "Game is already unpaused");
        gs().paused = false;
        emit PauseStateChanged(false);
    }

    /**
     * Only works for initialized planets.
     */
    function setOwner(uint256 planetId, address newOwner) public onlyAdmin {
        gs().planets[planetId].owner = newOwner;
        emit AdminOwnershipChanged(planetId, newOwner);
    }

    function deductScore(address playerAddress, uint256 amount) public onlyAdmin {
        Player storage player = gs().players[playerAddress];

        require(player.isInitialized, "player does not exist");
        require(amount <= player.score, "tried to deduct much score");

        player.score -= amount;
    }

    function addScore(address playerAddress, uint256 amount) public onlyAdmin {
        Player storage player = gs().players[playerAddress];

        require(player.isInitialized, "player does not exist");

        player.score += amount;
    }

    /**
     * Sets the owner of the given planet, even if it's not initialized (which is why
     * it requires the same snark arguments as DFCoreFacet#initializePlanet).
     */
    function safeSetOwner(
        address newOwner,
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[8] memory _input
    ) public onlyAdmin {
        uint256 planetId = _input[0];

        if (!gs().planetsExtendedInfo[planetId].isInitialized) {
            LibPlanet.initializePlanet(_a, _b, _c, _input, false);
        }

        gs().planets[planetId].silver = gs().planets[planetId].silverCap;
        gs().planets[planetId].population = gs().planets[planetId].populationCap;

        setOwner(planetId, newOwner);
    }

    function changeWorldRadiusMin(uint256 _newConstant) public onlyAdmin {
        gameConstants().WORLD_RADIUS_MIN = _newConstant;
        LibGameUtils.updateWorldRadius();
    }

    function adminSetWorldRadius(uint256 _newRadius) public onlyAdmin {
        gs().worldRadius = _newRadius;
    }

    function changeLocationRevealCooldown(uint256 newCooldown) public onlyAdmin {
        gameConstants().LOCATION_REVEAL_COOLDOWN = newCooldown;
    }

    function withdraw() public onlyAdmin {
        // TODO: Don't send to msg.sender, instead send to contract admin
        payable(msg.sender).transfer(address(this).balance);
    }

    function setTokenMintEndTime(uint256 newTokenMintEndTime) public onlyAdmin {
        gs().TOKEN_MINT_END_TIMESTAMP = newTokenMintEndTime;
    }

    function createPlanet(AdminCreatePlanetArgs memory args) public onlyAdmin {
        require(gameConstants().ADMIN_CAN_ADD_PLANETS, "admin can no longer add planets");
        if (args.requireValidLocationId) {
            require(LibGameUtils._locationIdValid(args.location), "Not a valid planet location");
        }
        SpaceType spaceType = LibGameUtils.spaceTypeFromPerlin(args.perlin);
        LibPlanet._initializePlanet(
            DFPInitPlanetArgs(
                args.location,
                args.perlin,
                args.level,
                gameConstants().TIME_FACTOR_HUNDREDTHS,
                spaceType,
                args.planetType,
                false
            )
        );
        gs().planetIds.push(args.location);
        gs().initializedPlanetCountByLevel[args.level] += 1;

        emit AdminPlanetCreated(args.location);
    }

    function adminGiveSpaceShip(
        uint256 locationId,
        address owner,
        ArtifactType artifactType
    ) public onlyAdmin {
        require(gs().planetsExtendedInfo2[locationId].isInitialized, "planet is not initialized");
        require(LibArtifactUtils.isSpaceship(artifactType), "artifact type must be a space ship");

        uint256 shipId = LibArtifactUtils.createAndPlaceSpaceship(locationId, owner, artifactType);
        Artifact memory artifact = gs().artifacts[shipId];
        Planet memory planet = gs().planets[locationId];
        PlanetExtendedInfo memory planetExtendedInfo = gs().planetsExtendedInfo[locationId];
        PlanetExtendedInfo2 memory planetExtendedInfo2 = gs().planetsExtendedInfo2[locationId];

        (planet, planetExtendedInfo, planetExtendedInfo2) = LibPlanet.applySpaceshipArrive(
            artifact,
            planet,
            planetExtendedInfo,
            planetExtendedInfo2
        );

        gs().planets[locationId] = planet;
        gs().planetsExtendedInfo[locationId] = planetExtendedInfo;
        gs().planetsExtendedInfo2[locationId] = planetExtendedInfo2;

        emit AdminGiveSpaceship(locationId, owner, artifactType);
    }

    function adminInitializePlanet(uint256 locationId, uint256 perlin) public onlyAdmin {
        require(
            !gs().planetsExtendedInfo2[locationId].isInitialized,
            "planet is already initialized"
        );

        LibPlanet.initializePlanetWithDefaults(locationId, perlin, false);
    }

    function setPlanetTransferEnabled(bool enabled) public onlyAdmin {
        gameConstants().PLANET_TRANSFER_ENABLED = enabled;
    }
}
