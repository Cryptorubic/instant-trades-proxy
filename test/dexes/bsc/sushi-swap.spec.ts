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

describe('DexProxy with Sushi swap', function () {
    const sushiSwapAddress = '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506';

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
            [sushiSwapAddress]
        );
    });

    it('Should give correct fee in swap NATIVE-ERC20 with promoter.', async () => {
        const fromToken = TOKENS.BNB;
        const toToken = TOKENS.BUSD;
        const amount = toWei('1', fromToken.decimals);
        const expectedToAmount = toWei('391.713935640904315161', toToken.decimals);
        const sushiSwapCallData = `0x7ff36ab5000000000000000000000000000000000000000000000014cf66821831667f7a0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000${dexProxy.address.slice(
            2
        )}0000000000000000000000000000000000000000000000000000000061e941540000000000000000000000000000000000000000000000000000000000000002000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d56`;
        const integratorFee = availableFeeValues[0];

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
            sushiSwapAddress,
            sushiSwapCallData,
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
        expect(promoterToTokenBalanceAfter).to.be.eq(expectedPromoterToTokenBalanceAfter);
        expect(providerToTokenBalanceAfter).to.be.eq(expectedProviderToTokenBalanceAfter);
        expect(aliceToTokenBalanceAfter).to.be.eq(expectedAliceToTokenBalanceAfter);
        expect(aliceFromTokenBalanceAfter).to.be.eq(expectedAliceFromTokenBalanceAfter);
    });

    it('Should give correct fee in swap ERC20-NATIVE with promoter.', async () => {
        const fromToken = TOKENS.BUSD;
        const toToken = TOKENS.BNB;
        const amount = toWei('1', fromToken.decimals);
        const expectedToAmount = toWei('0.002359343964441116', toToken.decimals);
        const sushiSwapCallData = `0x18cbafe50000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000836e505b9b42600000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000${dexProxy.address.slice(
            2
        )}0000000000000000000000000000000000000000000000000000000061e941df0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d56000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c`;
        const integratorFee = availableFeeValues[0];

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
            sushiSwapAddress,
            sushiSwapCallData,
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
        expect(integratorToTokenBalanceAfter).to.be.eq(expectedIntegratorToTokenBalanceAfter);
        expect(promoterToTokenBalanceAfter).to.be.eq(expectedPromoterToTokenBalanceAfter);
        expect(providerToTokenBalanceAfter).to.be.eq(expectedProviderToTokenBalanceAfter);
        expect(aliceToTokenBalanceAfter).to.be.eq(expectedAliceToTokenBalanceAfter);
        expect(aliceFromTokenBalanceAfter).to.be.eq(expectedAliceFromTokenBalanceAfter);
    });

    it('Should give correct fee in swap ERC20-ERC20 with promoter.', async () => {
        const fromToken = TOKENS.BUSD;
        const toToken = TOKENS.CAKE;
        const amount = toWei('1', fromToken.decimals);
        const expectedToAmount = toWei('0.095877856589956001', toToken.decimals);
        const sushiSwapCallData = `0x38ed17390000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000014dd0650031595100000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000${dexProxy.address.slice(
            2
        )}0000000000000000000000000000000000000000000000000000000061e942370000000000000000000000000000000000000000000000000000000000000003000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d56000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c0000000000000000000000000e09fabb73bd3ade0a17ecc321fd13a19e81ce82`;
        const integratorFee = availableFeeValues[0];

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
            sushiSwapAddress,
            sushiSwapCallData,
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
        expect(integratorToTokenBalanceAfter).to.be.eq(expectedIntegratorToTokenBalanceAfter);
        expect(promoterToTokenBalanceAfter).to.be.eq(expectedPromoterToTokenBalanceAfter);
        expect(providerToTokenBalanceAfter).to.be.eq(expectedProviderToTokenBalanceAfter);
        expect(aliceToTokenBalanceAfter).to.be.eq(expectedAliceToTokenBalanceAfter);
        expect(aliceFromTokenBalanceAfter).to.be.eq(expectedAliceFromTokenBalanceAfter);
    });

    it('Should give correct fee in swap NATIVE-ERC20 without promoter.', async () => {
        const fromToken = TOKENS.BNB;
        const toToken = TOKENS.BUSD;
        const amount = toWei('1', fromToken.decimals);
        const expectedToAmount = toWei('391.713935640904315161', toToken.decimals);
        const sushiSwapCallData = `0x7ff36ab5000000000000000000000000000000000000000000000014cf66821831667f7a0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000${dexProxy.address.slice(
            2
        )}0000000000000000000000000000000000000000000000000000000061e941540000000000000000000000000000000000000000000000000000000000000002000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d56`;
        const integratorFee = availableFeeValues[0];

        const aliceFromTokenBalanceBefore = await getBalance(alice.address, fromToken.address);
        const aliceToTokenBalanceBefore = await getBalance(alice.address, toToken.address);
        const integratorToTokenBalanceBefore = await getBalance(integratorAddress, toToken.address);
        const providerToTokenBalanceBefore = await getBalance(providerAddress, toToken.address);

        dexProxy = dexProxy.connect(alice);
        const swapTransaction = await dexProxy.swap(
            fromToken.address,
            toToken.address,
            amount,
            sushiSwapAddress,
            sushiSwapCallData,
            {
                fee: integratorFee,
                feeTarget: integratorAddress
            },
            {
                value: amount
            }
        );
        const swapTransactionReceipt = await swapTransaction.wait();

        const aliceFromTokenBalanceAfter = await getBalance(alice.address, fromToken.address);
        const aliceToTokenBalanceAfter = await getBalance(alice.address, toToken.address);
        const integratorToTokenBalanceAfter = await getBalance(integratorAddress, toToken.address);
        const providerToTokenBalanceAfter = await getBalance(providerAddress, toToken.address);

        const swapTransactionFee = await getTransactionFeeByReceipt(swapTransactionReceipt);

        const expectedIntegratorToTokenBalanceAfter = integratorToTokenBalanceBefore.add(
            expectedToAmount.mul(integratorFee).div(feeDivisor)
        );
        const expectedProviderToTokenBalanceAfter = providerToTokenBalanceBefore.add(
            expectedToAmount.mul(providerBaseFee).div(feeDivisor)
        );
        const expectedAliceToTokenBalanceAfter = aliceToTokenBalanceBefore
            .add(expectedToAmount)
            .sub(expectedToAmount.mul(integratorFee).div(feeDivisor))
            .sub(expectedToAmount.mul(providerBaseFee).div(feeDivisor));
        const expectedAliceFromTokenBalanceAfter = aliceFromTokenBalanceBefore
            .sub(swapTransactionFee)
            .sub(amount);

        expect(swapTransactionReceipt.status).to.be.eq(1);
        expect(integratorToTokenBalanceAfter).to.be.eq(expectedIntegratorToTokenBalanceAfter);
        expect(providerToTokenBalanceAfter).to.be.eq(expectedProviderToTokenBalanceAfter);
        expect(aliceToTokenBalanceAfter).to.be.eq(expectedAliceToTokenBalanceAfter);
        expect(aliceFromTokenBalanceAfter).to.be.eq(expectedAliceFromTokenBalanceAfter);
    });

    it('Should give correct fee in swap ERC20-NATIVE without promoter.', async () => {
        const fromToken = TOKENS.BUSD;
        const toToken = TOKENS.BNB;
        const amount = toWei('1', fromToken.decimals);
        const expectedToAmount = toWei('0.002359343964441116', toToken.decimals);
        const sushiSwapCallData = `0x18cbafe50000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000836e505b9b42600000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000${dexProxy.address.slice(
            2
        )}0000000000000000000000000000000000000000000000000000000061e941df0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d56000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c`;
        const integratorFee = availableFeeValues[0];

        await setTokenBalance(fromToken.address, amount, alice.address);

        const aliceFromTokenBalanceBefore = await getBalance(alice.address, fromToken.address);
        const aliceToTokenBalanceBefore = await getBalance(alice.address, toToken.address);
        const integratorToTokenBalanceBefore = await getBalance(integratorAddress, toToken.address);
        const providerToTokenBalanceBefore = await getBalance(providerAddress, toToken.address);

        const busdContract = await ethers.getContractAt('IERC20', fromToken.address, alice);
        const approveTransaction = await busdContract.approve(dexProxy.address, amount);
        const approveTransactionReceipt = await approveTransaction.wait();

        dexProxy = dexProxy.connect(alice);
        const swapTransaction = await dexProxy.swap(
            fromToken.address,
            toToken.address,
            amount,
            sushiSwapAddress,
            sushiSwapCallData,
            {
                fee: integratorFee,
                feeTarget: integratorAddress
            }
        );
        const swapTransactionReceipt = await swapTransaction.wait();

        const aliceFromTokenBalanceAfter = await getBalance(alice.address, fromToken.address);
        const aliceToTokenBalanceAfter = await getBalance(alice.address, toToken.address);
        const integratorToTokenBalanceAfter = await getBalance(integratorAddress, toToken.address);
        const providerToTokenBalanceAfter = await getBalance(providerAddress, toToken.address);

        const approveTransactionFee = await getTransactionFeeByReceipt(approveTransactionReceipt);
        const swapTransactionFee = await getTransactionFeeByReceipt(swapTransactionReceipt);

        const expectedIntegratorToTokenBalanceAfter = integratorToTokenBalanceBefore.add(
            expectedToAmount.mul(integratorFee).div(feeDivisor)
        );
        const expectedProviderToTokenBalanceAfter = providerToTokenBalanceBefore.add(
            expectedToAmount.mul(providerBaseFee).div(feeDivisor)
        );
        const expectedAliceToTokenBalanceAfter = aliceToTokenBalanceBefore
            .sub(approveTransactionFee)
            .sub(swapTransactionFee)
            .add(expectedToAmount)
            .sub(expectedToAmount.mul(integratorFee).div(feeDivisor))
            .sub(expectedToAmount.mul(providerBaseFee).div(feeDivisor));
        const expectedAliceFromTokenBalanceAfter = aliceFromTokenBalanceBefore.sub(amount);

        expect(swapTransactionReceipt.status).to.be.eq(1);
        expect(integratorToTokenBalanceAfter).to.be.eq(expectedIntegratorToTokenBalanceAfter);
        expect(providerToTokenBalanceAfter).to.be.eq(expectedProviderToTokenBalanceAfter);
        expect(aliceToTokenBalanceAfter).to.be.eq(expectedAliceToTokenBalanceAfter);
        expect(aliceFromTokenBalanceAfter).to.be.eq(expectedAliceFromTokenBalanceAfter);
    });

    it('Should give correct fee in swap ERC20-ERC20 without promoter.', async () => {
        const fromToken = TOKENS.BUSD;
        const toToken = TOKENS.CAKE;
        const amount = toWei('1', fromToken.decimals);
        const expectedToAmount = toWei('0.095877856589956001', toToken.decimals);
        const sushiSwapCallData = `0x38ed17390000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000014dd0650031595100000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000${dexProxy.address.slice(
            2
        )}0000000000000000000000000000000000000000000000000000000061e942370000000000000000000000000000000000000000000000000000000000000003000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d56000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c0000000000000000000000000e09fabb73bd3ade0a17ecc321fd13a19e81ce82`;
        const integratorFee = availableFeeValues[0];

        await setTokenBalance(fromToken.address, amount, alice.address);

        const aliceFromTokenBalanceBefore = await getBalance(alice.address, fromToken.address);
        const aliceToTokenBalanceBefore = await getBalance(alice.address, toToken.address);
        const integratorToTokenBalanceBefore = await getBalance(integratorAddress, toToken.address);
        const providerToTokenBalanceBefore = await getBalance(providerAddress, toToken.address);

        const busdContract = await ethers.getContractAt('IERC20', fromToken.address, alice);
        await busdContract.approve(dexProxy.address, amount);

        dexProxy = dexProxy.connect(alice);
        const swapTransaction = await dexProxy.swap(
            fromToken.address,
            toToken.address,
            amount,
            sushiSwapAddress,
            sushiSwapCallData,
            {
                fee: integratorFee,
                feeTarget: integratorAddress
            }
        );
        const swapTransactionReceipt = await swapTransaction.wait();

        const aliceFromTokenBalanceAfter = await getBalance(alice.address, fromToken.address);
        const aliceToTokenBalanceAfter = await getBalance(alice.address, toToken.address);
        const integratorToTokenBalanceAfter = await getBalance(integratorAddress, toToken.address);
        const providerToTokenBalanceAfter = await getBalance(providerAddress, toToken.address);

        const expectedIntegratorToTokenBalanceAfter = integratorToTokenBalanceBefore.add(
            expectedToAmount.mul(integratorFee).div(feeDivisor)
        );
        const expectedProviderToTokenBalanceAfter = providerToTokenBalanceBefore.add(
            expectedToAmount.mul(providerBaseFee).div(feeDivisor)
        );
        const expectedAliceToTokenBalanceAfter = aliceToTokenBalanceBefore
            .add(expectedToAmount)
            .sub(expectedToAmount.mul(integratorFee).div(feeDivisor))
            .sub(expectedToAmount.mul(providerBaseFee).div(feeDivisor));
        const expectedAliceFromTokenBalanceAfter = aliceFromTokenBalanceBefore.sub(amount);

        expect(swapTransactionReceipt.status).to.be.eq(1);
        expect(integratorToTokenBalanceAfter).to.be.eq(expectedIntegratorToTokenBalanceAfter);
        expect(providerToTokenBalanceAfter).to.be.eq(expectedProviderToTokenBalanceAfter);
        expect(aliceToTokenBalanceAfter).to.be.eq(expectedAliceToTokenBalanceAfter);
        expect(aliceFromTokenBalanceAfter).to.be.eq(expectedAliceFromTokenBalanceAfter);
    });
});
