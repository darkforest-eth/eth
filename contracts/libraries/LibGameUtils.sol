// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// External contract imports
import {DFArtifactFacet} from "../facets/DFArtifactFacet.sol";

// Library imports
import {ABDKMath64x64} from "../vendor/libraries/ABDKMath64x64.sol";

// Storage imports
import {LibStorage, GameStorage, GameConstants, SnarkConstants} from "./LibStorage.sol";

import {
    Biome,
    SpaceType,
    Planet,
    PlanetType,
    PlanetEventType,
    Artifact,
    ArtifactType,
    ArtifactRarity,
    Upgrade,
    PlanetDefaultStats
} from "../DFTypes.sol";

library LibGameUtils {
    function gs() internal pure returns (GameStorage storage) {
        return LibStorage.gameStorage();
    }

    function gameConstants() internal pure returns (GameConstants storage) {
        return LibStorage.gameConstants();
    }

    function snarkConstants() internal pure returns (SnarkConstants storage) {
        return LibStorage.snarkConstants();
    }

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

    function _locationIdValid(uint256 _loc) public view returns (bool) {
        return (_loc <
            (21888242871839275222246405745257275088548364400416034343698204186575808495617 /
                gameConstants().PLANET_RARITY));
    }

    // if you don't check the public input snark perlin config values, then a player could specify a planet with for example the wrong PLANETHASH_KEY and the SNARK would verify but they'd have created an invalid planet.
    // the zkSNARK verification function checks that the SNARK proof is valid; a valid proof might be "i know the existence of a planet at secret coords with address 0x123456... and mimc key 42". but if this universe's mimc key is 43 this is still an invalid planet, so we have to check that this SNARK proof is a proof for the right mimc key (and spacetype key, perlin length scale, etc.)
    function revertIfBadSnarkPerlinFlags(uint256[5] memory perlinFlags, bool checkingBiome)
        public
        view
        returns (bool)
    {
        require(perlinFlags[0] == snarkConstants().PLANETHASH_KEY, "bad planethash mimc key");
        if (checkingBiome) {
            require(perlinFlags[1] == snarkConstants().BIOMEBASE_KEY, "bad spacetype mimc key");
        } else {
            require(perlinFlags[1] == snarkConstants().SPACETYPE_KEY, "bad spacetype mimc key");
        }
        require(perlinFlags[2] == snarkConstants().PERLIN_LENGTH_SCALE, "bad perlin length scale");
        require((perlinFlags[3] == 1) == snarkConstants().PERLIN_MIRROR_X, "bad perlin mirror x");
        require((perlinFlags[4] == 1) == snarkConstants().PERLIN_MIRROR_Y, "bad perlin mirror y");

        return true;
    }

    function spaceTypeFromPerlin(uint256 perlin) public view returns (SpaceType) {
        if (perlin >= gameConstants().PERLIN_THRESHOLD_3) {
            return SpaceType.DEAD_SPACE;
        } else if (perlin >= gameConstants().PERLIN_THRESHOLD_2) {
            return SpaceType.DEEP_SPACE;
        } else if (perlin >= gameConstants().PERLIN_THRESHOLD_1) {
            return SpaceType.SPACE;
        }
        return SpaceType.NEBULA;
    }

    function _getPlanetLevelTypeAndSpaceType(uint256 _location, uint256 _perlin)
        public
        view
        returns (
            uint256,
            PlanetType,
            SpaceType
        )
    {
        SpaceType spaceType = spaceTypeFromPerlin(_perlin);

        bytes memory _b = abi.encodePacked(_location);

        // get the uint value of byte 4 - 6
        uint256 _planetLevelUInt = _calculateByteUInt(_b, 4, 6);
        uint256 level;

        // reverse-iterate thresholds and return planet type accordingly
        for (uint256 i = (gs().planetLevelThresholds.length - 1); i >= 0; i--) {
            if (_planetLevelUInt < gs().planetLevelThresholds[i]) {
                level = i;
                break;
            }
        }

        if (spaceType == SpaceType.NEBULA && level > 4) {
            // clip level to <= 3 if in nebula
            level = 4;
        }
        if (spaceType == SpaceType.SPACE && level > 5) {
            // clip level to <= 4 if in space
            level = 5;
        }

        // clip level to <= MAX_NATURAL_PLANET_LEVEL
        if (level > gameConstants().MAX_NATURAL_PLANET_LEVEL) {
            level = gameConstants().MAX_NATURAL_PLANET_LEVEL;
        }

        // get planet type
        PlanetType planetType = PlanetType.PLANET;
        uint8[5] memory weights = gameConstants().PLANET_TYPE_WEIGHTS[uint8(spaceType)][level];
        uint256[5] memory thresholds;
        {
            uint256 weightSum;
            for (uint8 i = 0; i < weights.length; i++) {
                weightSum += weights[i];
            }
            thresholds[0] = weightSum - weights[0];
            for (uint8 i = 1; i < weights.length; i++) {
                thresholds[i] = thresholds[i - 1] - weights[i];
            }
            for (uint8 i = 0; i < weights.length; i++) {
                thresholds[i] = (thresholds[i] * 256) / weightSum;
            }
        }

        uint8 typeByte = uint8(_b[8]);
        for (uint8 i = 0; i < thresholds.length; i++) {
            if (typeByte >= thresholds[i]) {
                planetType = PlanetType(i);
                break;
            }
        }

        return (level, planetType, spaceType);
    }

    function _getRadius() public view returns (uint256) {
        uint256 nPlayers = gs().playerIds.length;
        uint256 worldRadiusMin = gameConstants().WORLD_RADIUS_MIN;
        uint256 target4 = gs().initializedPlanetCountByLevel[4] + 20 * nPlayers;
        uint256 targetRadiusSquared4 = (target4 * gs().cumulativeRarities[4] * 100) / 314;
        uint256 r4 =
            ABDKMath64x64.toUInt(ABDKMath64x64.sqrt(ABDKMath64x64.fromUInt(targetRadiusSquared4)));
        if (r4 < worldRadiusMin) {
            return worldRadiusMin;
        } else {
            return r4;
        }
    }

    function _randomArtifactTypeAndLevelBonus(
        uint256 artifactSeed,
        Biome biome,
        SpaceType spaceType
    ) internal pure returns (ArtifactType, uint256) {
        uint256 lastByteOfSeed = artifactSeed % 0xFF;
        uint256 secondLastByteOfSeed = ((artifactSeed - lastByteOfSeed) / 256) % 0xFF;

        ArtifactType artifactType = ArtifactType.Pyramid;

        if (lastByteOfSeed < 39) {
            artifactType = ArtifactType.Monolith;
        } else if (lastByteOfSeed < 78) {
            artifactType = ArtifactType.Colossus;
        }
        // else if (lastByteOfSeed < 117) {
        //     artifactType = ArtifactType.Spaceship;
        // }
        else if (lastByteOfSeed < 156) {
            artifactType = ArtifactType.Pyramid;
        } else if (lastByteOfSeed < 171) {
            artifactType = ArtifactType.Wormhole;
        } else if (lastByteOfSeed < 186) {
            artifactType = ArtifactType.PlanetaryShield;
        } else if (lastByteOfSeed < 201) {
            artifactType = ArtifactType.PhotoidCannon;
        } else if (lastByteOfSeed < 216) {
            artifactType = ArtifactType.BloomFilter;
        } else if (lastByteOfSeed < 231) {
            artifactType = ArtifactType.BlackDomain;
        } else {
            if (biome == Biome.Ice) {
                artifactType = ArtifactType.PlanetaryShield;
            } else if (biome == Biome.Lava) {
                artifactType = ArtifactType.PhotoidCannon;
            } else if (biome == Biome.Wasteland) {
                artifactType = ArtifactType.BloomFilter;
            } else if (biome == Biome.Corrupted) {
                artifactType = ArtifactType.BlackDomain;
            } else {
                artifactType = ArtifactType.Wormhole;
            }
            artifactType = ArtifactType.PhotoidCannon;
        }

        uint256 bonus = 0;
        if (secondLastByteOfSeed < 4) {
            bonus = 2;
        } else if (secondLastByteOfSeed < 16) {
            bonus = 1;
        }

        return (artifactType, bonus);
    }

    // TODO v0.6: handle corrupted biomes
    function _getBiome(SpaceType spaceType, uint256 biomebase) public view returns (Biome) {
        if (spaceType == SpaceType.DEAD_SPACE) {
            return Biome.Corrupted;
        }

        uint256 biome = 3 * uint256(spaceType);
        if (biomebase < gameConstants().BIOME_THRESHOLD_1) biome += 1;
        else if (biomebase < gameConstants().BIOME_THRESHOLD_2) biome += 2;
        else biome += 3;

        return Biome(biome);
    }

    function defaultUpgrade() public pure returns (Upgrade memory) {
        return
            Upgrade({
                popCapMultiplier: 100,
                popGroMultiplier: 100,
                rangeMultiplier: 100,
                speedMultiplier: 100,
                defMultiplier: 100
            });
    }

    function timeDelayUpgrade(Artifact memory artifact) public pure returns (Upgrade memory) {
        if (artifact.artifactType == ArtifactType.PhotoidCannon) {
            uint256[6] memory range = [uint256(100), 200, 200, 200, 200, 200];
            uint256[6] memory speedBoosts = [uint256(100), 500, 1000, 1500, 2000, 2500];
            return
                Upgrade({
                    popCapMultiplier: 100,
                    popGroMultiplier: 100,
                    rangeMultiplier: range[uint256(artifact.rarity)],
                    speedMultiplier: speedBoosts[uint256(artifact.rarity)],
                    defMultiplier: 100
                });
        }

        return defaultUpgrade();
    }

    /**
      The upgrade applied to a movement when abandoning a planet.
     */
    function abandoningUpgrade() public view returns (Upgrade memory) {
        return
            Upgrade({
                popCapMultiplier: 100,
                popGroMultiplier: 100,
                rangeMultiplier: gameConstants().ABANDON_RANGE_CHANGE_PERCENT,
                speedMultiplier: gameConstants().ABANDON_SPEED_CHANGE_PERCENT,
                defMultiplier: 100
            });
    }

    function _getUpgradeForArtifact(Artifact memory artifact) public pure returns (Upgrade memory) {
        if (artifact.artifactType == ArtifactType.PlanetaryShield) {
            uint256[6] memory defenseMultipliersPerRarity = [uint256(100), 150, 200, 300, 450, 650];

            return
                Upgrade({
                    popCapMultiplier: 100,
                    popGroMultiplier: 100,
                    rangeMultiplier: 20,
                    speedMultiplier: 20,
                    defMultiplier: defenseMultipliersPerRarity[uint256(artifact.rarity)]
                });
        }

        if (artifact.artifactType == ArtifactType.PhotoidCannon) {
            uint256[6] memory def = [uint256(100), 50, 40, 30, 20, 10];
            return
                Upgrade({
                    popCapMultiplier: 100,
                    popGroMultiplier: 100,
                    rangeMultiplier: 100,
                    speedMultiplier: 100,
                    defMultiplier: def[uint256(artifact.rarity)]
                });
        }

        if (uint256(artifact.artifactType) >= 5) {
            return
                Upgrade({
                    popCapMultiplier: 100,
                    popGroMultiplier: 100,
                    rangeMultiplier: 100,
                    speedMultiplier: 100,
                    defMultiplier: 100
                });
        }

        Upgrade memory ret =
            Upgrade({
                popCapMultiplier: 100,
                popGroMultiplier: 100,
                rangeMultiplier: 100,
                speedMultiplier: 100,
                defMultiplier: 100
            });

        if (artifact.artifactType == ArtifactType.Monolith) {
            ret.popCapMultiplier += 5;
            ret.popGroMultiplier += 5;
        } else if (artifact.artifactType == ArtifactType.Colossus) {
            ret.speedMultiplier += 5;
        } else if (artifact.artifactType == ArtifactType.Spaceship) {
            ret.rangeMultiplier += 5;
        } else if (artifact.artifactType == ArtifactType.Pyramid) {
            ret.defMultiplier += 5;
        }

        if (artifact.planetBiome == Biome.Ocean) {
            ret.speedMultiplier += 5;
            ret.defMultiplier += 5;
        } else if (artifact.planetBiome == Biome.Forest) {
            ret.defMultiplier += 5;
            ret.popCapMultiplier += 5;
            ret.popGroMultiplier += 5;
        } else if (artifact.planetBiome == Biome.Grassland) {
            ret.popCapMultiplier += 5;
            ret.popGroMultiplier += 5;
            ret.rangeMultiplier += 5;
        } else if (artifact.planetBiome == Biome.Tundra) {
            ret.defMultiplier += 5;
            ret.rangeMultiplier += 5;
        } else if (artifact.planetBiome == Biome.Swamp) {
            ret.speedMultiplier += 5;
            ret.rangeMultiplier += 5;
        } else if (artifact.planetBiome == Biome.Desert) {
            ret.speedMultiplier += 10;
        } else if (artifact.planetBiome == Biome.Ice) {
            ret.rangeMultiplier += 10;
        } else if (artifact.planetBiome == Biome.Wasteland) {
            ret.defMultiplier += 10;
        } else if (artifact.planetBiome == Biome.Lava) {
            ret.popCapMultiplier += 10;
            ret.popGroMultiplier += 10;
        } else if (artifact.planetBiome == Biome.Corrupted) {
            ret.rangeMultiplier += 5;
            ret.speedMultiplier += 5;
            ret.popCapMultiplier += 5;
            ret.popGroMultiplier += 5;
        }

        uint256 scale = 1 + (uint256(artifact.rarity) / 2);

        ret.popCapMultiplier = scale * ret.popCapMultiplier - (scale - 1) * 100;
        ret.popGroMultiplier = scale * ret.popGroMultiplier - (scale - 1) * 100;
        ret.speedMultiplier = scale * ret.speedMultiplier - (scale - 1) * 100;
        ret.rangeMultiplier = scale * ret.rangeMultiplier - (scale - 1) * 100;
        ret.defMultiplier = scale * ret.defMultiplier - (scale - 1) * 100;

        return ret;
    }

    function artifactRarityFromPlanetLevel(uint256 planetLevel)
        public
        pure
        returns (ArtifactRarity)
    {
        if (planetLevel <= 1) return ArtifactRarity.Common;
        else if (planetLevel <= 3) return ArtifactRarity.Rare;
        else if (planetLevel <= 5) return ArtifactRarity.Epic;
        else if (planetLevel <= 7) return ArtifactRarity.Legendary;
        else return ArtifactRarity.Mythic;
    }

    // planets can have multiple artifacts on them. this function updates all the
    // internal contract book-keeping to reflect that the given artifact was
    // put on. note that this function does not transfer the artifact.
    function _putArtifactOnPlanet(uint256 artifactId, uint256 locationId) public {
        gs().artifactIdToPlanetId[artifactId] = locationId;
        gs().planetArtifacts[locationId].push(artifactId);
    }

    // planets can have multiple artifacts on them. this function updates all the
    // internal contract book-keeping to reflect that the given artifact was
    // taken off the given planet. note that this function does not transfer the
    // artifact.
    //
    // if the given artifact is not on the given planet, reverts
    // if the given artifact is currently activated, reverts
    function _takeArtifactOffPlanet(uint256 artifactId, uint256 locationId) public {
        uint256 artifactsOnThisPlanet = gs().planetArtifacts[locationId].length;
        bool hadTheArtifact = false;

        for (uint256 i = 0; i < artifactsOnThisPlanet; i++) {
            if (gs().planetArtifacts[locationId][i] == artifactId) {
                Artifact memory artifact =
                    DFArtifactFacet(address(this)).getArtifact(gs().planetArtifacts[locationId][i]);

                require(
                    !isActivated(artifact),
                    "you cannot take an activated artifact off a planet"
                );

                gs().planetArtifacts[locationId][i] = gs().planetArtifacts[locationId][
                    artifactsOnThisPlanet - 1
                ];

                hadTheArtifact = true;
                break;
            }
        }

        require(hadTheArtifact, "this artifact was not present on this planet");
        gs().artifactIdToPlanetId[artifactId] = 0;
        gs().planetArtifacts[locationId].pop();
    }

    // an artifact is only considered 'activated' if this method returns true.
    // we do not have an `isActive` field on artifact; the times that the
    // artifact was last activated and deactivated are sufficent to determine
    // whether or not the artifact is activated.
    function isActivated(Artifact memory artifact) public pure returns (bool) {
        return artifact.lastDeactivated < artifact.lastActivated;
    }

    function isArtifactOnPlanet(uint256 locationId, uint256 artifactId) public returns (bool) {
        for (uint256 i; i < gs().planetArtifacts[locationId].length; i++) {
            if (gs().planetArtifacts[locationId][i] == artifactId) {
                return true;
            }
        }

        return false;
    }

    // if the given artifact is on the given planet, then return the artifact
    // otherwise, return a 'null' artifact
    function getPlanetArtifact(uint256 locationId, uint256 artifactId)
        public
        view
        returns (Artifact memory)
    {
        for (uint256 i; i < gs().planetArtifacts[locationId].length; i++) {
            if (gs().planetArtifacts[locationId][i] == artifactId) {
                return DFArtifactFacet(address(this)).getArtifact(artifactId);
            }
        }

        return _nullArtifact();
    }

    // if the given planet has an activated artifact on it, then return the artifact
    // otherwise, return a 'null artifact'
    function getActiveArtifact(uint256 locationId) public view returns (Artifact memory) {
        for (uint256 i; i < gs().planetArtifacts[locationId].length; i++) {
            Artifact memory artifact =
                DFArtifactFacet(address(this)).getArtifact(gs().planetArtifacts[locationId][i]);

            if (isActivated(artifact)) {
                return artifact;
            }
        }

        return _nullArtifact();
    }

    // the space junk that a planet starts with
    function getPlanetDefaultSpaceJunk(Planet memory planet) public view returns (uint256) {
        if (planet.isHomePlanet) return 0;

        return gameConstants().PLANET_LEVEL_JUNK[planet.planetLevel];
    }

    // constructs a new artifact whose `isInititalized` field is set to `false`
    // used to represent the concept of 'no artifact'
    function _nullArtifact() private pure returns (Artifact memory) {
        return
            Artifact(
                false,
                0,
                0,
                ArtifactRarity(0),
                Biome(0),
                0,
                address(0),
                ArtifactType(0),
                0,
                0,
                0,
                0,
                address(0)
            );
    }

    function _buffPlanet(uint256 location, Upgrade memory upgrade) public {
        Planet storage planet = gs().planets[location];

        planet.populationCap = (planet.populationCap * upgrade.popCapMultiplier) / 100;
        planet.populationGrowth = (planet.populationGrowth * upgrade.popGroMultiplier) / 100;
        planet.range = (planet.range * upgrade.rangeMultiplier) / 100;
        planet.speed = (planet.speed * upgrade.speedMultiplier) / 100;
        planet.defense = (planet.defense * upgrade.defMultiplier) / 100;
    }

    function _debuffPlanet(uint256 location, Upgrade memory upgrade) public {
        Planet storage planet = gs().planets[location];

        planet.populationCap = (planet.populationCap * 100) / upgrade.popCapMultiplier;
        planet.populationGrowth = (planet.populationGrowth * 100) / upgrade.popGroMultiplier;
        planet.range = (planet.range * 100) / upgrade.rangeMultiplier;
        planet.speed = (planet.speed * 100) / upgrade.speedMultiplier;
        planet.defense = (planet.defense * 100) / upgrade.defMultiplier;
    }

    // planets support a limited amount of incoming arrivals
    // the owner can send a maximum of 5 arrivals to this planet
    // separately, everyone other than the owner can also send a maximum
    // of 5 arrivals in aggregate
    function checkPlanetDOS(uint256 locationId, address sender) public view {
        uint8 arrivalsFromOwner = 0;
        uint8 arrivalsFromOthers = 0;

        for (uint8 i = 0; i < gs().planetEvents[locationId].length; i++) {
            if (gs().planetEvents[locationId][i].eventType == PlanetEventType.ARRIVAL) {
                if (
                    gs().planetArrivals[gs().planetEvents[locationId][i].id].player ==
                    gs().planets[locationId].owner
                ) {
                    arrivalsFromOwner++;
                } else {
                    arrivalsFromOthers++;
                }
            }
        }
        if (sender == gs().planets[locationId].owner) {
            require(arrivalsFromOwner < 6, "Planet is rate-limited");
        } else {
            require(arrivalsFromOthers < 6, "Planet is rate-limited");
        }

        require(arrivalsFromOwner + arrivalsFromOthers < 12, "Planet is rate-limited");
    }

    function updateWorldRadius() public {
        if (!gameConstants().WORLD_RADIUS_LOCKED) {
            gs().worldRadius = _getRadius();
        }
    }

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

    function isHalfSpaceJunk(uint256 _location) public pure returns (bool) {
        bytes memory _b = abi.encodePacked(_location);
        return uint256(uint8(_b[14])) < 16;
    }

    function _defaultPlanet(
        uint256 location,
        uint256 level,
        PlanetType planetType,
        SpaceType spaceType,
        uint256 TIME_FACTOR_HUNDREDTHS
    ) public view returns (Planet memory _planet) {
        PlanetDefaultStats storage _planetDefaultStats = LibStorage.planetDefaultStats()[level];

        bool deadSpace = spaceType == SpaceType.DEAD_SPACE;
        bool deepSpace = spaceType == SpaceType.DEEP_SPACE;
        bool mediumSpace = spaceType == SpaceType.SPACE;

        _planet.owner = address(0);
        _planet.planetLevel = level;

        _planet.populationCap = _planetDefaultStats.populationCap;
        _planet.populationGrowth = _planetDefaultStats.populationGrowth;
        _planet.range = _planetDefaultStats.range;
        _planet.speed = _planetDefaultStats.speed;
        _planet.defense = _planetDefaultStats.defense;
        _planet.silverCap = _planetDefaultStats.silverCap;

        if (planetType == PlanetType.SILVER_MINE) {
            _planet.silverGrowth = _planetDefaultStats.silverGrowth;
        }

        if (isPopCapBoost(location)) {
            _planet.populationCap *= 2;
        }
        if (isPopGroBoost(location)) {
            _planet.populationGrowth *= 2;
        }
        if (isRangeBoost(location)) {
            _planet.range *= 2;
        }
        if (isSpeedBoost(location)) {
            _planet.speed *= 2;
        }
        if (isDefBoost(location)) {
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
        _planet.planetType = planetType;

        if (planetType == PlanetType.SILVER_MINE) {
            _planet.silverCap *= 2;
            _planet.defense /= 2;
        } else if (planetType == PlanetType.SILVER_BANK) {
            _planet.speed /= 2;
            _planet.silverCap *= 10;
            _planet.populationGrowth = 0;
            _planet.populationCap *= 5;
        } else if (planetType == PlanetType.TRADING_POST) {
            _planet.defense /= 2;
            _planet.silverCap *= 2;
        }

        // initial population (pirates) and silver
        _planet.population =
            (_planet.populationCap * _planetDefaultStats.barbarianPercentage) /
            100;

        // pirates adjusted for def debuffs, and buffed in space/deepspace
        if (deadSpace) {
            _planet.population *= 20;
        } else if (deepSpace) {
            _planet.population *= 10;
        } else if (mediumSpace) {
            _planet.population *= 4;
        }
        if (planetType == PlanetType.SILVER_BANK) {
            _planet.population /= 2;
        }

        // Adjust silver cap for mine
        if (planetType == PlanetType.SILVER_MINE) {
            _planet.silver = _planet.silverCap / 2;
        }

        // apply time factor
        _planet.speed *= TIME_FACTOR_HUNDREDTHS / 100;
        _planet.populationGrowth *= TIME_FACTOR_HUNDREDTHS / 100;
        _planet.silverGrowth *= TIME_FACTOR_HUNDREDTHS / 100;
    }
}
