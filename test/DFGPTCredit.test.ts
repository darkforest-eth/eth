import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BN_ZERO, fixtureLoader } from './utils/TestUtils';
import { defaultWorldFixture, World } from './utils/TestWorld';

describe('DarkForestGPTCredit', function () {
  let world: World;

  beforeEach('load fixture', async function () {
    world = await fixtureLoader(defaultWorldFixture);
  });

  it('should allow player to buy credits for ether/xdai', async function () {
    const creditPrice = await world.contracts.gptCredits.creditPrice();

    expect(await world.contracts.gptCredits.credits(world.user1.address)).to.equal(BN_ZERO);

    const creditsToBuy = 5;
    const buyTxPromise = world.user1GPTCredit.buyCredits(creditsToBuy, {
      value: creditPrice.mul(creditsToBuy).toString(),
    });
    await expect(buyTxPromise)
      .to.emit(world.contracts.gptCredits, 'BoughtCredits')
      .withArgs(world.user1.address, creditsToBuy, creditPrice.mul(creditsToBuy).toString());
    expect(await buyTxPromise).to.changeEtherBalances(
      [world.contracts.gptCredits, world.user1],
      [creditPrice.mul(creditsToBuy), creditPrice.mul(creditsToBuy).mul(-1)]
    );
    expect(await world.contracts.gptCredits.credits(world.user1.address)).to.equal(creditsToBuy);
  });

  it('should reject GPT credit purchase with not enough xDAI', async function () {
    const creditPrice = await world.contracts.gptCredits.creditPrice();

    expect(await world.contracts.gptCredits.credits(world.user1.address)).to.equal(BN_ZERO);

    const creditsToBuy = 5;
    const buyTxPromise = world.user1GPTCredit.buyCredits(creditsToBuy, {
      value: creditPrice.mul(creditsToBuy - 1).toString(),
    });

    await expect(buyTxPromise).to.be.revertedWith('Wrong value sent');
  });

  it('should allow admin (and only admin) to decrease player credits', async function () {
    const creditPrice = await world.contracts.gptCredits.creditPrice();
    const creditsToBuy = 5;

    await world.user1GPTCredit.buyCredits(creditsToBuy, {
      value: creditPrice.mul(creditsToBuy).toString(),
    });

    const creditsPre = await world.contracts.gptCredits.credits(world.user1.address);

    const creditsToDeduct = 2;

    await expect(
      world.user1GPTCredit.decreasePlayerCredits(world.user1.address, creditsToDeduct)
    ).to.be.revertedWith('Only administrator can perform this action');
    const deductTxPromise = world.contracts.gptCredits.decreasePlayerCredits(
      world.user1.address,
      creditsToDeduct
    );
    await expect(deductTxPromise)
      .to.emit(world.contracts.gptCredits, 'DeductedCredits')
      .withArgs(world.user1.address, creditsToDeduct);
    await deductTxPromise;

    const creditsPost = await world.contracts.gptCredits.credits(world.user1.address);

    expect(creditsPre.sub(creditsPost)).to.equal(creditsToDeduct);
  });

  it("shouldn't allow admin to decrease user credits by more credits than user has", async function () {
    const creditPrice = await world.contracts.gptCredits.creditPrice();
    const creditsToBuy = 5;

    await world.user1GPTCredit.buyCredits(creditsToBuy, {
      value: creditPrice.mul(creditsToBuy).toString(),
    });

    const creditsToDeduct = 7;

    await expect(
      world.contracts.gptCredits.decreasePlayerCredits(world.user1.address, creditsToDeduct)
    ).to.be.revertedWith('Not enough credits');
  });

  it('should allow admin (and only admin) to gift player credits', async function () {
    const creditsPre = await world.contracts.gptCredits.credits(world.user1.address);

    const creditsToGift = 2;

    await expect(
      world.user1GPTCredit.giftPlayerCredits(world.user1.address, creditsToGift)
    ).to.be.revertedWith('Only administrator can perform this action');
    const giftTxPromise = world.contracts.gptCredits.giftPlayerCredits(
      world.user1.address,
      creditsToGift
    );
    await expect(giftTxPromise)
      .to.emit(world.contracts.gptCredits, 'GiftedCredits')
      .withArgs(world.user1.address, creditsToGift);
    await giftTxPromise;

    const creditsPost = await world.contracts.gptCredits.credits(world.user1.address);

    expect(creditsPost.sub(creditsPre)).to.equal(creditsToGift);
  });

  it('should allow admin (and only admin) to change credit cost', async function () {
    const newCreditPrice = ethers.utils.parseUnits('0.15', 'ether');

    await expect(world.user1GPTCredit.changeCreditPrice(newCreditPrice)).to.be.revertedWith(
      'Only administrator can perform this action'
    );

    const changePriceTxPromise = world.contracts.gptCredits.changeCreditPrice(newCreditPrice);

    await expect(changePriceTxPromise)
      .to.emit(world.contracts.gptCredits, 'ChangedCreditPrice')
      .withArgs(newCreditPrice);
    await changePriceTxPromise;

    expect(await world.contracts.gptCredits.creditPrice()).to.equal(newCreditPrice);
    // verify that new credit price is used
    const creditsToBuy = 5;
    await expect(
      await world.user1GPTCredit.buyCredits(creditsToBuy, {
        value: newCreditPrice.mul(creditsToBuy).toString(),
      })
    ).to.changeEtherBalance(world.user1, newCreditPrice.mul(creditsToBuy).mul(-1));
  });

  it('should allow admin (and only admin) to withdraw all funds', async function () {
    const creditPrice = await world.contracts.gptCredits.creditPrice();
    const creditsToBuy = 5;
    await world.user1GPTCredit.buyCredits(creditsToBuy, {
      value: creditPrice.mul(creditsToBuy).toString(),
    });

    const preBalance = await ethers.provider.getBalance(world.contracts.gptCredits.address);

    await expect(world.user1GPTCredit.withdraw()).to.be.revertedWith(
      'Only administrator can perform this action'
    );

    await expect(await world.contracts.gptCredits.withdraw()).to.changeEtherBalance(
      world.contracts.gptCredits,
      preBalance.mul(-1)
    );
  });
});
