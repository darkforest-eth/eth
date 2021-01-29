import * as util from "util";
import * as fs from "fs";
import * as readlineSync from "readline-sync";
import HDWalletProvider from "@truffle/hdwallet-provider";

const rawExec = util.promisify(require("child_process").exec);
const isProd = process.env.NODE_ENV === "production";

require("dotenv").config({
  path: isProd ? ".env.prod" : ".env.example",
});

enum Network {
  xDAI = "xdai",
  Ropsten = "ropsten",
  Development = "development",
  PersonalGanache = "personalGanache",
}

const NETWORK: Network = process.env.network as Network;
const PROJECT_ID = process.env.project_id;
const DEPLOYER_MNEMONIC = process.env.deployer_mnemonic;
const CORE_CONTROLLER_MNEMONIC = process.env.core_controller_mnemonic;
const WHITELIST_CONTROLLER_MNEMONIC = process.env.whitelist_controller_mnemonic;
const OZ_ADMIN_MNEMONIC = process.env.oz_admin_mnemonic;
const DISABLE_ZK_CHECKS =
  process.env.DISABLE_ZK_CHECKS === undefined
    ? undefined
    : process.env.DISABLE_ZK_CHECKS === "true";

if (
  !NETWORK ||
  !PROJECT_ID ||
  !DEPLOYER_MNEMONIC ||
  !CORE_CONTROLLER_MNEMONIC ||
  !WHITELIST_CONTROLLER_MNEMONIC ||
  !OZ_ADMIN_MNEMONIC ||
  DISABLE_ZK_CHECKS === undefined
) {
  console.error("environment variables not found!");
  console.log(NETWORK);
  console.log(PROJECT_ID);
  console.log(DEPLOYER_MNEMONIC);
  console.log(CORE_CONTROLLER_MNEMONIC);
  console.log(WHITELIST_CONTROLLER_MNEMONIC);
  console.log(OZ_ADMIN_MNEMONIC);
  console.log(DISABLE_ZK_CHECKS);
  throw "";
}

if (DISABLE_ZK_CHECKS) {
  console.log("WARNING: ZK checks disabled.");
}

let network_url = "http://localhost:8545";

if (NETWORK === Network.Ropsten) {
  network_url = `https://ropsten.infura.io/v3/${PROJECT_ID}`;
} else if (NETWORK === Network.xDAI) {
  network_url = "https://dai.poa.network/";
} else if (NETWORK === Network.PersonalGanache) {
  network_url = "https://dark-forest.online:8545";
}

const exec = async (command: string) => {
  const { error, stdout, stderr } = await rawExec(command);
  console.log(">> ", command);

  if (error) {
    console.error(`{command} failed with error ${error} and stderr ${stderr}.`);
    throw "";
  } else {
    return stdout.trim();
  }
};

