// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// Library imports
import {ABDKMath64x64} from "../vendor/libraries/ABDKMath64x64.sol";
import {LibGameUtils} from "../libraries/LibGameUtils.sol";
import {LibArtifactUtils} from "../libraries/LibArtifactUtils.sol";
import {LibPlanet} from "../libraries/LibPlanet.sol";
import {Verifier} from "../Verifier.sol";

// Storage imports
import {WithStorage} from "../libraries/LibStorage.sol";

// Type imports
import {
    ArrivalData,
    ArrivalType,
    Artifact,
    ArtifactType,
    DFPCreateArrivalArgs,
    DFPMoveArgs,
    Planet,
    PlanetExtendedInfo,
    PlanetExtendedInfo2,
    PlanetEventMetadata,
    PlanetEventType,
    Upgrade
} from "../DFTypes.sol";

contract DFMoveFacet is WithStorage {
    modifier notPaused() {
        require(!gs().paused, "Game is paused");
        _;
    }

    event ArrivalQueued(
        address player,
        uint256 arrivalId,
        uint256 from,
        uint256 to,
        uint256 artifactId,
        uint256 abandoning
    );

    function move(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[14] memory _input
    ) public notPaused returns (uint256) {
        LibGameUtils.revertIfBadSnarkPerlinFlags(
            [_input[5], _input[6], _input[7], _input[8], _input[9]],
            false
        );

        DFPMoveArgs memory args =
            DFPMoveArgs({
                oldLoc: _input[0],
                newLoc: _input[1],
                maxDist: _input[4],
                popMoved: _input[10],
                silverMoved: _input[11],
                movedArtifactId: _input[12],
                abandoning: _input[13],
                sender: msg.sender
            });

        if (_isSpaceshipMove(args)) {
            // If spaceships moves are not address(0)
            // they can conquer planets with 0 energy
            args.sender = address(0);
        }

        uint256 newPerlin = _input[2];
        uint256 newRadius = _input[3];

        if (!snarkConstants().DISABLE_ZK_CHECKS) {
            uint256[10] memory _proofInput =
                [
                    args.oldLoc,
                    args.newLoc,
                    newPerlin,
                    newRadius,
                    args.maxDist,
                    _input[5],
                    _input[6],
                    _input[7],
                    _input[8],
                    _input[9]
                ];
            require(Verifier.verifyMoveProof(_a, _b, _c, _proofInput), "Failed move proof check");
        }

        // check radius
        require(newRadius <= gs().worldRadius, "Attempting to move out of bounds");

        // Refresh fromPlanet first before doing any action on it
        LibPlanet.refreshPlanet(args.oldLoc);

        gs().planetEventsCount++;

        // Only perform if the toPlanet have never initialized previously
        if (!gs().planetsExtendedInfo[args.newLoc].isInitialized) {
            LibPlanet.initializePlanetWithDefaults(args.newLoc, newPerlin, false);
        } else {
            // need to do this so people can't deny service to planets with gas limit
            LibPlanet.refreshPlanet(args.newLoc);
            LibGameUtils.checkPlanetDOS(args.newLoc, args.sender);
        }

        _executeMove(args);

        LibGameUtils.updateWorldRadius();
        emit ArrivalQueued(
            msg.sender,
            gs().planetEventsCount,
            args.oldLoc,
            args.newLoc,
            args.movedArtifactId,
            args.abandoning
        );
        return (gs().planetEventsCount);
    }

    function _executeMove(DFPMoveArgs memory args) private {
        _checkMoveValidity(args);

        uint256 effectiveDistTimesHundred = args.maxDist * 100; // for precision
        ArrivalType arrivalType = ArrivalType.Normal;
        Upgrade memory temporaryUpgrade = LibGameUtils.defaultUpgrade();

        (bool wormholePresent, uint256 distModifier) = _checkWormhole(args);
        if (wormholePresent) {
            effectiveDistTimesHundred /= distModifier;
            arrivalType = ArrivalType.Wormhole;
        }

        if (!_isSpaceshipMove(args)) {
            (bool photoidPresent, Upgrade memory newTempUpgrade) = _checkPhotoid(args);
            if (photoidPresent) {
                temporaryUpgrade = newTempUpgrade;
                arrivalType = ArrivalType.Photoid;
            }
        }

        _removeSpaceshipEffectsFromOriginPlanet(args);

        uint256 popMoved = args.popMoved;
        uint256 silverMoved = args.silverMoved;
        uint256 remainingOriginPlanetPopulation = gs().planets[args.oldLoc].population - popMoved;

        if (gameConstants().SPACE_JUNK_ENABLED && !_isSpaceshipMove(args)) {
            if (args.abandoning != 0) {
                (
                    uint256 newPopMoved,
                    uint256 newSilverMoved,
                    uint256 newRemainingOriginPlanetPopulation,
                    Upgrade memory abandonUpgrade
                ) = _abandonPlanet(args);

                popMoved = newPopMoved;
                silverMoved = newSilverMoved;
                remainingOriginPlanetPopulation = newRemainingOriginPlanetPopulation;
                temporaryUpgrade = abandonUpgrade;
            }

            _transferPlanetSpaceJunkToPlayer(args);
        }

        LibGameUtils._buffPlanet(args.oldLoc, temporaryUpgrade);

        uint256 travelTime = effectiveDistTimesHundred / gs().planets[args.oldLoc].speed;

        // don't allow 0 second voyages, so that arrival can't be processed in same block
        if (travelTime == 0) {
            travelTime = 1;
        }

        // all checks pass. execute move
        // push the new move into the planetEvents array for args.newLoc
        gs().planetEvents[args.newLoc].push(
            PlanetEventMetadata(
                gs().planetEventsCount,
                PlanetEventType.ARRIVAL,
                block.timestamp + travelTime,
                block.timestamp
            )
        );

        _createArrival(
            DFPCreateArrivalArgs(
                args.sender,
                args.oldLoc,
                args.newLoc,
                args.maxDist,
                effectiveDistTimesHundred,
                popMoved,
                silverMoved,
                travelTime,
                args.movedArtifactId,
                arrivalType
            )
        );
        LibGameUtils._debuffPlanet(args.oldLoc, temporaryUpgrade);

        gs().planets[args.oldLoc].silver -= silverMoved;
        gs().planets[args.oldLoc].population = remainingOriginPlanetPopulation;
    }

    /**
        Reverts transaction if the movement is invalid.
     */
    function _checkMoveValidity(DFPMoveArgs memory args) private view {
        if (_isSpaceshipMove(args)) {
            require(args.popMoved == 0, "ship moves must move 0 energy");
            require(args.silverMoved == 0, "ship moves must move 0 silver");
            require(
                gs().artifacts[args.movedArtifactId].controller == msg.sender,
                "you can only move your own ships"
            );
        } else {
            // we want strict > so that the population can't go to 0
            require(
                gs().planets[args.oldLoc].population > args.popMoved,
                "Tried to move more population that what exists"
            );
            require(
                !gs().planetsExtendedInfo[args.newLoc].destroyed &&
                    !gs().planetsExtendedInfo[args.oldLoc].destroyed,
                "planet is destroyed"
            );
            require(
                gs().planets[args.oldLoc].owner == msg.sender,
                "Only owner account can perform that operation on planet."
            );
        }

        require(
            gs().planets[args.oldLoc].silver >= args.silverMoved,
            "Tried to move more silver than what exists"
        );

        if (args.movedArtifactId != 0) {
            require(
                gs().planetArtifacts[args.newLoc].length < 5,
                "too many artifacts on this planet"
            );
        }
    }

    function applySpaceshipDepart(
        Artifact memory artifact,
        Planet memory planet,
        PlanetExtendedInfo memory planetExtendedInfo,
        PlanetExtendedInfo2 memory planetExtendedInfo2
    )
        public
        view
        returns (
            Planet memory,
            PlanetExtendedInfo memory,
            PlanetExtendedInfo2 memory
        )
    {
        if (planet.isHomePlanet) {
            return (planet, planetExtendedInfo, planetExtendedInfo2);
        }

        if (artifact.artifactType == ArtifactType.ShipMothership) {
            planet.populationGrowth /= 2;
        } else if (artifact.artifactType == ArtifactType.ShipWhale) {
            planet.silverGrowth /= 2;
        } else if (artifact.artifactType == ArtifactType.ShipTitan) {
            // so that updating silver/energy starts from the current time,
            // as opposed to the last time that the planet was updated
            planetExtendedInfo.lastUpdated = block.timestamp;
            planetExtendedInfo2.pausers--;
        }

        return (planet, planetExtendedInfo, planetExtendedInfo2);
    }

    /**
        Undo the spaceship effects that were applied when the ship arrived on the planet.
     */
    function _removeSpaceshipEffectsFromOriginPlanet(DFPMoveArgs memory args) private {
        Artifact memory movedArtifact = gs().artifacts[args.movedArtifactId];

        Planet memory planet;
        PlanetExtendedInfo memory planetExtendedInfo;
        PlanetExtendedInfo2 memory planetExtendedInfo2;

        (planet, planetExtendedInfo, planetExtendedInfo2) = applySpaceshipDepart(
            movedArtifact,
            gs().planets[args.oldLoc],
            gs().planetsExtendedInfo[args.oldLoc],
            gs().planetsExtendedInfo2[args.oldLoc]
        );

        gs().planets[args.oldLoc] = planet;
        gs().planetsExtendedInfo[args.oldLoc] = planetExtendedInfo;
        gs().planetsExtendedInfo2[args.oldLoc] = planetExtendedInfo2;
    }

    /**
        If an active wormhole is present on the origin planet,
        return the modified distance between the origin and target
        planet.
     */
    function _checkWormhole(DFPMoveArgs memory args)
        private
        view
        returns (bool wormholePresent, uint256 effectiveDistModifier)
    {
        Artifact memory relevantWormhole;
        Artifact memory activeArtifactFrom = LibGameUtils.getActiveArtifact(args.oldLoc);
        Artifact memory activeArtifactTo = LibGameUtils.getActiveArtifact(args.newLoc);

        // TODO: take the greater rarity of these, or disallow wormholes between planets that
        // already have a wormhole between them
        if (
            activeArtifactFrom.isInitialized &&
            activeArtifactFrom.artifactType == ArtifactType.Wormhole &&
            activeArtifactFrom.wormholeTo == args.newLoc
        ) {
            relevantWormhole = activeArtifactFrom;
        } else if (
            activeArtifactTo.isInitialized &&
            activeArtifactTo.artifactType == ArtifactType.Wormhole &&
            activeArtifactTo.wormholeTo == args.oldLoc
        ) {
            relevantWormhole = activeArtifactTo;
        }

        if (relevantWormhole.isInitialized) {
            wormholePresent = true;
            uint256[6] memory speedBoosts = [uint256(1), 2, 4, 8, 16, 32];
            effectiveDistModifier = speedBoosts[uint256(relevantWormhole.rarity)];
        }
    }

    /**
        If an active photoid cannon is present, return
        the upgrade that should be applied to the origin
        planet.
     */
    function _checkPhotoid(DFPMoveArgs memory args)
        private
        returns (bool photoidPresent, Upgrade memory temporaryUpgrade)
    {
        Artifact memory activeArtifactFrom = LibGameUtils.getActiveArtifact(args.oldLoc);
        if (
            activeArtifactFrom.isInitialized &&
            activeArtifactFrom.artifactType == ArtifactType.PhotoidCannon &&
            block.timestamp - activeArtifactFrom.lastActivated >=
            gameConstants().PHOTOID_ACTIVATION_DELAY
        ) {
            photoidPresent = true;
            LibArtifactUtils.deactivateArtifact(args.oldLoc);
            temporaryUpgrade = LibGameUtils.timeDelayUpgrade(activeArtifactFrom);
        }
    }

    function _abandonPlanet(DFPMoveArgs memory args)
        private
        returns (
            uint256 popMoved,
            uint256 silverMoved,
            uint256 remainingOriginPlanetPopulation,
            Upgrade memory temporaryUpgrade
        )
    {
        require(
            // This is dependent on Arrival being the only type of planet event.
            gs().planetEvents[args.oldLoc].length == 0,
            "Cannot abandon a planet that has incoming voyages."
        );

        require(!gs().planets[args.oldLoc].isHomePlanet, "Cannot abandon home planet");

        // When abandoning a planet:
        // 1. Always send full energy and silver
        // 2. Receive a range / speed boost
        // 3. Transfer ownership to 0 address
        // 4. Place double the default amount of space pirates
        // 5. Subtract space junk from player total
        popMoved = gs().planets[args.oldLoc].population;
        silverMoved = gs().planets[args.oldLoc].silver;
        remainingOriginPlanetPopulation =
            LibGameUtils
                ._defaultPlanet(
                args
                    .oldLoc,
                gs().planets[args.oldLoc]
                    .planetLevel,
                gs().planets[args.oldLoc]
                    .planetType,
                gs().planetsExtendedInfo[args.oldLoc]
                    .spaceType,
                gameConstants()
                    .TIME_FACTOR_HUNDREDTHS
            )
                .population *
            2;
        temporaryUpgrade = LibGameUtils.abandoningUpgrade();

        uint256 planetSpaceJunk = LibGameUtils.getPlanetDefaultSpaceJunk(gs().planets[args.oldLoc]);

        if (LibGameUtils.isHalfSpaceJunk(args.oldLoc)) {
            planetSpaceJunk /= 2;
        }

        if (planetSpaceJunk >= gs().players[msg.sender].spaceJunk) {
            gs().players[msg.sender].spaceJunk = 0;
        } else {
            gs().players[msg.sender].spaceJunk -= planetSpaceJunk;
        }

        gs().planetsExtendedInfo[args.oldLoc].spaceJunk = planetSpaceJunk;
        gs().planets[args.oldLoc].owner = address(0);
    }

    /**
        Make sure players don't take on more junk than they are allowed to.
        Properly increment players space junk and remove the junk from the
        target planet.
     */
    function _transferPlanetSpaceJunkToPlayer(DFPMoveArgs memory args) private {
        require(
            (gs().players[msg.sender].spaceJunk + gs().planetsExtendedInfo[args.newLoc].spaceJunk <=
                gs().players[msg.sender].spaceJunkLimit),
            "Tried to take on more space junk than your limit"
        );

        if (gs().planetsExtendedInfo[args.newLoc].spaceJunk != 0) {
            gs().players[msg.sender].spaceJunk += gs().planetsExtendedInfo[args.newLoc].spaceJunk;
            gs().planetsExtendedInfo[args.newLoc].spaceJunk = 0;
        }
    }

    function _isSpaceshipMove(DFPMoveArgs memory args) private view returns (bool) {
        return LibArtifactUtils.isSpaceship(gs().artifacts[args.movedArtifactId].artifactType);
    }

    function _createArrival(DFPCreateArrivalArgs memory args) private {
        // enter the arrival data for event id
        Planet memory planet = gs().planets[args.oldLoc];
        uint256 popArriving =
            _getDecayedPop(
                args.popMoved,
                args.effectiveDistTimesHundred,
                planet.range,
                planet.populationCap
            );
        bool isSpaceship =
            LibArtifactUtils.isSpaceship(gs().artifacts[args.movedArtifactId].artifactType);
        // space ship moves are implemented as 0-energy moves
        require(popArriving > 0 || isSpaceship, "Not enough forces to make move");
        require(isSpaceship ? args.popMoved == 0 : true, "spaceship moves must be 0 energy moves");
        gs().planetArrivals[gs().planetEventsCount] = ArrivalData({
            id: gs().planetEventsCount,
            player: args.player, // player address or address(0) for ship moves
            fromPlanet: args.oldLoc,
            toPlanet: args.newLoc,
            popArriving: popArriving,
            silverMoved: args.silverMoved,
            departureTime: block.timestamp,
            arrivalTime: block.timestamp + args.travelTime,
            arrivalType: args.arrivalType,
            carriedArtifactId: args.movedArtifactId,
            distance: args.actualDist
        });

        if (args.movedArtifactId != 0) {
            LibGameUtils._takeArtifactOffPlanet(args.movedArtifactId, args.oldLoc);
            gs().artifactIdToVoyageId[args.movedArtifactId] = gs().planetEventsCount;
        }
    }

    function _getDecayedPop(
        uint256 _popMoved,
        uint256 distTimesHundred,
        uint256 _range,
        uint256 _populationCap
    ) private pure returns (uint256 _decayedPop) {
        int128 _scaleInv = ABDKMath64x64.exp_2(ABDKMath64x64.divu(distTimesHundred, _range * 100));
        int128 _bigPlanetDebuff = ABDKMath64x64.divu(_populationCap, 20);
        int128 _beforeDebuff = ABDKMath64x64.div(ABDKMath64x64.fromUInt(_popMoved), _scaleInv);
        if (_beforeDebuff > _bigPlanetDebuff) {
            _decayedPop = ABDKMath64x64.toUInt(ABDKMath64x64.sub(_beforeDebuff, _bigPlanetDebuff));
        } else {
            _decayedPop = 0;
        }
    }
}
