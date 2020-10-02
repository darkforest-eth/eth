const util = require("util");
const rawExec = util.promisify(require("child_process").exec);
const fs = require("fs");
const readlineSync = require("readline-sync");
//@ts-ignore
import HDWalletProvider from "@truffle/hdwallet-provider";

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
  network_url = "https://rpc.xdaichain.com/";
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

const run = async () => {
  await exec(`oz compile --optimizer on --no-interactive`);
  console.log("Deploy mnemonics: ", DEPLOYER_MNEMONIC);
  const deployerWallet = new HDWalletProvider(DEPLOYER_MNEMONIC, network_url);
  const whitelistControllerWallet = new HDWalletProvider(
    WHITELIST_CONTROLLER_MNEMONIC,
    network_url
  );
  const coreControllerWallet = new HDWalletProvider(
    CORE_CONTROLLER_MNEMONIC,
    network_url
  );
  const ozAdminWallet = new HDWalletProvider(OZ_ADMIN_MNEMONIC, network_url);
  if (isProd) {
    console.log(`Give some eth to ${deployerWallet.getAddress()}`);
    readlineSync.question("Press enter when you're done.");
  }
  const whitelistControllerAddress = whitelistControllerWallet.getAddress();
  const whitelistContractAddress = await deployWhitelist(
    whitelistControllerAddress
  );

  writeEnv(`../whitelist/${isProd ? "prod" : "dev"}.autogen.env`, {
    mnemonic: WHITELIST_CONTROLLER_MNEMONIC,
    project_id: PROJECT_ID,
    contract_address: whitelistContractAddress,
  });
  const coreControllerAddress = coreControllerWallet.getAddress();
  const coreContractAddress = await deployCore(
    coreControllerAddress,
    whitelistContractAddress
  );
  fs.writeFileSync(
    isProd
      ? "../client/src/utils/prod_contract_addr.ts"
      : "../client/src/utils/local_contract_addr.ts",
    `export const contractAddress = '${coreContractAddress}'`
  );
  await exec("mkdir -p ../client/public/contracts");
  await exec(
    "cp build/contracts/DarkForestCore.json ../client/public/contracts/"
  );

  const ozAdminAddress = ozAdminWallet.getAddress();

  await exec(
    `oz set-admin ${coreControllerAddress} ${ozAdminAddress} --network ${NETWORK} --no-interactive --force`
  );

  console.log("Deploy over. You can quit this process.");
  //process.exit()
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

const deployCore = async (
  coreControllerAddress: string,
  whitelistAddress: string
): Promise<string> => {
  await exec(`oz add DarkForestCore`);
  await exec(`oz push -n ${NETWORK} --no-interactive --reset --force`);
  const dfCoreAddress = await exec(
    `oz deploy DarkForestCore -k upgradeable -n ${NETWORK} --no-interactive`
  );
  await exec(
    `oz send-tx -n ${NETWORK} --to ${dfCoreAddress} --method initialize --args ${coreControllerAddress},${whitelistAddress},${DISABLE_ZK_CHECKS} --no-interactive`
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

run();
