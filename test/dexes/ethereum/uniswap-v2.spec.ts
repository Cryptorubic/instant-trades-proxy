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
import { resetNetwork, setTokenBalance, toWei } from '../../utils/blockchain';

describe('DexProxy with Uniswap v2', function () {
    const uniswapV2Address = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

    let dexProxy: DexProxyType;
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let integratorAddress: string;
    let promoterAddress: string;
    let providerAddress: string;

    beforeEach(async () => {
        await resetNetwork();
        const signers = await ethers.getSigners();
        owner = signers[0];
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
            [uniswapV2Address]
        );
    });

    it('Should swap 1 ETH to 3173.460947 USDT', async () => {
        const fromToken = TOKENS.ETH;
        const toToken = TOKENS.USDT;
        const amount = toWei('1', fromToken.decimals);
        const expectedToAmount = toWei('3173.460947', toToken.decimals);
        const uniswapCallData = `0x7ff36ab500000000000000000000000000000000000000000000000000000000b95eb5300000000000000000000000000000000000000000000000000000000000000080000000000000000000000000${dexProxy.address.slice(
            2
        )}0000000000000000000000000000000000000000000000000000000061e1da9a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7`;
        const usdtContract = await ethers.getContractAt('IERC20', TOKENS.USDT.address);
        const integratorFee = 100;

        const aliceUsdtBalanceBefore: BigNumber = await usdtContract.balanceOf(alice.address);
        const integratorUsdtBalanceBefore: BigNumber = await usdtContract.balanceOf(
            integratorAddress
        );
        const promoterUsdtBalanceBefore: BigNumber = await usdtContract.balanceOf(promoterAddress);
        const providerUsdtBalanceBefore: BigNumber = await usdtContract.balanceOf(providerAddress);

        dexProxy = dexProxy.connect(alice);
        const transaction = await dexProxy.swapWithPromoter(
            fromToken.address,
            toToken.address,
            amount,
            uniswapV2Address,
            uniswapCallData,
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
        const aliceUsdtBalanceAfter: BigNumber = await usdtContract.balanceOf(alice.address);
        const integratorUsdtBalanceAfter: BigNumber = await usdtContract.balanceOf(
            integratorAddress
        );
        const promoterUsdtBalanceAfter: BigNumber = await usdtContract.balanceOf(promoterAddress);
        const providerUsdtBalanceAfter: BigNumber = await usdtContract.balanceOf(providerAddress);

        const integratorFeeBonus = providerBaseFee - providerDiscountFee - promoterFee;
        const expectedIntegratorUsdtBalanceAfter = integratorUsdtBalanceBefore.add(
            expectedToAmount.mul(integratorFee + integratorFeeBonus).div(feeDivisor)
        );
        const expectedPromoterUsdtBalanceAfter = promoterUsdtBalanceBefore.add(
            expectedToAmount.mul(promoterFee).div(feeDivisor)
        );
        const expectedProviderUsdtBalanceAfter = providerUsdtBalanceBefore.add(
            expectedToAmount.mul(providerDiscountFee).div(feeDivisor)
        );
        const expectedAliceBalanceAfter = aliceUsdtBalanceBefore
            .add(expectedToAmount)
            .sub(expectedToAmount.mul(integratorFee + integratorFeeBonus).div(feeDivisor))
            .sub(expectedToAmount.mul(promoterFee).div(feeDivisor))
            .sub(expectedToAmount.mul(providerDiscountFee).div(feeDivisor));

        expect(receipt.status).to.be.eq(1);
        expect(integratorUsdtBalanceAfter.eq(expectedIntegratorUsdtBalanceAfter)).to.be.eq(true);
        expect(promoterUsdtBalanceAfter.eq(expectedPromoterUsdtBalanceAfter)).to.be.eq(true);
        expect(providerUsdtBalanceAfter.eq(expectedProviderUsdtBalanceAfter)).to.be.eq(true);
        expect(aliceUsdtBalanceAfter.eq(expectedAliceBalanceAfter)).to.be.eq(true);
    });
});
