// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.9;

// Import base Initializable contract
import "./DarkForestTypes.sol";
import "./Whitelist.sol";

contract DarkForestStorageV1 {
    // Contract housekeeping
    address public adminAddress;
    Whitelist whitelist;
    bool public paused;

    // Game config
    uint256 public VERSION;
    bool public DISABLE_ZK_CHECK;
    uint256 public constant PERLIN_THRESHOLD = 18;
    uint256 public constant GLOBAL_SPEED_IN_HUNDRETHS = 75;
    uint256 public constant PLANET_RARITY = 16384;
    uint256 public constant ENERGY_PER_SECOND = 17;
    uint256 public constant ENERGY_CAP = 200000;
    uint256 public constant TRADING_POST_RARITY = 16;
    uint256 public constant SILVER_RARITY = 4;
    uint256 public constant TRADING_POST_BARBARIANS = 50;

    // Default planet type stats
    uint256[] public planetLevelThresholds;
    uint256[] public planetTypeThresholds;
    uint256[] public cumulativeRarities;
    uint256[] public initializedPlanetCountByLevel;
    DarkForestTypes.PlanetDefaultStats[] public planetDefaultStats;
    DarkForestTypes.Upgrade[4][3] public upgrades;

    // Game world state
    uint256 gameEndTimestamp;
    uint256 target4RadiusConstant;
    uint256 target5RadiusConstant;
    uint256[] public planetIds;
    address[] public playerIds;
    uint256 public worldRadius;
    uint256 public planetEventsCount;
    mapping(uint256 => DarkForestTypes.Planet) public planets;
    mapping(uint256 => DarkForestTypes.PlanetExtendedInfo)
        public planetsExtendedInfo;
    mapping(address => bool) public isPlayerInitialized;

    // maps location id to planet events array
    mapping(uint256 => DarkForestTypes.PlanetEventMetadata[])
        public planetEvents;

    // maps event id to arrival data
    mapping(uint256 => DarkForestTypes.ArrivalData) public planetArrivals;

    // no-op for now since no player energy
    // mapping(address => DarkForestTypes.PlayerInfo) public playerInfos;
}
