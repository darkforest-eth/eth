// SPDX-License-Identifier: GPL-3.0 AND MIT
/**
 * Customized version of DiamondInit.sol
 *
 * Vendored on November 16, 2021 from:
 * https://github.com/mudgen/diamond-3-hardhat/blob/7feb995/contracts/upgradeInitializers/DiamondInit.sol
 */
pragma solidity ^0.8.0;

/******************************************************************************\
* Author: Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
* EIP-2535 Diamonds: https://eips.ethereum.org/EIPS/eip-2535
*
* Implementation of a diamond.
/******************************************************************************/

// It is expected that this contract is customized in order to deploy a diamond with data
// from a deployment script. The init function is used to initialize state variables
// of the diamond. Add parameters to the init function if you need to.

// Interface imports
import {IDiamondLoupe} from "./vendor/interfaces/IDiamondLoupe.sol";
import {IDiamondCut} from "./vendor/interfaces/IDiamondCut.sol";
import {IERC173} from "./vendor/interfaces/IERC173.sol";
import {IERC165} from "@solidstate/contracts/introspection/IERC165.sol";
import {IERC721} from "@solidstate/contracts/token/ERC721/IERC721.sol";
import {IERC721Metadata} from "@solidstate/contracts/token/ERC721/metadata/IERC721Metadata.sol";
import {
    IERC721Enumerable
} from "@solidstate/contracts/token/ERC721/enumerable/IERC721Enumerable.sol";

// Inherited storage
import {
    ERC721MetadataStorage
} from "@solidstate/contracts/token/ERC721/metadata/ERC721MetadataStorage.sol";

// Library imports
import {LibDiamond} from "./vendor/libraries/LibDiamond.sol";
import {WithStorage} from "./libraries/LibStorage.sol";
import {LibGameUtils} from "./libraries/LibGameUtils.sol";

// Type imports
import {PlanetDefaultStats, Upgrade, UpgradeBranch} from "./DFTypes.sol";

struct InitArgs {
    bool START_PAUSED;
    bool ADMIN_CAN_ADD_PLANETS;
    uint256 LOCATION_REVEAL_COOLDOWN;
    uint256 TOKEN_MINT_END_TIMESTAMP;
    bool WORLD_RADIUS_LOCKED;
    uint256 WORLD_RADIUS_MIN;
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
    uint256[10] PLANET_LEVEL_THRESHOLDS;
    uint256 PLANET_RARITY;
    bool PLANET_TRANSFER_ENABLED;
    uint8[5][10][4] PLANET_TYPE_WEIGHTS; // spaceType (enum 0-3) -> planetLevel (0-7) -> planetType (enum 0-4)
    uint256 SILVER_SCORE_VALUE;
    uint256[6] ARTIFACT_POINT_VALUES;
    uint256 PHOTOID_ACTIVATION_DELAY;
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
    bool CAPTURE_ZONES_ENABLED;
    uint256 CAPTURE_ZONE_COUNT;
    uint256 CAPTURE_ZONE_CHANGE_BLOCK_INTERVAL;
    uint256 CAPTURE_ZONE_RADIUS;
    uint256[10] CAPTURE_ZONE_PLANET_LEVEL_SCORE;
    uint256 CAPTURE_ZONE_HOLD_BLOCKS_REQUIRED;
    uint256 CAPTURE_ZONES_PER_5000_WORLD_RADIUS;
}

