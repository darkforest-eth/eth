// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// Library imports
import {LibDiamond} from "../vendor/libraries/LibDiamond.sol";

// Storage imports
import {WithStorage} from "../libraries/LibStorage.sol";

// Functions used in tests/development for easily modifying game state
contract DFDebugFacet is WithStorage {
    modifier onlyAdmin() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    function adminFillPlanet(uint256 locationId) public onlyAdmin {
        require(gs().planetsExtendedInfo[locationId].isInitialized, "planet is not initialized");

        gs().planets[locationId].silver = gs().planets[locationId].silverCap;
        gs().planets[locationId].population = gs().planets[locationId].populationCap;
    }
}
