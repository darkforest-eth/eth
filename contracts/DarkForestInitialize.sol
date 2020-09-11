// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.9;

// Libraries
import "./ABDKMath64x64.sol";
import "./DarkForestTypes.sol";

library DarkForestInitialize {
    function initializeDefaults(
        DarkForestTypes.PlanetDefaultStats[] storage planetDefaultStats
    ) public {
        planetDefaultStats.push(
            DarkForestTypes.PlanetDefaultStats({
                label: "Asteroid",
                populationCap: 150000,
                populationGrowth: 750,
                range: 99,
                silverGrowth: 0,
                silverCap: 0,
                silverMax: 0,
                barbarianPercentage: 0,
                energyCost: 0
            })
        );

        planetDefaultStats.push(
            DarkForestTypes.PlanetDefaultStats({
                label: "Brown Dwarf",
                populationCap: 500000,
                populationGrowth: 1000,
                range: 177,
                silverGrowth: 28,
                silverCap: 20000,
                silverMax: 40000,
                barbarianPercentage: 0,
                energyCost: 5
            })
        );

        planetDefaultStats.push(
            DarkForestTypes.PlanetDefaultStats({
                label: "Red Dwarf",
                populationCap: 1500000,
                populationGrowth: 1250,
                range: 315,
                silverGrowth: 139,
                silverCap: 250000,
                silverMax: 500000,
                barbarianPercentage: 2,
                energyCost: 10
            })
        );

        planetDefaultStats.push(
            DarkForestTypes.PlanetDefaultStats({
                label: "White Dwarf",
                populationCap: 5000000,
                populationGrowth: 1500,
                range: 591,
                silverGrowth: 889,
                silverCap: 3200000,
                silverMax: 6400000,
                barbarianPercentage: 3,
                energyCost: 15
            })
        );

        planetDefaultStats.push(
            DarkForestTypes.PlanetDefaultStats({
                label: "Yellow Star",
                populationCap: 15000000,
                populationGrowth: 1750,
                range: 1025,
                silverGrowth: 3556,
                silverCap: 32000000,
                silverMax: 64000000,
                barbarianPercentage: 4,
                energyCost: 20
            })
        );

        planetDefaultStats.push(
            DarkForestTypes.PlanetDefaultStats({
                label: "Blue Star",
                populationCap: 40000000,
                populationGrowth: 2000,
                range: 1261,
                silverGrowth: 5333,
                silverCap: 134400000,
                silverMax: 268800000,
                barbarianPercentage: 5,
                energyCost: 25
            })
        );

        planetDefaultStats.push(
            DarkForestTypes.PlanetDefaultStats({
                label: "Giant",
                populationCap: 60000000,
                populationGrowth: 2250,
                range: 1577,
                silverGrowth: 6667,
                silverCap: 240000000,
                silverMax: 480000000,
                barbarianPercentage: 9,
                energyCost: 30
            })
        );

        planetDefaultStats.push(
            DarkForestTypes.PlanetDefaultStats({
                label: "Supergiant",
                populationCap: 75000000,
                populationGrowth: 2500,
                range: 1892,
                silverGrowth: 6667,
                silverCap: 288000000,
                silverMax: 576000000,
                barbarianPercentage: 10,
                energyCost: 35
            })
        );
    }

    function initializeUpgrades(DarkForestTypes.Upgrade[4][3] storage upgrades)
        public
    {
        upgrades[0][0] = DarkForestTypes.Upgrade({
            popCapMultiplier: 100,
            popGroMultiplier: 100,
            silverCapMultiplier: 110,
            silverGroMultiplier: 110,
            silverMaxMultiplier: 110,
            rangeMultiplier: 100,
            silverCostMultiplier: 25
        });
        upgrades[0][1] = DarkForestTypes.Upgrade({
            popCapMultiplier: 100,
            popGroMultiplier: 100,
            silverCapMultiplier: 115,
            silverGroMultiplier: 115,
            silverMaxMultiplier: 115,
            rangeMultiplier: 100,
            silverCostMultiplier: 60
        });
        upgrades[0][2] = DarkForestTypes.Upgrade({
            popCapMultiplier: 100,
            popGroMultiplier: 100,
            silverCapMultiplier: 135,
            silverGroMultiplier: 135,
            silverMaxMultiplier: 135,
            rangeMultiplier: 85,
            silverCostMultiplier: 120
        });
        upgrades[0][3] = DarkForestTypes.Upgrade({
            popCapMultiplier: 100,
            popGroMultiplier: 100,
            silverCapMultiplier: 160,
            silverGroMultiplier: 160,
            silverMaxMultiplier: 160,
            rangeMultiplier: 80,
            silverCostMultiplier: 240
        });

        upgrades[1][0] = DarkForestTypes.Upgrade({
            popCapMultiplier: 110,
            popGroMultiplier: 110,
            silverCapMultiplier: 100,
            silverGroMultiplier: 100,
            silverMaxMultiplier: 100,
            rangeMultiplier: 100,
            silverCostMultiplier: 25
        });
        upgrades[1][1] = DarkForestTypes.Upgrade({
            popCapMultiplier: 115,
            popGroMultiplier: 115,
            silverCapMultiplier: 100,
            silverGroMultiplier: 100,
            silverMaxMultiplier: 100,
            rangeMultiplier: 100,
            silverCostMultiplier: 50
        });
        upgrades[1][2] = DarkForestTypes.Upgrade({
            popCapMultiplier: 135,
            popGroMultiplier: 135,
            silverCapMultiplier: 100,
            silverGroMultiplier: 100,
            silverMaxMultiplier: 100,
            rangeMultiplier: 85,
            silverCostMultiplier: 90
        });
        upgrades[1][3] = DarkForestTypes.Upgrade({
            popCapMultiplier: 160,
            popGroMultiplier: 160,
            silverCapMultiplier: 100,
            silverGroMultiplier: 100,
            silverMaxMultiplier: 100,
            rangeMultiplier: 80,
            silverCostMultiplier: 170
        });

        upgrades[2][0] = DarkForestTypes.Upgrade({
            popCapMultiplier: 100,
            popGroMultiplier: 100,
            silverCapMultiplier: 100,
            silverGroMultiplier: 100,
            silverMaxMultiplier: 100,
            rangeMultiplier: 110,
            silverCostMultiplier: 25
        });
        upgrades[2][1] = DarkForestTypes.Upgrade({
            popCapMultiplier: 100,
            popGroMultiplier: 100,
            silverCapMultiplier: 100,
            silverGroMultiplier: 100,
            silverMaxMultiplier: 100,
            rangeMultiplier: 115,
            silverCostMultiplier: 50
        });
        upgrades[2][2] = DarkForestTypes.Upgrade({
            popCapMultiplier: 80,
            popGroMultiplier: 80,
            silverCapMultiplier: 100,
            silverGroMultiplier: 100,
            silverMaxMultiplier: 100,
            rangeMultiplier: 125,
            silverCostMultiplier: 90
        });
        upgrades[2][3] = DarkForestTypes.Upgrade({
            popCapMultiplier: 75,
            popGroMultiplier: 75,
            silverCapMultiplier: 100,
            silverGroMultiplier: 100,
            silverMaxMultiplier: 100,
            rangeMultiplier: 135,
            silverCostMultiplier: 170
        });
    }
}
