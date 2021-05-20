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

    function initialize(address _coreAddress, address _adminAddress) public initializer {
        coreAddress = _coreAddress;
        adminAddress = _adminAddress;
        _setBaseURI("https://zkga.me/token-uri/artifact/");
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

    function setBaseUri() public {
        _setBaseURI("https://zkga.me/token-uri/artifact/");
    }
}
