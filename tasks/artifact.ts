import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

task('artifact:read', 'Read Artifact data from Tokens contract').setAction(artifactsRead);

async function artifactsRead({}, hre: HardhatRuntimeEnvironment) {
  const contract = await hre.ethers.getContractAt('DarkForest', hre.contracts.CONTRACT_ADDRESS);

  const id = await contract.tokenByIndex(0);
  console.log(id.toString());
  const token = await contract.getArtifact(id);
  console.log(token);
  const URI = await contract.tokenURI(id);
  console.log(URI);
}
