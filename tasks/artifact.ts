import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DarkForestTokens } from '../task-types';

task('artifact:read', 'Read Artifact data from Tokens contract').setAction(artifactsRead);

async function artifactsRead({}, hre: HardhatRuntimeEnvironment) {
  const tokens: DarkForestTokens = await hre.run('utils:getTokens');

  const id = await tokens.tokenByIndex(0);
  console.log(id.toString());
  const token = await tokens.getArtifact(id);
  console.log(token);
  const URI = await tokens.tokenURI(id);
  console.log(URI);
}

task('artifact:set-base-uri', 'set token base URI').setAction(setBaseURI);

async function setBaseURI({}, hre: HardhatRuntimeEnvironment) {
  const tokens: DarkForestTokens = await hre.run('utils:getTokens');
  tokens.setBaseUriForStaging();
}
