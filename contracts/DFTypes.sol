// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

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
    uint256 score;
    uint256 spaceJunk;
    uint256 spaceJunkLimit;
    bool claimedShips;
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
    uint256 spaceJunk;
}

struct PlanetExtendedInfo2 {
    bool isInitialized;
    uint256 pausers;
    address invader;
    uint256 invadeStartBlock;
    address capturer;
}

// For DFGetters
struct PlanetData {
    Planet planet;
    PlanetExtendedInfo info;
    PlanetExtendedInfo2 info2;
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
    uint256 abandoning;
    address sender;
}

struct DFPFindArtifactArgs {
    uint256 planetId;
    uint256 biomebase;
    address coreAddress;
}

struct DFPCreateArrivalArgs {
    address player;
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
    // Only used for spaceships
    address controller;
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
    BlackDomain,
    ShipMothership,
    ShipCrescent,
    ShipWhale,
    ShipGear,
    ShipTitan
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
    uint256 activations;
    uint256 lastActivated;
    uint256 lastDeactivated;
    uint256 wormholeTo; // location id
    address controller; // space ships can be controlled regardless of which planet they're on
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