const deploy = async () => {
  if (!isProd) {
    // delete old contract data
    // -f in case path doesn't exist
    await exec(`rm -f .openzeppelin/dev-31337.json`);
  }

  // compile the contracts
  await exec(`oz compile --optimizer on --no-interactive`);

  const [
    deployerWallet,
    whitelistControllerWallet,
    coreControllerWallet,
    ozAdminWallet,
  ] = [
    new HDWalletProvider(DEPLOYER_MNEMONIC, network_url),
    new HDWalletProvider(WHITELIST_CONTROLLER_MNEMONIC, network_url),
    new HDWalletProvider(CORE_CONTROLLER_MNEMONIC, network_url),
    new HDWalletProvider(OZ_ADMIN_MNEMONIC, network_url),
  ];

  const [whitelistControllerAddress, coreControllerAddress, ozAdminAddress] = [
    whitelistControllerWallet.getAddress(),
    coreControllerWallet.getAddress(),
    ozAdminWallet.getAddress(),
  ];

  // Only when deploying to production, give the deployer wallet money,
  // in order for it to be able to deploy the contracts
  if (isProd) {
    console.log(`Give some eth to ${deployerWallet.getAddress()}`);
    readlineSync.question("Press enter when you're done.");
  }

  // deploy the whitelist contract
  const whitelistContractAddress = await deployWhitelist(
    whitelistControllerAddress
  );

  // Save the deployment environment variables relevant for whitelist
  writeEnv(`../whitelist/${isProd ? "prod" : "dev"}.autogen.env`, {
    mnemonic: WHITELIST_CONTROLLER_MNEMONIC,
    project_id: PROJECT_ID,
    contract_address: whitelistContractAddress,
  });

  // deploy the tokens contract
  const tokensContractAddress = await deployTokens();

  // deploy the core contract
  const coreContractAddress = await deployCore(
    coreControllerAddress,
    whitelistContractAddress,
    tokensContractAddress
  );

  await exec(
    `oz send-tx -n ${NETWORK} --to ${tokensContractAddress} --method initialize --args ${coreContractAddress},${coreControllerAddress} --no-interactive`
  );

  // save the addresses of the deployed contracts to files that
  // are accessible by typesript, so that the client connects to the correct
  // contracts
  fs.writeFileSync(
    isProd
      ? "../client/src/utils/prod_contract_addr.ts"
      : "../client/src/utils/local_contract_addr.ts",
    `export const contractAddress = '${coreContractAddress}';\nexport const tokensContract = '${tokensContractAddress}';\nexport const whitelistContract = '${whitelistContractAddress}';\n`
  );

  // save the core contract json
  await exec("mkdir -p ../client/public/contracts");
  await exec(
    "cp build/contracts/DarkForestCore.json ../client/public/contracts/"
  );
  await exec(
    "cp build/contracts/DarkForestTokens.json ../client/public/contracts/"
  );
  await exec("cp build/contracts/Whitelist.json ../client/public/contracts/");

  await exec(
    `oz set-admin ${coreControllerAddress} ${ozAdminAddress} --network ${NETWORK} --no-interactive --force`
  );

  // save environment variables (i.e. contract addresses) and contract ABI to cache-server
  // save the addresses of the deployed contracts to files that
  // are accessible by typesript, so that the client connects to the correct
  // contracts
  fs.writeFileSync(
    isProd
      ? "../cache-server/src/prod_contract_addrs.ts"
      : "../cache-server/src/local_contract_addrs.ts",
    `export const coreContractAddress = '${coreContractAddress}';\nexport const tokensContract = '${tokensContractAddress}';\nexport const whitelistContract = '${whitelistContractAddress}';\n`
  );
  await exec("cp build/contracts/DarkForestCore.json ../cache-server/src/abi/");
  await exec(
    "cp build/contracts/DarkForestTokens.json ../cache-server/src/abi/"
  );
  await exec("cp build/contracts/Whitelist.json ../cache-server/src/abi/");

  console.log("Deploy over. You can quit this process.");
};

const deployWhitelist = async (
  whitelistControllerAddress: string
): Promise<string> => {
  await exec(`oz add Whitelist`);
  await exec(`oz push -n ${NETWORK} --no-interactive --reset --force`);
  const whitelistAddress = await exec(
    `oz deploy Whitelist -k regular -n ${NETWORK} --no-interactive`
  );
  await exec(
    `oz send-tx -n ${NETWORK} --to ${whitelistAddress} --method initialize --args ${whitelistControllerAddress},${isProd} --no-interactive`
  );
  await exec(
    `oz send-tx -n ${NETWORK} --to ${whitelistAddress} --method receiveEther --value 2000000000000000000 --no-interactive`
  );
  console.log(`Whitelist deployed to ${whitelistAddress}`);
  return whitelistAddress;
};

const deployTokens = async (): Promise<string> => {
  await exec(`oz add DarkForestTokens`);
  await exec(`oz push -n ${NETWORK} --no-interactive --reset --force`);
  const dfTokensAddress = await exec(
    `oz deploy DarkForestTokens -k upgradeable -n ${NETWORK} --no-interactive`
  );

  console.log(`DarkForestTokens deployed to ${dfTokensAddress}.`);
  return dfTokensAddress;
};

const deployCore = async (
  coreControllerAddress: string,
  whitelistAddress: string,
  tokensAddress: string
): Promise<string> => {
  await exec(`oz add DarkForestCore`);
  await exec(`oz push -n ${NETWORK} --no-interactive --reset --force`);
  const dfCoreAddress = await exec(
    `oz deploy DarkForestCore -k upgradeable -n ${NETWORK} --no-interactive`
  );
  await exec(
    `oz send-tx -n ${NETWORK} --to ${dfCoreAddress} --method initialize --args ${coreControllerAddress},${whitelistAddress},${tokensAddress},${DISABLE_ZK_CHECKS} --no-interactive`
  );
  console.log(`DFCore deployed to ${dfCoreAddress}.`);
  return dfCoreAddress;
};

const writeEnv = (filename: string, dict: Record<string, string>): void => {
  const str = Object.entries(dict)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  fs.writeFileSync(filename, str);
};

deploy();
