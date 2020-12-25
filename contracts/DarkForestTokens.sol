pragma solidity ^0.6.9;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "./DarkForestTypes.sol";

contract DarkForestTokens is ERC721Upgradeable {
    address coreAddress = address(0);
    mapping(uint256 => DarkForestTypes.Artifact) artifacts;

    function initialize(address _coreAddress) public initializer {
        coreAddress = _coreAddress;
    }

    function createArtifact(
        uint256 tokenId,
        address discoverer,
        uint256 planetId,
        uint256 planetLevel,
        uint256 levelBonus,
        DarkForestTypes.Biome planetBiome,
        DarkForestTypes.ArtifactType artifactType
    ) public returns (DarkForestTypes.Artifact memory) {
        require(
            msg.sender == coreAddress,
            "Only the Core Address can spawn artifacts"
        );

        _mint(coreAddress, tokenId);

        uint256 level = planetLevel + levelBonus;
        if (level > 7) {
            level = 7;
        }

        DarkForestTypes.Artifact memory newArtifact = DarkForestTypes.Artifact(
            tokenId,
            planetId,
            level,
            planetBiome,
            block.timestamp,
            discoverer,
            artifactType
        );

        artifacts[tokenId] = newArtifact;

        return newArtifact;
    }

    function getArtifact(uint256 tokenId)
        public
        view
        returns (DarkForestTypes.Artifact memory)
    {
        return artifacts[tokenId];
    }

    function getPlayerArtifactIds(address playerId)
        public
        view
        returns (uint256[] memory)
    {
        uint256 balance = balanceOf(playerId);

        uint256[] memory results = new uint256[](balance);

        for (uint256 idx = 0; idx < balance; idx++) {
            results[idx] = tokenOfOwnerByIndex(playerId, idx);
        }

        return results;
    }

    function transferToCoreContract(uint256 tokenId) public {
        require(
            msg.sender == coreAddress,
            "Only the Core Address can initiate a transfer to itself"
        );
        _transfer(ownerOf(tokenId), coreAddress, tokenId);
    }

    function doesArtifactExist(uint256 tokenId) public view returns (bool) {
        return _exists(tokenId);
    }
}
