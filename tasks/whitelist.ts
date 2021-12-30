import * as fs from 'fs';
import { subtask, task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { Whitelist, DarkForestCore } from '../task-types';
import { generateKey, generateKeys, keysPerTx } from './whitelist-helpers';

task('whitelist:changeDrip', 'change the faucet amount for whitelisted players')
  .addPositionalParam('value', 'drip value (in ether or xDAI)', undefined, types.float)
  .setAction(changeDrip);

async function changeDrip(args: { value: number }, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  const whitelist: Whitelist = await hre.run('utils:getWhitelist');

  const txReceipt = await whitelist.changeDrip(hre.ethers.utils.parseEther(args.value.toString()));
  await txReceipt.wait();

  console.log(`changed drip to ${args.value}`);
}

task('whitelist:generate', 'create n keys and add to whitelist contract')
  .addPositionalParam('number', 'number of keys', undefined, types.int)
  .setAction(whitelistGenerate);

async function whitelistGenerate(args: { number: number }, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  const nKeys = args.number;

  const whitelist: Whitelist = await hre.run('utils:getWhitelist');

  let allKeys: string[] = [];
  let keysGenerated = 0;
  for (let i = 0; i < nKeys / keysPerTx; i += 1) {
    const keysToGenerate = Math.min(nKeys - keysGenerated, keysPerTx);
    console.log(`Keyset ${i}: registering ${keysToGenerate} keys`);

    const keys: string[] = generateKeys(keysToGenerate);
    const hashes: string[] = keys.map((x) => hre.ethers.utils.id(x));

    try {
      const akReceipt = await whitelist.addKeys(hashes, { gasPrice: '5000000000' }); // 5gwei
      await akReceipt.wait();

      allKeys = allKeys.concat(keys);
      keysGenerated += keysPerTx;

      for (const key of keys) {
        fs.appendFileSync('./keys.txt', key + '\n');
      }
    } catch (e) {
      console.log(`Error generating keyset ${i}: ${e}`);
    }
  }

  const balance = await hre.ethers.provider.getBalance(whitelist.address);
  console.log('whitelist balance:', hre.ethers.utils.formatEther(balance));

  console.log('generated keys: ');
  console.log(allKeys);
}

task('whitelist:exists', 'check if previously whitelisted')
  .addOptionalParam('address', 'network address', undefined, types.string)
  .addOptionalParam('key', 'whitelist key', undefined, types.string)
  .setAction(whitelistExists);

async function whitelistExists(
  { address, key }: { address?: string; key?: string },
  hre: HardhatRuntimeEnvironment
) {
  if (key !== undefined && address !== undefined) {
    throw new Error(`Provided both key and address. Choose one.`);
  }

  if (address !== undefined) {
    return await hre.run('whitelist:existsAddress', { address });
  } else if (key !== undefined) {
    return await hre.run('whitelist:existsKey', { key });
  }
}

subtask('whitelist:existsAddress', 'determine if an address is whitelisted')
  .addParam('address', 'network address', undefined, types.string)
  .setAction(whitelistExistsAddress);

async function whitelistExistsAddress(args: { address: string }, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  const whitelist: Whitelist = await hre.run('utils:getWhitelist');

  const isAddress = hre.ethers.utils.isAddress(args.address);
  if (!isAddress) {
    throw new Error(`Address ${args.address} is NOT a valid address.`);
  }

  const isWhitelisted = await whitelist.isWhitelisted(args.address);

  const balance = await hre.ethers.provider.getBalance(whitelist.address);
  console.log('whitelist balance:', hre.ethers.utils.formatEther(balance));

  console.log(`Player ${args.address} is${isWhitelisted ? '' : ' NOT'} whitelisted.`);
}

subtask('whitelist:existsKey', 'determine if a whitelist key is valid')
  .addParam('key', 'whitelist key', undefined, types.string)
  .setAction(whitelistExistsKey);

async function whitelistExistsKey(args: { key: string }, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  const whitelist: Whitelist = await hre.run('utils:getWhitelist');

  const isValid = await whitelist.isKeyValid(args.key);

  const balance = await hre.ethers.provider.getBalance(whitelist.address);
  console.log('whitelist balance:', hre.ethers.utils.formatEther(balance));

  console.log(`Key ${args.key} is${isValid ? '' : ' NOT'} valid.`);
}

task(
  'whitelist-nokey:register',
  'path to csv file of addresses'
) 
  .addParam(
    'path',
    'file path to csv of addresses',
    undefined,
    types.string
)
.setAction(noKeyWhitelistRegister);

async function noKeyWhitelistRegister(args: { path: string }, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  const whitelist: Whitelist = await hre.run('utils:getWhitelist');

  const drip = hre.ethers.utils.formatEther(await whitelist.drip());
  console.log("drip", drip);

  const prevBalance = await hre.ethers.provider.getBalance(whitelist.address);
  const prevBalanceEth = parseFloat(hre.ethers.utils.formatEther(prevBalance));
  console.log('whitelist balance:', prevBalanceEth);

  const prevPlayers = await whitelist.numPlayers();
  console.log('num whitelisted players before adding:', prevPlayers.toNumber());

  const allowedAccounts = await whitelist.bulkGetWhitelistIds(hre.ethers.constants.Zero, prevPlayers);
  /// console.log('allowed accounts', allowedAccounts);

  let addresses = "";
  console.log("path", args.path);
  addresses = fs.readFileSync(args.path, 'utf8')
  // remove new line 
  addresses = addresses.replace(/\n|\r/g,'');
  if(!addresses) {
    console.log("failed to read addresses");
    return;
  }

  const finalAddresses = addresses.split(',');

  // also filter for whitelisted addresses that are already in game.
  let validAddresses = finalAddresses
      .filter(hre.ethers.utils.isAddress)
      .filter(acc => !allowedAccounts.includes(acc)); // Filter out accounts that are already whitelisted.
  
  const slice = 100;

  validAddresses = validAddresses.slice(0,500);

  console.log("total players to add", validAddresses.length);
  console.log(`require ${parseFloat(drip) * validAddresses.length} < ${prevBalanceEth} in contract`);

  if( (parseFloat(drip) * validAddresses.length) >= prevBalanceEth) {
    console.log("not enough eth in contract. Add more before whitelisting");
    return;
  }
  
  if(validAddresses.length === 0) {
    console.log("no valid addresses to register");
    return;
  }

  // batch into chunks of 100
  for(let i = 0; i < validAddresses.length; i+=slice) {
    console.log(`examining index ${i} to ${i + slice}`);
    const addressChunk = validAddresses.slice(i, i + slice);

    console.log("chunk players to add", addressChunk.length);
    if(addressChunk.length == 0) {
      console.log("no addresses to chunk")
      continue;
    }

    const prevBalance = await hre.ethers.provider.getBalance(whitelist.address);

    console.log("drip", drip);
    console.log(parseFloat(drip));
    console.log("expected amount in whitelist", parseFloat(drip) * addressChunk.length);
  
    if( parseFloat(drip) * addressChunk.length > parseFloat(hre.ethers.utils.formatEther(prevBalance))) {
      console.log("not enough eth in contract. Add more before whitelisting");
      break;
    }
    console.log('whitelist balance before adding:', parseFloat(hre.ethers.utils.formatEther(prevBalance)));

    const prevPlayers = await whitelist.numPlayers();
    console.log('num whitelisted players before adding:', prevPlayers.toNumber());

    const addTx = await whitelist.addAndDripPlayers(addressChunk);
    await addTx.wait();

    const currBalance = await hre.ethers.provider.getBalance(whitelist.address);
    console.log('whitelist balance after adding:', hre.ethers.utils.formatEther(currBalance));

    const currPlayers = await whitelist.numPlayers();
    console.log('num whitelisted players after adding:', currPlayers.toNumber());

    const newPlayers = currPlayers.sub(prevPlayers).toNumber()
    if(newPlayers != addressChunk.length) {
      console.log("WARNING: not all players in list were successfully added");
    }
    
    const sentAmount = hre.ethers.utils.formatEther(prevBalance.sub(currBalance));

    console.log(`[${new Date()}] Registered ${newPlayers} players with $${sentAmount} xDAI.`);
  }
}

task(
  'whitelist:register',
  'add address to whitelist contract with given key if provided, or on-the-fly-generated key if not provided'
)
  .addOptionalParam('key', 'whitelist key', undefined, types.string)
  .addParam(
    'address',
    'network address (or comma seperated list of addresses)',
    undefined,
    types.string
  )
  .setAction(whitelistRegister);

async function whitelistRegister(
  { address, key }: { address: string; key?: string },
  hre: HardhatRuntimeEnvironment
) {
  if (key === undefined) {
    return await hre.run('whitelist:registerAddress', { address });
  } else {
    return await hre.run('whitelist:registerKey', { address, key });
  }
}

subtask('whitelist:registerAddress', 'add address to whitelist with on-the-fly-generated key')
  .addParam(
    'address',
    'network address (or comma seperated list of addresses)',
    undefined,
    types.string
  )
  .setAction(whitelistRegisterAddress);

async function whitelistRegisterAddress(args: { address: string }, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  const whitelist: Whitelist = await hre.run('utils:getWhitelist');

  for (const address of args.address.split(',')) {
    const isAddress = hre.ethers.utils.isAddress(address);
    if (!isAddress) {
      throw new Error(`Address ${address} is NOT a valid address.`);
    }

    const isWhitelisted = await whitelist.isWhitelisted(address);
    if (isWhitelisted) {
      throw new Error(`Address ${address} is already whitelisted.`);
    }

    const apiKey: string = generateKey();
    const akReceipt = await whitelist.addKeys([hre.ethers.utils.id(apiKey)]);
    await akReceipt.wait();

    const ukReceipt = await whitelist.useKey(apiKey, address);
    await ukReceipt.wait();

    const balance = await hre.ethers.provider.getBalance(whitelist.address);
    console.log('whitelist balance:', hre.ethers.utils.formatEther(balance));

    console.log(`[${new Date()}] Registered player ${address} with key ${apiKey}.`);
  }
}

subtask('whitelist:registerKey', 'add address to whitelist with pregenerated key')
  .addParam('key', 'whitelist key', undefined, types.string)
  .addParam('address', 'network address', undefined, types.string)
  .setAction(whitelistRegisterKey);

async function whitelistRegisterKey(
  args: { address: string; key: string },
  hre: HardhatRuntimeEnvironment
) {
  await hre.run('utils:assertChainId');

  const whitelist: Whitelist = await hre.run('utils:getWhitelist');

  const isValid = await whitelist.isKeyValid(args.key);
  if (!isValid) {
    throw new Error(`Key ${args.key} is${isValid ? '' : ' NOT'} valid.`);
  }

  const isWhitelisted = await whitelist.isWhitelisted(args.address);
  if (isWhitelisted) {
    throw new Error(`Player ${args.address} is already whitelisted.`);
  }

  const ukReceipt = await whitelist.useKey(args.key, args.address);
  await ukReceipt.wait();

  const balance = await hre.ethers.provider.getBalance(whitelist.address);
  console.log('whitelist balance:', hre.ethers.utils.formatEther(balance));

  console.log(`[${new Date()}] Registered player ${args.address} with key ${args.key}.`);
}