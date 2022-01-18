import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
    availableFeeValues,
    feeDivisor,
    promoterFee,
    providerBaseFee,
    providerDiscountFee
} from '../../utils/fee-constants';
import { DexProxy as DexProxyType } from '../../../typechain';
import { TOKENS } from '../../utils/tokens';
import {
    getBalance,
    getTransactionFeeByReceipt,
    resetNetwork,
    setTokenBalance,
    toWei
} from '../../utils/blockchain';

describe('DexProxy with Pancake swap', function () {
    const pancakeSwapAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

    let dexProxy: DexProxyType;
    let alice: SignerWithAddress;
    let integratorAddress: string;
    let promoterAddress: string;
    let providerAddress: string;

    beforeEach(async () => {
        await resetNetwork();
        const signers = await ethers.getSigners();
        alice = signers[1];
        integratorAddress = signers[2].address;
        promoterAddress = signers[3].address;
        providerAddress = signers[4].address;

        const DexProxy = await ethers.getContractFactory('DexProxy');
        dexProxy = await DexProxy.deploy(
            promoterFee,
            providerBaseFee,
            providerDiscountFee,
            providerAddress,
            availableFeeValues,
            [pancakeSwapAddress]
        );
    });

    it('Should give correct fee in swap NATIVE-ERC20 with promoter.', async () => {
        const fromToken = TOKENS.BNB;
        const toToken = TOKENS.BUSD;
        const amount = toWei('1', fromToken.decimals);
        const expectedToAmount = toWei('422.380197389784994586', toToken.decimals);
        const pancakeSwapCallData = `0x7ff36ab50000000000000000000000000000000000000000000000167077fca069f57a660000000000000000000000000000000000000000000000000000000000000080000000000000000000000000${dexProxy.address.slice(
            2
        )}0000000000000000000000000000000000000000000000000000000061e690c00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d56`;
        const integratorFee = 100;

        const aliceFromTokenBalanceBefore = await getBalance(alice.address, fromToken.address);
        const aliceToTokenBalanceBefore = await getBalance(alice.address, toToken.address);
        const integratorToTokenBalanceBefore = await getBalance(integratorAddress, toToken.address);
        const promoterToTokenBalanceBefore = await getBalance(promoterAddress, toToken.address);
        const providerToTokenBalanceBefore = await getBalance(providerAddress, toToken.address);

        dexProxy = dexProxy.connect(alice);
        const swapTransaction = await dexProxy.swapWithPromoter(
            fromToken.address,
            toToken.address,
            amount,
            pancakeSwapAddress,
            pancakeSwapCallData,
            {
                fee: integratorFee,
                feeTarget: integratorAddress
            },
            promoterAddress,
            {
                value: amount
            }
        );
        const swapTransactionReceipt = await swapTransaction.wait();

        const aliceFromTokenBalanceAfter = await getBalance(alice.address, fromToken.address);
        const aliceToTokenBalanceAfter = await getBalance(alice.address, toToken.address);
        const integratorToTokenBalanceAfter = await getBalance(integratorAddress, toToken.address);
        const promoterToTokenBalanceAfter = await getBalance(promoterAddress, toToken.address);
        const providerToTokenBalanceAfter = await getBalance(providerAddress, toToken.address);

        const swapTransactionFee = await getTransactionFeeByReceipt(swapTransactionReceipt);

        const integratorFeeBonus = providerBaseFee - providerDiscountFee - promoterFee;
        const expectedIntegratorToTokenBalanceAfter = integratorToTokenBalanceBefore.add(
            expectedToAmount.mul(integratorFee + integratorFeeBonus).div(feeDivisor)
        );
        const expectedPromoterToTokenBalanceAfter = promoterToTokenBalanceBefore.add(
            expectedToAmount.mul(promoterFee).div(feeDivisor)
        );
        const expectedProviderToTokenBalanceAfter = providerToTokenBalanceBefore.add(
            expectedToAmount.mul(providerDiscountFee).div(feeDivisor)
        );
        const expectedAliceToTokenBalanceAfter = aliceToTokenBalanceBefore
            .add(expectedToAmount)
            .sub(expectedToAmount.mul(integratorFee + integratorFeeBonus).div(feeDivisor))
            .sub(expectedToAmount.mul(promoterFee).div(feeDivisor))
            .sub(expectedToAmount.mul(providerDiscountFee).div(feeDivisor));
        const expectedAliceFromTokenBalanceAfter = aliceFromTokenBalanceBefore
            .sub(swapTransactionFee)
            .sub(amount);

        expect(swapTransactionReceipt.status).to.be.eq(1);
        expect(integratorToTokenBalanceAfter.eq(expectedIntegratorToTokenBalanceAfter)).to.be.eq(
            true
        );
        expect(promoterToTokenBalanceAfter.eq(expectedPromoterToTokenBalanceAfter)).to.be.eq(true);
        expect(providerToTokenBalanceAfter.eq(expectedProviderToTokenBalanceAfter)).to.be.eq(true);
        expect(aliceToTokenBalanceAfter.eq(expectedAliceToTokenBalanceAfter)).to.be.eq(true);
        expect(aliceFromTokenBalanceAfter.eq(expectedAliceFromTokenBalanceAfter)).to.be.eq(true);
    });

    it('Should give correct fee in swap ERC20-NATIVE with promoter.', async () => {
        const fromToken = TOKENS.BUSD;
        const toToken = TOKENS.BNB;
        const amount = toWei('1', fromToken.decimals);
        const expectedToAmount = toWei('0.002356615098091433', toToken.decimals);
        const pancakeSwapCallData = `0x18cbafe50000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000834765dad9d4400000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000${dexProxy.address.slice(
            2
        )}0000000000000000000000000000000000000000000000000000000061e6cb520000000000000000000000000000000000000000000000000000000000000003000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d5600000000000000000000000023396cf899ca06c4472205fc903bdb4de249d6fc000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c`;
        const integratorFee = 100;

        await setTokenBalance(fromToken.address, amount, alice.address);

        const aliceFromTokenBalanceBefore = await getBalance(alice.address, fromToken.address);
        const aliceToTokenBalanceBefore = await getBalance(alice.address, toToken.address);
        const integratorToTokenBalanceBefore = await getBalance(integratorAddress, toToken.address);
        const promoterToTokenBalanceBefore = await getBalance(promoterAddress, toToken.address);
        const providerToTokenBalanceBefore = await getBalance(providerAddress, toToken.address);

        const busdContract = await ethers.getContractAt('IERC20', fromToken.address, alice);
        const approveTransaction = await busdContract.approve(dexProxy.address, amount);
        const approveTransactionReceipt = await approveTransaction.wait();

        dexProxy = dexProxy.connect(alice);
        const swapTransaction = await dexProxy.swapWithPromoter(
            fromToken.address,
            toToken.address,
            amount,
            pancakeSwapAddress,
            pancakeSwapCallData,
            {
                fee: integratorFee,
                feeTarget: integratorAddress
            },
            promoterAddress
        );
        const swapTransactionReceipt = await swapTransaction.wait();

        const aliceFromTokenBalanceAfter = await getBalance(alice.address, fromToken.address);
        const aliceToTokenBalanceAfter = await getBalance(alice.address, toToken.address);
        const integratorToTokenBalanceAfter = await getBalance(integratorAddress, toToken.address);
        const promoterToTokenBalanceAfter = await getBalance(promoterAddress, toToken.address);
        const providerToTokenBalanceAfter = await getBalance(providerAddress, toToken.address);

        const approveTransactionFee = await getTransactionFeeByReceipt(approveTransactionReceipt);
        const swapTransactionFee = await getTransactionFeeByReceipt(swapTransactionReceipt);

        const integratorFeeBonus = providerBaseFee - providerDiscountFee - promoterFee;
        const expectedIntegratorToTokenBalanceAfter = integratorToTokenBalanceBefore.add(
            expectedToAmount.mul(integratorFee + integratorFeeBonus).div(feeDivisor)
        );
        const expectedPromoterToTokenBalanceAfter = promoterToTokenBalanceBefore.add(
            expectedToAmount.mul(promoterFee).div(feeDivisor)
        );
        const expectedProviderToTokenBalanceAfter = providerToTokenBalanceBefore.add(
            expectedToAmount.mul(providerDiscountFee).div(feeDivisor)
        );
        const expectedAliceToTokenBalanceAfter = aliceToTokenBalanceBefore
            .sub(approveTransactionFee)
            .sub(swapTransactionFee)
            .add(expectedToAmount)
            .sub(expectedToAmount.mul(integratorFee + integratorFeeBonus).div(feeDivisor))
            .sub(expectedToAmount.mul(promoterFee).div(feeDivisor))
            .sub(expectedToAmount.mul(providerDiscountFee).div(feeDivisor));
        const expectedAliceFromTokenBalanceAfter = aliceFromTokenBalanceBefore.sub(amount);

        expect(swapTransactionReceipt.status).to.be.eq(1);
        expect(integratorToTokenBalanceAfter.eq(expectedIntegratorToTokenBalanceAfter)).to.be.eq(
            true
        );
        expect(promoterToTokenBalanceAfter.eq(expectedPromoterToTokenBalanceAfter)).to.be.eq(true);
        expect(providerToTokenBalanceAfter.eq(expectedProviderToTokenBalanceAfter)).to.be.eq(true);
        expect(aliceToTokenBalanceAfter.eq(expectedAliceToTokenBalanceAfter)).to.be.eq(true);
        expect(aliceFromTokenBalanceAfter.eq(expectedAliceFromTokenBalanceAfter)).to.be.eq(true);
    });

    it('Should give correct fee in swap ERC20-ERC20 with promoter.', async () => {
        const fromToken = TOKENS.BUSD;
        const toToken = TOKENS.BRBC;
        const amount = toWei('1', fromToken.decimals);
        const expectedToAmount = toWei('4.847116995576762401', toToken.decimals);
        const pancakeSwapCallData = `0x38ed17390000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000041ec02ae8bfd459100000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000${dexProxy.address.slice(
            2
        )}0000000000000000000000000000000000000000000000000000000061e6e71f0000000000000000000000000000000000000000000000000000000000000004000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d5600000000000000000000000023396cf899ca06c4472205fc903bdb4de249d6fc000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c0000000000000000000000008e3bcc334657560253b83f08331d85267316e08a`;
        const integratorFee = 100;

        await setTokenBalance(fromToken.address, amount, alice.address);

        const aliceFromTokenBalanceBefore = await getBalance(alice.address, fromToken.address);
        const aliceToTokenBalanceBefore = await getBalance(alice.address, toToken.address);
        const integratorToTokenBalanceBefore = await getBalance(integratorAddress, toToken.address);
        const promoterToTokenBalanceBefore = await getBalance(promoterAddress, toToken.address);
        const providerToTokenBalanceBefore = await getBalance(providerAddress, toToken.address);

        const busdContract = await ethers.getContractAt('IERC20', fromToken.address, alice);
        await busdContract.approve(dexProxy.address, amount);

        dexProxy = dexProxy.connect(alice);
        const swapTransaction = await dexProxy.swapWithPromoter(
            fromToken.address,
            toToken.address,
            amount,
            pancakeSwapAddress,
            pancakeSwapCallData,
            {
                fee: integratorFee,
                feeTarget: integratorAddress
            },
            promoterAddress
        );
        const swapTransactionReceipt = await swapTransaction.wait();

        const aliceFromTokenBalanceAfter = await getBalance(alice.address, fromToken.address);
        const aliceToTokenBalanceAfter = await getBalance(alice.address, toToken.address);
        const integratorToTokenBalanceAfter = await getBalance(integratorAddress, toToken.address);
        const promoterToTokenBalanceAfter = await getBalance(promoterAddress, toToken.address);
        const providerToTokenBalanceAfter = await getBalance(providerAddress, toToken.address);

        const integratorFeeBonus = providerBaseFee - providerDiscountFee - promoterFee;
        const expectedIntegratorToTokenBalanceAfter = integratorToTokenBalanceBefore.add(
            expectedToAmount.mul(integratorFee + integratorFeeBonus).div(feeDivisor)
        );
        const expectedPromoterToTokenBalanceAfter = promoterToTokenBalanceBefore.add(
            expectedToAmount.mul(promoterFee).div(feeDivisor)
        );
        const expectedProviderToTokenBalanceAfter = providerToTokenBalanceBefore.add(
            expectedToAmount.mul(providerDiscountFee).div(feeDivisor)
        );
        const expectedAliceToTokenBalanceAfter = aliceToTokenBalanceBefore
            .add(expectedToAmount)
            .sub(expectedToAmount.mul(integratorFee + integratorFeeBonus).div(feeDivisor))
            .sub(expectedToAmount.mul(promoterFee).div(feeDivisor))
            .sub(expectedToAmount.mul(providerDiscountFee).div(feeDivisor));
        const expectedAliceFromTokenBalanceAfter = aliceFromTokenBalanceBefore.sub(amount);

        expect(swapTransactionReceipt.status).to.be.eq(1);
        expect(integratorToTokenBalanceAfter.eq(expectedIntegratorToTokenBalanceAfter)).to.be.eq(
            true
        );
        expect(promoterToTokenBalanceAfter.eq(expectedPromoterToTokenBalanceAfter)).to.be.eq(true);
        expect(providerToTokenBalanceAfter.eq(expectedProviderToTokenBalanceAfter)).to.be.eq(true);
        expect(aliceToTokenBalanceAfter.eq(expectedAliceToTokenBalanceAfter)).to.be.eq(true);
        expect(aliceFromTokenBalanceAfter.eq(expectedAliceFromTokenBalanceAfter)).to.be.eq(true);
    });
});
