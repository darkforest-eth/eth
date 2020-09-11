// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.9;
pragma experimental ABIEncoderV2;

// Import base Initializable contract
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "./Verifier.sol";
import "./DarkForestStorageV1.sol";
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
    using SafeMath for *;
    using Math for uint256;

    event PlayerInitialized(address player, uint256 loc);
    event ArrivalQueued(uint256 arrivalId);
    event PlanetUpgraded(uint256 loc);

    function initialize(
        address _adminAddress,
        address _whitelistAddress,
        bool _disableZKCheck
    ) public initializer {
        adminAddress = _adminAddress;
        whitelist = Whitelist(_whitelistAddress);

        paused = false;

        VERSION = 1;
        DISABLE_ZK_CHECK = _disableZKCheck;

        gameEndTimestamp = 1697464000;
        target4RadiusConstant = 50;
        target5RadiusConstant = 12;

        planetTypeThresholds = [65536, 0];
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

    modifier notEnded() {
        require(block.timestamp < gameEndTimestamp, "Game have ended");
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

    function changeGameEndTime(uint256 _newGameEnd) public onlyAdmin {
        gameEndTimestamp = _newGameEnd;
    }

    function changeTarget4RadiusConstant(uint256 _newConstant)
        public
        onlyAdmin
    {
        target4RadiusConstant = _newConstant;
    }

    function changeTarget5RadiusConstant(uint256 _newConstant)
        public
        onlyAdmin
    {
        target5RadiusConstant = _newConstant;
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

    function getPlanetTypeThresholds() public view returns (uint256[] memory) {
        return planetTypeThresholds;
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

    function getPlanetCounts() public view returns (uint256[] memory) {
        return initializedPlanetCountByLevel;
    }

    function getUpgrades()
        public
        view
        returns (DarkForestTypes.Upgrade[4][3] memory)
    {
        return upgrades;
    }

    // private utilities

    function _getPlanetType()
        public
        pure
        returns (
            /* uint256 _location */
            DarkForestTypes.PlanetType
        )
    {
        return DarkForestTypes.PlanetType.PLANET;
    }

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
            target4RadiusConstant,
            target5RadiusConstant
        );
    }

    function _initializePlanet(uint256 _location, bool _isHomePlanet) private {
        require(_locationIdValid(_location), "Not a valid planet location");

        (
            uint256 _level,
            DarkForestTypes.PlanetResource _resource
        ) = DarkForestUtils._getPlanetLevelAndResource(
            _location,
            SILVER_RARITY,
            planetLevelThresholds,
            planetDefaultStats
        );

        DarkForestTypes.PlanetType _type = _getPlanetType();

        if (_isHomePlanet) {
            require(_level == 0, "Can only initialize on planet level 0");
        }

        DarkForestPlanet.initializePlanet(
            planets[_location],
            planetsExtendedInfo[_location],
            planetDefaultStats[_level],
            VERSION,
            _type,
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

    function refreshPlanet(uint256 _location)
        public
        onlyWhitelisted
        notPaused
        notEnded
    {
        require(
            planetsExtendedInfo[_location].isInitialized,
            "Planet has not been initialized"
        );

        // apply all pending events until the current timestamp
        DarkForestLazyUpdate._applyPendingEvents(
            _location,
            planetEvents,
            planets,
            planetsExtendedInfo,
            planetArrivals
        );

        // we need to do another updatePlanet call to sync the planet's data
        // to current time.
        DarkForestLazyUpdate.updatePlanet(
            planets[_location],
            planetsExtendedInfo[_location],
            block.timestamp
        );
    }

    function initializePlayer(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[3] memory _input
    ) public onlyWhitelisted notPaused notEnded {
        if (!DISABLE_ZK_CHECK) {
            require(
                Verifier.verifyInitProof(_a, _b, _c, _input),
                "Failed init proof check"
            );
        }

        uint256 _location = _input[0];
        // uint256 _perlin = _input[1];
        uint256 _radius = _input[2];

        require(
            !isPlayerInitialized[msg.sender],
            "Player is already initialized"
        );
        require(
            !planetsExtendedInfo[_location].isInitialized,
            "Planet is already initialized"
        );
        require(
            _radius <= worldRadius,
            "Init radius is bigger than the current world radius"
        );
        // require(
        //     _perlin <= PERLIN_THRESHOLD,
        //     "Init not allowed in perlin value above the threshold"
        // );

        // Initialize player data
        isPlayerInitialized[msg.sender] = true;
        playerIds.push(msg.sender);

        // Initialize planet information
        _initializePlanet(_location, true);
        planets[_location].owner = msg.sender;
        planets[_location].population = 75000;
        _updateWorldRadius();
        emit PlayerInitialized(msg.sender, _location);
    }

    function move(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[7] memory _input
    ) public notPaused notEnded {
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
            _initializePlanet(_newLoc, false);
        } else {
            // need to do this so people can't deny service to their own planets with gas limit
            refreshPlanet(_newLoc);
            require(planetEvents[_newLoc].length < 8, "Planet is rate-limited");
        }

        // Refresh fromPlanet first before doing any action on it
        refreshPlanet(_oldLoc);
        DarkForestPlanet.move(
            _oldLoc,
            _newLoc,
            _maxDist,
            _popMoved,
            _silverMoved,
            GLOBAL_SPEED_IN_HUNDRETHS,
            planetEventsCount,
            planets,
            planetEvents,
            planetArrivals
        );

        planetEventsCount++;

        _updateWorldRadius();
        emit ArrivalQueued(planetEventsCount - 1);
    }

    function upgradePlanet(uint256 _location, uint256 _branch)
        public
        notPaused
        notEnded
    {
        // _branch specifies which of the three upgrade branches player is leveling up
        // 0 improves silver production and capacity
        // 1 improves population
        // 2 improves range
        refreshPlanet(_location);
        DarkForestPlanet.upgradePlanet(
            planets[_location],
            planetsExtendedInfo[_location],
            _branch,
            planetDefaultStats,
            upgrades
        );
        emit PlanetUpgraded(_location);
    }
}
