// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.9;
pragma experimental ABIEncoderV2;

// Import base Initializable contract
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/MathUpgradeable.sol";
import "./Verifier.sol";
import "./DarkForestStorageV1.sol";
import "./DarkForestTokens.sol";
import "./DarkForestUtils.sol";
import "./DarkForestPlanet.sol";
import "./DarkForestLazyUpdate.sol";
import "./DarkForestInitialize.sol";

// .______       _______     ___       _______  .___  ___.  _______
// |   _  \     |   ____|   /   \     |       \ |   \/   | |   ____|
// |  |_)  |    |  |__     /  ^  \    |  .--.  ||  \  /  | |  |__
// |      /     |   __|   /  /_\  \   |  |  |  ||  |\/|  | |   __|
// |  |\  \----.|  |____ /  _____  \  |  '--'  ||  |  |  | |  |____
// | _| `._____||_______/__/     \__\ |_______/ |__|  |__| |_______|
//
// READ THIS FIRST BEFORE EDITING ANYTHING IN THIS FILE:
// https://docs.openzeppelin.com/learn/upgrading-smart-contracts#limitations-of-contract-upgrades
//
// DO NOT ADD ANY STORAGE VARIABLES IN THIS FILE
// IT SHOULD BELONG AT STORAGE CONTRACTS
// ADDING STORAGE VARIABLES HERE WI LL BLOCK ANY STORAGE CONTRACTS FROM EVER
// ADDING THEIR OWN VARIABLES EVER AGAIN.

