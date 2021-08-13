// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./DarkForestCore.sol";
import "./DarkForestScoreMap.sol";
import "./ABDKMath64x64.sol";

/**
 * Externally from the core game, in round 3 of dark forest v0.6, we allow players to 'claim'
 * planets. The person who claims the planet closest to (0, 0) is the winner and the rest are
 * ordered by their closest claimed planet.
 */
contract DarkForestScoringRound3 is OwnableUpgradeable, DarkForestScoreMap {
    uint256 public roundEnd;
    GameConstants public gameConstants;

    mapping(address => uint256) lastClaimTimestamp;
    struct LastClaimedStruct {
        address player;
        uint256 lastClaimTimestamp;
    }
    event LocationClaimed(address revealer, address previousClaimer, uint256 loc);

    function initialize(
        address _coreContractAddress,
        string memory _roundName,
        uint256 _roundEnd,
        uint256 claimPlanetCooldown
    ) public initializer {
        __Ownable_init();
        coreContract = DarkForestCore(_coreContractAddress);
        roundEnd = _roundEnd;

        gameConstants = GameConstants({
            ROUND_NAME: _roundName,
            CLAIM_PLANET_COOLDOWN_SECONDS: claimPlanetCooldown
        });
    }

    function bulkGetLastClaimTimestamp(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (LastClaimedStruct[] memory ret)
    {
        ret = new LastClaimedStruct[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            address player = coreContract.playerIds(i);
            ret[i - startIdx] = LastClaimedStruct({
                player: player,
                lastClaimTimestamp: lastClaimTimestamp[player]
            });
        }
    }

    /**
     * Returns the last time that the given player claimed a planet.
     */
    function getLastClaimTimestamp(address player) public view returns (uint256) {
        return lastClaimTimestamp[player];
    }

    /**
     * Calculates the distance of the given coordinate from (0, 0).
     */
    function distanceFromCenter(uint256 x, uint256 y) private pure returns (uint256) {
        if (x == 0 && y == 0) {
            return 0;
        }

        uint256 distance =
            ABDKMath64x64.toUInt(
                ABDKMath64x64.sqrt(
                    ABDKMath64x64.add(
                        ABDKMath64x64.pow(ABDKMath64x64.fromUInt(x), 2),
                        ABDKMath64x64.pow(ABDKMath64x64.fromUInt(y), 2)
                    )
                )
            );

        return distance;
    }

    // `x`, `y` are in `{0, 1, 2, ..., LOCATION_ID_UB - 1}` by convention, if a number `n` is
    // greater than `LOCATION_ID_UB / 2`, it is considered a negative number whose "actual" value is
    // `n - LOCATION_ID_UB` this code snippet calculates the absolute value of `x` or `y` (given the
    // above convention)
    function getAbsoluteModP(uint256 n) private pure returns (uint256) {
        uint256 LOCATION_ID_UB =
            21888242871839275222246405745257275088548364400416034343698204186575808495617;
        require(n < LOCATION_ID_UB, "Number outside of AbsoluteModP Range");
        if (n > SafeMathUpgradeable.div(LOCATION_ID_UB, 2)) {
            return SafeMathUpgradeable.sub(LOCATION_ID_UB, n);
        }

        return n;
    }

    function setRoundEnd(uint256 _roundEnd) public onlyOwner {
        roundEnd = _roundEnd;
    }

    //  In dark forest v0.6 r3, players can claim planets that own. This will reveal a planets a
    //  coordinates to all other players. A Player's score is determined by taking the distance of
    //  their closest planet from the center of the universe. A planet can be claimed multiple
    //  times, but only the last player to claim a planet can use it as part of their score.
    function claim(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[9] memory _input
    ) public {
        require(block.timestamp < roundEnd, "Cannot claim planets after the round has ended");
        require(
            block.timestamp - lastClaimTimestamp[msg.sender] >
                gameConstants.CLAIM_PLANET_COOLDOWN_SECONDS,
            "wait for cooldown before revealing again"
        );
        require(
            coreContract.planetsExtendedInfo(_input[0]).isInitialized,
            "Cannot claim uninitialized planet"
        );
        require(coreContract.checkRevealProof(_a, _b, _c, _input), "Failed reveal pf check");
        uint256 x = _input[2];
        uint256 y = _input[3];

        coreContract.refreshPlanet(_input[0]);
        DarkForestTypes.Planet memory planet = coreContract.planets(_input[0]);
        require(planet.owner == msg.sender, "Only planet owner can perform operation on planets");
        require(planet.planetLevel >= 3, "Planet level must >= 3");
        require(
            !coreContract.planetsExtendedInfo(_input[0]).destroyed,
            "Cannot claim destroyed planet"
        );
        lastClaimTimestamp[msg.sender] = block.timestamp;
        address previousClaimer =
            storePlayerClaim(
                msg.sender,
                _input[0],
                distanceFromCenter(getAbsoluteModP(x), getAbsoluteModP(y)),
                x,
                y
            );
        emit LocationClaimed(msg.sender, previousClaimer, _input[0]);
    }

    struct GameConstants {
        string ROUND_NAME;
        uint256 CLAIM_PLANET_COOLDOWN_SECONDS;
    }
}
