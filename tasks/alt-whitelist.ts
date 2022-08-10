import { subtask, task, types } from 'hardhat/config';
import * as fs from 'fs';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const faucetAddr = process.env['FAUCET_ADDR']

task('alt-whitelist:generate', 'create the account and register to the game')
  .addPositionalParam('number', 'number of keys', undefined, types.int)
  .addPositionalParam('dripAmt', 'drip value (in ether)', undefined, types.float)
  .setAction(whitelistGenerate);

async function whitelistGenerate(
  args: {
    number: number
  },
  hre: HardhatRuntimeEnvironment
) {
  // Generate N wallets
  const mnemonic = await hre.ethers.utils.entropyToMnemonic(hre.ethers.utils.randomBytes(16));
  const walletPaths = Array(args.number).fill(0).map((_, k) => `m/44'/60'/0'/0/${k}`);
  const wallets = walletPaths.map(path => hre.ethers.Wallet.fromMnemonic(mnemonic, path));

  console.log('mnemonic:', mnemonic)
  wallets.forEach(wallet => {
    console.log(`addr: ${wallet.address}, private: ${wallet.privateKey}`)
  })

  // whitelist these addresses
  const addresses = wallets.map(w => w.address).join(',')
  await hre.run('whitelist:register', { address: addresses })

  // drip amount
  if (!faucetAddr) {
    console.log('No dripping as faucet address is not set.');
  } else {

  }

  // Write the public/private key to a csv file
  const content = wallets.map(w => `${w.address}, ${w.privateKey}`).join('\n')
  fs.appendFileSync('./alt-whitelist-addr.csv', content + '\n')
}
