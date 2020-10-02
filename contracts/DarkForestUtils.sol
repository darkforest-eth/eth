// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.9;

// Libraries
import "./ABDKMath64x64.sol";
import "./DarkForestTypes.sol";

library DarkForestUtils {
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
        uint256 target4RadiusConstant,
        uint256 target5RadiusConstant
    ) public view returns (uint256) {
        uint256 target4 = 2 *
            initializedPlanetCountByLevel[4] +
            nPlayers /
            5 +
            target4RadiusConstant;
        uint256 target5 = nPlayers / 10 + target5RadiusConstant;
        for (uint256 i = 5; i < initializedPlanetCountByLevel.length; i += 1) {
            target4 += 2 * initializedPlanetCountByLevel[i];
            target5 += 2 * initializedPlanetCountByLevel[i];
        }
        uint256 targetRadiusSquared4 = (target4 * cumulativeRarities[4] * 100) /
            314;
        uint256 targetRadiusSquared5 = (target5 * cumulativeRarities[5] * 100) /
            314;
        uint256 r4 = ABDKMath64x64.toUInt(
            ABDKMath64x64.sqrt(ABDKMath64x64.fromUInt(targetRadiusSquared4))
        );
        uint256 r5 = ABDKMath64x64.toUInt(
            ABDKMath64x64.sqrt(ABDKMath64x64.fromUInt(targetRadiusSquared5))
        );
        if (r4 > r5) {
            return r4;
        } else {
            return r5;
        }
    }

    function isDelegated(
        mapping(uint256 => DarkForestTypes.PlanetExtendedInfo)
            storage planetsExtendedInfo,
        uint256 _location,
        address _player
    ) public view returns (bool) {
        for (
            uint256 i = 0;
            i < planetsExtendedInfo[_location].delegatedPlayers.length;
            i++
        ) {
            if (_player == planetsExtendedInfo[_location].delegatedPlayers[i]) {
                return true;
            }
        }

        return false;
    }
}
