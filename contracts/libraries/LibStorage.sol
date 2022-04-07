// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// Type imports
import {
    Planet,
    PlanetExtendedInfo,
    PlanetExtendedInfo2,
    PlanetEventMetadata,
    PlanetDefaultStats,
    Upgrade,
    RevealedCoords,
    Player,
    ArrivalData,
    Artifact
} from "../DFTypes.sol";

struct WhitelistStorage {
    bool enabled;
    uint256 drip;
    mapping(address => bool) allowedAccounts;
    // TODO Delete this when we re-deploy a fresh contract
    mapping(bytes32 => bool) allowedKeyHashes;
    address[] allowedAccountsArray;
    bool relayerRewardsEnabled;
    uint256 relayerReward;
    // This is needed to be upgrade-safe because we can't
    // change the data type of the existing allowedKeyHashes
    // TODO When we delete the old one, this becomes the only
    // mapping.
    mapping(uint256 => bool) newAllowedKeyHashes;
}

struct GameStorage {
    // Contract housekeeping
    address diamondAddress;
    // admin controls
    bool paused;
    uint256 TOKEN_MINT_END_TIMESTAMP;
    uint256 planetLevelsCount;
    uint256[] planetLevelThresholds;
    uint256[] cumulativeRarities;
    uint256[] initializedPlanetCountByLevel;
    // Game world state
    uint256[] planetIds;
    uint256[] revealedPlanetIds;
    address[] playerIds;
    uint256 worldRadius;
    uint256 planetEventsCount;
    uint256 miscNonce;
    mapping(uint256 => Planet) planets;
    mapping(uint256 => RevealedCoords) revealedCoords;
    mapping(uint256 => PlanetExtendedInfo) planetsExtendedInfo;
    mapping(uint256 => PlanetExtendedInfo2) planetsExtendedInfo2;
    mapping(uint256 => uint256) artifactIdToPlanetId;
    mapping(uint256 => uint256) artifactIdToVoyageId;
    mapping(address => Player) players;
    // maps location id to planet events array
    mapping(uint256 => PlanetEventMetadata[]) planetEvents;
    // maps event id to arrival data
    mapping(uint256 => ArrivalData) planetArrivals;
    mapping(uint256 => uint256[]) planetArtifacts;
    // Artifact stuff
    mapping(uint256 => Artifact) artifacts;
    // Capture Zones
    uint256 nextChangeBlock;
}

// Game config
struct GameConstants {
    bool ADMIN_CAN_ADD_PLANETS;
    bool WORLD_RADIUS_LOCKED;
    uint256 WORLD_RADIUS_MIN;
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
    uint256[10] PLANET_LEVEL_THRESHOLDS;
    uint256 PLANET_RARITY;
    bool PLANET_TRANSFER_ENABLED;
    uint256 PHOTOID_ACTIVATION_DELAY;
    uint256 LOCATION_REVEAL_COOLDOWN;
    uint8[5][10][4] PLANET_TYPE_WEIGHTS; // spaceType (enum 0-3) -> planetLevel (0-9) -> planetType (enum 0-4)
    uint256 SILVER_SCORE_VALUE;
    uint256[6] ARTIFACT_POINT_VALUES;
    // Space Junk
    bool SPACE_JUNK_ENABLED;
    /**
      Total amount of space junk a player can take on.
      This can be overridden at runtime by updating
      this value for a specific player in storage.
    */
    uint256 SPACE_JUNK_LIMIT;
    /**
      The amount of junk that each level of planet
      gives the player when moving to it for the
      first time.
    */
    uint256[10] PLANET_LEVEL_JUNK;
    /**
      The speed boost a movement receives when abandoning
      a planet.
    */
    uint256 ABANDON_SPEED_CHANGE_PERCENT;
    /**
      The range boost a movement receives when abandoning
      a planet.
    */
    uint256 ABANDON_RANGE_CHANGE_PERCENT;
    // Capture Zones
    uint256 GAME_START_BLOCK;
    bool CAPTURE_ZONES_ENABLED;
    uint256 CAPTURE_ZONE_COUNT;
    uint256 CAPTURE_ZONE_CHANGE_BLOCK_INTERVAL;
    uint256 CAPTURE_ZONE_RADIUS;
    uint256[10] CAPTURE_ZONE_PLANET_LEVEL_SCORE;
    uint256 CAPTURE_ZONE_HOLD_BLOCKS_REQUIRED;
    uint256 CAPTURE_ZONES_PER_5000_WORLD_RADIUS;
}

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

