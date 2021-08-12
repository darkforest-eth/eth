// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "./DarkForestCore.sol";

contract DarkForestScoreMap {
    // We keep a reference to the game contract so that we can ask it questions about the game's state.
    DarkForestCore coreContract;

    /**
     * Each time someone claims a planet, we insert an instance of this struct into `claimedCoords`
     */
    struct ClaimedCoords {
        uint256 locationId;
        uint256 x;
        uint256 y;
        address claimer;
        uint256 score;
        uint256 claimedAt;
    }

    /**
     * Map from player address to the list of planets they have claimed.
     */
    mapping(address => uint256[]) public claimedPlanetsOwners;

    /**
     * List of all claimed planetIds
     */
    uint256[] public claimedIds;

    /**
     * Map from planet id to claim data.
     */
    mapping(uint256 => ClaimedCoords) public claimedCoords;

    /**
     * Sums up all the distances of all the planets this player has claimed.
     */
    function getScore(address player) public view returns (uint256) {
        uint256 bestScore = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        uint256[] storage planetIds = claimedPlanetsOwners[player];

        for (uint256 i = 0; i < planetIds.length; i++) {
            ClaimedCoords memory claimed = claimedCoords[planetIds[i]];
            if (
                bestScore > claimed.score &&
                !coreContract.planetsExtendedInfo(planetIds[i]).destroyed
            ) {
                bestScore = claimed.score;
            }
        }

        return bestScore;
    }

    /**
     * If this planet has been claimed, gets information about the circumstances of that claim.
     */
    function getClaimedCoords(uint256 locationId) public view returns (ClaimedCoords memory) {
        return claimedCoords[locationId];
    }

    /**
     * Assuming that the given player is allowed to claim the given planet, and that the distance is
      correct, update the data that the scoring function will need.
     */
    function storePlayerClaim(
        address player,
        uint256 planetId,
        uint256 distance,
        uint256 x,
        uint256 y
    ) internal returns (address) {
        ClaimedCoords memory oldClaim = getClaimedCoords(planetId);
        uint256[] storage playerClaims = claimedPlanetsOwners[player];
        uint256[] storage oldPlayerClaimed = claimedPlanetsOwners[oldClaim.claimer];

        if (claimedCoords[planetId].claimer == address(0)) {
            claimedIds.push(planetId);
            playerClaims.push(planetId);
            claimedCoords[planetId] = ClaimedCoords({
                locationId: planetId,
                x: x,
                y: y,
                claimer: player,
                score: distance,
                claimedAt: block.timestamp
            });
            // Only execute if player is not current claimer
        } else if (claimedCoords[planetId].claimer != player) {
            playerClaims.push(planetId);
            claimedCoords[planetId].claimer = player;
            claimedCoords[planetId].claimedAt = block.timestamp;
            for (uint256 i = 0; i < oldPlayerClaimed.length; i++) {
                if (oldPlayerClaimed[i] == planetId) {
                    oldPlayerClaimed[i] = oldPlayerClaimed[oldPlayerClaimed.length - 1];
                    oldPlayerClaimed.pop();
                    break;
                }
            }
        }
        // return previous claimer for event emission
        return oldClaim.claimer;
    }

    /**
     * Returns the total amount of planets that have been claimed. A planet does not get counted
     * more than once if it's been claimed by multiple people.
     */
    function getNClaimedPlanets() public view returns (uint256) {
        return claimedIds.length;
    }

    /**
     * API for loading a sublist of the set of claimed planets, so that clients can download this
     * info without DDOSing xDai.
     */
    function bulkGetClaimedPlanetIds(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (uint256[] memory ret)
    {
        // return slice of revealedPlanetIds array from startIdx through endIdx - 1
        ret = new uint256[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = claimedIds[i];
        }
    }

    /**
     * API for loading a sublist of the set of claimed planets, so that clients can download this
     * info without DDOSing xDai.
     */
    function bulkGetClaimedCoordsByIds(uint256[] calldata ids)
        public
        view
        returns (ClaimedCoords[] memory ret)
    {
        ret = new ClaimedCoords[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = claimedCoords[ids[i]];
        }
    }
}
