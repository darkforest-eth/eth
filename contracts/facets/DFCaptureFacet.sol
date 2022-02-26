// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// External contract imports
import {DFCoreFacet} from "./DFCoreFacet.sol";
import {DFWhitelistFacet} from "./DFWhitelistFacet.sol";

// Library imports
import {LibPlanet} from "../libraries/LibPlanet.sol";
import {LibDiamond} from "../vendor/libraries/LibDiamond.sol";

// Storage imports
import {WithStorage} from "../libraries/LibStorage.sol";

// Vendor Imports
import {LibTrig} from "../vendor/libraries/LibTrig.sol";
import {ABDKMath64x64} from "../vendor/libraries/ABDKMath64x64.sol";

// Type imports
import {Planet, PlanetExtendedInfo, PlanetExtendedInfo2} from "../DFTypes.sol";

contract DFCaptureFacet is WithStorage {
    modifier notPaused() {
        require(!gs().paused, "Game is paused");
        _;
    }

    modifier onlyWhitelisted() {
        require(
            DFWhitelistFacet(address(this)).isWhitelisted(msg.sender) ||
                msg.sender == LibDiamond.contractOwner(),
            "Player is not whitelisted"
        );
        _;
    }

    event PlanetInvaded(address player, uint256 loc);
    event PlanetCaptured(address player, uint256 loc);

    struct Zone {
        int256 x;
        int256 y;
    }

    /**
     * Same snark args as DFCoreFacet#revealLocation
     * TODO Client supplies the nonce for the capture zone they are in.
     * Contract can generate the same zone based on that nonce, eliminating
     * the need to generate all the zones on every transaction.
     */
    function invadePlanet(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[9] memory _input
    ) public onlyWhitelisted notPaused {
        require(gameConstants().CAPTURE_ZONES_ENABLED, "capture zones are disabled");

        uint256 locationId = _input[0];

        DFCoreFacet(address(this)).checkRevealProof(_a, _b, _c, _input);

        require(planetInCaptureZone(_input[2], _input[3]), "planet is not in capture zone");

        LibPlanet.refreshPlanet(locationId);
        Planet memory planet = gs().planets[locationId];
        PlanetExtendedInfo memory planetExtendedInfo = gs().planetsExtendedInfo[locationId];
        PlanetExtendedInfo2 storage planetExtendedInfo2 = gs().planetsExtendedInfo2[locationId];

        require(!planetExtendedInfo.destroyed, "planet is destroyed");
        require(planetExtendedInfo2.invader == address(0), "planet is already invaded");
        require(planetExtendedInfo2.capturer == address(0), "planet has already been captured");
        require(planet.owner == msg.sender, "you can only invade planets you own");

        planetExtendedInfo2.invader = msg.sender;
        planetExtendedInfo2.invadeStartBlock = block.number;

        emit PlanetInvaded(msg.sender, locationId);
    }

    function capturePlanet(uint256 locationId) public onlyWhitelisted notPaused {
        require(gameConstants().CAPTURE_ZONES_ENABLED, "capture zones are disabled");

        LibPlanet.refreshPlanet(locationId);
        Planet memory planet = gs().planets[locationId];
        PlanetExtendedInfo memory planetExtendedInfo = gs().planetsExtendedInfo[locationId];
        PlanetExtendedInfo2 storage planetExtendedInfo2 = gs().planetsExtendedInfo2[locationId];

        require(planetExtendedInfo2.capturer == address(0), "planets can only be captured once");
        require(!planetExtendedInfo.destroyed, "planet is destroyed");
        require(planet.owner == msg.sender, "you can only capture planets you own");
        require(
            planetExtendedInfo2.invader != address(0),
            "you must invade the planet before capturing"
        );
        require(
            (planet.population * 100) >= (planet.populationCap * 100) / 78,
            // We lie here, but it is a better UX
            "planet must have 80% energy before capturing"
        );

        require(
            planetExtendedInfo2.invadeStartBlock +
                gameConstants().CAPTURE_ZONE_HOLD_BLOCKS_REQUIRED <=
                block.number,
            "you have not held the planet long enough to capture it"
        );

        planetExtendedInfo2.capturer = msg.sender;

        gs().players[msg.sender].score += gameConstants().CAPTURE_ZONE_PLANET_LEVEL_SCORE[
            planet.planetLevel
        ];
        emit PlanetCaptured(msg.sender, locationId);
    }

    function planetInCaptureZone(uint256 x, uint256 y) public returns (bool) {
        setNextGenerationBlock();

        uint256 generationBlock =
            gs().nextChangeBlock - gameConstants().CAPTURE_ZONE_CHANGE_BLOCK_INTERVAL;
        bytes32 generationBlockHash = blockhash(generationBlock);

        int256 planetX = getIntFromUInt(x);
        int256 planetY = getIntFromUInt(y);

        for (uint256 ring = 0; ring < gs().worldRadius / 5000; ring++) {
            uint256 nonceBase = ring * gameConstants().CAPTURE_ZONES_PER_5000_WORLD_RADIUS;

            for (uint256 j = 0; j < gameConstants().CAPTURE_ZONES_PER_5000_WORLD_RADIUS; j++) {
                uint256 nonce = nonceBase + j;
                bytes32 hexSeed = keccak256(abi.encodePacked(generationBlockHash, nonce));
                uint256 seed = uint256(hexSeed);

                Zone memory zone = getZonePoint(seed, ring);

                int256 xDiff = (planetX - zone.x);
                int256 yDiff = (planetY - zone.y);

                uint256 distanceToZone = sqrt(uint256(xDiff * xDiff + yDiff * yDiff));

                if (distanceToZone <= gameConstants().CAPTURE_ZONE_RADIUS) {
                    return true;
                }
            }
        }

        return false;
    }

    function getZonePoint(uint256 seed, uint256 ringNumber) private pure returns (Zone memory) {
        uint256 angleSeed = seed % 0xFFF;
        uint256 angleRadians = (angleSeed * 1e18) / 651;

        uint256 distanceSeed = ((seed - angleSeed) / 4096) % 0xFFFFFF;
        uint256 divisor = 3355;

        uint256 distance = (distanceSeed / divisor) + ringNumber * 5000;
        int256 cos = LibTrig.cos(angleRadians);
        int256 sin = LibTrig.sin(angleRadians);

        return Zone((int256(distance) * cos) / 1e18, (int256(distance) * sin) / 1e18);
    }

    function sqrt(uint256 x) private pure returns (uint256 y) {
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function setNextGenerationBlock() private {
        uint256 changeInterval = gameConstants().CAPTURE_ZONE_CHANGE_BLOCK_INTERVAL;
        uint256 totalGameBlocks = block.number - gameConstants().GAME_START_BLOCK;
        uint256 numPastIntervals = totalGameBlocks / changeInterval;
        gs().nextChangeBlock =
            gameConstants().GAME_START_BLOCK +
            (numPastIntervals + 1) *
            changeInterval;
    }

    function getIntFromUInt(uint256 n) public pure returns (int256) {
        uint256 LOCATION_ID_UB =
            21888242871839275222246405745257275088548364400416034343698204186575808495617;
        require(n < LOCATION_ID_UB, "Number outside of AbsoluteModP Range");
        if (n > (LOCATION_ID_UB / 2)) {
            return 0 - int256(LOCATION_ID_UB - n);
        }

        return int256(n);
    }
}
