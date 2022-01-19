import { DexProxy as DexProxyType } from '../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
    getBalance,
    resetNetwork,
    setNativeBalance,
    setTokenBalance,
    toWei
} from './utils/blockchain';
import { ethers } from 'hardhat';
import {
    availableFeeValues,
    promoterFee,
    providerBaseFee,
    providerDiscountFee
} from './utils/fee-constants';
import { expect } from 'chai';
import { TOKENS } from './utils/tokens';

describe('Withdrawable contract tests', function () {
    const availableDexesList = ['0x0000000000000000000000000000000000000001'];

    let dexProxy: DexProxyType;
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let receiverAddress: string;

    beforeEach(async () => {
        await resetNetwork();
        const signers = await ethers.getSigners();
        owner = signers[0];
        alice = signers[1];
        receiverAddress = signers[2].address;

        const DexProxy = await ethers.getContractFactory('DexProxy', owner);
        dexProxy = await DexProxy.deploy(
            promoterFee,
            providerBaseFee,
            providerDiscountFee,
            owner.address,
            availableFeeValues,
            availableDexesList
        );
    });

    it('Owner can withdraw ether.', async () => {
        const tokenToWithdraw = TOKENS.BNB;
        const amountToWithdraw = toWei('1', tokenToWithdraw.decimals);
        await setNativeBalance(amountToWithdraw, dexProxy.address);
        const receiverBalanceBefore = await getBalance(receiverAddress, tokenToWithdraw.address);

        dexProxy = dexProxy.connect(owner);
        await dexProxy.withdraw(tokenToWithdraw.address, amountToWithdraw, receiverAddress);
        const receiverBalanceAfter = await getBalance(receiverAddress, tokenToWithdraw.address);

        expect(receiverBalanceAfter).to.be.eq(receiverBalanceBefore.add(amountToWithdraw));
    });

    it('Owner can withdraw ERC20.', async () => {
        const tokenToWithdraw = TOKENS.BUSD;
        const amountToWithdraw = toWei('1', tokenToWithdraw.decimals);
        await setTokenBalance(tokenToWithdraw.address, amountToWithdraw, dexProxy.address);
        const receiverBalanceBefore = await getBalance(receiverAddress, tokenToWithdraw.address);

        dexProxy = dexProxy.connect(owner);
        await dexProxy.withdraw(tokenToWithdraw.address, amountToWithdraw, receiverAddress);
        const receiverBalanceAfter = await getBalance(receiverAddress, tokenToWithdraw.address);

        expect(receiverBalanceAfter).to.be.eq(receiverBalanceBefore.add(amountToWithdraw));
    });

    it('Only owner can withdraw ether.', async () => {
        const tokenToWithdraw = TOKENS.BNB;
        const amountToWithdraw = toWei('1');
        await setNativeBalance(amountToWithdraw, dexProxy.address);

        dexProxy = dexProxy.connect(alice);
        await expect(
            dexProxy.withdraw(tokenToWithdraw.address, amountToWithdraw, receiverAddress)
        ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Only owner can withdraw ERC20.', async () => {
        const tokenToWithdraw = TOKENS.BUSD;
        const amountToWithdraw = toWei('1');
        await setTokenBalance(tokenToWithdraw.address, amountToWithdraw, dexProxy.address);

        dexProxy = dexProxy.connect(alice);
        await expect(
            dexProxy.withdraw(tokenToWithdraw.address, amountToWithdraw, receiverAddress)
        ).to.be.revertedWith('Ownable: caller is not the owner');
    });
});
