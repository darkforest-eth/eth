import { subtask } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

subtask('utils:assertChainId', 'Assert proper network is selectaed').setAction(assertChainId);

async function assertChainId({}, hre: HardhatRuntimeEnvironment) {
  const { NETWORK_ID } = hre.contracts;

  if (hre.network.config.chainId !== NETWORK_ID) {
    throw new Error(
      `Hardhat defined network chain id ${hre.network.config.chainId} is NOT same as contracts network id: ${NETWORK_ID}.`
    );
  }
}
