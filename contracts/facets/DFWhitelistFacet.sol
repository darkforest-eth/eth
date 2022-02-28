// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// Library imports
import {LibDiamond} from "../vendor/libraries/LibDiamond.sol";

// Storage imports
import {WithStorage} from "../libraries/LibStorage.sol";

contract DFWhitelistFacet is WithStorage {
    // administrative
    modifier onlyAdmin() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    // public getters
    function getNAllowed() public view returns (uint256) {
        return ws().allowedAccountsArray.length;
    }

    function isWhitelisted(address _addr) public view returns (bool) {
        if (!ws().enabled) {
            return true;
        }
        return ws().allowedAccounts[_addr];
    }

    function isKeyValid(string memory key) public view returns (bool) {
        bytes32 hashed = keccak256(abi.encodePacked(key));
        return ws().allowedKeyHashes[hashed];
    }

    // modify whitelist
    function addKeys(bytes32[] memory hashes) public onlyAdmin {
        for (uint16 i = 0; i < hashes.length; i++) {
            ws().allowedKeyHashes[hashes[i]] = true;
        }
    }

    function disableKeys(bytes32[] memory keys) public onlyAdmin {
        for (uint256 i = 0; i < keys.length; i++) {
            ws().allowedKeyHashes[keys[i]] = false;
        }
    }

    function useKey(string memory key, address owner) public onlyAdmin {
        // This is a no-op instead of a revert
        // because when the webserver restarts
        // we have no way to recover useKey txs
        // that were sent but not confirmed.
        // Repeating the request should be a
        // success so the webserver can
        // properly notify the client.
        if (ws().allowedAccounts[owner]) {
            return;
        }

        bytes32 hashed = keccak256(abi.encodePacked(key));
        require(ws().allowedKeyHashes[hashed], "invalid key");
        ws().allowedAccounts[owner] = true;
        ws().allowedAccountsArray.push(owner);
        ws().allowedKeyHashes[hashed] = false;
        // xDAI ONLY
        payable(owner).transfer(ws().drip);
    }

    function addToWhitelist(address toAdd) public onlyAdmin {
        require(!ws().allowedAccounts[toAdd], "player is already allowed");

        ws().allowedAccounts[toAdd] = true;
        ws().allowedAccountsArray.push(toAdd);
    }

    function removeFromWhitelist(address toRemove) public onlyAdmin {
        require(ws().allowedAccounts[toRemove], "player was not whitelisted to begin with");
        ws().allowedAccounts[toRemove] = false;
        for (uint256 i = 0; i < ws().allowedAccountsArray.length; i++) {
            if (ws().allowedAccountsArray[i] == toRemove) {
                ws().allowedAccountsArray[i] = ws().allowedAccountsArray[
                    ws().allowedAccountsArray.length - 1
                ];
                ws().allowedAccountsArray.pop();
            }
        }
    }

    function changeDrip(uint256 newDrip) public onlyAdmin {
        ws().drip = newDrip;
    }

    function drip() public view returns (uint256) {
        return ws().drip;
    }
}