contract DarkForestCore is Initializable, DarkForestStorageV1 {
    using ABDKMath64x64 for *;
    using SafeMathUpgradeable for *;
    using MathUpgradeable for uint256;

    event PlayerInitialized(address player, uint256 loc);
    event ArrivalQueued(uint256 arrivalId);
    event PlanetUpgraded(uint256 loc);
    event BoughtHat(uint256 loc);
    event PlanetTransferred(uint256 loc, address player);
    event FoundArtifact(uint256 loc, address player, uint256 artifactId);
    event DepositedArtifact(uint256 loc, address player, uint256 artifactId);
    event WithdrewArtifact(uint256 loc, address player, uint256 artifactId);

    function initialize(
        address _adminAddress,
        address payable _whitelistAddress,
        address payable _tokensAddress,
        bool _disableZKCheck
    ) public initializer {
        adminAddress = _adminAddress;
        whitelist = Whitelist(_whitelistAddress);
        tokens = DarkForestTokens(_tokensAddress);

        paused = false;

        DISABLE_ZK_CHECK = _disableZKCheck;

        tokenMintEndTimestamp = 1611584314; // a month from contract deploy - 01/25/21 2:18:34 GMT
        target4RadiusConstant = 800;

        planetLevelThresholds = [
            16777216,
            4194256,
            1048516,
            262081,
            65472,
            16320,
            4032,
            960
        ];

        DarkForestInitialize.initializeDefaults(planetDefaultStats);
        DarkForestInitialize.initializeUpgrades(upgrades);

        initializedPlanetCountByLevel = [0, 0, 0, 0, 0, 0, 0, 0];
        for (uint256 i = 0; i < planetLevelThresholds.length; i += 1) {
            cumulativeRarities.push(
                (2**24 / planetLevelThresholds[i]) * PLANET_RARITY
            );
        }

        _updateWorldRadius();
    }

    //////////////////////
    /// ACCESS CONTROL ///
    //////////////////////
    modifier onlyAdmin() {
        require(msg.sender == adminAddress, "Sender is not a game master");
        _;
    }

    modifier onlyWhitelisted() {
        require(
            whitelist.isWhitelisted(msg.sender),
            "Player is not whitelisted"
        );
        _;
    }

    modifier notPaused() {
        require(!paused, "Game is paused");
        _;
    }

    modifier notTokenEnded() {
        require(
            block.timestamp < tokenMintEndTimestamp,
            "Token mint period has ended"
        );
        _;
    }

    function changeAdmin(address _newAdmin) public onlyAdmin {
        require(_newAdmin != address(0), "newOwner cannot be 0x0");
        adminAddress = _newAdmin;
    }

    /////////////////////////////
    /// Administrative Engine ///
    /////////////////////////////

    function pause() public onlyAdmin {
        require(!paused, "Game is already paused");
        paused = true;
    }

    function unpause() public onlyAdmin {
        require(paused, "Game is already unpaused");
        paused = false;
    }

    function changeTokenMintEndTime(uint256 _newEnd) public onlyAdmin {
        tokenMintEndTimestamp = _newEnd;
    }

    function changeTarget4RadiusConstant(uint256 _newConstant)
        public
        onlyAdmin
    {
        target4RadiusConstant = _newConstant;
        _updateWorldRadius();
    }

    function withdraw() public onlyAdmin {
        msg.sender.transfer(address(this).balance);
    }

    //////////////
    /// Helper ///
    //////////////

    // Public helper getters
    function getNPlanets() public view returns (uint256) {
        return planetIds.length;
    }

    function bulkGetPlanetIds(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (uint256[] memory ret)
    {
        // return slice of planetIds array from startIdx through endIdx - 1
        ret = new uint256[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = planetIds[i];
        }
    }

    function bulkGetPlanetsByIds(uint256[] calldata ids)
        public
        view
        returns (DarkForestTypes.Planet[] memory ret)
    {
        ret = new DarkForestTypes.Planet[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = planets[ids[i]];
        }
    }

    function bulkGetPlanetArrivalsByIds(uint256[] calldata ids)
        public
        view
        returns (DarkForestTypes.ArrivalData[][] memory)
    {

            DarkForestTypes.ArrivalData[][] memory ret
         = new DarkForestTypes.ArrivalData[][](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = getPlanetArrivals(ids[i]);
        }

        return ret;
    }

    // this is meant to be called by a subgraph indexer at the exact timestamp
    // that a newly-initiated arrival occurs.
    // without it, in order to retrieve the most recent state of the from- and to-planets
    // we have to make five contract calls per new arrival id: arrival data by id, and
    // both planets and planetsExtendedInfo for both from- and to-planets
    // with this we just have to make one call, since only owner/pop/silver would be modified
    function bulkGetCompactArrivalsByIds(uint256[] calldata ids)
        public
        view
        returns (DarkForestTypes.CompactArrival[] memory ret)
    {
        ret = new DarkForestTypes.CompactArrival[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            DarkForestTypes.ArrivalData memory arrival = planetArrivals[ids[i]];
            DarkForestTypes.Planet memory from = planets[arrival.fromPlanet];
            DarkForestTypes.Planet memory to = planets[arrival.toPlanet];
            ret[i] = DarkForestTypes.CompactArrival({
                popArriving: arrival.popArriving,
                silverMoved: arrival.silverMoved,
                departureTime: arrival.departureTime,
                arrivalTime: arrival.arrivalTime,
                fromPlanet: arrival.fromPlanet,
                fromPlanetOwner: from.owner,
                fromPlanetPopulation: from.population,
                fromPlanetSilver: from.silver,
                toPlanet: arrival.toPlanet,
                toPlanetOwner: to.owner,
                toPlanetPopulation: to.population,
                toPlanetSilver: to.silver
            });
        }
    }

    function bulkGetPlanetsExtendedInfoByIds(uint256[] calldata ids)
        public
        view
        returns (DarkForestTypes.PlanetExtendedInfo[] memory ret)
    {
        ret = new DarkForestTypes.PlanetExtendedInfo[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = planetsExtendedInfo[ids[i]];
        }
    }

    function bulkGetPlanets(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (DarkForestTypes.Planet[] memory ret)
    {
        // return array of planets corresponding to planetIds[startIdx] through planetIds[endIdx - 1]
        ret = new DarkForestTypes.Planet[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = planets[planetIds[i]];
        }
    }

    function bulkGetPlanetsExtendedInfo(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (DarkForestTypes.PlanetExtendedInfo[] memory ret)
    {
        // return array of planets corresponding to planetIds[startIdx] through planetIds[endIdx - 1]
        ret = new DarkForestTypes.PlanetExtendedInfo[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = planetsExtendedInfo[planetIds[i]];
        }
    }

    function getNPlayers() public view returns (uint256) {
        return playerIds.length;
    }

    function bulkGetPlayers(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (address[] memory ret)
    {
        // return slice of players array from startIdx through endIdx - 1
        ret = new address[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = playerIds[i];
        }
    }

    function getPlanetLevelThresholds() public view returns (uint256[] memory) {
        return planetLevelThresholds;
    }

    function getPlanetCumulativeRarities()
        public
        view
        returns (uint256[] memory)
    {
        return cumulativeRarities;
    }

    function getPlanetArrivals(uint256 _location)
        public
        view
        returns (DarkForestTypes.ArrivalData[] memory ret)
    {
        uint256 arrivalCount = 0;
        for (uint256 i = 0; i < planetEvents[_location].length; i += 1) {
            if (
                planetEvents[_location][i].eventType ==
                DarkForestTypes.PlanetEventType.ARRIVAL
            ) {
                arrivalCount += 1;
            }
        }
        ret = new DarkForestTypes.ArrivalData[](arrivalCount);
        uint256 count = 0;
        for (uint256 i = 0; i < planetEvents[_location].length; i += 1) {
            if (
                planetEvents[_location][i].eventType ==
                DarkForestTypes.PlanetEventType.ARRIVAL
            ) {
                ret[count] = planetArrivals[planetEvents[_location][i].id];
                count++;
            }
        }
    }

    function bulkGetPlanetArrivals(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (DarkForestTypes.ArrivalData[][] memory)
    {
        // return array of planets corresponding to planetIds[startIdx] through planetIds[endIdx - 1]


            DarkForestTypes.ArrivalData[][] memory ret
         = new DarkForestTypes.ArrivalData[][](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = getPlanetArrivals(planetIds[i]);
        }
        return ret;
    }

    function getDefaultStats()
        public
        view
        returns (DarkForestTypes.PlanetDefaultStats[] memory)
    {

            DarkForestTypes.PlanetDefaultStats[] memory ret
         = new DarkForestTypes.PlanetDefaultStats[](
            planetLevelThresholds.length
        );
        for (uint256 i = 0; i < planetLevelThresholds.length; i += 1) {
            ret[i] = planetDefaultStats[i];
        }
        return ret;
    }

    function getUpgrades()
        public
        view
        returns (DarkForestTypes.Upgrade[4][3] memory)
    {
        return upgrades;
    }

    function getPlayerArtifactIds(address playerId)
        public
        view
        returns (uint256[] memory)
    {
        return tokens.getPlayerArtifactIds(playerId);
    }

    function doesArtifactExist(uint256 tokenId) public view returns (bool) {
        return tokens.doesArtifactExist(tokenId);
    }

    function getArtifactById(uint256 artifactId)
        public
        view
        returns (DarkForestTypes.ArtifactWithMetadata memory ret)
    {
        DarkForestTypes.Artifact memory artifact = tokens.getArtifact(
            artifactId
        );
        DarkForestTypes.Upgrade memory upgrade = DarkForestUtils
            ._getUpgradeForArtifact(artifact);
        ret = DarkForestTypes.ArtifactWithMetadata({
            artifact: artifact,
            upgrade: upgrade,
            owner: tokens.ownerOf(artifact.id),
            locationId: contractOwnedArtifactLocations[artifact.id]
        });
    }

    function bulkGetArtifactsByIds(uint256[] calldata ids)
        public
        view
        returns (DarkForestTypes.ArtifactWithMetadata[] memory ret)
    {
        ret = new DarkForestTypes.ArtifactWithMetadata[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            DarkForestTypes.Artifact memory artifact = tokens.getArtifact(
                ids[i]
            );
            DarkForestTypes.Upgrade memory upgrade = DarkForestUtils
                ._getUpgradeForArtifact(artifact);
            ret[i] = DarkForestTypes.ArtifactWithMetadata({
                artifact: artifact,
                upgrade: upgrade,
                owner: tokens.ownerOf(artifact.id),
                locationId: contractOwnedArtifactLocations[artifact.id]
            });
        }
    }

    // private utilities

    function _locationIdValid(uint256 _loc) public pure returns (bool) {
        return (_loc <
            (21888242871839275222246405745257275088548364400416034343698204186575808495617 /
                PLANET_RARITY));
    }

    // Private helpers that modify state
    function _updateWorldRadius() private {
        worldRadius = DarkForestUtils._getRadius(
            initializedPlanetCountByLevel,
            cumulativeRarities,
            playerIds.length,
            target4RadiusConstant
        );
    }

    function _initializePlanet(
        uint256 _location,
        uint256 _perlin,
        bool _isHomePlanet
    ) private {
        require(_locationIdValid(_location), "Not a valid planet location");

        (
            uint256 _level,
            DarkForestTypes.PlanetResource _resource
        ) = DarkForestUtils._getPlanetLevelAndResource(
            _location,
            _perlin,
            PERLIN_THRESHOLD_1,
            PERLIN_THRESHOLD_2,
            SILVER_RARITY_1,
            SILVER_RARITY_2,
            SILVER_RARITY_3,
            planetLevelThresholds,
            planetDefaultStats
        );

        if (_isHomePlanet) {
            require(_level == 0, "Can only initialize on planet level 0");
        }

        DarkForestPlanet.initializePlanet(
            planets[_location],
            planetsExtendedInfo[_location],
            planetDefaultStats[_level],
            _perlin,
            TIME_FACTOR_HUNDREDTHS,
            PERLIN_THRESHOLD_1,
            PERLIN_THRESHOLD_2,
            _resource,
            _level,
            _location
        );
        planetIds.push(_location);
        initializedPlanetCountByLevel[_level] += 1;
    }

    //////////////////////
    /// Game Mechanics ///
    //////////////////////

    function refreshPlanet(uint256 _location) public onlyWhitelisted notPaused {
        DarkForestPlanet.refreshPlanet(
            _location,
            planets,
            planetsExtendedInfo,
            planetEvents,
            planetArrivals
        );
    }

    function initializePlayer(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[3] memory _input
    ) public onlyWhitelisted notPaused returns (uint256) {
        if (!DISABLE_ZK_CHECK) {
            require(
                Verifier.verifyInitProof(_a, _b, _c, _input),
                "Failed init proof check"
            );
        }

        uint256 _location = _input[0];
        uint256 _perlin = _input[1];
        uint256 _radius = _input[2];

        require(
            DarkForestPlanet.checkInit(
                _location,
                _perlin,
                _radius,
                isPlayerInitialized,
                planetsExtendedInfo,
                worldRadius,
                PERLIN_THRESHOLD_1
            )
        );

        // Initialize player data
        isPlayerInitialized[msg.sender] = true;
        playerIds.push(msg.sender);

        // Initialize planet information
        _initializePlanet(_location, _perlin, true);
        planets[_location].owner = msg.sender;
        planets[_location].population = 50000;
        _updateWorldRadius();
        emit PlayerInitialized(msg.sender, _location);
        return _location;
    }

    function move(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[7] memory _input
    ) public notPaused returns (uint256) {
        uint256 _oldLoc = _input[0];
        uint256 _newLoc = _input[1];
        uint256 _newPerlin = _input[2];
        uint256 _newRadius = _input[3];
        uint256 _maxDist = _input[4];
        uint256 _popMoved = _input[5];
        uint256 _silverMoved = _input[6];

        if (!DISABLE_ZK_CHECK) {
            uint256[5] memory _proofInput = [
                _oldLoc,
                _newLoc,
                _newPerlin,
                _newRadius,
                _maxDist
            ];
            require(
                Verifier.verifyMoveProof(_a, _b, _c, _proofInput),
                "Failed move proof check"
            );
        }

        // check radius
        require(_newRadius <= worldRadius, "Attempting to move out of bounds");

        // Only perform if the toPlanet have never initialized previously
        if (!planetsExtendedInfo[_newLoc].isInitialized) {
            _initializePlanet(_newLoc, _newPerlin, false);
        } else {
            // need to do this so people can't deny service to planets with gas limit
            refreshPlanet(_newLoc);
            uint8 arrivalsFromOwner = 0;
            uint8 arrivalsFromOthers = 0;
            for (uint8 i = 0; i < planetEvents[_newLoc].length; i++) {
                if (
                    planetEvents[_newLoc][i].eventType ==
                    DarkForestTypes.PlanetEventType.ARRIVAL
                ) {
                    if (
                        planetArrivals[planetEvents[_newLoc][i].id].player ==
                        planets[_newLoc].owner
                    ) {
                        arrivalsFromOwner++;
                    } else {
                        arrivalsFromOthers++;
                    }
                }
            }
            if (msg.sender == planets[_newLoc].owner) {
                require(arrivalsFromOwner < 6, "Planet is rate-limited");
            } else {
                require(arrivalsFromOthers < 6, "Planet is rate-limited");
            }
        }

        // Refresh fromPlanet first before doing any action on it
        refreshPlanet(_oldLoc);
        DarkForestPlanet.move(
            _oldLoc,
            _newLoc,
            _maxDist,
            _popMoved,
            _silverMoved,
            planetEventsCount,
            planets,
            planetsExtendedInfo,
            planetEvents,
            planetArrivals
        );

        planetEventsCount++;

        _updateWorldRadius();
        emit ArrivalQueued(planetEventsCount - 1);
        return (planetEventsCount - 1);
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
        DarkForestPlanet.upgradePlanet(
            _location,
            _branch,
            planets,
            planetsExtendedInfo,
            planetDefaultStats,
            upgrades
        );
        emit PlanetUpgraded(_location);
        return (_location, _branch);
    }

    function transferOwnership(uint256 _location, address _player)
        public
        notPaused
    {
        require(
            planetsExtendedInfo[_location].isInitialized == true,
            "Planet is not initialized"
        );

        refreshPlanet(_location);

        require(
            planets[_location].owner == msg.sender,
            "Only owner can transfer planet"
        );

        require(_player != msg.sender, "Cannot transfer planet to self");

        require(
            isPlayerInitialized[_player],
            "Can only transfer ownership to initialized players"
        );

        planets[_location].owner = _player;

        emit PlanetTransferred(_location, _player);
    }

    function buyHat(uint256 _location) public payable {
        require(
            planetsExtendedInfo[_location].isInitialized == true,
            "Planet is not initialized"
        );

        refreshPlanet(_location);

        require(
            planets[_location].owner == msg.sender,
            "Only owner can buy hat for planet"
        );

        uint256 cost = (1 << planetsExtendedInfo[_location].hatLevel) * 1 ether;

        require(msg.value >= cost, "Insufficient value sent");

        planetsExtendedInfo[_location].hatLevel += 1;
        emit BoughtHat(_location);
    }

    function findArtifact(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[2] memory _input
    ) public notPaused notTokenEnded {
        uint256 planetId = _input[0];
        uint256 biomebase = _input[1];

        refreshPlanet(planetId);
        DarkForestTypes.Planet storage planet = planets[planetId];


            DarkForestTypes.PlanetExtendedInfo storage info
         = planetsExtendedInfo[planetId];
        DarkForestTypes.Biome biome = DarkForestUtils._getBiome(
            info.spaceType,
            biomebase,
            BIOME_THRESHOLD_1,
            BIOME_THRESHOLD_2
        );

        if (!DISABLE_ZK_CHECK) {
            require(
                Verifier.verifyBiomebaseProof(_a, _b, _c, _input),
                "biome zkSNARK failed doesn't check out"
            );
        }

        require(
            DarkForestUtils._isPlanetMineable(planetId, planet.planetLevel),
            "you can't find an artifact on this planet"
        );
        require(!info.hasTriedFindingArtifact, "planet already plundered");
        require(
            planet.owner == msg.sender,
            "you can only find artifacts on planets you own"
        );
        require(
            (planet.population * 100) / planet.populationCap > 95,
            "you must have 95% of the max energy"
        );
        require(
            planet.planetResource == DarkForestTypes.PlanetResource.NONE,
            "can't mint artifact on silver mine"
        );

        info.hasTriedFindingArtifact = true;

        uint256 artifactSeed = DarkForestUtils._artifactSeed(
            planetId,
            planetEventsCount,
            block.timestamp
        );
        (
            DarkForestTypes.ArtifactType artifactType,
            uint256 levelBonus
        ) = DarkForestUtils._randomArtifactTypeAndLevelBonus(artifactSeed);

        DarkForestTypes.Artifact memory foundArtifact = tokens.createArtifact(
            artifactSeed,
            msg.sender,
            planetId,
            planet.planetLevel,
            levelBonus,
            biome,
            artifactType
        );

        DarkForestPlanet._putArtifactOnPlanet(
            tokens,
            foundArtifact.id,
            planetId,
            planet,
            info,
            contractOwnedArtifactLocations
        );

        emit FoundArtifact(planetId, msg.sender, foundArtifact.id);
        return;
    }

    function depositArtifact(uint256 locationId, uint256 artifactId)
        public
        notPaused
    {
        // should this be implemented as logic that is triggered when a player sends
        // an artifact to the contract with locationId in the extra data?
        // might be better use of the ERC721 standard - can use safeTransfer then
        refreshPlanet(locationId);
        DarkForestTypes.Planet storage planet = planets[locationId];


            DarkForestTypes.PlanetExtendedInfo storage planetInfo
         = planetsExtendedInfo[locationId];

        require(
            tokens.ownerOf(artifactId) == msg.sender,
            "you can only deposit artifacts you own"
        );
        require(
            planet.owner == msg.sender,
            "you can only deposit on a planet you own"
        );
        require(
            planetInfo.heldArtifactId == 0,
            "planet already has an artifact"
        );
        require(
            planet.planetResource == DarkForestTypes.PlanetResource.NONE,
            "can't deposit artifact on silver mine"
        );

        DarkForestPlanet._putArtifactOnPlanet(
            tokens,
            artifactId,
            locationId,
            planet,
            planetInfo,
            contractOwnedArtifactLocations
        );
        emit DepositedArtifact(locationId, msg.sender, artifactId);
        return;
    }

    function withdrawArtifact(uint256 locationId) public notPaused {
        refreshPlanet(locationId);
        DarkForestTypes.Planet storage planet = planets[locationId];


            DarkForestTypes.PlanetExtendedInfo storage planetInfo
         = planetsExtendedInfo[locationId];

        uint256 artifactId = planetInfo.heldArtifactId;

        require(
            planet.owner == msg.sender,
            "you can only withdraw from a planet you own"
        );
        require(artifactId != 0, "planet has no artifact to withdraw");
        require(
            block.timestamp >
                planetInfo.artifactLockedTimestamp +
                    ARTIFACT_LOCKUP_DURATION_SECONDS,
            "planet's artifact is in lockup period"
        );

        DarkForestPlanet._takeArtifactOffPlanet(
            tokens,
            address(this),
            planet,
            planetInfo,
            contractOwnedArtifactLocations
        );
        emit WithdrewArtifact(locationId, msg.sender, artifactId);
        return;
    }
}
