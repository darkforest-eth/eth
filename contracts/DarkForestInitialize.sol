// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;

// Libraries
import "./ABDKMath64x64.sol";
import "./DarkForestTypes.sol";

library DarkForestInitialize {
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

    function initializeDefaults() public {
        DarkForestTypes.PlanetDefaultStats[] storage planetDefaultStats = s().planetDefaultStats;

        planetDefaultStats.push(
            DarkForestTypes.PlanetDefaultStats({
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
            DarkForestTypes.PlanetDefaultStats({
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
            DarkForestTypes.PlanetDefaultStats({
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
            DarkForestTypes.PlanetDefaultStats({
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
            DarkForestTypes.PlanetDefaultStats({
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
            DarkForestTypes.PlanetDefaultStats({
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
            DarkForestTypes.PlanetDefaultStats({
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
            DarkForestTypes.PlanetDefaultStats({
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
            DarkForestTypes.PlanetDefaultStats({
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
            DarkForestTypes.PlanetDefaultStats({
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
        DarkForestTypes.Upgrade[4][3] storage upgrades = s().upgrades;

        // defense
        upgrades[uint256(DarkForestTypes.UpgradeBranch.DEFENSE)][0] = DarkForestTypes.Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 100,
            speedMultiplier: 100,
            defMultiplier: 120
        });
        upgrades[uint256(DarkForestTypes.UpgradeBranch.DEFENSE)][1] = DarkForestTypes.Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 100,
            speedMultiplier: 100,
            defMultiplier: 120
        });
        upgrades[uint256(DarkForestTypes.UpgradeBranch.DEFENSE)][2] = DarkForestTypes.Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 100,
            speedMultiplier: 100,
            defMultiplier: 120
        });
        upgrades[uint256(DarkForestTypes.UpgradeBranch.DEFENSE)][3] = DarkForestTypes.Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 100,
            speedMultiplier: 100,
            defMultiplier: 120
        });

        // range
        upgrades[uint256(DarkForestTypes.UpgradeBranch.RANGE)][0] = DarkForestTypes.Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 125,
            speedMultiplier: 100,
            defMultiplier: 100
        });
        upgrades[uint256(DarkForestTypes.UpgradeBranch.RANGE)][1] = DarkForestTypes.Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 125,
            speedMultiplier: 100,
            defMultiplier: 100
        });
        upgrades[uint256(DarkForestTypes.UpgradeBranch.RANGE)][2] = DarkForestTypes.Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 125,
            speedMultiplier: 100,
            defMultiplier: 100
        });
        upgrades[uint256(DarkForestTypes.UpgradeBranch.RANGE)][3] = DarkForestTypes.Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 125,
            speedMultiplier: 100,
            defMultiplier: 100
        });

        // speed
        upgrades[uint256(DarkForestTypes.UpgradeBranch.SPEED)][0] = DarkForestTypes.Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 100,
            speedMultiplier: 175,
            defMultiplier: 100
        });
        upgrades[uint256(DarkForestTypes.UpgradeBranch.SPEED)][1] = DarkForestTypes.Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 100,
            speedMultiplier: 175,
            defMultiplier: 100
        });
        upgrades[uint256(DarkForestTypes.UpgradeBranch.SPEED)][2] = DarkForestTypes.Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 100,
            speedMultiplier: 175,
            defMultiplier: 100
        });
        upgrades[uint256(DarkForestTypes.UpgradeBranch.SPEED)][3] = DarkForestTypes.Upgrade({
            popCapMultiplier: 120,
            popGroMultiplier: 120,
            rangeMultiplier: 100,
            speedMultiplier: 175,
            defMultiplier: 100
        });
    }
}
