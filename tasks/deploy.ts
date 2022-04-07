import * as fs from 'fs';
import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment, Libraries } from 'hardhat/types';
import * as path from 'path';
import { dedent } from 'ts-dedent';
import * as settings from '../settings';
import { DiamondChanges } from '../utils/diamond';
import { tscompile } from '../utils/tscompile';

task('deploy', 'deploy all contracts')
  .addOptionalParam('whitelist', 'override the whitelist', undefined, types.boolean)
  .addOptionalParam('fund', 'amount of eth to fund whitelist contract for fund', 0.5, types.float)
  .addOptionalParam(
    'subgraph',
    'bring up subgraph with name (requires docker)',
    undefined,
    types.string
  )
  .setAction(deploy);

async function deploy(
  args: { whitelist?: boolean; fund: number; subgraph?: string },
  hre: HardhatRuntimeEnvironment
) {
  const isDev = hre.network.name === 'localhost' || hre.network.name === 'hardhat';

  let whitelistEnabled: boolean;
  if (typeof args.whitelist === 'undefined') {
    // `whitelistEnabled` defaults to `false` in dev but `true` in prod
    whitelistEnabled = isDev ? false : true;
  } else {
    whitelistEnabled = args.whitelist;
  }

  // Ensure we have required keys in our initializers
  settings.required(hre.initializers, ['PLANETHASH_KEY', 'SPACETYPE_KEY', 'BIOMEBASE_KEY']);

  // need to force a compile for tasks
  await hre.run('compile');

  // Were only using one account, getSigners()[0], the deployer.
  // Is deployer of all contracts, but ownership is transferred to ADMIN_PUBLIC_ADDRESS if set
  const [deployer] = await hre.ethers.getSigners();

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

  const [diamond, diamondInit, initReceipt] = await deployAndCut(
    { ownerAddress: deployer.address, whitelistEnabled, initializers: hre.initializers },
    hre
  );

  await saveDeploy(
    {
      coreBlockNumber: initReceipt.blockNumber,
      diamondAddress: diamond.address,
      initAddress: diamondInit.address,
    },
    hre
  );

  // Note Ive seen `ProviderError: Internal error` when not enough money...
  console.log(`funding whitelist with ${args.fund}`);

  const tx = await deployer.sendTransaction({
    to: diamond.address,
    value: hre.ethers.utils.parseEther(args.fund.toString()),
  });
  await tx.wait();

  console.log(
    `Sent ${args.fund} to diamond contract (${diamond.address}) to fund drips in whitelist facet`
  );

  // give all contract administration over to an admin adress if was provided
  if (hre.ADMIN_PUBLIC_ADDRESS) {
    const ownership = await hre.ethers.getContractAt('DarkForest', diamond.address);
    const tx = await ownership.transferOwnership(hre.ADMIN_PUBLIC_ADDRESS);
    await tx.wait();
    console.log(`transfered diamond ownership to ${hre.ADMIN_PUBLIC_ADDRESS}`);
  }

  if (args.subgraph) {
    await hre.run('subgraph:deploy', { name: args.subgraph });
    console.log('deployed subgraph');
  }

  const whitelistBalance = await hre.ethers.provider.getBalance(diamond.address);
  console.log(`Whitelist balance ${whitelistBalance}`);

  // TODO: Upstream change to update task name from `hardhat-4byte-uploader`
  if (!isDev) {
    try {
      await hre.run('upload-selectors', { noCompile: true });
    } catch {
      console.warn('WARNING: Unable to update 4byte database with our selectors');
      console.warn('Please run the `upload-selectors` task manually so selectors can be reversed');
    }
  }

  console.log('Deployed successfully. Godspeed cadet.');
}