contract DFInitialize is WithStorage {
    using ERC721MetadataStorage for ERC721MetadataStorage.Layout;

    // You can add parameters to this function in order to pass in
    // data to set initialize state variables
    function init(
        bool whitelistEnabled,
        string memory artifactBaseURI,
        InitArgs memory initArgs
    ) external {
        // adding ERC165 data
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        ds.supportedInterfaces[type(IERC165).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
        ds.supportedInterfaces[type(IERC173).interfaceId] = true;
        ds.supportedInterfaces[type(IERC721).interfaceId] = true;
        ds.supportedInterfaces[type(IERC721Metadata).interfaceId] = true;
        ds.supportedInterfaces[type(IERC721Enumerable).interfaceId] = true;

        // Setup the ERC721 metadata
        // TODO(#1925): Add name and symbol for the artifact tokens
        ERC721MetadataStorage.layout().name = "";
        ERC721MetadataStorage.layout().symbol = "";
        ERC721MetadataStorage.layout().baseURI = artifactBaseURI;

        gs().diamondAddress = address(this);

        ws().enabled = whitelistEnabled;
        ws().drip = 0.05 ether;
        ws().relayerRewardsEnabled = false;
        ws().relayerReward = 0.01 ether;

        gs().planetLevelsCount = 10;
        gs().planetLevelThresholds = initArgs.PLANET_LEVEL_THRESHOLDS;

        snarkConstants().DISABLE_ZK_CHECKS = initArgs.DISABLE_ZK_CHECKS;
        snarkConstants().PLANETHASH_KEY = initArgs.PLANETHASH_KEY;
        snarkConstants().SPACETYPE_KEY = initArgs.SPACETYPE_KEY;
        snarkConstants().BIOMEBASE_KEY = initArgs.BIOMEBASE_KEY;
        snarkConstants().PERLIN_MIRROR_X = initArgs.PERLIN_MIRROR_X;
        snarkConstants().PERLIN_MIRROR_Y = initArgs.PERLIN_MIRROR_Y;
        snarkConstants().PERLIN_LENGTH_SCALE = initArgs.PERLIN_LENGTH_SCALE;

        gameConstants().ADMIN_CAN_ADD_PLANETS = initArgs.ADMIN_CAN_ADD_PLANETS;
        gameConstants().WORLD_RADIUS_LOCKED = initArgs.WORLD_RADIUS_LOCKED;
        gameConstants().WORLD_RADIUS_MIN = initArgs.WORLD_RADIUS_MIN;
        gameConstants().MAX_NATURAL_PLANET_LEVEL = initArgs.MAX_NATURAL_PLANET_LEVEL;
        gameConstants().TIME_FACTOR_HUNDREDTHS = initArgs.TIME_FACTOR_HUNDREDTHS;
        gameConstants().PERLIN_THRESHOLD_1 = initArgs.PERLIN_THRESHOLD_1;
        gameConstants().PERLIN_THRESHOLD_2 = initArgs.PERLIN_THRESHOLD_2;
        gameConstants().PERLIN_THRESHOLD_3 = initArgs.PERLIN_THRESHOLD_3;
        gameConstants().INIT_PERLIN_MIN = initArgs.INIT_PERLIN_MIN;
        gameConstants().INIT_PERLIN_MAX = initArgs.INIT_PERLIN_MAX;
        gameConstants().SPAWN_RIM_AREA = initArgs.SPAWN_RIM_AREA;
        gameConstants().BIOME_THRESHOLD_1 = initArgs.BIOME_THRESHOLD_1;
        gameConstants().BIOME_THRESHOLD_2 = initArgs.BIOME_THRESHOLD_2;
        gameConstants().PLANET_RARITY = initArgs.PLANET_RARITY;
        gameConstants().PLANET_TRANSFER_ENABLED = initArgs.PLANET_TRANSFER_ENABLED;
        gameConstants().PHOTOID_ACTIVATION_DELAY = initArgs.PHOTOID_ACTIVATION_DELAY;
        gameConstants().LOCATION_REVEAL_COOLDOWN = initArgs.LOCATION_REVEAL_COOLDOWN;
        gameConstants().PLANET_TYPE_WEIGHTS = initArgs.PLANET_TYPE_WEIGHTS;
        gameConstants().SILVER_SCORE_VALUE = initArgs.SILVER_SCORE_VALUE;
        gameConstants().ARTIFACT_POINT_VALUES = initArgs.ARTIFACT_POINT_VALUES;
        // Space Junk
        gameConstants().SPACE_JUNK_ENABLED = initArgs.SPACE_JUNK_ENABLED;
        gameConstants().SPACE_JUNK_LIMIT = initArgs.SPACE_JUNK_LIMIT;
        gameConstants().PLANET_LEVEL_JUNK = initArgs.PLANET_LEVEL_JUNK;
        gameConstants().ABANDON_SPEED_CHANGE_PERCENT = initArgs.ABANDON_SPEED_CHANGE_PERCENT;
        gameConstants().ABANDON_RANGE_CHANGE_PERCENT = initArgs.ABANDON_RANGE_CHANGE_PERCENT;
        // Capture Zones
        gameConstants().GAME_START_BLOCK = block.number;
        gameConstants().CAPTURE_ZONES_ENABLED = initArgs.CAPTURE_ZONES_ENABLED;
        gameConstants().CAPTURE_ZONE_COUNT = initArgs.CAPTURE_ZONE_COUNT;
        gameConstants().CAPTURE_ZONE_CHANGE_BLOCK_INTERVAL = initArgs
            .CAPTURE_ZONE_CHANGE_BLOCK_INTERVAL;
        gameConstants().CAPTURE_ZONE_RADIUS = initArgs.CAPTURE_ZONE_RADIUS;
        gameConstants().CAPTURE_ZONE_PLANET_LEVEL_SCORE = initArgs.CAPTURE_ZONE_PLANET_LEVEL_SCORE;
        gameConstants().CAPTURE_ZONE_HOLD_BLOCKS_REQUIRED = initArgs
            .CAPTURE_ZONE_HOLD_BLOCKS_REQUIRED;
        gameConstants().CAPTURE_ZONES_PER_5000_WORLD_RADIUS = initArgs
            .CAPTURE_ZONES_PER_5000_WORLD_RADIUS;

        gs().nextChangeBlock = block.number + initArgs.CAPTURE_ZONE_CHANGE_BLOCK_INTERVAL;

        gs().worldRadius = initArgs.WORLD_RADIUS_MIN; // will be overridden by `LibGameUtils.updateWorldRadius()` if !WORLD_RADIUS_LOCKED

        gs().paused = initArgs.START_PAUSED;
        gs().TOKEN_MINT_END_TIMESTAMP = initArgs.TOKEN_MINT_END_TIMESTAMP;

        initializeDefaults();
        initializeUpgrades();

        gs().initializedPlanetCountByLevel = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (uint256 i = 0; i < gs().planetLevelThresholds.length; i += 1) {
            gs().cumulativeRarities.push(
                (2**24 / gs().planetLevelThresholds[i]) * initArgs.PLANET_RARITY
            );
        }

        LibGameUtils.updateWorldRadius();
    }

    function initializeDefaults() public {
        PlanetDefaultStats[] storage planetDefaultStats = planetDefaultStats();

        planetDefaultStats.push(
            PlanetDefaultStats({
                label: "Asteroid",
                populationCap: 100000,
                populationGrowth: 417,
                range: 99,
                speed: 75,
                defense: 400,
                silverGrowth: 0,
                silverCap: 0,
                barbarianPercentage: 0
            })
        );

        planetDefaultStats.push(
            PlanetDefaultStats({
                label: "Brown Dwarf",
                populationCap: 400000,
                populationGrowth: 833,
                range: 177,
                speed: 75,
                defense: 400,
                silverGrowth: 56,
                silverCap: 100000,
                barbarianPercentage: 1
            })
        );

        planetDefaultStats.push(
            PlanetDefaultStats({
                label: "Red Dwarf",
                populationCap: 1600000,
                populationGrowth: 1250,
                range: 315,
                speed: 75,
                defense: 300,
                silverGrowth: 167,
                silverCap: 500000,
                barbarianPercentage: 2
            })
        );

        planetDefaultStats.push(
            PlanetDefaultStats({
                label: "White Dwarf",
                populationCap: 6000000,
                populationGrowth: 1667,
                range: 591,
                speed: 75,
                defense: 300,
                silverGrowth: 417,
                silverCap: 2500000,
                barbarianPercentage: 3
            })
        );

        planetDefaultStats.push(
            PlanetDefaultStats({
                label: "Yellow Star",
                populationCap: 25000000,
                populationGrowth: 2083,
                range: 1025,
                speed: 75,
                defense: 300,
                silverGrowth: 833,
                silverCap: 12000000,
                barbarianPercentage: 4
            })
        );

        planetDefaultStats.push(
            PlanetDefaultStats({
                label: "Blue Star",
                populationCap: 100000000,
                populationGrowth: 2500,
                range: 1734,
                speed: 75,
                defense: 200,
                silverGrowth: 1667,
                silverCap: 50000000,
                barbarianPercentage: 5
            })
        );

        planetDefaultStats.push(
            PlanetDefaultStats({
                label: "Giant",
                populationCap: 300000000,
                populationGrowth: 2917,
                range: 2838,
                speed: 75,
                defense: 200,
                silverGrowth: 2778,
                silverCap: 100000000,
                barbarianPercentage: 7
            })
        );

        planetDefaultStats.push(
            PlanetDefaultStats({
                label: "Supergiant",
                populationCap: 500000000,
                populationGrowth: 3333,
                range: 4414,
                speed: 75,
                defense: 200,
                silverGrowth: 2778,
                silverCap: 200000000,
                barbarianPercentage: 10
            })
        );

        planetDefaultStats.push(
            PlanetDefaultStats({
                label: "Unlabeled1",
                populationCap: 700000000,
                populationGrowth: 3750,
                range: 6306,
                speed: 75,
                defense: 200,
                silverGrowth: 2778,
                silverCap: 300000000,
                barbarianPercentage: 20
            })
        );

        planetDefaultStats.push(
            PlanetDefaultStats({
                label: "Unlabeled2",
                populationCap: 800000000,
                populationGrowth: 4167,
                range: 8829,
                speed: 75,
                defense: 200,
                silverGrowth: 2778,
                silverCap: 400000000,
                barbarianPercentage: 25
            })
        );
    }

    function initializeUpgrades() public {
        Upgrade[4][3] storage upgrades = upgrades();

        // defense
        upgrades[uint256(UpgradeBranch.DEFENSE)][0] = Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 100,
            speedMultiplier: 100,
            defMultiplier: 120
        });
        upgrades[uint256(UpgradeBranch.DEFENSE)][1] = Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 100,
            speedMultiplier: 100,
            defMultiplier: 120
        });
        upgrades[uint256(UpgradeBranch.DEFENSE)][2] = Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 100,
            speedMultiplier: 100,
            defMultiplier: 120
        });
        upgrades[uint256(UpgradeBranch.DEFENSE)][3] = Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 100,
            speedMultiplier: 100,
            defMultiplier: 120
        });

        // range
        upgrades[uint256(UpgradeBranch.RANGE)][0] = Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 125,
            speedMultiplier: 100,
            defMultiplier: 100
        });
        upgrades[uint256(UpgradeBranch.RANGE)][1] = Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 125,
            speedMultiplier: 100,
            defMultiplier: 100
        });
        upgrades[uint256(UpgradeBranch.RANGE)][2] = Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 125,
            speedMultiplier: 100,
            defMultiplier: 100
        });
        upgrades[uint256(UpgradeBranch.RANGE)][3] = Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 125,
            speedMultiplier: 100,
            defMultiplier: 100
        });

        // speed
        upgrades[uint256(UpgradeBranch.SPEED)][0] = Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 100,
            speedMultiplier: 175,
            defMultiplier: 100
        });
        upgrades[uint256(UpgradeBranch.SPEED)][1] = Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 100,
            speedMultiplier: 175,
            defMultiplier: 100
        });
        upgrades[uint256(UpgradeBranch.SPEED)][2] = Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 100,
            speedMultiplier: 175,
            defMultiplier: 100
        });
        upgrades[uint256(UpgradeBranch.SPEED)][3] = Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 100,
            speedMultiplier: 175,
            defMultiplier: 100
        });
    }
}
