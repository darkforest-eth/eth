// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "./DarkForestTypes.sol";

contract DarkForestTokens is ERC721Upgradeable {
    address coreAddress;
    mapping(uint256 => DarkForestTypes.Artifact) artifacts;
    address adminAddress;

    modifier onlyAdminOrCore() {
        require(
            msg.sender == coreAddress || msg.sender == adminAddress,
            "Only the Core or Admin addresses can fiddle with artifacts."
        );
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == adminAddress, "Only Admin address can perform this action.");
        _;
    }

    // initialization functions are only called once during deployment. They are not called during upgrades.
    function initialize(
        address _coreAddress,
        address _adminAddress,
        string memory _baseURI
    ) public initializer {
        coreAddress = _coreAddress;
        adminAddress = _adminAddress;
        _setBaseURI(_baseURI);
    }

    function changeAdmin(address _newAdminAddress) public onlyAdmin {
        adminAddress = _newAdminAddress;
    }

    function setBaseUriForStaging() public onlyAdmin {
        _setBaseURI(
            "https://nft.zkga.me/token-uri/artifact/100-0xb4112582d061d6d0ce0adf8d6fdbf09c173a68c9/"
        );
    }

    function createArtifact(DarkForestTypes.DFTCreateArtifactArgs memory args)
        public
        onlyAdminOrCore
        returns (DarkForestTypes.Artifact memory)
    {
        require(args.tokenId >= 1, "artifact id must be positive");

        _mint(args.owner, args.tokenId);

        DarkForestTypes.Artifact memory newArtifact =
            DarkForestTypes.Artifact(
                true,
                args.tokenId,
                args.planetId,
                args.rarity,
                args.biome,
                block.timestamp,
                args.discoverer,
                args.artifactType,
                0,
                0,
                0
            );

        artifacts[args.tokenId] = newArtifact;

        return newArtifact;
    }

    function getArtifact(uint256 tokenId) public view returns (DarkForestTypes.Artifact memory) {
        return artifacts[tokenId];
    }

    function getArtifactAtIndex(uint256 idx) public view returns (DarkForestTypes.Artifact memory) {
        return artifacts[tokenByIndex(idx)];
    }

    function getPlayerArtifactIds(address playerId) public view returns (uint256[] memory) {
        uint256 balance = balanceOf(playerId);
        uint256[] memory results = new uint256[](balance);

        for (uint256 idx = 0; idx < balance; idx++) {
            results[idx] = tokenOfOwnerByIndex(playerId, idx);
        }

        return results;
    }

    function transferArtifact(uint256 tokenId, address newOwner) public onlyAdminOrCore {
        if (newOwner == address(0)) {
            _burn(tokenId);
        } else {
            _transfer(ownerOf(tokenId), newOwner, tokenId);
        }
    }

    function updateArtifact(DarkForestTypes.Artifact memory updatedArtifact)
        public
        onlyAdminOrCore
    {
        require(_exists(updatedArtifact.id), "you cannot update an artifact that doesn't exist");

        artifacts[updatedArtifact.id] = updatedArtifact;
    }

    function doesArtifactExist(uint256 tokenId) public view returns (bool) {
        return _exists(tokenId);
    }
}