async function saveDeploy(
  args: {
    coreBlockNumber: number;
    diamondAddress: string;
    initAddress: string;
  },
  hre: HardhatRuntimeEnvironment
) {
  const isDev = hre.network.name === 'localhost' || hre.network.name === 'hardhat';

  // Save the addresses of the deployed contracts to the `@darkforest_eth/contracts` package
  const tsContents = dedent`
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
   * The block in which the DarkForest contract was initialized.
   */
  export const START_BLOCK = ${isDev ? 0 : args.coreBlockNumber};
  /**
   * The address for the DarkForest contract.
   */
  export const CONTRACT_ADDRESS = '${args.diamondAddress}';
  /**
   * The address for the initalizer contract. Useful for lobbies.
   */
  export const INIT_ADDRESS = '${args.initAddress}';
  `;

  const { jsContents, jsmapContents, dtsContents, dtsmapContents } = tscompile(tsContents);

  const contractsFileTS = path.join(hre.packageDirs['@darkforest_eth/contracts'], 'index.ts');
  const contractsFileJS = path.join(hre.packageDirs['@darkforest_eth/contracts'], 'index.js');
  const contractsFileJSMap = path.join(
    hre.packageDirs['@darkforest_eth/contracts'],
    'index.js.map'
  );
  const contractsFileDTS = path.join(hre.packageDirs['@darkforest_eth/contracts'], 'index.d.ts');
  const contractsFileDTSMap = path.join(
    hre.packageDirs['@darkforest_eth/contracts'],
    'index.d.ts.map'
  );

  fs.writeFileSync(contractsFileTS, tsContents);
  fs.writeFileSync(contractsFileJS, jsContents);
  fs.writeFileSync(contractsFileJSMap, jsmapContents);
  fs.writeFileSync(contractsFileDTS, dtsContents);
  fs.writeFileSync(contractsFileDTSMap, dtsmapContents);
}

export async function deployAndCut(
  {
    ownerAddress,
    whitelistEnabled,
    initializers,
  }: {
    ownerAddress: string;
    whitelistEnabled: boolean;
    initializers: HardhatRuntimeEnvironment['initializers'];
  },
  hre: HardhatRuntimeEnvironment
) {
  const isDev = hre.network.name === 'localhost' || hre.network.name === 'hardhat';

  const changes = new DiamondChanges();

  const libraries = await deployLibraries({}, hre);

  // Diamond Spec facets
  // Note: These won't be updated during an upgrade without manual intervention
  const diamondCutFacet = await deployDiamondCutFacet({}, libraries, hre);
  const diamondLoupeFacet = await deployDiamondLoupeFacet({}, libraries, hre);
  const ownershipFacet = await deployOwnershipFacet({}, libraries, hre);

  // The `cuts` to perform for Diamond Spec facets
  const diamondSpecFacetCuts = [
    // Note: The `diamondCut` is omitted because it is cut upon deployment
    ...changes.getFacetCuts('DiamondLoupeFacet', diamondLoupeFacet),
    ...changes.getFacetCuts('OwnershipFacet', ownershipFacet),
  ];

  const diamond = await deployDiamond(
    {
      ownerAddress,
      // The `diamondCutFacet` is cut upon deployment
      diamondCutAddress: diamondCutFacet.address,
    },
    libraries,
    hre
  );

  const diamondInit = await deployDiamondInit({}, libraries, hre);

  // Dark Forest facets
  const coreFacet = await deployCoreFacet({}, libraries, hre);
  const moveFacet = await deployMoveFacet({}, libraries, hre);
  const captureFacet = await deployCaptureFacet({}, libraries, hre);
  const artifactFacet = await deployArtifactFacet(
    { diamondAddress: diamond.address },
    libraries,
    hre
  );
  const getterFacet = await deployGetterFacet({}, libraries, hre);
  const whitelistFacet = await deployWhitelistFacet({}, libraries, hre);
  const adminFacet = await deployAdminFacet({}, libraries, hre);
  const lobbyFacet = await deployLobbyFacet({}, {}, hre);

  // The `cuts` to perform for Dark Forest facets
  const darkForestFacetCuts = [
    ...changes.getFacetCuts('DFCoreFacet', coreFacet),
    ...changes.getFacetCuts('DFMoveFacet', moveFacet),
    ...changes.getFacetCuts('DFCaptureFacet', captureFacet),
    ...changes.getFacetCuts('DFArtifactFacet', artifactFacet),
    ...changes.getFacetCuts('DFGetterFacet', getterFacet),
    ...changes.getFacetCuts('DFWhitelistFacet', whitelistFacet),
    ...changes.getFacetCuts('DFAdminFacet', adminFacet),
    ...changes.getFacetCuts('DFLobbyFacet', lobbyFacet),
  ];

  if (isDev) {
    const debugFacet = await deployDebugFacet({}, libraries, hre);
    darkForestFacetCuts.push(...changes.getFacetCuts('DFDebugFacet', debugFacet));
  }

  const toCut = [...diamondSpecFacetCuts, ...darkForestFacetCuts];

  const diamondCut = await hre.ethers.getContractAt('DarkForest', diamond.address);

  const tokenBaseUri = `${
    isDev
      ? 'https://nft-test.zkga.me/token-uri/artifact/'
      : 'https://nft.zkga.me/token-uri/artifact/'
  }${hre.network.config?.chainId || 'unknown'}-${diamond.address}/`;

  // EIP-2535 specifies that the `diamondCut` function takes two optional
  // arguments: address _init and bytes calldata _calldata
  // These arguments are used to execute an arbitrary function using delegatecall
  // in order to set state variables in the diamond during deployment or an upgrade
  // More info here: https://eips.ethereum.org/EIPS/eip-2535#diamond-interface
  const initAddress = diamondInit.address;
  const initFunctionCall = diamondInit.interface.encodeFunctionData('init', [
    whitelistEnabled,
    tokenBaseUri,
    initializers,
  ]);

  const initTx = await diamondCut.diamondCut(toCut, initAddress, initFunctionCall);
  const initReceipt = await initTx.wait();
  if (!initReceipt.status) {
    throw Error(`Diamond cut failed: ${initTx.hash}`);
  }
  console.log('Completed diamond cut');

  return [diamond, diamondInit, initReceipt] as const;
}

