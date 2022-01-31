// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

// Libraries
import "./ABDKMath64x64.sol";
import "./DarkForestTypes.sol";
import "./DarkForestTokens.sol";

library DarkForestUtils {
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
                s().gameConstants.PLANET_RARITY));
    }

    // if you don't check the public input snark perlin config values, then a player could specify a planet with for example the wrong PLANETHASH_KEY and the SNARK would verify but they'd have created an invalid planet.
    // the zkSNARK verification function checks that the SNARK proof is valid; a valid proof might be "i know the existence of a planet at secret coords with address 0x123456... and mimc key 42". but if this universe's mimc key is 43 this is still an invalid planet, so we have to check that this SNARK proof is a proof for the right mimc key (and spacetype key, perlin length scale, etc.)
    function revertIfBadSnarkPerlinFlags(uint256[5] memory perlinFlags, bool checkingBiome)
        public
        view
        returns (bool)
    {
        require(perlinFlags[0] == s().snarkConstants.PLANETHASH_KEY, "bad planethash mimc key");
        if (checkingBiome) {
            require(perlinFlags[1] == s().snarkConstants.BIOMEBASE_KEY, "bad spacetype mimc key");
        } else {
            require(perlinFlags[1] == s().snarkConstants.SPACETYPE_KEY, "bad spacetype mimc key");
        }
        require(
            perlinFlags[2] == s().snarkConstants.PERLIN_LENGTH_SCALE,
            "bad perlin length scale"
        );
        require((perlinFlags[3] == 1) == s().snarkConstants.PERLIN_MIRROR_X, "bad perlin mirror x");
        require((perlinFlags[4] == 1) == s().snarkConstants.PERLIN_MIRROR_Y, "bad perlin mirror y");

        return true;
    }

    function spaceTypeFromPerlin(uint256 perlin) public view returns (DarkForestTypes.SpaceType) {
        if (perlin >= s().gameConstants.PERLIN_THRESHOLD_3) {
            return DarkForestTypes.SpaceType.DEAD_SPACE;
        } else if (perlin >= s().gameConstants.PERLIN_THRESHOLD_2) {
            return DarkForestTypes.SpaceType.DEEP_SPACE;
        } else if (perlin >= s().gameConstants.PERLIN_THRESHOLD_1) {
            return DarkForestTypes.SpaceType.SPACE;
        }
        return DarkForestTypes.SpaceType.NEBULA;
    }

    function _getPlanetLevelTypeAndSpaceType(uint256 _location, uint256 _perlin)
        public
        view
        returns (
            uint256,
            DarkForestTypes.PlanetType,
            DarkForestTypes.SpaceType
        )
    {
        DarkForestTypes.SpaceType spaceType = spaceTypeFromPerlin(_perlin);

        bytes memory _b = abi.encodePacked(_location);

        // get the uint value of byte 4 - 6
        uint256 _planetLevelUInt = _calculateByteUInt(_b, 4, 6);
        uint256 level;

        // reverse-iterate thresholds and return planet type accordingly
        for (uint256 i = (s().planetLevelThresholds.length - 1); i >= 0; i--) {
            if (_planetLevelUInt < s().planetLevelThresholds[i]) {
                level = i;
                break;
            }
        }

        if (spaceType == DarkForestTypes.SpaceType.NEBULA && level > 4) {
            // clip level to <= 3 if in nebula
            level = 4;
        }
        if (spaceType == DarkForestTypes.SpaceType.SPACE && level > 5) {
            // clip level to <= 4 if in space
            level = 5;
        }

        // clip level to <= MAX_NATURAL_PLANET_LEVEL
        if (level > s().gameConstants.MAX_NATURAL_PLANET_LEVEL) {
            level = s().gameConstants.MAX_NATURAL_PLANET_LEVEL;
        }

        // get planet type
        DarkForestTypes.PlanetType planetType = DarkForestTypes.PlanetType.PLANET;
        uint8[5] memory weights = s().gameConstants.PLANET_TYPE_WEIGHTS[uint8(spaceType)][level];
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
                planetType = DarkForestTypes.PlanetType(i);
                break;
            }
        }

        return (level, planetType, spaceType);
    }

    function _getRadius() public view returns (uint256) {
        uint256 nPlayers = s().playerIds.length;

        // TODO: SPECIAL FOR ROUND 3. Revert this change for future rounds
        // in round 3, the universe starts at ~300k radius, and expands by a
        // fixed amount for every player who joins the game.
        uint256 target4 = s().TARGET4_RADIUS + 40 * nPlayers;

        uint256 targetRadiusSquared4 = (target4 * s().cumulativeRarities[4] * 100) / 314;
        uint256 r4 =
            ABDKMath64x64.toUInt(ABDKMath64x64.sqrt(ABDKMath64x64.fromUInt(targetRadiusSquared4)));
        return r4;
    }

    function _randomArtifactTypeAndLevelBonus(
        uint256 artifactSeed,
        DarkForestTypes.Biome biome,
        DarkForestTypes.SpaceType spaceType
    ) internal pure returns (DarkForestTypes.ArtifactType, uint256) {
        uint256 lastByteOfSeed = artifactSeed % 0xFF;
        uint256 secondLastByteOfSeed = ((artifactSeed - lastByteOfSeed) / 256) % 0xFF;

        DarkForestTypes.ArtifactType artifactType = DarkForestTypes.ArtifactType.Pyramid;

        if (lastByteOfSeed < 39) {
            artifactType = DarkForestTypes.ArtifactType.Monolith;
        } else if (lastByteOfSeed < 78) {
            artifactType = DarkForestTypes.ArtifactType.Colossus;
        } else if (lastByteOfSeed < 117) {
            artifactType = DarkForestTypes.ArtifactType.Spaceship;
        } else if (lastByteOfSeed < 156) {
            artifactType = DarkForestTypes.ArtifactType.Pyramid;
        } else if (lastByteOfSeed < 171) {
            artifactType = DarkForestTypes.ArtifactType.Wormhole;
        } else if (lastByteOfSeed < 186) {
            artifactType = DarkForestTypes.ArtifactType.PlanetaryShield;
        } else if (lastByteOfSeed < 201) {
            artifactType = DarkForestTypes.ArtifactType.PhotoidCannon;
        } else if (lastByteOfSeed < 216) {
            artifactType = DarkForestTypes.ArtifactType.BloomFilter;
        } else if (lastByteOfSeed < 231) {
            artifactType = DarkForestTypes.ArtifactType.BlackDomain;
        } else {
            // Commented out for v6 Round 3
            // if (biome == DarkForestTypes.Biome.Ice) {
            //     artifactType = DarkForestTypes.ArtifactType.PlanetaryShield;
            // } else if (biome == DarkForestTypes.Biome.Lava) {
            //     artifactType = DarkForestTypes.ArtifactType.PhotoidCannon;
            // } else if (biome == DarkForestTypes.Biome.Wasteland) {
            //     artifactType = DarkForestTypes.ArtifactType.BloomFilter;
            // } else if (biome == DarkForestTypes.Biome.Corrupted) {
            //     artifactType = DarkForestTypes.ArtifactType.BlackDomain;
            // } else {
            //     artifactType = DarkForestTypes.ArtifactType.Wormhole;
            // }
            artifactType = DarkForestTypes.ArtifactType.PhotoidCannon;
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
    function _getBiome(DarkForestTypes.SpaceType spaceType, uint256 biomebase)
        public
        view
        returns (DarkForestTypes.Biome)
    {
        if (spaceType == DarkForestTypes.SpaceType.DEAD_SPACE) {
            return DarkForestTypes.Biome.Corrupted;
        }

        uint256 biome = 3 * uint256(spaceType);
        if (biomebase < s().gameConstants.BIOME_THRESHOLD_1) biome += 1;
        else if (biomebase < s().gameConstants.BIOME_THRESHOLD_2) biome += 2;
        else biome += 3;

        return DarkForestTypes.Biome(biome);
    }

    function defaultUpgrade() public pure returns (DarkForestTypes.Upgrade memory) {
        return
            DarkForestTypes.Upgrade({
                popCapMultiplier: 100,
                popGroMultiplier: 100,
                rangeMultiplier: 100,
                speedMultiplier: 100,
                defMultiplier: 100
            });
    }

    function timeDelayUpgrade(DarkForestTypes.Artifact memory artifact)
        public
        pure
        returns (DarkForestTypes.Upgrade memory)
    {
        if (artifact.artifactType == DarkForestTypes.ArtifactType.PhotoidCannon) {
            uint256[6] memory range = [uint256(100), 200, 200, 200, 200, 200];
            uint256[6] memory speedBoosts = [uint256(100), 500, 1000, 1500, 2000, 2500];
            return
                DarkForestTypes.Upgrade({
                    popCapMultiplier: 100,
                    popGroMultiplier: 100,
                    rangeMultiplier: range[uint256(artifact.rarity)],
                    speedMultiplier: speedBoosts[uint256(artifact.rarity)],
                    defMultiplier: 100
                });
        }

        return defaultUpgrade();
    }

    function _getUpgradeForArtifact(DarkForestTypes.Artifact memory artifact)
        public
        pure
        returns (DarkForestTypes.Upgrade memory)
    {
        if (artifact.artifactType == DarkForestTypes.ArtifactType.PlanetaryShield) {
            uint256[6] memory defenseMultipliersPerRarity = [uint256(100), 150, 200, 300, 450, 650];

            return
                DarkForestTypes.Upgrade({
                    popCapMultiplier: 100,
                    popGroMultiplier: 100,
                    rangeMultiplier: 20,
                    speedMultiplier: 20,
                    defMultiplier: defenseMultipliersPerRarity[uint256(artifact.rarity)]
                });
        }

        if (artifact.artifactType == DarkForestTypes.ArtifactType.PhotoidCannon) {
            uint256[6] memory def = [uint256(100), 50, 40, 30, 20, 10];
            return
                DarkForestTypes.Upgrade({
                    popCapMultiplier: 100,
                    popGroMultiplier: 100,
                    rangeMultiplier: 100,
                    speedMultiplier: 100,
                    defMultiplier: def[uint256(artifact.rarity)]
                });
        }

        if (uint256(artifact.artifactType) >= 5) {
            return
                DarkForestTypes.Upgrade({
                    popCapMultiplier: 100,
                    popGroMultiplier: 100,
                    rangeMultiplier: 100,
                    speedMultiplier: 100,
                    defMultiplier: 100
                });
        }

        DarkForestTypes.Upgrade memory ret =
            DarkForestTypes.Upgrade({
                popCapMultiplier: 100,
                popGroMultiplier: 100,
                rangeMultiplier: 100,
                speedMultiplier: 100,
                defMultiplier: 100
            });

        if (artifact.artifactType == DarkForestTypes.ArtifactType.Monolith) {
            ret.popCapMultiplier += 5;
            ret.popGroMultiplier += 5;
        } else if (artifact.artifactType == DarkForestTypes.ArtifactType.Colossus) {
            ret.speedMultiplier += 5;
        } else if (artifact.artifactType == DarkForestTypes.ArtifactType.Spaceship) {
            ret.rangeMultiplier += 5;
        } else if (artifact.artifactType == DarkForestTypes.ArtifactType.Pyramid) {
            ret.defMultiplier += 5;
        }

        if (artifact.planetBiome == DarkForestTypes.Biome.Ocean) {
            ret.speedMultiplier += 5;
            ret.defMultiplier += 5;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Forest) {
            ret.defMultiplier += 5;
            ret.popCapMultiplier += 5;
            ret.popGroMultiplier += 5;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Grassland) {
            ret.popCapMultiplier += 5;
            ret.popGroMultiplier += 5;
            ret.rangeMultiplier += 5;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Tundra) {
            ret.defMultiplier += 5;
            ret.rangeMultiplier += 5;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Swamp) {
            ret.speedMultiplier += 5;
            ret.rangeMultiplier += 5;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Desert) {
            ret.speedMultiplier += 10;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Ice) {
            ret.rangeMultiplier += 10;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Wasteland) {
            ret.defMultiplier += 10;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Lava) {
            ret.popCapMultiplier += 10;
            ret.popGroMultiplier += 10;
        } else if (artifact.planetBiome == DarkForestTypes.Biome.Corrupted) {
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
        returns (DarkForestTypes.ArtifactRarity)
    {
        if (planetLevel <= 1) return DarkForestTypes.ArtifactRarity.Common;
        else if (planetLevel <= 3) return DarkForestTypes.ArtifactRarity.Rare;
        else if (planetLevel <= 5) return DarkForestTypes.ArtifactRarity.Epic;
        else if (planetLevel <= 7) return DarkForestTypes.ArtifactRarity.Legendary;
        else return DarkForestTypes.ArtifactRarity.Mythic;
    }

    // planets can have multiple artifacts on them. this function updates all the
    // internal contract book-keeping to reflect that the given artifact was
    // put on. note that this function does not transfer the artifact.
    function _putArtifactOnPlanet(uint256 artifactId, uint256 locationId) public {
        s().artifactIdToPlanetId[artifactId] = locationId;
        s().planetArtifacts[locationId].push(artifactId);
    }

    // planets can have multiple artifacts on them. this function updates all the
    // internal contract book-keeping to reflect that the given artifact was
    // taken off the given planet. note that this function does not transfer the
    // artifact.
    //
    // if the given artifact is not on the given planet, reverts
    // if the given artifact is currently activated, reverts
    function _takeArtifactOffPlanet(uint256 artifactId, uint256 locationId) public {
        uint256 artifactsOnThisPlanet = s().planetArtifacts[locationId].length;
        bool hadTheArtifact = false;

        for (uint256 i = 0; i < artifactsOnThisPlanet; i++) {
            if (s().planetArtifacts[locationId][i] == artifactId) {
                DarkForestTypes.Artifact memory artifact =
                    s().tokens.getArtifact(s().planetArtifacts[locationId][i]);

                require(
                    !isActivated(artifact),
                    "you cannot take an activated artifact off a planet"
                );

                s().planetArtifacts[locationId][i] = s().planetArtifacts[locationId][
                    artifactsOnThisPlanet - 1
                ];

                hadTheArtifact = true;
                break;
            }
        }

        require(hadTheArtifact, "this artifact was not present on this planet");
        s().artifactIdToPlanetId[artifactId] = 0;
        s().planetArtifacts[locationId].pop();
    }

    // an artifact is only considered 'activated' if this method returns true.
    // we do not have an `isActive` field on artifact; the times that the
    // artifact was last activated and deactivated are sufficent to determine
    // whether or not the artifact is activated.
    function isActivated(DarkForestTypes.Artifact memory artifact) public pure returns (bool) {
        return artifact.lastDeactivated < artifact.lastActivated;
    }

    // if the given artifact is on the given planet, then return the artifact
    // otherwise, return a 'null' artifact
    function getPlanetArtifact(uint256 locationId, uint256 artifactId)
        public
        view
        returns (DarkForestTypes.Artifact memory)
    {
        for (uint256 i; i < s().planetArtifacts[locationId].length; i++) {
            if (s().planetArtifacts[locationId][i] == artifactId) {
                return s().tokens.getArtifact(artifactId);
            }
        }

        return _nullArtifact();
    }

    // if the given planet has an activated artifact on it, then return the artifact
    // otherwise, return a 'null artifact'
    function getActiveArtifact(uint256 locationId)
        public
        view
        returns (DarkForestTypes.Artifact memory)
    {
        for (uint256 i; i < s().planetArtifacts[locationId].length; i++) {
            DarkForestTypes.Artifact memory artifact =
                s().tokens.getArtifact(s().planetArtifacts[locationId][i]);

            if (isActivated(artifact)) {
                return artifact;
            }
        }

        return _nullArtifact();
    }

    // constructs a new artifact whose `isInititalized` field is set to `false`
    // used to represent the concept of 'no artifact'
    function _nullArtifact() private pure returns (DarkForestTypes.Artifact memory) {
        return
            DarkForestTypes.Artifact(
                false,
                0,
                0,
                DarkForestTypes.ArtifactRarity(0),
                DarkForestTypes.Biome(0),
                0,
                address(0),
                DarkForestTypes.ArtifactType(0),
                0,
                0,
                0
            );
    }

    function _buffPlanet(uint256 location, DarkForestTypes.Upgrade memory upgrade) public {
        DarkForestTypes.Planet storage planet = s().planets[location];

        planet.populationCap = (planet.populationCap * upgrade.popCapMultiplier) / 100;
        planet.populationGrowth = (planet.populationGrowth * upgrade.popGroMultiplier) / 100;
        planet.range = (planet.range * upgrade.rangeMultiplier) / 100;
        planet.speed = (planet.speed * upgrade.speedMultiplier) / 100;
        planet.defense = (planet.defense * upgrade.defMultiplier) / 100;
    }

    function _debuffPlanet(uint256 location, DarkForestTypes.Upgrade memory upgrade) public {
        DarkForestTypes.Planet storage planet = s().planets[location];

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
    function checkPlanetDOS(uint256 locationId) public view {
        uint8 arrivalsFromOwner = 0;
        uint8 arrivalsFromOthers = 0;

        for (uint8 i = 0; i < s().planetEvents[locationId].length; i++) {
            if (
                s().planetEvents[locationId][i].eventType == DarkForestTypes.PlanetEventType.ARRIVAL
            ) {
                if (
                    s().planetArrivals[s().planetEvents[locationId][i].id].player ==
                    s().planets[locationId].owner
                ) {
                    arrivalsFromOwner++;
                } else {
                    arrivalsFromOthers++;
                }
            }
        }
        if (msg.sender == s().planets[locationId].owner) {
            require(arrivalsFromOwner < 6, "Planet is rate-limited");
        } else {
            require(arrivalsFromOthers < 6, "Planet is rate-limited");
        }
    }
}
