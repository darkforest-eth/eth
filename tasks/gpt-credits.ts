import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { DarkForestGPTCredit } from '../task-types';

task('gpt:giftCredits', 'give credits to player')
  .addParam('address', 'network address', undefined, types.string)
  .addParam('amount', 'amount of credits to give', undefined, types.int)
  .setAction(giftCredits);

async function giftCredits(
  { address, amount }: { address: string; amount: number },
  hre: HardhatRuntimeEnvironment
) {
  await hre.run('utils:assertChainId');

  const gptCreditContract: DarkForestGPTCredit = await hre.run('utils:getGPTCredit');

  console.log(`giving ${amount} GPT credits to ${address}`);

  const receipt = await gptCreditContract.giftPlayerCredits(address, amount);
  await receipt.wait();
}

task('gpt:setGPTCreditPrice', 'change the GPT credit price')
  .addPositionalParam('price', 'the new price in ether', undefined, types.float)
  .setAction(setGPTCreditPrice);

async function setGPTCreditPrice(args: { price: number }, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');

  const gptCreditContract: DarkForestGPTCredit = await hre.run('utils:getGPTCredit');

  const priceWei = hre.ethers.utils.parseUnits(args.price.toString(), 'ether');

  const receipt = await gptCreditContract.changeCreditPrice(priceWei);
  await receipt.wait();
}
