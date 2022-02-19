// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// Contract imports
import {ERC721} from "@solidstate/contracts/token/ERC721/ERC721.sol";
import {ERC721BaseStorage} from "@solidstate/contracts/token/ERC721/base/ERC721BaseStorage.sol";
import {LibDiamond} from "../vendor/libraries/LibDiamond.sol";

// Storage imports
import {WithStorage} from "../libraries/LibStorage.sol";

// Type imports
import {Artifact, DFTCreateArtifactArgs} from "../DFTypes.sol";

contract DFArtifactFacet is WithStorage, ERC721 {
    using ERC721BaseStorage for ERC721BaseStorage.Layout;

    modifier onlyAdminOrCore() {
        require(
            msg.sender == gs().diamondAddress || msg.sender == LibDiamond.contractOwner(),
            "Only the Core or Admin addresses can fiddle with artifacts."
        );
        _;
    }

    modifier onlyAdmin() {
        require(
            msg.sender == LibDiamond.contractOwner(),
            "Only Admin address can perform this action."
        );
        _;
    }

    function createArtifact(DFTCreateArtifactArgs memory args)
        public
        onlyAdminOrCore
        returns (Artifact memory)
    {
        require(args.tokenId >= 1, "artifact id must be positive");

        _mint(args.owner, args.tokenId);

        Artifact memory newArtifact =
            Artifact(
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
                0,
                0,
                args.controller
            );

        gs().artifacts[args.tokenId] = newArtifact;

        return newArtifact;
    }

    function getArtifact(uint256 tokenId) public view returns (Artifact memory) {
        return gs().artifacts[tokenId];
    }

    function getArtifactAtIndex(uint256 idx) public view returns (Artifact memory) {
        return gs().artifacts[tokenByIndex(idx)];
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

    function updateArtifact(Artifact memory updatedArtifact) public onlyAdminOrCore {
        require(
            ERC721BaseStorage.layout().exists(updatedArtifact.id),
            "you cannot update an artifact that doesn't exist"
        );

        gs().artifacts[updatedArtifact.id] = updatedArtifact;
    }

    function doesArtifactExist(uint256 tokenId) public view returns (bool) {
        return ERC721BaseStorage.layout().exists(tokenId);
    }
}