export async function deployGetterFacet(
  {},
  { LibGameUtils }: Libraries,
  hre: HardhatRuntimeEnvironment
) {
  const factory = await hre.ethers.getContractFactory('DFGetterFacet', {
    libraries: {
      LibGameUtils,
    },
  });
  const contract = await factory.deploy();
  await contract.deployTransaction.wait();
  console.log('DFGetterFacet deployed to:', contract.address);
  return contract;
}

export async function deployAdminFacet(
  {},
  { LibGameUtils, LibPlanet, LibArtifactUtils }: Libraries,
  hre: HardhatRuntimeEnvironment
) {
  const factory = await hre.ethers.getContractFactory('DFAdminFacet', {
    libraries: {
      LibArtifactUtils,
      LibGameUtils,
      LibPlanet,
    },
  });
  const contract = await factory.deploy();
  await contract.deployTransaction.wait();
  console.log(`DFAdminFacet deployed to: ${contract.address}`);
  return contract;
}

export async function deployDebugFacet({}, {}: Libraries, hre: HardhatRuntimeEnvironment) {
  const factory = await hre.ethers.getContractFactory('DFDebugFacet');
  const contract = await factory.deploy();
  await contract.deployTransaction.wait();
  console.log(`DFDebugFacet deployed to: ${contract.address}`);
  return contract;
}

export async function deployWhitelistFacet(
  {},
  { Verifier }: Libraries,
  hre: HardhatRuntimeEnvironment
) {
  const factory = await hre.ethers.getContractFactory('DFWhitelistFacet', {
    libraries: {
      Verifier,
    },
  });
  const contract = await factory.deploy();
  await contract.deployTransaction.wait();
  console.log(`DFWhitelistFacet deployed to: ${contract.address}`);
  return contract;
}

export async function deployArtifactFacet(
  {},
  { LibGameUtils, LibPlanet, LibArtifactUtils, Verifier }: Libraries,
  hre: HardhatRuntimeEnvironment
) {
  const factory = await hre.ethers.getContractFactory('DFArtifactFacet', {
    libraries: {
      Verifier,
      LibArtifactUtils,
      LibGameUtils,
      LibPlanet,
    },
  });
  const contract = await factory.deploy();
  await contract.deployTransaction.wait();
  console.log(`DFArtifactFacet deployed to: ${contract.address}`);
  return contract;
}

export async function deployLibraries({}, hre: HardhatRuntimeEnvironment) {
  const VerifierFactory = await hre.ethers.getContractFactory('Verifier');
  const Verifier = await VerifierFactory.deploy();
  await Verifier.deployTransaction.wait();

  const LibGameUtilsFactory = await hre.ethers.getContractFactory('LibGameUtils');
  const LibGameUtils = await LibGameUtilsFactory.deploy();
  await LibGameUtils.deployTransaction.wait();

  const LibLazyUpdateFactory = await hre.ethers.getContractFactory('LibLazyUpdate');
  const LibLazyUpdate = await LibLazyUpdateFactory.deploy();
  await LibLazyUpdate.deployTransaction.wait();

  const LibArtifactUtilsFactory = await hre.ethers.getContractFactory('LibArtifactUtils', {
    libraries: {
      LibGameUtils: LibGameUtils.address,
    },
  });

  const LibArtifactUtils = await LibArtifactUtilsFactory.deploy();
  await LibArtifactUtils.deployTransaction.wait();

  const LibPlanetFactory = await hre.ethers.getContractFactory('LibPlanet', {
    libraries: {
      LibGameUtils: LibGameUtils.address,
      LibLazyUpdate: LibLazyUpdate.address,
      Verifier: Verifier.address,
    },
  });
  const LibPlanet = await LibPlanetFactory.deploy();
  await LibPlanet.deployTransaction.wait();

  return {
    LibGameUtils: LibGameUtils.address,
    LibPlanet: LibPlanet.address,
    Verifier: Verifier.address,
    LibArtifactUtils: LibArtifactUtils.address,
  };
}

