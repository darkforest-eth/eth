// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract Whitelist is Initializable {
    bool whitelistEnabled;
    uint256 public drip;
    mapping(address => bool) public allowedAccounts;
    mapping(address => bool) public receivedDrip;
    mapping(bytes32 => bool) allowedKeyHashes;
    address[] public allowedAccountsArray;
    address admin;
    uint256 public numPlayers;

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
        drip = 0.15 ether;
        admin = _admin;
        whitelistEnabled = _whitelistEnabled;
    }

    // public getters
    function getNAllowed() public view returns (uint256) {
        return allowedAccountsArray.length;
    }

    function bulkGetWhitelistIds(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (address[] memory ret)
    {
        // return slice of players array from startIdx through endIdx - 1
        ret = new address[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = allowedAccountsArray[i];
        }
    }

    function isWhitelisted(address _addr) public view returns (bool) {
        if (!whitelistEnabled) {
            return true;
        }
        return allowedAccounts[_addr];
    }

    // Don't need for no whitelist
    function isKeyValid(string memory key) public view returns (bool) {
        bytes32 hashed = keccak256(abi.encodePacked(key));
        return allowedKeyHashes[hashed];
    }

    // Don't need for no whitelist
    function addKeys(bytes32[] memory hashes) public onlyAdmin {
        for (uint16 i = 0; i < hashes.length; i++) {
            allowedKeyHashes[hashes[i]] = true;
        }
    }

    function sendDrip(address _addr) public onlyAdmin {
        require(allowedAccounts[_addr], "player not whitelisted");
        require(!receivedDrip[_addr], "player already received drip");
        require(address(this).balance > drip, "not enough $ in contract to drip");

        receivedDrip[_addr] = true;
        (bool success, ) = _addr.call{value: drip}("");
        require(success, "Drip failed.");
    }

    function addPlayer(address _addr) public onlyAdmin {
        require(!allowedAccounts[_addr], "player already whitelisted");
        allowedAccounts[_addr] = true;
        allowedAccountsArray.push(_addr);
        numPlayers++;
    }
    
    function addAndDripPlayers(address[] calldata players) public onlyAdmin {
        for(uint256 i = 0; i < players.length; i++) {
            address player = players[i];

            // extra check to avoid reverting in loop
            if(!allowedAccounts[player]) {
                addPlayer(player);
            }
            // extra check to avoid reverting in loop
            if(allowedAccounts[player] && !receivedDrip[player] && address(this).balance > drip) {
                sendDrip(player);
            }
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