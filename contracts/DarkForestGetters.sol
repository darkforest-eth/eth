// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "./DarkForestCore.sol";
import "./DarkForestTokens.sol";

contract DarkForestGetters is Initializable {
    address adminAddress;
    DarkForestCore coreContract;
    DarkForestTokens tokensContract;

    // initialization functions are only called once during deployment. They are not called during upgrades.
    function initialize(
        address _adminAddress,
        address _coreContractAddress,
        address _tokensAddress
    ) public initializer {
        adminAddress = _adminAddress;
        coreContract = DarkForestCore(_coreContractAddress);
        tokensContract = DarkForestTokens(_tokensAddress);
    }

    function bulkGetPlanetIds(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (uint256[] memory ret)
    {
        // return slice of planetIds array from startIdx through endIdx - 1
        ret = new uint256[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = coreContract.planetIds(i);
        }
    }

    function bulkGetRevealedPlanetIds(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (uint256[] memory ret)
    {
        // return slice of revealedPlanetIds array from startIdx through endIdx - 1
        ret = new uint256[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = coreContract.revealedPlanetIds(i);
        }
    }

    function getPlanetEvent(uint256 locationId, uint256 idx)
        public
        view
        returns (DarkForestTypes.PlanetEventMetadata memory)
    {
        return coreContract.getPlanetEvent(locationId, idx);
    }

    function bulkGetPlanetsByIds(uint256[] calldata ids)
        public
        view
        returns (DarkForestTypes.Planet[] memory ret)
    {
        ret = new DarkForestTypes.Planet[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = coreContract.planets(ids[i]);
        }
    }

    function bulkGetRevealedCoordsByIds(uint256[] calldata ids)
        public
        view
        returns (DarkForestTypes.RevealedCoords[] memory ret)
    {
        ret = new DarkForestTypes.RevealedCoords[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = coreContract.getRevealedCoords(ids[i]);
        }
    }

    function bulkGetPlanetArrivalsByIds(uint256[] calldata ids)
        public
        view
        returns (DarkForestTypes.ArrivalData[][] memory)
    {
        DarkForestTypes.ArrivalData[][] memory ret =
            new DarkForestTypes.ArrivalData[][](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = getPlanetArrivals(ids[i]);
        }

        return ret;
    }

    function bulkGetPlanetsExtendedInfoByIds(uint256[] calldata ids)
        public
        view
        returns (DarkForestTypes.PlanetExtendedInfo[] memory ret)
    {
        ret = new DarkForestTypes.PlanetExtendedInfo[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = coreContract.planetsExtendedInfo(ids[i]);
        }
    }

    function bulkGetPlanetsDataByIds(uint256[] calldata ids)
        public
        view
        returns (DarkForestTypes.PlanetData[] memory ret)
    {
        ret = new DarkForestTypes.PlanetData[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = DarkForestTypes.PlanetData({
                planet: coreContract.planets(ids[i]),
                info: coreContract.planetsExtendedInfo(ids[i]),
                revealedCoords: coreContract.revealedCoords(ids[i])
            });
        }
    }

    function bulkGetVoyagesByIds(uint256[] calldata ids)
        public
        view
        returns (DarkForestTypes.ArrivalData[] memory ret)
    {
        ret = new DarkForestTypes.ArrivalData[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = coreContract.planetArrivals(ids[i]);
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
            ret[i - startIdx] = coreContract.planets(coreContract.planetIds(i));
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
            ret[i - startIdx] = coreContract.planetsExtendedInfo(coreContract.planetIds(i));
        }
    }

    function bulkGetPlayerIds(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (address[] memory ret)
    {
        // return slice of players array from startIdx through endIdx - 1
        ret = new address[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = coreContract.playerIds(i);
        }
    }

    function bulkGetPlayers(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (DarkForestTypes.Player[] memory ret)
    {
        // return array of planets corresponding to planetIds[startIdx] through planetIds[endIdx - 1]
        ret = new DarkForestTypes.Player[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = coreContract.players(coreContract.playerIds(i));
        }
    }

    function getPlanetArrivals(uint256 _location)
        public
        view
        returns (DarkForestTypes.ArrivalData[] memory ret)
    {
        uint256 arrivalCount = 0;
        for (uint256 i = 0; i < coreContract.getPlanetEventsCount(_location); i += 1) {
            if (getPlanetEvent(_location, i).eventType == DarkForestTypes.PlanetEventType.ARRIVAL) {
                arrivalCount += 1;
            }
        }
        ret = new DarkForestTypes.ArrivalData[](arrivalCount);

        for (uint256 i = 0; i < coreContract.getPlanetEventsCount(_location); i += 1) {
            DarkForestTypes.PlanetEventMetadata memory arrivalEvent =
                coreContract.getPlanetEvent(_location, i);

            if (arrivalEvent.eventType == DarkForestTypes.PlanetEventType.ARRIVAL) {
                ret[i] = coreContract.getPlanetArrival(arrivalEvent.id);
            }
        }
    }

    function bulkGetPlanetArrivals(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (DarkForestTypes.ArrivalData[][] memory)
    {
        // return array of planets corresponding to planetIds[startIdx] through planetIds[endIdx - 1]

        DarkForestTypes.ArrivalData[][] memory ret =
            new DarkForestTypes.ArrivalData[][](endIdx - startIdx);

        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = getPlanetArrivals(coreContract.planetIds(i));
        }

        return ret;
    }

    function getDefaultStats() public view returns (DarkForestTypes.PlanetDefaultStats[] memory) {
        DarkForestTypes.PlanetDefaultStats[] memory ret =
            new DarkForestTypes.PlanetDefaultStats[](coreContract.planetLevelsCount());

        for (uint256 i = 0; i < coreContract.planetLevelsCount(); i += 1) {
            ret[i] = coreContract.planetDefaultStats(i);
        }

        return ret;
    }

    function getPlayerArtifactIds(address playerId) public view returns (uint256[] memory) {
        return tokensContract.getPlayerArtifactIds(playerId);
    }

    function doesArtifactExist(uint256 tokenId) public view returns (bool) {
        return tokensContract.doesArtifactExist(tokenId);
    }

    function getArtifactById(uint256 artifactId)
        public
        view
        returns (DarkForestTypes.ArtifactWithMetadata memory ret)
    {
        DarkForestTypes.Artifact memory artifact = tokensContract.getArtifact(artifactId);

        address owner;

        try tokensContract.ownerOf(artifact.id) returns (address addr) {
            owner = addr;
        } catch Error(string memory) {
            // artifact is probably burned / owned by 0x0, so owner is 0x0
        } catch (bytes memory) {
            // this shouldn't happen
        }

        ret = DarkForestTypes.ArtifactWithMetadata({
            artifact: artifact,
            upgrade: DarkForestUtils._getUpgradeForArtifact(artifact),
            timeDelayedUpgrade: DarkForestUtils.timeDelayUpgrade(artifact),
            owner: owner,
            locationId: coreContract.artifactIdToPlanetId(artifact.id),
            voyageId: coreContract.artifactIdToVoyageId(artifact.id)
        });
    }

    function getArtifactsOnPlanet(uint256 locationId)
        public
        view
        returns (DarkForestTypes.ArtifactWithMetadata[] memory ret)
    {
        uint256[] memory artifactIds = coreContract.planetArtifacts(locationId);
        ret = new DarkForestTypes.ArtifactWithMetadata[](artifactIds.length);
        for (uint256 i = 0; i < artifactIds.length; i++) {
            ret[i] = getArtifactById(artifactIds[i]);
        }
        return ret;
    }

    function bulkGetPlanetArtifacts(uint256[] calldata planetIds)
        public
        view
        returns (DarkForestTypes.ArtifactWithMetadata[][] memory)
    {
        DarkForestTypes.ArtifactWithMetadata[][] memory ret =
            new DarkForestTypes.ArtifactWithMetadata[][](planetIds.length);

        for (uint256 i = 0; i < planetIds.length; i++) {
            uint256[] memory planetOwnedArtifactIds = coreContract.planetArtifacts(planetIds[i]);
            ret[i] = bulkGetArtifactsByIds(planetOwnedArtifactIds);
        }

        return ret;
    }

    function bulkGetArtifactsByIds(uint256[] memory ids)
        public
        view
        returns (DarkForestTypes.ArtifactWithMetadata[] memory ret)
    {
        ret = new DarkForestTypes.ArtifactWithMetadata[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            DarkForestTypes.Artifact memory artifact = tokensContract.getArtifact(ids[i]);

            address owner;

            try tokensContract.ownerOf(artifact.id) returns (address addr) {
                owner = addr;
            } catch Error(string memory) {
                // artifact is probably burned or owned by 0x0, so owner is 0x0
            } catch (bytes memory) {
                // this shouldn't happen
            }

            ret[i] = DarkForestTypes.ArtifactWithMetadata({
                artifact: artifact,
                upgrade: DarkForestUtils._getUpgradeForArtifact(artifact),
                timeDelayedUpgrade: DarkForestUtils.timeDelayUpgrade(artifact),
                owner: owner,
                locationId: coreContract.artifactIdToPlanetId(artifact.id),
                voyageId: coreContract.artifactIdToVoyageId(artifact.id)
            });
        }
    }

    /**
     * Get a group or artifacts based on their index, fetch all between startIdx & endIdx. indexs are assigned to artifacts based on the order in which they are minted.
     * index 0 would be the first Artifact minted, etc.
     * @param startIdx index of the first element to get
     * @param endIdx index of the last element to get
     */
    function bulkGetArtifacts(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (DarkForestTypes.ArtifactWithMetadata[] memory ret)
    {
        ret = new DarkForestTypes.ArtifactWithMetadata[](endIdx - startIdx);

        for (uint256 i = startIdx; i < endIdx; i++) {
            DarkForestTypes.Artifact memory artifact = tokensContract.getArtifactAtIndex(i);
            address owner = address(0);

            try tokensContract.ownerOf(artifact.id) returns (address addr) {
                owner = addr;
            } catch Error(string memory) {
                // artifact is probably burned or owned by 0x0, so owner is 0x0
            } catch (bytes memory) {
                // this shouldn't happen
            }
            ret[i - startIdx] = DarkForestTypes.ArtifactWithMetadata({
                artifact: artifact,
                upgrade: DarkForestUtils._getUpgradeForArtifact(artifact),
                timeDelayedUpgrade: DarkForestUtils.timeDelayUpgrade(artifact),
                owner: owner,
                locationId: coreContract.artifactIdToPlanetId(artifact.id),
                voyageId: coreContract.artifactIdToVoyageId(artifact.id)
            });
        }
    }
}
