// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.9;

library DarkForestTypes {
    enum PlanetResource {NONE, SILVER}
    enum PlanetEventType {ARRIVAL}
    enum SpaceType {NEBULA, SPACE, DEEP_SPACE}

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
        address[] delegatedPlayers;
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
}