export async function deployCoreFacet(
  {},
  { Verifier, LibGameUtils, LibPlanet }: Libraries,
  hre: HardhatRuntimeEnvironment
) {
  const factory = await hre.ethers.getContractFactory('DFCoreFacet', {
    libraries: {
      Verifier,
      LibGameUtils,
      LibPlanet,
    },
  });
  const contract = await factory.deploy();
  await contract.deployTransaction.wait();
  console.log(`DFCoreFacet deployed to: ${contract.address}`);
  return contract;
}

export async function deployMoveFacet(
  {},
  { Verifier, LibGameUtils, LibArtifactUtils, LibPlanet }: Libraries,
  hre: HardhatRuntimeEnvironment
) {
  const factory = await hre.ethers.getContractFactory('DFMoveFacet', {
    libraries: {
      Verifier,
      LibGameUtils,
      LibArtifactUtils,
      LibPlanet,
    },
  });
  const contract = await factory.deploy();
  await contract.deployTransaction.wait();
  console.log(`DFMoveFacet deployed to: ${contract.address}`);
  return contract;
}

export async function deployCaptureFacet(
  {},
  { LibPlanet }: Libraries,
  hre: HardhatRuntimeEnvironment
) {
  const factory = await hre.ethers.getContractFactory('DFCaptureFacet', {
    libraries: {
      LibPlanet,
    },
  });
  const contract = await factory.deploy();
  await contract.deployTransaction.wait();
  console.log(`DFCaptureFacet deployed to: ${contract.address}`);
  return contract;
}

async function deployDiamondCutFacet({}, libraries: Libraries, hre: HardhatRuntimeEnvironment) {
  const factory = await hre.ethers.getContractFactory('DiamondCutFacet');
  const contract = await factory.deploy();
  await contract.deployTransaction.wait();
  console.log(`DiamondCutFacet deployed to: ${contract.address}`);
  return contract;
}

async function deployDiamond(
  {
    ownerAddress,
    diamondCutAddress,
  }: {
    ownerAddress: string;
    diamondCutAddress: string;
  },
  {}: Libraries,
  hre: HardhatRuntimeEnvironment
) {
  const factory = await hre.ethers.getContractFactory('Diamond');
  const contract = await factory.deploy(ownerAddress, diamondCutAddress);
  await contract.deployTransaction.wait();
  console.log(`Diamond deployed to: ${contract.address}`);
  return contract;
}

async function deployDiamondInit({}, { LibGameUtils }: Libraries, hre: HardhatRuntimeEnvironment) {
  // DFInitialize provides a function that is called when the diamond is upgraded to initialize state variables
  // Read about how the diamondCut function works here: https://eips.ethereum.org/EIPS/eip-2535#addingreplacingremoving-functions
  const factory = await hre.ethers.getContractFactory('DFInitialize', {
    libraries: { LibGameUtils },
  });
  const contract = await factory.deploy();
  await contract.deployTransaction.wait();
  console.log(`DFInitialize deployed to: ${contract.address}`);
  return contract;
}

async function deployDiamondLoupeFacet({}, {}: Libraries, hre: HardhatRuntimeEnvironment) {
  const factory = await hre.ethers.getContractFactory('DiamondLoupeFacet');
  const contract = await factory.deploy();
  await contract.deployTransaction.wait();
  console.log(`DiamondLoupeFacet deployed to: ${contract.address}`);
  return contract;
}

async function deployOwnershipFacet({}, {}: Libraries, hre: HardhatRuntimeEnvironment) {
  const factory = await hre.ethers.getContractFactory('OwnershipFacet');
  const contract = await factory.deploy();
  await contract.deployTransaction.wait();
  console.log(`OwnershipFacet deployed to: ${contract.address}`);
  return contract;
}

export async function deployLobbyFacet({}, {}: Libraries, hre: HardhatRuntimeEnvironment) {
  const factory = await hre.ethers.getContractFactory('DFLobbyFacet');
  const contract = await factory.deploy();
  await contract.deployTransaction.wait();
  console.log(`DFLobbyFacet deployed to: ${contract.address}`);
  return contract;
}
