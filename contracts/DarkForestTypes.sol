// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.9;

library DarkForestTypes {
    enum PlanetResource {NONE, SILVER}
    enum PlanetEventType {ARRIVAL}
    enum SpaceType {NEBULA, SPACE, DEEP_SPACE}
    enum UpgradeBranch {DEFENSE, RANGE, SPEED}

    struct Planet {
        address owner;
        uint256 range;
        uint256 speed;
        uint256 defense;
        uint256 population;
        uint256 populationCap;
        uint256 populationGrowth;
        PlanetResource planetResource;
        uint256 silverCap;
        uint256 silverGrowth;
        uint256 silver;
        uint256 planetLevel;
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
        uint256 heldArtifactId;
        uint256 artifactLockedTimestamp;
    }

    struct PlanetEventMetadata {
        uint256 id;
        PlanetEventType eventType;
        uint256 timeTrigger;
        uint256 timeAdded;
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
    }

    // for a utility getter - not used for any mutations
    struct CompactArrival {
        uint256 popArriving;
        uint256 silverMoved;
        uint256 departureTime;
        uint256 arrivalTime;
        uint256 fromPlanet;
        address fromPlanetOwner;
        uint256 fromPlanetPopulation;
        uint256 fromPlanetSilver;
        uint256 toPlanet;
        address toPlanetOwner;
        uint256 toPlanetPopulation;
        uint256 toPlanetSilver;
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
    enum ArtifactType {Unknown, Monolith, Colossus, Spaceship, Pyramid}

    // for NFTs
    struct Artifact {
        uint256 id;
        uint256 planetDiscoveredOn;
        uint256 planetLevel;
        Biome planetBiome;
        uint256 mintedAtTimestamp;
        address discoverer;
        ArtifactType artifactType;
    }

    // for artifact getters

    struct ArtifactWithMetadata {
        Artifact artifact;
        Upgrade upgrade;
        address owner;
        uint256 locationId; // 0 if planet is not deposited into contract
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
        Lava
    }
}
