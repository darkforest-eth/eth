// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

// Import base Initializable contract
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

contract Whitelist is Initializable {
    bool whitelistEnabled;
    uint256 public drip;
    mapping(address => bool) allowedAccounts;
    mapping(bytes32 => bool) allowedKeyHashes;
    address[] allowedAccountsArray;
    address admin;

    // administrative
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only administrator can perform this action");
        _;
    }

    function changeAdmin(address _newAdmin) public onlyAdmin {
        admin = _newAdmin;
    }

    // initialization functions are only called once during deployment. They are not called during upgrades.
    function initialize(address _admin, bool _whitelistEnabled) public initializer {
        drip = 0.05 ether;
        admin = _admin;
        whitelistEnabled = _whitelistEnabled;
    }

    // public getters
    function getNAllowed() public view returns (uint256) {
        return allowedAccountsArray.length;
    }

    function isWhitelisted(address _addr) public view returns (bool) {
        if (!whitelistEnabled) {
            return true;
        }
        return allowedAccounts[_addr];
    }

    function isKeyValid(string memory key) public view returns (bool) {
        bytes32 hashed = keccak256(abi.encodePacked(key));
        return allowedKeyHashes[hashed];
    }

    // modify whitelist
    function addKeys(bytes32[] memory hashes) public onlyAdmin {
        for (uint16 i = 0; i < hashes.length; i++) {
            allowedKeyHashes[hashes[i]] = true;
        }
    }

    function useKey(string memory key, address owner) public onlyAdmin {
        require(!allowedAccounts[owner], "player already whitelisted");
        bytes32 hashed = keccak256(abi.encodePacked(key));
        require(allowedKeyHashes[hashed], "invalid key");
        allowedAccounts[owner] = true;
        allowedAccountsArray.push(owner);
        allowedKeyHashes[hashed] = false;
        // xDAI ONLY
        payable(owner).transfer(drip);
    }

    function removeFromWhitelist(address toRemove) public onlyAdmin {
        require(allowedAccounts[toRemove], "player was not whitelisted to begin with");
        allowedAccounts[toRemove] = false;
        for (uint256 i = 0; i < allowedAccountsArray.length; i++) {
            if (allowedAccountsArray[i] == toRemove) {
                allowedAccountsArray[i] = allowedAccountsArray[allowedAccountsArray.length - 1];
                allowedAccountsArray.pop();
            }
        }
    }

    function changeDrip(uint256 newDrip) public onlyAdmin {
        drip = newDrip;
    }

    function receiveEther() external payable {}

    receive() external payable {}
}
