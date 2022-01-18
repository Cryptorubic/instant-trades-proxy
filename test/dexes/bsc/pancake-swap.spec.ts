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
import { BigNumber } from 'ethers';
import { resetNetwork, toWei } from '../../utils/blockchain';

describe('DexProxy with Pancake swap v2', function () {
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

    it('Should swap BNB to BUSD', async () => {
        const fromToken = TOKENS.BNB;
        const toToken = TOKENS.BUSD;
        const amount = toWei('1', fromToken.decimals);
        const expectedToAmount = toWei('422.380197389784994586', toToken.decimals);
        const pancakeSwapCallData = `0x7ff36ab50000000000000000000000000000000000000000000000167077fca069f57a660000000000000000000000000000000000000000000000000000000000000080000000000000000000000000${dexProxy.address.slice(
            2
        )}0000000000000000000000000000000000000000000000000000000061e690c00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d56`;

        const busdContract = await ethers.getContractAt('IERC20', TOKENS.BUSD.address);
        const integratorFee = 100;

        const aliceToTokenBalanceBefore: BigNumber = await busdContract.balanceOf(alice.address);
        const integratorToTokenBalanceBefore: BigNumber = await busdContract.balanceOf(
            integratorAddress
        );
        const promoterToTokenBalanceBefore: BigNumber = await busdContract.balanceOf(
            promoterAddress
        );
        const providerToTokenBalanceBefore: BigNumber = await busdContract.balanceOf(
            providerAddress
        );

        dexProxy = dexProxy.connect(alice);
        const transaction = await dexProxy.swapWithPromoter(
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
        const receipt = await transaction.wait();
        const aliceToTokenBalanceAfter: BigNumber = await busdContract.balanceOf(alice.address);
        const integratorToTokenBalanceAfter: BigNumber = await busdContract.balanceOf(
            integratorAddress
        );
        const promoterToTokenBalanceAfter: BigNumber = await busdContract.balanceOf(
            promoterAddress
        );
        const providerToTokenBalanceAfter: BigNumber = await busdContract.balanceOf(
            providerAddress
        );

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

        expect(receipt.status).to.be.eq(1);
        expect(integratorToTokenBalanceAfter.eq(expectedIntegratorToTokenBalanceAfter)).to.be.eq(
            true
        );
        expect(promoterToTokenBalanceAfter.eq(expectedPromoterToTokenBalanceAfter)).to.be.eq(true);
        expect(providerToTokenBalanceAfter.eq(expectedProviderToTokenBalanceAfter)).to.be.eq(true);
        expect(aliceToTokenBalanceAfter.eq(expectedAliceToTokenBalanceAfter)).to.be.eq(true);
    });
});
