// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.9;
pragma experimental ABIEncoderV2;

// Libraries
import "./ABDKMath64x64.sol";
import "./DarkForestTypes.sol";

library DarkForestUtils {
    // inclusive on both ends
    function _calculateByteUInt(
        bytes memory _b,
        uint256 _startByte,
        uint256 _endByte
    ) public pure returns (uint256 _byteUInt) {
        for (uint256 i = _startByte; i <= _endByte; i++) {
            _byteUInt += uint256(uint8(_b[i])) * (256**(_endByte - i));
        }
    }

    function _getPlanetLevelAndResource(
        uint256 _location,
        uint256 _perlin,
        uint256 PERLIN_THRESHOLD_1,
        uint256 PERLIN_THRESHOLD_2,
        uint256 SILVER_RARITY_1,
        uint256 SILVER_RARITY_2,
        uint256 SILVER_RARITY_3,
        uint256[] storage planetLevelThresholds,
        DarkForestTypes.PlanetDefaultStats[] storage planetDefaultStats
    ) public view returns (uint256, DarkForestTypes.PlanetResource) {
        bytes memory _b = abi.encodePacked(_location);

        // get the uint value of byte 4 - 6
        uint256 _planetLevelUInt = _calculateByteUInt(_b, 4, 6);
        uint256 level;

        // reverse-iterate thresholds and return planet type accordingly
        for (uint256 i = (planetLevelThresholds.length - 1); i >= 0; i--) {
            if (_planetLevelUInt < planetLevelThresholds[i]) {
                level = i;
                break;
            }
        }

        DarkForestTypes.PlanetResource resource = DarkForestTypes
            .PlanetResource
            .NONE;

        if (planetDefaultStats[level].silverGrowth > 0) {
            if (
                _perlin < PERLIN_THRESHOLD_1 &&
                uint256(uint8(_b[8])) * SILVER_RARITY_1 < 256
            ) {
                // nebula
                resource = DarkForestTypes.PlanetResource.SILVER;
            } else if (
                _perlin >= PERLIN_THRESHOLD_1 &&
                _perlin < PERLIN_THRESHOLD_2 &&
                uint256(uint8(_b[8])) * SILVER_RARITY_2 < 256
            ) {
                // space
                resource = DarkForestTypes.PlanetResource.SILVER;
            } else if (
                _perlin >= PERLIN_THRESHOLD_2 &&
                uint256(uint8(_b[8])) * SILVER_RARITY_3 < 256
            ) {
                // deep space
                resource = DarkForestTypes.PlanetResource.SILVER;
            }
        }

        if (_perlin < PERLIN_THRESHOLD_1 && level > 3) {
            // nebula clip
            level = 3;
        }
        if (
            _perlin >= PERLIN_THRESHOLD_1 &&
            _perlin < PERLIN_THRESHOLD_2 &&
            level > 4
        ) {
            // space clip
            level = 4;
        }

        return (level, resource);
    }

    function _getRadius(
        uint256[] storage initializedPlanetCountByLevel,
        uint256[] storage cumulativeRarities,
        uint256 nPlayers,
        uint256 target4RadiusConstant
    ) public view returns (uint256) {
        uint256 target4 = initializedPlanetCountByLevel[4] + 5 * nPlayers;
        if (target4 < target4RadiusConstant) {
            target4 = target4RadiusConstant;
        }
        uint256 targetRadiusSquared4 = (target4 * cumulativeRarities[4] * 100) /
            314;
        uint256 r4 = ABDKMath64x64.toUInt(
            ABDKMath64x64.sqrt(ABDKMath64x64.fromUInt(targetRadiusSquared4))
        );
        return r4;
    }

    function _isPlanetMineable(uint256 planetId, uint256 planetLevel)
        internal
        view
        returns (bool)
    {
        bytes memory _b = abi.encodePacked(planetId);
        uint256 fourteenthByte = _calculateByteUInt(_b, 14, 14);
        // TODO this should be a constant
        return (fourteenthByte < 16) && planetLevel >= 1;
    }

    function _artifactSeed(
        uint256 planetId,
        uint256 planetEventsCount,
        uint256 blockTimestamp
    ) internal view returns (uint256) {
        return
            uint256(
                keccak256(
                    abi.encodePacked(
                        planetId,
                        blockTimestamp,
                        planetEventsCount
                    )
                )
            );
    }

    function _randomArtifactTypeAndLevelBonus(uint256 artifactSeed)
        internal
        view
        returns (DarkForestTypes.ArtifactType, uint256)
    {
        uint256 lastByteOfSeed = artifactSeed % 0xFF;
        uint256 secondLastByteOfSeed = ((artifactSeed - lastByteOfSeed) / 256) %
            0xFF;

        DarkForestTypes.ArtifactType artifactType = DarkForestTypes
            .ArtifactType
            .Pyramid;

        if (lastByteOfSeed < 64) {
            artifactType = DarkForestTypes.ArtifactType.Monolith;
        } else if (lastByteOfSeed < 128) {
            artifactType = DarkForestTypes.ArtifactType.Colossus;
        } else if (lastByteOfSeed < 192) {
            artifactType = DarkForestTypes.ArtifactType.Spaceship;
        }

        uint256 bonus = 0;
        if (secondLastByteOfSeed < 4) {
            bonus = 3;
        } else if (secondLastByteOfSeed < 16) {
            bonus = 2;
        } else if (secondLastByteOfSeed < 64) {
            bonus = 1;
        }

        return (artifactType, bonus);
    }

    function _getBiome(
        DarkForestTypes.SpaceType spaceType,
        uint256 biomebase,
        uint256 BIOME_THRESHOLD_1,
        uint256 BIOME_THRESHOLD_2
    ) public view returns (DarkForestTypes.Biome) {
        uint256 biome = 3 * uint256(spaceType);
        if (biomebase < BIOME_THRESHOLD_1) biome += 1;
        else if (biomebase < BIOME_THRESHOLD_2) biome += 2;
        else biome += 3;

        return DarkForestTypes.Biome(biome);
    }

    function _getUpgradeForArtifact(DarkForestTypes.Artifact memory artifact)
        public
        view
        returns (DarkForestTypes.Upgrade memory)
    {
        // formula pulled out of my ass at 4AM

        DarkForestTypes.Upgrade memory ret = DarkForestTypes.Upgrade({
            popCapMultiplier: 85,
            popGroMultiplier: 85,
            rangeMultiplier: 85,
            speedMultiplier: 85,
            defMultiplier: 85
        });

        if (artifact.artifactType == DarkForestTypes.ArtifactType.Monolith) {
            ret.popCapMultiplier += 35;
            ret.popGroMultiplier += 35;
        } else if (
            artifact.artifactType == DarkForestTypes.ArtifactType.Colossus
        ) {
            ret.speedMultiplier += 35;
        } else if (
            artifact.artifactType == DarkForestTypes.ArtifactType.Spaceship
        ) {
            ret.rangeMultiplier += 35;
        } else if (
            artifact.artifactType == DarkForestTypes.ArtifactType.Pyramid
        ) {
            ret.defMultiplier += 35;
        }

        if (artifact.planetBiome == DarkForestTypes.Biome.Ocean) {
            ret.speedMultiplier += 10;
            ret.defMultiplier += 10;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Forest) {
            ret.defMultiplier += 10;
            ret.popCapMultiplier += 10;
            ret.popGroMultiplier += 10;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Grassland) {
            ret.popCapMultiplier += 10;
            ret.popGroMultiplier += 10;
            ret.rangeMultiplier += 10;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Tundra) {
            ret.defMultiplier += 10;
            ret.rangeMultiplier += 10;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Swamp) {
            ret.speedMultiplier += 10;
            ret.rangeMultiplier += 10;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Desert) {
            ret.speedMultiplier += 20;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Ice) {
            ret.rangeMultiplier += 20;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Wasteland) {
            ret.defMultiplier += 20;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Lava) {
            ret.popCapMultiplier += 20;
            ret.popGroMultiplier += 20;
        }

        uint256 scale = 1 + (artifact.planetLevel / 2);

        ret.popCapMultiplier = scale * ret.popCapMultiplier - (scale - 1) * 100;
        ret.popGroMultiplier = scale * ret.popGroMultiplier - (scale - 1) * 100;
        ret.speedMultiplier = scale * ret.speedMultiplier - (scale - 1) * 100;
        ret.rangeMultiplier = scale * ret.rangeMultiplier - (scale - 1) * 100;
        ret.defMultiplier = scale * ret.defMultiplier - (scale - 1) * 100;

        return ret;
    }
}
