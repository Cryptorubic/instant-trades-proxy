import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
    availableFeeValues,
    promoterFee,
    providerBaseFee,
    providerDiscountFee
} from '../utils/fee-constants';
import { DexProxy as DexProxyType } from '../../typechain';
import { TOKENS } from '../utils/tokens';
import { resetNetwork, setTokenBalance, toWei } from '../utils/blockchain';

describe('DexProxy swap method common tests', function () {
    const pancakeSwapAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

    let dexProxy: DexProxyType;
    let alice: SignerWithAddress;
    let integratorAddress: string;
    let providerAddress: string;

    beforeEach(async () => {
        await resetNetwork();
        const signers = await ethers.getSigners();
        alice = signers[1];
        integratorAddress = signers[2].address;
        providerAddress = signers[3].address;

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

    it('Should revert if dex address is not in white list.', async () => {
        const invalidDexAddress = '0x0000000000000000000000000000000000000001';
        const fromToken = TOKENS.BNB;
        const toToken = TOKENS.BUSD;
        const amount = toWei('1', fromToken.decimals);
        const pancakeSwapCallData = '0x00';
        const integratorFee = availableFeeValues[0];

        dexProxy = dexProxy.connect(alice);
        await expect(
            dexProxy.swap(
                fromToken.address,
                toToken.address,
                amount,
                invalidDexAddress,
                pancakeSwapCallData,
                {
                    fee: integratorFee,
                    feeTarget: integratorAddress
                },
                {
                    value: amount
                }
            )
        ).to.be.revertedWith('Passed dex is not supported.');
    });

    it('Should revert if integrator fee is not in white list.', async () => {
        const invalidIntegratorFee = availableFeeValues[availableFeeValues.length - 1] + 1;
        const fromToken = TOKENS.BNB;
        const toToken = TOKENS.BUSD;
        const amount = toWei('1', fromToken.decimals);
        const pancakeSwapCallData = '0x00';

        dexProxy = dexProxy.connect(alice);
        await expect(
            dexProxy.swap(
                fromToken.address,
                toToken.address,
                amount,
                pancakeSwapAddress,
                pancakeSwapCallData,
                {
                    fee: invalidIntegratorFee,
                    feeTarget: integratorAddress
                },
                {
                    value: amount
                }
            )
        ).to.be.revertedWith('Passed fee value is not supported.');
    });

    it('Should revert if tx value is incorrect in swap NATIVE-ERC20.', async () => {
        const fromToken = TOKENS.BNB;
        const toToken = TOKENS.BUSD;
        const amount = toWei('1', fromToken.decimals);
        const pancakeSwapCallData = `0x7ff36ab50000000000000000000000000000000000000000000000167077fca069f57a660000000000000000000000000000000000000000000000000000000000000080000000000000000000000000${dexProxy.address.slice(
            2
        )}0000000000000000000000000000000000000000000000000000000061e690c00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d56`;
        const integratorFee = availableFeeValues[0];
        const incorrectValue = amount.sub(1);

        dexProxy = dexProxy.connect(alice);
        await expect(
            dexProxy.swap(
                fromToken.address,
                toToken.address,
                amount,
                pancakeSwapAddress,
                pancakeSwapCallData,
                {
                    fee: integratorFee,
                    feeTarget: integratorAddress
                },
                {
                    value: incorrectValue
                }
            )
        ).to.be.revertedWith('Transaction value must be equal to value parameter.');
    });

    it('Should revert if user token balance is not enough to swap ERC20-NATIVE.', async () => {
        const fromToken = TOKENS.BUSD;
        const toToken = TOKENS.BNB;
        const amount = toWei('1', fromToken.decimals);
        const pancakeSwapCallData = `0x18cbafe50000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000834765dad9d4400000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000${dexProxy.address.slice(
            2
        )}0000000000000000000000000000000000000000000000000000000061e6cb520000000000000000000000000000000000000000000000000000000000000003000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d5600000000000000000000000023396cf899ca06c4472205fc903bdb4de249d6fc000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c`;
        const integratorFee = availableFeeValues[0];
        const incorrectTokenBalance = amount.sub(1);

        await setTokenBalance(fromToken.address, incorrectTokenBalance, alice.address);

        dexProxy = dexProxy.connect(alice);
        await expect(
            dexProxy.swap(
                fromToken.address,
                toToken.address,
                amount,
                pancakeSwapAddress,
                pancakeSwapCallData,
                {
                    fee: integratorFee,
                    feeTarget: integratorAddress
                }
            )
        ).to.be.revertedWith('BEP20: transfer amount exceeds balance');
    });

    it('Should revert if user token allowance is not enough to swap ERC20-NATIVE.', async () => {
        const fromToken = TOKENS.BUSD;
        const toToken = TOKENS.BNB;
        const amount = toWei('1', fromToken.decimals);
        const pancakeSwapCallData = `0x18cbafe50000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000834765dad9d4400000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000${dexProxy.address.slice(
            2
        )}0000000000000000000000000000000000000000000000000000000061e6cb520000000000000000000000000000000000000000000000000000000000000003000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d5600000000000000000000000023396cf899ca06c4472205fc903bdb4de249d6fc000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c`;
        const integratorFee = availableFeeValues[0];
        const incorrectTokenAllowance = amount.sub(1);

        const busdContract = await ethers.getContractAt('IERC20', fromToken.address, alice);
        await busdContract.approve(dexProxy.address, incorrectTokenAllowance);

        await setTokenBalance(fromToken.address, amount, alice.address);

        dexProxy = dexProxy.connect(alice);
        await expect(
            dexProxy.swap(
                fromToken.address,
                toToken.address,
                amount,
                pancakeSwapAddress,
                pancakeSwapCallData,
                {
                    fee: integratorFee,
                    feeTarget: integratorAddress
                }
            )
        ).to.be.revertedWith('BEP20: transfer amount exceeds allowance');
    });

    it('Should revert if passed amount parameter is not equal (less than) to dex input token amount.', async () => {
        const fromToken = TOKENS.BUSD;
        const toToken = TOKENS.BNB;
        const wrongAmount = toWei('0.1', fromToken.decimals); // but 1 is encoded to calldata
        const correctAmountFromCallData = toWei('1', fromToken.decimals);
        const pancakeSwapCallData = `0x18cbafe50000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000834765dad9d4400000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000${dexProxy.address.slice(
            2
        )}0000000000000000000000000000000000000000000000000000000061e6cb520000000000000000000000000000000000000000000000000000000000000003000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d5600000000000000000000000023396cf899ca06c4472205fc903bdb4de249d6fc000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c`;
        const integratorFee = availableFeeValues[0];

        await setTokenBalance(fromToken.address, correctAmountFromCallData, alice.address);

        const busdContract = await ethers.getContractAt('IERC20', fromToken.address, alice);
        await busdContract.approve(dexProxy.address, correctAmountFromCallData);

        dexProxy = dexProxy.connect(alice);
        await expect(
            dexProxy.swap(
                fromToken.address,
                toToken.address,
                wrongAmount,
                pancakeSwapAddress,
                pancakeSwapCallData,
                {
                    fee: integratorFee,
                    feeTarget: integratorAddress
                }
            )
        ).to.be.revertedWith('TransferHelper: TRANSFER_FROM_FAILED');
    });

    it('Should revert if passed amount parameter is not equal (grow than) to dex input token amount.', async () => {
        const fromToken = TOKENS.BUSD;
        const toToken = TOKENS.BNB;
        const wrongAmount = toWei('2', fromToken.decimals); // but 1 is encoded to calldata
        const pancakeSwapCallData = `0x18cbafe50000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000834765dad9d4400000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000${dexProxy.address.slice(
            2
        )}0000000000000000000000000000000000000000000000000000000061e6cb520000000000000000000000000000000000000000000000000000000000000003000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d5600000000000000000000000023396cf899ca06c4472205fc903bdb4de249d6fc000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c`;
        const integratorFee = availableFeeValues[0];

        await setTokenBalance(fromToken.address, wrongAmount, alice.address);

        const busdContract = await ethers.getContractAt('IERC20', fromToken.address, alice);
        await busdContract.approve(dexProxy.address, wrongAmount);

        dexProxy = dexProxy.connect(alice);
        await expect(
            dexProxy.swap(
                fromToken.address,
                toToken.address,
                wrongAmount,
                pancakeSwapAddress,
                pancakeSwapCallData,
                {
                    fee: integratorFee,
                    feeTarget: integratorAddress
                }
            )
        ).to.be.revertedWith('Value parameter is not equal to swap data amount parameter.');
    });
});
