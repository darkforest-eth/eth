import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

task('lobby:create', 'create a lobby from the command line').setAction(deployLobbies);

async function deployLobbies({}, hre: HardhatRuntimeEnvironment): Promise<void> {
  const isDev = hre.network.name === 'localhost' || hre.network.name === 'hardhat';

  // Were only using one account, getSigners()[0], the deployer. Becomes the ProxyAdmin
  const [deployer] = await hre.ethers.getSigners();

  // TODO: The deployer balance should be checked for production.
  // Need to investigate how much this actually costs.

  const baseURI = isDev ? 'http://localhost:8081' : 'https://zkga.me';

  const contract = await hre.ethers.getContractAt('DarkForest', hre.contracts.CONTRACT_ADDRESS);

  const { abi: InitABI } = await hre.artifacts.readArtifact('DFInitialize');
  const initInterface = hre.ethers.Contract.getInterface(InitABI);

  const whitelistEnabled = false;
  const artifactBaseURI = '';
  const initializers = { ...hre.initializers, DISABLE_ZK_CHECKS: true };

  const initAddress = hre.contracts.INIT_ADDRESS;
  const initFunctionCall = initInterface.encodeFunctionData('init', [
    whitelistEnabled,
    artifactBaseURI,
    initializers,
  ]);

  function waitForCreated(): Promise<void> {
    return new Promise(async (resolve) => {
      contract.on('LobbyCreated', async (ownerAddress, lobbyAddress) => {
        if (deployer.address === ownerAddress) {
          console.log(`Lobby created. Play at ${baseURI}/play/${lobbyAddress}`);
          resolve();
        }
      });
    });
  }

  // We setup the event handler before creating the lobby
  const result = waitForCreated();

  const tx = await contract.createLobby(initAddress, initFunctionCall);

  const receipt = await tx.wait();
  if (!receipt.status) {
    throw Error(`Lobby creation failed: ${tx.hash}`);
  }

  await result;
}
