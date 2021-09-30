import * as fs from 'fs';
import { subtask, task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import * as path from 'path';
import * as prettier from 'prettier';
import * as settings from '../settings';
import type {
  DarkForestCoreReturn,
  DarkForestGetters,
  DarkForestGPTCredit,
  DarkForestTokens,
  LibraryContracts,
  Whitelist,
} from '../task-types';
import '../tasks/deploy-more';
import { tscompile } from '../utils/tscompile';

task('deploy', 'deploy all contracts')
  .addOptionalParam('whitelist', 'override the whitelist', true, types.boolean)
  .addOptionalParam('fund', 'amount of eth to fund whitelist contract for fund', 0.5, types.float)
  .addOptionalParam(
    'subgraph',
    'bring up subgraph with name (requires docker)',
    undefined,
    types.string
  )
  .setAction(deploy);

async function deploy(
  args: { whitelist: boolean; fund: number; subgraph: string },
  hre: HardhatRuntimeEnvironment
) {
  const isDev = hre.network.name === 'localhost';

  // Ensure we have required keys in our initializers
  settings.required(hre.initializers, ['PLANETHASH_KEY', 'SPACETYPE_KEY', 'BIOMEBASE_KEY']);

  // need to force a compile for tasks
  await hre.run('compile');

  // Were only using one account, getSigners()[0], the deployer. Becomes the ProxyAdmin
  const [deployer] = await hre.ethers.getSigners();
  // give contract administration over to an admin adress if was provided, or use deployer
  const controllerWalletAddress =
    hre.ADMIN_PUBLIC_ADDRESS !== undefined ? hre.ADMIN_PUBLIC_ADDRESS : deployer.address;

  const requires = hre.ethers.utils.parseEther('2.1');
  const balance = await deployer.getBalance();

  // Only when deploying to production, give the deployer wallet money,
  // in order for it to be able to deploy the contracts
  if (!isDev && balance.lt(requires)) {
    throw new Error(
      `${deployer.address} requires ~$${hre.ethers.utils.formatEther(
        requires
      )} but has ${hre.ethers.utils.formatEther(balance)} top up and rerun`
    );
  }

  // deploy the whitelist contract
  const whitelist: Whitelist = await hre.run('deploy:whitelist', {
    controllerWalletAddress,
    whitelistEnabled: args.whitelist,
  });

  const whitelistAddress = whitelist.address;
  console.log('Whitelist deployed to:', whitelistAddress);

  // deploy the tokens contract
  const darkForestTokens: DarkForestTokens = await hre.run('deploy:tokens');
  const tokensAddress = darkForestTokens.address;
  console.log('DarkForestTokens deployed to:', tokensAddress);

  const libraries: LibraryContracts = await hre.run('deploy:libraries');

  // deploy the core contract
  const darkForestCoreReturn: DarkForestCoreReturn = await hre.run('deploy:core', {
    controllerWalletAddress,
    whitelistAddress,
    tokensAddress,
    initializeAddress: libraries.initialize.address,
    planetAddress: libraries.planet.address,
    utilsAddress: libraries.utils.address,
    verifierAddress: libraries.verifier.address,
    artifactUtilsAddress: libraries.artifactUtils.address,
  });

  const coreAddress = darkForestCoreReturn.contract.address;
  console.log('DarkForestCore deployed to:', coreAddress);

  // late initlialize tokens now that we have corecontract address
  const dftReceipt = await darkForestTokens.initialize(
    coreAddress,
    controllerWalletAddress,
    `${
      isDev
        ? 'https://nft-test.zkga.me/token-uri/artifact/'
        : 'https://nft.zkga.me/token-uri/artifact/'
    }${hre.network.config?.chainId || 'unknown'}-${darkForestTokens.address}/`
  );
  await dftReceipt.wait();

  const darkForestGetters: DarkForestGetters = await hre.run('deploy:getters', {
    controllerWalletAddress,
    coreAddress,
    tokensAddress,
    utilsAddress: libraries.utils.address,
  });

  const gettersAddress = darkForestGetters.address;

  const gpt3Credit: DarkForestGPTCredit = await hre.run('deploy:gptcredits', {
    controllerWalletAddress,
  });
  const gptCreditAddress = gpt3Credit.address;

  const scoringAddress = '';
  await hre.run('deploy:save', {
    coreBlockNumber: darkForestCoreReturn.blockNumber,
    libraries,
    coreAddress,
    tokensAddress,
    gettersAddress,
    whitelistAddress,
    gptCreditAddress,
    scoringAddress,
  });

  // give all contract administration over to an admin adress if was provided
  if (hre.ADMIN_PUBLIC_ADDRESS) {
    await hre.upgrades.admin.transferProxyAdminOwnership(hre.ADMIN_PUBLIC_ADDRESS);
    console.log('transfered all contracts');
  }

  // Note Ive seen `ProviderError: Internal error` when not enough money...
  await deployer.sendTransaction({
    to: whitelist.address,
    value: hre.ethers.utils.parseEther(args.fund.toString()),
  });
  console.log(`Sent ${args.fund} to whitelist contract (${whitelist.address}) to fund drips`);

  if (args.subgraph) {
    await hre.run('subgraph:deploy', { name: args.subgraph });
    console.log('deployed subgraph');
  }

  const whitelistBalance = await hre.ethers.provider.getBalance(whitelist.address);
  console.log(`Whitelist balance ${whitelistBalance}`);
  console.log('Deployed successfully. Godspeed cadet.');
}

subtask('deploy:save').setAction(deploySave);

async function deploySave(
  args: {
    coreBlockNumber: number;
    libraries: LibraryContracts;
    coreAddress: string;
    tokensAddress: string;
    gettersAddress: string;
    whitelistAddress: string;
    gptCreditAddress: string;
    scoringAddress: string;
  },
  hre: HardhatRuntimeEnvironment
) {
  const isDev = hre.network.name === 'localhost';

  // Save the addresses of the deployed contracts to the `@darkforest_eth/contracts` package
  const tsContents = `
  /**
   * This package contains deployed contract addresses, ABIs, and Typechain types
   * for the Dark Forest game.
   *
   * ## Installation
   *
   * You can install this package using [\`npm\`](https://www.npmjs.com) or
   * [\`yarn\`](https://classic.yarnpkg.com/lang/en/) by running:
   *
   * \`\`\`bash
   * npm install --save @darkforest_eth/contracts
   * \`\`\`
   * \`\`\`bash
   * yarn add @darkforest_eth/contracts
   * \`\`\`
   *
   * When using this in a plugin, you might want to load it with [skypack](https://www.skypack.dev)
   *
   * \`\`\`js
   * import * as contracts from 'http://cdn.skypack.dev/@darkforest_eth/contracts'
   * \`\`\`
   *
   * ## Typechain
   *
   * The Typechain types can be found in the \`typechain\` directory.
   *
   * ## ABIs
   *
   * The contract ABIs can be found in the \`abis\` directory.
   *
   * @packageDocumentation
   */

  /**
   * The name of the network where these contracts are deployed.
   */
  export const NETWORK = '${hre.network.name}';
  /**
   * The id of the network where these contracts are deployed.
   */
  export const NETWORK_ID = ${hre.network.config.chainId};
  /**
   * The block in which the DarkForestCore contract was deployed.
   */
  export const START_BLOCK = ${isDev ? 0 : args.coreBlockNumber};
  /**
   * The address for the DarkForestUtils library.
   */
  export const UTILS_LIBRARY_ADDRESS = '${args.libraries.utils.address}';
  /**
   * The address for the DarkForestPlanet library.
   */
  export const PLANET_LIBRARY_ADDRESS = '${args.libraries.planet.address}';
  /**
   * The address for the DarkForestArtifactUtils library.
   */
  export const ARTIFACT_UTILS_LIBRARY_ADDRESS = '${args.libraries.artifactUtils.address}';
  /**
   * The address for the Verifier library.
   */
  export const VERIFIER_LIBRARY_ADDRESS = '${args.libraries.verifier.address}';
  /**
   * The address for the DarkForestInitialize library.
   */
  export const INITIALIZE_LIBRARY_ADDRESS = '${args.libraries.initialize.address}';
  /**
   * The address for the DarkForestLazyUpdate library.
   */
  export const LAZY_UPDATE_LIBRARY_ADDRESS = '${args.libraries.lazyUpdate.address}';
  /**
   * The address for the DarkForestCore contract.
   */
  export const CORE_CONTRACT_ADDRESS = '${args.coreAddress}';
  /**
   * The address for the DarkForestTokens contract.
   */
  export const TOKENS_CONTRACT_ADDRESS = '${args.tokensAddress}';
  /**
   * The address for the DarkForestGetters contract.
   */
  export const GETTERS_CONTRACT_ADDRESS = '${args.gettersAddress}';
  /**
   * The address for the Whitelist contract.
   */
  export const WHITELIST_CONTRACT_ADDRESS = '${args.whitelistAddress}';
  /**
   * The address for the DarkForestGPTCredit contract.
   */
  export const GPT_CREDIT_CONTRACT_ADDRESS = '${args.gptCreditAddress}';
  /**
   * The address for the DarkForestScoring contract.
   */
  export const SCORING_CONTRACT_ADDRESS = '${args.scoringAddress}';
  `;

  const { jsContents, dtsContents } = tscompile(tsContents);

  const contractsFileTS = path.join(hre.packageDirs['@darkforest_eth/contracts'], 'index.ts');
  const contractsFileJS = path.join(hre.packageDirs['@darkforest_eth/contracts'], 'index.js');
  const contractsFileDTS = path.join(hre.packageDirs['@darkforest_eth/contracts'], 'index.d.ts');

  const options = prettier.resolveConfig.sync(contractsFileTS);

  fs.writeFileSync(
    contractsFileTS,
    prettier.format(tsContents, { ...options, parser: 'babel-ts' })
  );
  fs.writeFileSync(
    contractsFileJS,
    prettier.format(jsContents, { ...options, parser: 'babel-ts' })
  );
  fs.writeFileSync(
    contractsFileDTS,
    prettier.format(dtsContents, { ...options, parser: 'babel-ts' })
  );
}
