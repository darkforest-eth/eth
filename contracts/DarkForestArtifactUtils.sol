// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "./DarkForestTypes.sol";
import "./DarkForestUtils.sol";

library DarkForestArtifactUtils {
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

    // verifies that user is allowed to call findArtifact on this planet
    function checkFindArtifact(
        DarkForestTypes.PlanetExtendedInfo memory info,
        DarkForestTypes.Planet memory planet
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
        return true;
    }

    function findArtifact(DarkForestTypes.DFPFindArtifactArgs memory args)
        public
        returns (uint256 artifactId)
    {
        DarkForestTypes.Planet storage planet = s().planets[args.planetId];
        DarkForestTypes.PlanetExtendedInfo storage info = s().planetsExtendedInfo[args.planetId];

        require(checkFindArtifact(info, planet));

        DarkForestTypes.Biome biome = DarkForestUtils._getBiome(info.spaceType, args.biomebase);

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

        (DarkForestTypes.ArtifactType artifactType, uint256 levelBonus) =
            DarkForestUtils._randomArtifactTypeAndLevelBonus(artifactSeed, biome, info.spaceType);

        DarkForestTypes.DFTCreateArtifactArgs memory createArtifactArgs =
            DarkForestTypes.DFTCreateArtifactArgs(
                artifactSeed,
                msg.sender,
                args.planetId,
                DarkForestUtils.artifactRarityFromPlanetLevel(levelBonus + planet.planetLevel),
                biome,
                artifactType,
                args.coreAddress
            );

        DarkForestTypes.Artifact memory foundArtifact =
            s().tokens.createArtifact(createArtifactArgs);

        DarkForestUtils._putArtifactOnPlanet(foundArtifact.id, args.planetId);

        info.hasTriedFindingArtifact = true;
        s().players[msg.sender].score += s().gameConstants.ARTIFACT_POINT_VALUES[
            uint256(foundArtifact.rarity)
        ];

        artifactId = foundArtifact.id;
    }

    function activateArtifact(
        uint256 locationId,
        uint256 artifactId,
        uint256 wormholeTo
    ) public {
        DarkForestTypes.Planet storage planet = s().planets[locationId];
        DarkForestTypes.PlanetExtendedInfo storage info = s().planetsExtendedInfo[locationId];

        require(
            planet.owner == msg.sender,
            "you must own the planet you are activating an artifact on"
        );
        require(
            !DarkForestUtils.getActiveArtifact(locationId).isInitialized,
            "there is already an active artifact on this planet"
        );
        require(!info.destroyed, "planet is destroyed");

        DarkForestTypes.Artifact memory artifact =
            DarkForestUtils.getPlanetArtifact(locationId, artifactId);

        require(artifact.isInitialized, "this artifact is not on this planet");

        // Unknown is the 0th one, Monolith is the 1st, and so on.
        // TODO v0.6: consider photoid canon
        uint256[10] memory artifactCooldownsHours =
            [uint256(24), 24, 24, 24, 24, 48, 24, 24, 24, 24];

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

        if (artifact.artifactType == DarkForestTypes.ArtifactType.Wormhole) {
            require(wormholeTo != 0, "you must provide a wormholeTo to activate a wormhole");
            require(
                s().planets[wormholeTo].owner == msg.sender,
                "you can only create a wormhole to a planet you own"
            );
            require(!s().planetsExtendedInfo[wormholeTo].destroyed, "planet destroyed");
            artifact.wormholeTo = wormholeTo;
        } else if (artifact.artifactType == DarkForestTypes.ArtifactType.BloomFilter) {
            require(
                2 * uint256(artifact.rarity) >= planet.planetLevel,
                "artifact is not powerful enough to apply effect to this planet level"
            );
            planet.population = planet.populationCap;
            planet.silver = planet.silverCap;
            shouldDeactivateAndBurn = true;
        } else if (artifact.artifactType == DarkForestTypes.ArtifactType.BlackDomain) {
            require(
                2 * uint256(artifact.rarity) >= planet.planetLevel,
                "artifact is not powerful enough to apply effect to this planet level"
            );
            info.destroyed = true;
            shouldDeactivateAndBurn = true;
        }

        if (shouldDeactivateAndBurn) {
            artifact.lastDeactivated = block.timestamp; // immediately deactivate
            s().tokens.updateArtifact(artifact); // save artifact state immediately, because _takeArtifactOffPlanet will access pull it from tokens contract
            emit ArtifactDeactivated(msg.sender, artifactId, locationId);
            // burn it after use. will be owned by contract but not on a planet anyone can control
            DarkForestUtils._takeArtifactOffPlanet(artifactId, locationId);
        } else {
            s().tokens.updateArtifact(artifact);
        }

        // this is fine even tho some artifacts are immediately deactivated, because
        // those artifacts do not buff the planet.
        DarkForestUtils._buffPlanet(locationId, DarkForestUtils._getUpgradeForArtifact(artifact));
    }

    function deactivateArtifact(uint256 locationId) public {
        DarkForestTypes.Planet storage planet = s().planets[locationId];

        require(
            planet.owner == msg.sender,
            "you must own the planet you are deactivating an artifact on"
        );

        require(!s().planetsExtendedInfo[locationId].destroyed, "planet is destroyed");

        DarkForestTypes.Artifact memory artifact = DarkForestUtils.getActiveArtifact(locationId);

        require(artifact.isInitialized, "this artifact is not activated on this planet");

        artifact.lastDeactivated = block.timestamp;
        artifact.wormholeTo = 0;
        emit ArtifactDeactivated(msg.sender, artifact.id, locationId);
        s().tokens.updateArtifact(artifact);

        bool shouldBurn =
            artifact.artifactType == DarkForestTypes.ArtifactType.PlanetaryShield ||
                artifact.artifactType == DarkForestTypes.ArtifactType.PhotoidCannon;
        if (shouldBurn) {
            // burn it after use. will be owned by contract but not on a planet anyone can control
            DarkForestUtils._takeArtifactOffPlanet(artifact.id, locationId);
        }

        DarkForestUtils._debuffPlanet(locationId, DarkForestUtils._getUpgradeForArtifact(artifact));
    }

    function depositArtifact(
        uint256 locationId,
        uint256 artifactId,
        address coreAddress
    ) public {
        DarkForestTypes.Planet storage planet = s().planets[locationId];

        require(!s().planetsExtendedInfo[locationId].destroyed, "planet is destroyed");
        require(
            planet.planetType == DarkForestTypes.PlanetType.TRADING_POST,
            "can only deposit on trading posts"
        );
        require(
            s().tokens.ownerOf(artifactId) == msg.sender,
            "you can only deposit artifacts you own"
        );
        require(planet.owner == msg.sender, "you can only deposit on a planet you own");

        DarkForestTypes.Artifact memory artifact = s().tokens.getArtifact(artifactId);
        require(
            planet.planetLevel > uint256(artifact.rarity),
            "spacetime rip not high enough level to deposit this artifact"
        );

        require(s().planetArtifacts[locationId].length < 5, "too many artifacts on this planet");

        DarkForestUtils._putArtifactOnPlanet(artifactId, locationId);

        s().tokens.transferArtifact(artifactId, coreAddress);
    }

    function withdrawArtifact(uint256 locationId, uint256 artifactId) public {
        DarkForestTypes.Planet storage planet = s().planets[locationId];

        require(
            planet.planetType == DarkForestTypes.PlanetType.TRADING_POST,
            "can only withdraw from trading posts"
        );
        require(!s().planetsExtendedInfo[locationId].destroyed, "planet is destroyed");
        require(planet.owner == msg.sender, "you can only withdraw from a planet you own");
        DarkForestTypes.Artifact memory artifact =
            DarkForestUtils.getPlanetArtifact(locationId, artifactId);
        require(artifact.isInitialized, "this artifact is not on this planet");

        require(
            planet.planetLevel > uint256(artifact.rarity),
            "spacetime rip not high enough level to withdraw this artifact"
        );
        DarkForestUtils._takeArtifactOffPlanet(artifactId, locationId);

        s().tokens.transferArtifact(artifactId, msg.sender);
    }

    function prospectPlanet(uint256 locationId) public {
        DarkForestTypes.Planet storage planet = s().planets[locationId];
        DarkForestTypes.PlanetExtendedInfo storage planetInfo = s().planetsExtendedInfo[locationId];

        require(!planetInfo.destroyed, "planet is destroyed");
        require(
            (planet.population * 100) / planet.populationCap > 95,
            "you must have 95% of the max energy"
        );
        require(
            planet.planetType == DarkForestTypes.PlanetType.RUINS,
            "you can't find an artifact on this planet"
        );
        require(planet.owner == msg.sender, "you must own this planet");
        require(planetInfo.prospectedBlockNumber == 0, "this planet has already been prospected");

        planetInfo.prospectedBlockNumber = block.number;
    }
}
