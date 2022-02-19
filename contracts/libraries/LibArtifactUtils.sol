// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// External contract imports
import {DFArtifactFacet} from "../facets/DFArtifactFacet.sol";

// Library imports
import {LibGameUtils} from "./LibGameUtils.sol";

// Storage imports
import {LibStorage, GameStorage, GameConstants} from "./LibStorage.sol";

// Type imports
import {
    Biome,
    Planet,
    PlanetExtendedInfo,
    PlanetType,
    Artifact,
    ArtifactType,
    ArtifactRarity,
    DFPFindArtifactArgs,
    DFTCreateArtifactArgs
} from "../DFTypes.sol";

library LibArtifactUtils {
    function gs() internal pure returns (GameStorage storage) {
        return LibStorage.gameStorage();
    }

    function gameConstants() internal pure returns (GameConstants storage) {
        return LibStorage.gameConstants();
    }

    // also need to copy some of DFCore's event signatures
    event ArtifactActivated(address player, uint256 artifactId, uint256 loc);
    event ArtifactDeactivated(address player, uint256 artifactId, uint256 loc);
    event PlanetUpgraded(address player, uint256 loc, uint256 branch, uint256 toBranchLevel);

    // verifies that user is allowed to call findArtifact on this planet
    function checkFindArtifact(
        uint256 locationId,
        PlanetExtendedInfo memory info,
        Planet memory planet
    ) public view returns (bool) {
        require(!info.hasTriedFindingArtifact, "artifact already minted from this planet");
        require(planet.owner == msg.sender, "you can only find artifacts on planets you own");
        require(info.prospectedBlockNumber != 0, "planet never prospected");
        require(
            info.prospectedBlockNumber < block.number,
            "can only call findArtifact after prospectedBlockNumber"
        );
        require(block.number > info.prospectedBlockNumber, "invalid prospectedBlockNumber");
        require(block.number - info.prospectedBlockNumber < 256, "planet prospect expired");
        require(!info.destroyed, "planet is destroyed");
        require(containsGear(locationId), "gear ship must be present on planet");
        return true;
    }

    /**
     * Create a new spaceship and place it on a planet owned by the given player. Returns the id
     * of the newly created spaceship.
     */
    function createAndPlaceSpaceship(
        uint256 planetId,
        address owner,
        ArtifactType shipType
    ) public returns (uint256) {
        require(shipType <= ArtifactType.ShipTitan && shipType >= ArtifactType.ShipMothership);

        uint256 id = uint256(keccak256(abi.encodePacked(planetId, gs().miscNonce++)));

        DFTCreateArtifactArgs memory createArtifactArgs =
            DFTCreateArtifactArgs(
                id,
                msg.sender,
                planetId,
                ArtifactRarity.Unknown,
                Biome.Unknown,
                shipType,
                address(this),
                owner
            );

        Artifact memory foundArtifact =
            DFArtifactFacet(address(this)).createArtifact(createArtifactArgs);
        LibGameUtils._putArtifactOnPlanet(foundArtifact.id, planetId);

        return id;
    }

    function findArtifact(DFPFindArtifactArgs memory args) public returns (uint256 artifactId) {
        Planet storage planet = gs().planets[args.planetId];
        PlanetExtendedInfo storage info = gs().planetsExtendedInfo[args.planetId];

        require(checkFindArtifact(args.planetId, info, planet));

        Biome biome = LibGameUtils._getBiome(info.spaceType, args.biomebase);

        uint256 artifactSeed =
            uint256(
                keccak256(
                    abi.encodePacked(
                        args.planetId,
                        args.coreAddress,
                        blockhash(info.prospectedBlockNumber)
                    )
                )
            );

        (ArtifactType artifactType, uint256 levelBonus) =
            LibGameUtils._randomArtifactTypeAndLevelBonus(artifactSeed, biome, info.spaceType);

        DFTCreateArtifactArgs memory createArtifactArgs =
            DFTCreateArtifactArgs(
                artifactSeed,
                msg.sender,
                args.planetId,
                LibGameUtils.artifactRarityFromPlanetLevel(levelBonus + planet.planetLevel),
                biome,
                artifactType,
                args.coreAddress,
                address(0)
            );

        Artifact memory foundArtifact =
            DFArtifactFacet(address(this)).createArtifact(createArtifactArgs);

        LibGameUtils._putArtifactOnPlanet(foundArtifact.id, args.planetId);

        info.hasTriedFindingArtifact = true;
        gs().players[msg.sender].score += gameConstants().ARTIFACT_POINT_VALUES[
            uint256(foundArtifact.rarity)
        ];

        artifactId = foundArtifact.id;
    }

    function activateArtifact(
        uint256 locationId,
        uint256 artifactId,
        uint256 wormholeTo
    ) public {
        Planet storage planet = gs().planets[locationId];
        Artifact storage artifact = gs().artifacts[artifactId];

        require(
            LibGameUtils.isArtifactOnPlanet(locationId, artifactId),
            "can't active an artifact on a planet it's not on"
        );

        if (isSpaceship(artifact.artifactType)) {
            activateSpaceshipArtifact(locationId, artifactId, planet, artifact);
        } else {
            activateNonSpaceshipArtifact(locationId, artifactId, wormholeTo, planet, artifact);
        }

        artifact.activations++;
    }

    function activateSpaceshipArtifact(
        uint256 locationId,
        uint256 artifactId,
        Planet storage planet,
        Artifact storage artifact
    ) private {
        PlanetExtendedInfo storage extendedInfo = gs().planetsExtendedInfo[locationId];

        if (artifact.artifactType == ArtifactType.ShipCrescent) {
            require(artifact.activations == 0, "crescent cannot be activated more than once");

            require(
                planet.planetType != PlanetType.SILVER_MINE,
                "cannot turn a silver mine into a silver mine"
            );

            require(planet.owner == address(0), "can only activate crescent on unowned planets");
            require(planet.planetLevel >= 1, "planet level must be more than one");

            artifact.lastActivated = block.timestamp;
            artifact.lastDeactivated = block.timestamp;

            if (planet.silver == 0) {
                planet.silver = 1;
                Planet memory defaultPlanet =
                    LibGameUtils._defaultPlanet(
                        locationId,
                        planet.planetLevel,
                        PlanetType.SILVER_MINE,
                        extendedInfo.spaceType,
                        gameConstants().TIME_FACTOR_HUNDREDTHS
                    );

                planet.silverGrowth = defaultPlanet.silverGrowth;
            }

            planet.planetType = PlanetType.SILVER_MINE;
            emit ArtifactActivated(msg.sender, artifactId, locationId);
        }
    }

    function activateNonSpaceshipArtifact(
        uint256 locationId,
        uint256 artifactId,
        uint256 wormholeTo,
        Planet storage planet,
        Artifact memory artifact
    ) private {
        PlanetExtendedInfo storage info = gs().planetsExtendedInfo[locationId];

        require(
            planet.owner == msg.sender,
            "you must own the planet you are activating an artifact on"
        );
        require(
            !LibGameUtils.getActiveArtifact(locationId).isInitialized,
            "there is already an active artifact on this planet"
        );
        require(!info.destroyed, "planet is destroyed");

        require(artifact.isInitialized, "this artifact is not on this planet");

        // Unknown is the 0th one, Monolith is the 1st, and so on.
        // TODO v0.6: consider photoid canon
        uint256[10] memory artifactCooldownsHours = [uint256(24), 0, 0, 0, 0, 4, 4, 24, 24, 24];

        require(
            artifact.lastDeactivated +
                artifactCooldownsHours[uint256(artifact.artifactType)] *
                60 *
                60 <
                block.timestamp,
            "this artifact is on a cooldown"
        );

        bool shouldDeactivateAndBurn = false;

        artifact.lastActivated = block.timestamp;
        emit ArtifactActivated(msg.sender, artifactId, locationId);

        if (artifact.artifactType == ArtifactType.Wormhole) {
            require(wormholeTo != 0, "you must provide a wormholeTo to activate a wormhole");
            require(
                gs().planets[wormholeTo].owner == msg.sender,
                "you can only create a wormhole to a planet you own"
            );
            require(!gs().planetsExtendedInfo[wormholeTo].destroyed, "planet destroyed");
            artifact.wormholeTo = wormholeTo;
        } else if (artifact.artifactType == ArtifactType.BloomFilter) {
            require(
                2 * uint256(artifact.rarity) >= planet.planetLevel,
                "artifact is not powerful enough to apply effect to this planet level"
            );
            planet.population = planet.populationCap;
            planet.silver = planet.silverCap;
            shouldDeactivateAndBurn = true;
        } else if (artifact.artifactType == ArtifactType.BlackDomain) {
            require(
                2 * uint256(artifact.rarity) >= planet.planetLevel,
                "artifact is not powerful enough to apply effect to this planet level"
            );
            info.destroyed = true;
            shouldDeactivateAndBurn = true;
        }

        if (shouldDeactivateAndBurn) {
            artifact.lastDeactivated = block.timestamp; // immediately deactivate
            DFArtifactFacet(address(this)).updateArtifact(artifact); // save artifact state immediately, because _takeArtifactOffPlanet will access pull it from tokens contract
            emit ArtifactDeactivated(msg.sender, artifactId, locationId);
            // burn it after use. will be owned by contract but not on a planet anyone can control
            LibGameUtils._takeArtifactOffPlanet(artifactId, locationId);
        } else {
            DFArtifactFacet(address(this)).updateArtifact(artifact);
        }

        // this is fine even tho some artifacts are immediately deactivated, because
        // those artifacts do not buff the planet.
        LibGameUtils._buffPlanet(locationId, LibGameUtils._getUpgradeForArtifact(artifact));
    }

    function deactivateArtifact(uint256 locationId) public {
        Planet storage planet = gs().planets[locationId];

        require(
            planet.owner == msg.sender,
            "you must own the planet you are deactivating an artifact on"
        );

        require(!gs().planetsExtendedInfo[locationId].destroyed, "planet is destroyed");

        Artifact memory artifact = LibGameUtils.getActiveArtifact(locationId);

        require(artifact.isInitialized, "this artifact is not activated on this planet");

        artifact.lastDeactivated = block.timestamp;
        artifact.wormholeTo = 0;
        emit ArtifactDeactivated(msg.sender, artifact.id, locationId);
        DFArtifactFacet(address(this)).updateArtifact(artifact);

        bool shouldBurn =
            artifact.artifactType == ArtifactType.PlanetaryShield ||
                artifact.artifactType == ArtifactType.PhotoidCannon;
        if (shouldBurn) {
            // burn it after use. will be owned by contract but not on a planet anyone can control
            LibGameUtils._takeArtifactOffPlanet(artifact.id, locationId);
        }

        LibGameUtils._debuffPlanet(locationId, LibGameUtils._getUpgradeForArtifact(artifact));
    }

    function depositArtifact(
        uint256 locationId,
        uint256 artifactId,
        address coreAddress
    ) public {
        Planet storage planet = gs().planets[locationId];

        require(!gs().planetsExtendedInfo[locationId].destroyed, "planet is destroyed");
        require(planet.planetType == PlanetType.TRADING_POST, "can only deposit on trading posts");
        require(
            DFArtifactFacet(address(this)).ownerOf(artifactId) == msg.sender,
            "you can only deposit artifacts you own"
        );
        require(planet.owner == msg.sender, "you can only deposit on a planet you own");

        Artifact memory artifact = DFArtifactFacet(address(this)).getArtifact(artifactId);
        require(
            planet.planetLevel > uint256(artifact.rarity),
            "spacetime rip not high enough level to deposit this artifact"
        );
        require(!isSpaceship(artifact.artifactType), "cannot deposit spaceships");

        require(gs().planetArtifacts[locationId].length < 5, "too many artifacts on this planet");

        LibGameUtils._putArtifactOnPlanet(artifactId, locationId);

        DFArtifactFacet(address(this)).transferArtifact(artifactId, coreAddress);
    }

    function withdrawArtifact(uint256 locationId, uint256 artifactId) public {
        Planet storage planet = gs().planets[locationId];

        require(
            planet.planetType == PlanetType.TRADING_POST,
            "can only withdraw from trading posts"
        );
        require(!gs().planetsExtendedInfo[locationId].destroyed, "planet is destroyed");
        require(planet.owner == msg.sender, "you can only withdraw from a planet you own");
        Artifact memory artifact = LibGameUtils.getPlanetArtifact(locationId, artifactId);
        require(artifact.isInitialized, "this artifact is not on this planet");

        require(
            planet.planetLevel > uint256(artifact.rarity),
            "spacetime rip not high enough level to withdraw this artifact"
        );
        require(!isSpaceship(artifact.artifactType), "cannot withdraw spaceships");
        LibGameUtils._takeArtifactOffPlanet(artifactId, locationId);

        DFArtifactFacet(address(this)).transferArtifact(artifactId, msg.sender);
    }

    function prospectPlanet(uint256 locationId) public {
        Planet storage planet = gs().planets[locationId];
        PlanetExtendedInfo storage planetInfo = gs().planetsExtendedInfo[locationId];

        require(!planetInfo.destroyed, "planet is destroyed");
        require(planet.planetType == PlanetType.RUINS, "you can't find an artifact on this planet");
        require(containsGear(locationId), "gear ship must be present on planet");
        require(planet.owner == msg.sender, "you must own this planet");
        require(planetInfo.prospectedBlockNumber == 0, "this planet has already been prospected");

        planetInfo.prospectedBlockNumber = block.number;
    }

    function containsGear(uint256 locationId) public view returns (bool) {
        uint256[] memory artifactIds = gs().planetArtifacts[locationId];

        for (uint256 i = 0; i < artifactIds.length; i++) {
            Artifact memory artifact = DFArtifactFacet(address(this)).getArtifact(artifactIds[i]);
            if (
                artifact.artifactType == ArtifactType.ShipGear && msg.sender == artifact.controller
            ) {
                return true;
            }
        }

        return false;
    }

    function isSpaceship(ArtifactType artifactType) public pure returns (bool) {
        return
            artifactType >= ArtifactType.ShipMothership && artifactType <= ArtifactType.ShipTitan;
    }
}
