// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./Whitelist.sol";
import "./DarkForestTokens.sol";

library DarkForestTypes {
    enum PlanetType {PLANET, SILVER_MINE, RUINS, TRADING_POST, SILVER_BANK}
    enum PlanetEventType {ARRIVAL}
    enum SpaceType {NEBULA, SPACE, DEEP_SPACE, DEAD_SPACE}
    enum UpgradeBranch {DEFENSE, RANGE, SPEED}

    struct Player {
        bool isInitialized;
        address player;
        uint256 initTimestamp;
        uint256 homePlanetId;
        uint256 lastRevealTimestamp;
        uint256 score; // temporary for round 4
    }

    struct Planet {
        address owner;
        uint256 range;
        uint256 speed;
        uint256 defense;
        uint256 population;
        uint256 populationCap;
        uint256 populationGrowth;
        uint256 silverCap;
        uint256 silverGrowth;
        uint256 silver;
        uint256 planetLevel;
        PlanetType planetType;
        bool isHomePlanet;
    }

    struct RevealedCoords {
        uint256 locationId;
        uint256 x;
        uint256 y;
        address revealer;
    }

    struct PlanetExtendedInfo {
        bool isInitialized;
        uint256 createdAt;
        uint256 lastUpdated;
        uint256 perlin;
        SpaceType spaceType;
        uint256 upgradeState0;
        uint256 upgradeState1;
        uint256 upgradeState2;
        uint256 hatLevel;
        bool hasTriedFindingArtifact;
        uint256 prospectedBlockNumber;
        bool destroyed;
    }

    // For DFGetters
    struct PlanetData {
        Planet planet;
        PlanetExtendedInfo info;
        RevealedCoords revealedCoords;
    }

    struct AdminCreatePlanetArgs {
        uint256 location;
        uint256 perlin;
        uint256 level;
        PlanetType planetType;
        bool requireValidLocationId;
    }

    struct PlanetEventMetadata {
        uint256 id;
        PlanetEventType eventType;
        uint256 timeTrigger;
        uint256 timeAdded;
    }

    enum ArrivalType {Unknown, Normal, Photoid, Wormhole}

    // SNARK keys and perlin params
    struct SnarkConstants {
        bool DISABLE_ZK_CHECKS;
        uint256 PLANETHASH_KEY;
        uint256 SPACETYPE_KEY;
        uint256 BIOMEBASE_KEY;
        bool PERLIN_MIRROR_X;
        bool PERLIN_MIRROR_Y;
        uint256 PERLIN_LENGTH_SCALE; // must be a power of two up to 8192
    }

    // Game config
    // This struct is ~1 properties from maximum struct size
    struct GameConstants {
        uint256 MAX_NATURAL_PLANET_LEVEL;
        uint256 TIME_FACTOR_HUNDREDTHS; // speedup/slowdown game
        uint256 PERLIN_THRESHOLD_1;
        uint256 PERLIN_THRESHOLD_2;
        uint256 PERLIN_THRESHOLD_3;
        uint256 INIT_PERLIN_MIN;
        uint256 INIT_PERLIN_MAX;
        uint256 SPAWN_RIM_AREA;
        uint256 BIOME_THRESHOLD_1;
        uint256 BIOME_THRESHOLD_2;
        uint256 PLANET_RARITY;
        uint256 PHOTOID_ACTIVATION_DELAY;
        uint256 LOCATION_REVEAL_COOLDOWN;
        uint8[5][10][4] PLANET_TYPE_WEIGHTS; // spaceType (enum 0-3) -> planetLevel (0-7) -> planetType (enum 0-4)
        uint256[6] ARTIFACT_POINT_VALUES;
    }

    struct DFInitArgs {
        bool ADMIN_CAN_ADD_PLANETS;
        bool WORLD_RADIUS_LOCKED;
        uint256 LOCATION_REVEAL_COOLDOWN;
        uint256 TOKEN_MINT_END_TIMESTAMP;
        uint256 TARGET4_RADIUS;
        uint256 INITIAL_WORLD_RADIUS;
        // SNARK keys and perlin params
        bool DISABLE_ZK_CHECKS;
        uint256 PLANETHASH_KEY;
        uint256 SPACETYPE_KEY;
        uint256 BIOMEBASE_KEY;
        bool PERLIN_MIRROR_X;
        bool PERLIN_MIRROR_Y;
        uint256 PERLIN_LENGTH_SCALE; // must be a power of two up to 8192
        // Game config
        uint256 MAX_NATURAL_PLANET_LEVEL;
        uint256 TIME_FACTOR_HUNDREDTHS; // speedup/slowdown game
        uint256 PERLIN_THRESHOLD_1;
        uint256 PERLIN_THRESHOLD_2;
        uint256 PERLIN_THRESHOLD_3;
        uint256 INIT_PERLIN_MIN;
        uint256 INIT_PERLIN_MAX;
        uint256 SPAWN_RIM_AREA;
        uint256 BIOME_THRESHOLD_1;
        uint256 BIOME_THRESHOLD_2;
        uint256 PLANET_RARITY;
        uint8[5][10][4] PLANET_TYPE_WEIGHTS; // spaceType (enum 0-3) -> planetLevel (0-7) -> planetType (enum 0-4)
        uint256[6] ARTIFACT_POINT_VALUES;
        uint256 PHOTOID_ACTIVATION_DELAY;
    }

    struct DFPInitPlanetArgs {
        uint256 location;
        uint256 perlin;
        uint256 level;
        uint256 TIME_FACTOR_HUNDREDTHS;
        SpaceType spaceType;
        PlanetType planetType;
        bool isHomePlanet;
    }

    struct DFPMoveArgs {
        uint256 oldLoc;
        uint256 newLoc;
        uint256 maxDist;
        uint256 popMoved;
        uint256 silverMoved;
        uint256 movedArtifactId;
    }

    struct DFPFindArtifactArgs {
        uint256 planetId;
        uint256 biomebase;
        address coreAddress;
    }

    struct DFPCreateArrivalArgs {
        uint256 oldLoc;
        uint256 newLoc;
        uint256 actualDist;
        uint256 effectiveDistTimesHundred;
        uint256 popMoved;
        uint256 silverMoved;
        uint256 travelTime;
        uint256 movedArtifactId;
        ArrivalType arrivalType;
    }

    struct DFTCreateArtifactArgs {
        uint256 tokenId;
        address discoverer;
        uint256 planetId;
        ArtifactRarity rarity;
        Biome biome;
        ArtifactType artifactType;
        address owner;
    }

    struct ArrivalData {
        uint256 id;
        address player;
        uint256 fromPlanet;
        uint256 toPlanet;
        uint256 popArriving;
        uint256 silverMoved;
        uint256 departureTime;
        uint256 arrivalTime;
        ArrivalType arrivalType;
        uint256 carriedArtifactId;
        uint256 distance;
    }

    struct PlanetDefaultStats {
        string label;
        uint256 populationCap;
        uint256 populationGrowth;
        uint256 range;
        uint256 speed;
        uint256 defense;
        uint256 silverGrowth;
        uint256 silverCap;
        uint256 barbarianPercentage;
    }

    struct Upgrade {
        uint256 popCapMultiplier;
        uint256 popGroMultiplier;
        uint256 rangeMultiplier;
        uint256 speedMultiplier;
        uint256 defMultiplier;
    }

    // for NFTs
    enum ArtifactType {
        Unknown,
        Monolith,
        Colossus,
        Spaceship,
        Pyramid,
        Wormhole,
        PlanetaryShield,
        PhotoidCannon,
        BloomFilter,
        BlackDomain
    }

    enum ArtifactRarity {Unknown, Common, Rare, Epic, Legendary, Mythic}

    // for NFTs
    struct Artifact {
        bool isInitialized;
        uint256 id;
        uint256 planetDiscoveredOn;
        ArtifactRarity rarity;
        Biome planetBiome;
        uint256 mintedAtTimestamp;
        address discoverer;
        ArtifactType artifactType;
        // an artifact is 'activated' iff lastActivated > lastDeactivated
        uint256 lastActivated;
        uint256 lastDeactivated;
        uint256 wormholeTo; // location id
    }

    // for artifact getters

    struct ArtifactWithMetadata {
        Artifact artifact;
        Upgrade upgrade;
        Upgrade timeDelayedUpgrade; // for photoid canons specifically.
        address owner;
        uint256 locationId; // 0 if planet is not deposited into contract or is on a voyage
        uint256 voyageId; // 0 is planet is not deposited into contract or is on a planet
    }

    enum Biome {
        Unknown,
        Ocean,
        Forest,
        Grassland,
        Tundra,
        Swamp,
        Desert,
        Ice,
        Wasteland,
        Lava,
        Corrupted
    }

    struct GameStorage {
        // Contract housekeeping
        address adminAddress;
        Whitelist whitelist;
        DarkForestTokens tokens;
        // admin controls
        bool paused;
        bool ADMIN_CAN_ADD_PLANETS;
        bool WORLD_RADIUS_LOCKED;
        uint256 TOKEN_MINT_END_TIMESTAMP;
        uint256 TARGET4_RADIUS;
        // Game configuration
        DarkForestTypes.SnarkConstants snarkConstants;
        DarkForestTypes.GameConstants gameConstants;
        uint256 planetLevelsCount;
        uint256[] planetLevelThresholds;
        uint256[] cumulativeRarities;
        uint256[] initializedPlanetCountByLevel;
        DarkForestTypes.PlanetDefaultStats[] planetDefaultStats;
        DarkForestTypes.Upgrade[4][3] upgrades;
        // Game world state
        uint256[] planetIds;
        uint256[] revealedPlanetIds;
        address[] playerIds;
        uint256 worldRadius;
        uint256 planetEventsCount;
        mapping(uint256 => DarkForestTypes.Planet) planets;
        mapping(uint256 => DarkForestTypes.RevealedCoords) revealedCoords;
        mapping(uint256 => DarkForestTypes.PlanetExtendedInfo) planetsExtendedInfo;
        mapping(uint256 => uint256) artifactIdToPlanetId;
        mapping(uint256 => uint256) artifactIdToVoyageId;
        mapping(address => Player) players;
        // maps location id to planet events array
        mapping(uint256 => PlanetEventMetadata[]) planetEvents;
        // maps event id to arrival data
        mapping(uint256 => ArrivalData) planetArrivals;
        mapping(uint256 => uint256[]) planetArtifacts;
    }
}