/**
 * All of Dark Forest's game storage is stored in a single GameStorage struct.
 *
 * The Diamond Storage pattern (https://dev.to/mudgen/how-diamond-storage-works-90e)
 * is used to set the struct at a specific place in contract storage. The pattern
 * recommends that the hash of a specific namespace (e.g. "darkforest.game.storage")
 * be used as the slot to store the struct.
 *
 * Additionally, the Diamond Storage pattern can be used to access and change state inside
 * of Library contract code (https://dev.to/mudgen/solidity-libraries-can-t-have-state-variables-oh-yes-they-can-3ke9).
 * Instead of using `LibStorage.gameStorage()` directly, a Library will probably
 * define a convenience function to accessing state, similar to the `gs()` function provided
 * in the `WithStorage` base contract below.
 *
 * This pattern was chosen over the AppStorage pattern (https://dev.to/mudgen/appstorage-pattern-for-state-variables-in-solidity-3lki)
 * because AppStorage seems to indicate it doesn't support additional state in contracts.
 * This becomes a problem when using base contracts that manage their own state internally.
 *
 * There are a few caveats to this approach:
 * 1. State must always be loaded through a function (`LibStorage.gameStorage()`)
 *    instead of accessing it as a variable directly. The `WithStorage` base contract
 *    below provides convenience functions, such as `gs()`, for accessing storage.
 * 2. Although inherited contracts can have their own state, top level contracts must
 *    ONLY use the Diamond Storage. This seems to be due to how contract inheritance
 *    calculates contract storage layout.
 * 3. The same namespace can't be used for multiple structs. However, new namespaces can
 *    be added to the contract to add additional storage structs.
 * 4. If a contract is deployed using the Diamond Storage, you must ONLY ADD fields to the
 *    very end of the struct during upgrades. During an upgrade, if any fields get added,
 *    removed, or changed at the beginning or middle of the existing struct, the
 *    entire layout of the storage will be broken.
 * 5. Avoid structs within the Diamond Storage struct, as these nested structs cannot be
 *    changed during upgrades without breaking the layout of storage. Structs inside of
 *    mappings are fine because their storage layout is different. Consider creating a new
 *    Diamond storage for each struct.
 *
 * More information on Solidity contract storage layout is available at:
 * https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html
 *
 * Nick Mudge, the author of the Diamond Pattern and creator of Diamond Storage pattern,
 * wrote about the benefits of the Diamond Storage pattern over other storage patterns at
 * https://medium.com/1milliondevs/new-storage-layout-for-proxy-contracts-and-diamonds-98d01d0eadb#bfc1
 */
library LibStorage {
    // Storage are structs where the data gets updated throughout the lifespan of the game
    bytes32 constant GAME_STORAGE_POSITION = keccak256("darkforest.storage.game");
    bytes32 constant WHITELIST_STORAGE_POSITION = keccak256("darkforest.storage.whitelist");
    // Constants are structs where the data gets configured on game initialization
    bytes32 constant GAME_CONSTANTS_POSITION = keccak256("darkforest.constants.game");
    bytes32 constant SNARK_CONSTANTS_POSITION = keccak256("darkforest.constants.snarks");
    bytes32 constant PLANET_DEFAULT_STATS_POSITION =
        keccak256("darkforest.constants.planetDefaultStats");
    bytes32 constant UPGRADE_POSITION = keccak256("darkforest.constants.upgrades");

    function gameStorage() internal pure returns (GameStorage storage gs) {
        bytes32 position = GAME_STORAGE_POSITION;
        assembly {
            gs.slot := position
        }
    }

    function whitelistStorage() internal pure returns (WhitelistStorage storage ws) {
        bytes32 position = WHITELIST_STORAGE_POSITION;
        assembly {
            ws.slot := position
        }
    }

    function gameConstants() internal pure returns (GameConstants storage gc) {
        bytes32 position = GAME_CONSTANTS_POSITION;
        assembly {
            gc.slot := position
        }
    }

    function snarkConstants() internal pure returns (SnarkConstants storage sc) {
        bytes32 position = SNARK_CONSTANTS_POSITION;
        assembly {
            sc.slot := position
        }
    }

    function planetDefaultStats() internal pure returns (PlanetDefaultStats[] storage pds) {
        bytes32 position = PLANET_DEFAULT_STATS_POSITION;
        assembly {
            pds.slot := position
        }
    }

    function upgrades() internal pure returns (Upgrade[4][3] storage upgrades) {
        bytes32 position = UPGRADE_POSITION;
        assembly {
            upgrades.slot := position
        }
    }
}

/**
 * The `WithStorage` contract provides a base contract for Facet contracts to inherit.
 *
 * It mainly provides internal helpers to access the storage structs, which reduces
 * calls like `LibStorage.gameStorage()` to just `gs()`.
 *
 * To understand why the storage stucts must be accessed using a function instead of a
 * state variable, please refer to the documentation above `LibStorage` in this file.
 */
contract WithStorage {
    function gs() internal pure returns (GameStorage storage) {
        return LibStorage.gameStorage();
    }

    function ws() internal pure returns (WhitelistStorage storage) {
        return LibStorage.whitelistStorage();
    }

    function gameConstants() internal pure returns (GameConstants storage) {
        return LibStorage.gameConstants();
    }

    function snarkConstants() internal pure returns (SnarkConstants storage) {
        return LibStorage.snarkConstants();
    }

    function planetDefaultStats() internal pure returns (PlanetDefaultStats[] storage) {
        return LibStorage.planetDefaultStats();
    }

    function upgrades() internal pure returns (Upgrade[4][3] storage) {
        return LibStorage.upgrades();
    }
}
