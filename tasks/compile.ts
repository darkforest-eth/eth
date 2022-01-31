import * as fs from 'fs/promises';
import { task } from 'hardhat/config';
import {
  HardhatArguments,
  HardhatRuntimeEnvironment,
  RunSuperFunction,
  TaskArguments,
} from 'hardhat/types';
import * as path from 'path';
import * as prettier from 'prettier';

task('compile', 'hook the compile step and copy our abis after').setAction(copyAbi);

async function copyAbi(
  args: HardhatArguments,
  hre: HardhatRuntimeEnvironment,
  runSuper: RunSuperFunction<TaskArguments>
) {
  await runSuper(args);

  // save the contract ABIs to client
  const coreAbi = prettier.format(
    JSON.stringify((await hre.artifacts.readArtifact('DarkForestCore')).abi),
    { semi: false, parser: 'json' }
  );
  const tokensAbi = prettier.format(
    JSON.stringify((await hre.artifacts.readArtifact('DarkForestTokens')).abi),
    { semi: false, parser: 'json' }
  );
  const whitelistAbi = prettier.format(
    JSON.stringify((await hre.artifacts.readArtifact('Whitelist')).abi),
    { semi: false, parser: 'json' }
  );
  const gettersAbi = prettier.format(
    JSON.stringify((await hre.artifacts.readArtifact('DarkForestGetters')).abi),
    { semi: false, parser: 'json' }
  );
  const gptCreditAbi = prettier.format(
    JSON.stringify((await hre.artifacts.readArtifact('DarkForestGPTCredit')).abi),
    { semi: false, parser: 'json' }
  );
  const scoringAbi = prettier.format(
    JSON.stringify((await hre.artifacts.readArtifact('DarkForestScoringRound3')).abi),
    { semi: false, parser: 'json' }
  );

  const abisDir = path.join(hre.packageDirs['@darkforest_eth/contracts'], 'abis');

  await fs.mkdir(abisDir, { recursive: true });

  // Save contract ABIs to client
  await fs.writeFile(path.join(abisDir, 'DarkForestCore.json'), coreAbi);
  await fs.writeFile(path.join(abisDir, 'DarkForestTokens.json'), tokensAbi);
  await fs.writeFile(path.join(abisDir, 'Whitelist.json'), whitelistAbi);
  await fs.writeFile(path.join(abisDir, 'DarkForestGetters.json'), gettersAbi);
  await fs.writeFile(path.join(abisDir, 'DarkForestGPTCredit.json'), gptCreditAbi);
  await fs.writeFile(path.join(abisDir, 'DarkForestScoringRound3.json'), scoringAbi);

  // workaround for: https://github.com/graphprotocol/graph-cli/issues/588
  // just remove calls we cant process, note makes them unusable from within
  // graph but largely dont need these

  const coreAbiFiltered = (await hre.artifacts.readArtifact('DarkForestCore')).abi.filter(
    abiFilter
  );

  const gettersAbiFiltered = (await hre.artifacts.readArtifact('DarkForestGetters')).abi.filter(
    abiFilter
  );

  const tokensAbiFiltered = (await hre.artifacts.readArtifact('DarkForestTokens')).abi.filter(
    abiFilter
  );

  await fs.writeFile(
    path.join(abisDir, 'DarkForestCore_stripped.json'),
    prettier.format(JSON.stringify(coreAbiFiltered), {
      semi: false,
      parser: 'json',
    })
  );

  await fs.writeFile(
    path.join(abisDir, 'DarkForestGetters_stripped.json'),
    prettier.format(JSON.stringify(gettersAbiFiltered), {
      semi: false,
      parser: 'json',
    })
  );

  await fs.writeFile(
    path.join(abisDir, 'DarkForestTokens_stripped.json'),
    prettier.format(JSON.stringify(tokensAbiFiltered), {
      semi: false,
      parser: 'json',
    })
  );
}

// todo upstream export of task name
task('size-contracts', 'post contract sizer hook to ensure hardhat compile').setAction(
  contractSizer
);

async function contractSizer(
  args: HardhatArguments,
  hre: HardhatRuntimeEnvironment,
  runSuper: RunSuperFunction<TaskArguments>
) {
  // force a compile to make sure size data is fresh
  await hre.run('compile');
  await runSuper(args);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function abiFilter(item: any) {
  if (item.type === 'function') {
    // filter out all non view fns
    if (item.stateMutability === 'nonpayable' || item.stateMutability === 'payable') {
      return false;
    }

    for (const input of item.inputs) {
      if (input.type.includes('][') || input.internalType.includes('][')) {
        return false;
      }

      for (const component of input.components ?? []) {
        if (component.internalType.includes('][')) {
          return false;
        }
      }
    }

    for (const output of item.outputs) {
      if (output.type.includes('][') || output.internalType.includes('][')) {
        return false;
      }

      for (const component of output.components ?? []) {
        if (component.internalType.includes('][')) {
          return false;
        }
      }
    }
  }
  return true;
}
