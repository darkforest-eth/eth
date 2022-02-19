// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// External contract imports
import {DFWhitelistFacet} from "./DFWhitelistFacet.sol";

// Library imports
import {Verifier} from "../Verifier.sol";
import {ABDKMath64x64} from "../vendor/libraries/ABDKMath64x64.sol";
import {LibDiamond} from "../vendor/libraries/LibDiamond.sol";
import {LibGameUtils} from "../libraries/LibGameUtils.sol";
import {LibArtifactUtils} from "../libraries/LibArtifactUtils.sol";
import {LibPlanet} from "../libraries/LibPlanet.sol";

// Storage imports
import {WithStorage} from "../libraries/LibStorage.sol";

// Type imports
import {
    SpaceType,
    Planet,
    PlanetExtendedInfo,
    PlanetExtendedInfo2,
    Player,
    ArtifactType,
    DFPInitPlanetArgs,
    DFPMoveArgs,
    DFPFindArtifactArgs,
    AdminCreatePlanetArgs
} from "../DFTypes.sol";

contract DFCoreFacet is WithStorage {
    using ABDKMath64x64 for *;

    event PlayerInitialized(address player, uint256 loc);
    event PlanetUpgraded(address player, uint256 loc, uint256 branch, uint256 toBranchLevel); // emitted in DFPlanet library
    event PlanetHatBought(address player, uint256 loc, uint256 tohatLevel);
    event PlanetTransferred(address sender, uint256 loc, address receiver);
    event LocationRevealed(address revealer, uint256 loc, uint256 x, uint256 y);

    event PlanetProspected(address player, uint256 loc);
    event ArtifactFound(address player, uint256 artifactId, uint256 loc);
    event ArtifactDeposited(address player, uint256 artifactId, uint256 loc);
    event ArtifactWithdrawn(address player, uint256 artifactId, uint256 loc);
    event ArtifactActivated(address player, uint256 artifactId, uint256 loc); // emitted in DFPlanet library
    event ArtifactDeactivated(address player, uint256 artifactId, uint256 loc); // emitted in DFPlanet library

    event PlanetSilverWithdrawn(address player, uint256 loc, uint256 amount);

    //////////////////////
    /// ACCESS CONTROL ///
    //////////////////////

    modifier onlyWhitelisted() {
        require(
            DFWhitelistFacet(address(this)).isWhitelisted(msg.sender) ||
                msg.sender == LibDiamond.contractOwner(),
            "Player is not whitelisted"
        );
        _;
    }

    modifier disabled() {
        require(false, "This functionality is disabled for the current round.");
        _;
    }

    modifier notPaused() {
        require(!gs().paused, "Game is paused");
        _;
    }

    modifier notTokenEnded() {
        require(block.timestamp < gs().TOKEN_MINT_END_TIMESTAMP, "Token mint period has ended");
        _;
    }

    //////////////////////
    /// Game Mechanics ///
    //////////////////////

    function refreshPlanet(uint256 location) public notPaused {
        LibPlanet.refreshPlanet(location);
    }

    function getRefreshedPlanet(uint256 location, uint256 timestamp)
        public
        view
        returns (
            Planet memory,
            PlanetExtendedInfo memory,
            PlanetExtendedInfo2 memory,
            uint256[12] memory eventsToRemove,
            uint256[12] memory artifactsToAdd
        )
    {
        return LibPlanet.getRefreshedPlanet(location, timestamp);
    }

    function checkRevealProof(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[9] memory _input
    ) public view returns (bool) {
        if (!snarkConstants().DISABLE_ZK_CHECKS) {
            require(Verifier.verifyRevealProof(_a, _b, _c, _input), "Failed reveal pf check");
        }

        LibGameUtils.revertIfBadSnarkPerlinFlags(
            [_input[4], _input[5], _input[6], _input[7], _input[8]],
            false
        );

        return true;
    }

    function revealLocation(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[9] memory _input
    ) public onlyWhitelisted returns (uint256) {
        require(checkRevealProof(_a, _b, _c, _input), "Failed reveal pf check");

        if (!gs().planetsExtendedInfo[_input[0]].isInitialized) {
            LibPlanet.initializePlanetWithDefaults(_input[0], _input[1], false);
        }

        LibPlanet.revealLocation(
            _input[0],
            _input[1],
            _input[2],
            _input[3],
            msg.sender != LibDiamond.contractOwner()
        );
        emit LocationRevealed(msg.sender, _input[0], _input[2], _input[3]);
    }

    function initializePlayer(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[8] memory _input
    ) public onlyWhitelisted returns (uint256) {
        LibPlanet.initializePlanet(_a, _b, _c, _input, true);

        uint256 _location = _input[0];
        uint256 _perlin = _input[1];
        uint256 _radius = _input[2];

        require(LibPlanet.checkPlayerInit(_location, _perlin, _radius));

        // Initialize player data
        gs().playerIds.push(msg.sender);
        gs().players[msg.sender] = Player(
            true,
            msg.sender,
            block.timestamp,
            _location,
            0,
            0,
            0,
            gameConstants().SPACE_JUNK_LIMIT,
            false
        );

        LibGameUtils.updateWorldRadius();
        emit PlayerInitialized(msg.sender, _location);
        return _location;
    }

    /**
      Gives players 5 spaceships on their home planet. Can only be called once
      by a given player. This is a first pass at getting spaceships into the game.
      Eventually ships will be able to spawn in the game naturally (construction, capturing, etc.)
     */
    function giveSpaceShips(uint256 locationId) public onlyWhitelisted {
        require(!gs().players[msg.sender].claimedShips, "player already claimed ships");
        require(
            gs().planets[locationId].owner == msg.sender && gs().planets[locationId].isHomePlanet,
            "you can only spawn ships on your home planet"
        );

        address owner = gs().planets[locationId].owner;
        uint256 id1 =
            LibArtifactUtils.createAndPlaceSpaceship(
                locationId,
                owner,
                ArtifactType.ShipMothership
            );
        uint256 id2 =
            LibArtifactUtils.createAndPlaceSpaceship(locationId, owner, ArtifactType.ShipCrescent);
        uint256 id3 =
            LibArtifactUtils.createAndPlaceSpaceship(locationId, owner, ArtifactType.ShipWhale);
        uint256 id4 =
            LibArtifactUtils.createAndPlaceSpaceship(locationId, owner, ArtifactType.ShipGear);
        uint256 id5 =
            LibArtifactUtils.createAndPlaceSpaceship(locationId, owner, ArtifactType.ShipTitan);

        emit ArtifactFound(msg.sender, id1, locationId);
        emit ArtifactFound(msg.sender, id2, locationId);
        emit ArtifactFound(msg.sender, id3, locationId);
        emit ArtifactFound(msg.sender, id4, locationId);
        emit ArtifactFound(msg.sender, id5, locationId);

        gs().players[msg.sender].claimedShips = true;
    }

    function upgradePlanet(uint256 _location, uint256 _branch)
        public
        notPaused
        returns (uint256, uint256)
    {
        // _branch specifies which of the three upgrade branches player is leveling up
        // 0 improves silver production and capacity
        // 1 improves population
        // 2 improves range
        refreshPlanet(_location);
        LibPlanet.upgradePlanet(_location, _branch);
        return (_location, _branch);
    }

    function transferPlanet(uint256 _location, address _player) public notPaused {
        require(gameConstants().PLANET_TRANSFER_ENABLED, "planet transferring is disabled");

        require(
            gs().planetsExtendedInfo[_location].isInitialized == true,
            "Planet is not initialized"
        );

        refreshPlanet(_location);

        require(
            gs().planets[_location].owner == msg.sender,
            "Only owner account can perform that operation on planet."
        );

        require(_player != msg.sender, "Cannot transfer planet to self");

        require(
            gs().players[_player].isInitialized,
            "Can only transfer ownership to initialized players"
        );

        require(
            !gs().planetsExtendedInfo[_location].destroyed,
            "can't transfer a destroyed planet"
        );

        gs().planets[_location].owner = _player;

        emit PlanetTransferred(msg.sender, _location, _player);
    }

    function buyHat(uint256 _location) public payable notPaused {
        require(
            gs().planetsExtendedInfo[_location].isInitialized == true,
            "Planet is not initialized"
        );
        refreshPlanet(_location);

        require(
            gs().planets[_location].owner == msg.sender,
            "Only owner account can perform that operation on planet."
        );

        uint256 cost = (1 << gs().planetsExtendedInfo[_location].hatLevel) * 1 ether;

        require(msg.value == cost, "Wrong value sent");

        gs().planetsExtendedInfo[_location].hatLevel += 1;
        emit PlanetHatBought(msg.sender, _location, gs().planetsExtendedInfo[_location].hatLevel);
    }

    function findArtifact(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[7] memory _input
    ) public notPaused notTokenEnded {
        uint256 planetId = _input[0];
        uint256 biomebase = _input[1];

        LibGameUtils.revertIfBadSnarkPerlinFlags(
            [_input[2], _input[3], _input[4], _input[5], _input[6]],
            true
        );

        refreshPlanet(planetId);

        if (!snarkConstants().DISABLE_ZK_CHECKS) {
            require(
                Verifier.verifyBiomebaseProof(_a, _b, _c, _input),
                "biome zkSNARK failed doesn't check out"
            );
        }

        uint256 foundArtifactId =
            LibArtifactUtils.findArtifact(DFPFindArtifactArgs(planetId, biomebase, address(this)));

        emit ArtifactFound(msg.sender, foundArtifactId, planetId);
    }

    function depositArtifact(uint256 locationId, uint256 artifactId) public notPaused {
        // should this be implemented as logic that is triggered when a player sends
        // an artifact to the contract with locationId in the extra data?
        // might be better use of the ERC721 standard - can use safeTransfer then
        refreshPlanet(locationId);

        LibArtifactUtils.depositArtifact(locationId, artifactId, address(this));

        emit ArtifactDeposited(msg.sender, artifactId, locationId);
    }

    // withdraws the given artifact from the given planet. you must own the planet,
    // the artifact must be on the given planet
    function withdrawArtifact(uint256 locationId, uint256 artifactId) public notPaused {
        refreshPlanet(locationId);

        LibArtifactUtils.withdrawArtifact(locationId, artifactId);

        emit ArtifactWithdrawn(msg.sender, artifactId, locationId);
    }

    // activates the given artifact on the given planet. the artifact must have
    // been previously deposited on this planet. the artifact cannot be activated
    // within a certain cooldown period, depending on the artifact type
    function activateArtifact(
        uint256 locationId,
        uint256 artifactId,
        uint256 wormholeTo
    ) public notPaused {
        refreshPlanet(locationId);

        if (wormholeTo != 0) {
            refreshPlanet(wormholeTo);
        }

        LibArtifactUtils.activateArtifact(locationId, artifactId, wormholeTo);
        // event is emitted in the above library function
    }

    // if there's an activated artifact on this planet, deactivates it. otherwise reverts.
    // deactivating an artifact this debuffs the planet, and also removes whatever special
    // effect that the artifact bestowned upon this planet.
    function deactivateArtifact(uint256 locationId) public notPaused {
        refreshPlanet(locationId);

        LibArtifactUtils.deactivateArtifact(locationId);
        // event is emitted in the above library function
    }

    // in order to be able to find an artifact on a planet, the planet
    // must first be 'prospected'. prospecting commits to a currently-unknown
    // seed that is used to randomly generate the artifact that will be
    // found on this planet.
    function prospectPlanet(uint256 locationId) public notPaused {
        refreshPlanet(locationId);
        LibArtifactUtils.prospectPlanet(locationId);
        emit PlanetProspected(msg.sender, locationId);
    }

    // withdraw silver
    function withdrawSilver(uint256 locationId, uint256 amount) public notPaused {
        refreshPlanet(locationId);
        LibPlanet.withdrawSilver(locationId, amount);
        emit PlanetSilverWithdrawn(msg.sender, locationId, amount);
    }
}
