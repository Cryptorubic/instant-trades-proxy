import { DexProxy as DexProxyType } from '../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { resetNetwork } from './utils/blockchain';
import { ethers } from 'hardhat';
import {
    availableFeeValues,
    promoterFee,
    providerBaseFee,
    providerDiscountFee
} from './utils/fee-constants';
import { BigNumber } from 'ethers';
import { expect } from 'chai';

describe('Contract fields setters', function () {
    const availableDexesList = [
        '0x0000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000002'
    ];

    let dexProxy: DexProxyType;
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let providerAddress: string;

    beforeEach(async () => {
        await resetNetwork();
        const signers = await ethers.getSigners();
        owner = signers[0];
        alice = signers[1];
        providerAddress = signers[3].address;

        const DexProxy = await ethers.getContractFactory('DexProxy', owner);
        dexProxy = await DexProxy.deploy(
            promoterFee,
            providerBaseFee,
            providerDiscountFee,
            providerAddress,
            availableFeeValues,
            availableDexesList
        );
    });

    it('Owner can set promoter fee.', async () => {
        const oldPromoterFee: BigNumber = await dexProxy.promoterFee();
        const newPromoterFeeToSet = oldPromoterFee.div(2);
        dexProxy = dexProxy.connect(owner);

        await dexProxy.setPromoterFee(newPromoterFeeToSet);
        const newPromoterFee: BigNumber = await dexProxy.promoterFee();

        expect(newPromoterFee.eq(newPromoterFeeToSet)).to.be.eq(true);
    });

    it('Owner can not set promoter fee grater than feeDivisor.', async () => {
        const currentFeeDivisor: BigNumber = await dexProxy.feeDivisor();
        const newPromoterFeeToSet = currentFeeDivisor.add(1);
        dexProxy = dexProxy.connect(owner);

        await expect(dexProxy.setPromoterFee(newPromoterFeeToSet)).to.be.revertedWith(
            'Fee can not be grow than feeDivisor.'
        );
    });

    it('Only owner can set promoter fee.', async () => {
        const newPromoterFeeToSet = BigNumber.from(1);
        dexProxy = dexProxy.connect(alice);

        await expect(dexProxy.setPromoterFee(newPromoterFeeToSet)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        );
    });

    it('Owner can set provider base fee.', async () => {
        const oldProviderBaseFee: BigNumber = await dexProxy.providerBaseFee();
        const newProviderBaseFeeToSet = oldProviderBaseFee.sub(1);
        dexProxy = dexProxy.connect(owner);

        await dexProxy.setProviderBaseFee(newProviderBaseFeeToSet);
        const newProviderBaseFee: BigNumber = await dexProxy.providerBaseFee();

        expect(newProviderBaseFee.eq(newProviderBaseFeeToSet)).to.be.eq(true);
    });

    it('Owner can not set provider base fee less than current provider discount fee plus promoter fee.', async () => {
        const currentProviderDiscountFee: BigNumber = await dexProxy.providerDiscountFee();
        const currentPromoterFee: BigNumber = await dexProxy.promoterFee();
        const newProviderBaseFeeToSet = currentProviderDiscountFee.add(currentPromoterFee).sub(1);
        dexProxy = dexProxy.connect(owner);

        await expect(dexProxy.setProviderBaseFee(newProviderBaseFeeToSet)).to.be.revertedWith(
            'Base fee minus promoter fee must be grow or equal than discount fee.'
        );
    });

    it('Owner can not set provider base fee grater than feeDivisor.', async () => {
        const currentFeeDivisor: BigNumber = await dexProxy.feeDivisor();
        const newProviderBaseFeeToSet = currentFeeDivisor.add(1);
        dexProxy = dexProxy.connect(owner);

        await expect(dexProxy.setProviderBaseFee(newProviderBaseFeeToSet)).to.be.revertedWith(
            'Fee can not be grow than feeDivisor.'
        );
    });

    it('Only owner can set provider base fee.', async () => {
        const newProviderBaseFeeToSet = BigNumber.from(1);
        dexProxy = dexProxy.connect(alice);

        await expect(dexProxy.setProviderBaseFee(newProviderBaseFeeToSet)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        );
    });

    it('Owner can set provider discount fee.', async () => {
        const oldProviderDiscountFee: BigNumber = await dexProxy.providerDiscountFee();
        const newProviderDiscountFeeToSet = oldProviderDiscountFee.sub(1);
        dexProxy = dexProxy.connect(owner);

        await dexProxy.setProviderDiscountFee(newProviderDiscountFeeToSet);
        const newProviderDiscountFee: BigNumber = await dexProxy.providerDiscountFee();

        expect(newProviderDiscountFee.eq(newProviderDiscountFeeToSet)).to.be.eq(true);
    });

    it('Owner can not set provider discount fee grow than current provider base fee minus promoter fee.', async () => {
        const currentProviderBaseFee: BigNumber = await dexProxy.providerBaseFee();
        const currentPromoterFee: BigNumber = await dexProxy.promoterFee();
        const newProviderDiscountFeeToSet = currentProviderBaseFee.sub(currentPromoterFee).add(1);
        dexProxy = dexProxy.connect(owner);

        await expect(
            dexProxy.setProviderDiscountFee(newProviderDiscountFeeToSet)
        ).to.be.revertedWith('Discount fee plus promoter fee must be less or equal than base fee.');
    });

    it('Owner can not set provider discount fee grater than feeDivisor.', async () => {
        const currentFeeDivisor: BigNumber = await dexProxy.feeDivisor();
        const newProviderDiscountFeeToSet = currentFeeDivisor.add(1);
        dexProxy = dexProxy.connect(owner);

        await expect(
            dexProxy.setProviderDiscountFee(newProviderDiscountFeeToSet)
        ).to.be.revertedWith('Fee can not be grow than feeDivisor.');
    });

    it('Only owner can set provider base fee.', async () => {
        const newProviderDiscountFeeToSet = BigNumber.from(1);
        dexProxy = dexProxy.connect(alice);

        await expect(
            dexProxy.setProviderDiscountFee(newProviderDiscountFeeToSet)
        ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Owner can set provider fee target.', async () => {
        const oldProviderFeeTarget: string = await dexProxy.providerFeeTarget();
        const newProviderFeeTargetToSet =
            oldProviderFeeTarget === alice.address ? providerAddress : alice.address;
        dexProxy = dexProxy.connect(owner);

        await dexProxy.setProviderFeeTarget(newProviderFeeTargetToSet);
        const newProviderFeeTarget = await dexProxy.providerFeeTarget();

        expect(newProviderFeeTarget).to.be.eq(newProviderFeeTargetToSet);
    });

    it('Owner can not set provider fee target equal to current provider fee target.', async () => {
        const oldProviderFeeTarget: string = await dexProxy.providerFeeTarget();
        dexProxy = dexProxy.connect(owner);

        await expect(dexProxy.setProviderFeeTarget(oldProviderFeeTarget)).to.be.revertedWith(
            'New providerFeeTarget value should not be equal to previous.'
        );
    });

    it('Only owner can set provider fee target.', async () => {
        const oldProviderFeeTarget: string = await dexProxy.providerFeeTarget();
        const newProviderFeeTargetToSet =
            oldProviderFeeTarget === alice.address ? providerAddress : alice.address;
        dexProxy = dexProxy.connect(alice);

        await expect(dexProxy.setProviderFeeTarget(newProviderFeeTargetToSet)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        );
    });

    it('Owner can set available fee values.', async () => {
        const newAvailableFeeValue1 = availableFeeValues[availableFeeValues.length - 1] + 1;
        const newAvailableFeeValue2 = availableFeeValues[availableFeeValues.length - 1] + 2;
        dexProxy = dexProxy.connect(owner);

        await dexProxy.setAvailableFeeValues([newAvailableFeeValue1, newAvailableFeeValue2]);
        const isValue1Available = await dexProxy.availableFeeValues(newAvailableFeeValue1);
        const isValue2Available = await dexProxy.availableFeeValues(newAvailableFeeValue2);
        const areOldValuesAvailable = await Promise.all(
            availableFeeValues.map(value => dexProxy.availableFeeValues(value))
        );

        expect(isValue1Available).to.be.eq(true);
        expect(isValue2Available).to.be.eq(true);
        expect(areOldValuesAvailable).to.eql(availableFeeValues.map(() => true));
    });

    it('Owner can not set available fee value grater than feeDivisor.', async () => {
        const currentFeeDivisor = await dexProxy.feeDivisor();
        const newAvailableFeeValue = currentFeeDivisor.add(1);
        dexProxy = dexProxy.connect(owner);

        await expect(dexProxy.setAvailableFeeValues([newAvailableFeeValue])).to.be.revertedWith(
            'Fee can not be grow than feeDivisor.'
        );
    });

    it('Only owner can set available fee values.', async () => {
        const newAvailableFeeValue = availableFeeValues[availableFeeValues.length - 1] + 1;
        dexProxy = dexProxy.connect(alice);

        await expect(dexProxy.setAvailableFeeValues([newAvailableFeeValue])).to.be.revertedWith(
            'Ownable: caller is not the owner'
        );
    });

    it('Owner can remove available fee value.', async () => {
        const feeValueToRemove = availableFeeValues[0];
        dexProxy = dexProxy.connect(owner);

        await dexProxy.removeFeeValue(feeValueToRemove);
        const isRemovedFeeValueAvailable = await dexProxy.availableFeeValues(feeValueToRemove);

        await expect(isRemovedFeeValueAvailable).to.be.eq(false);
    });

    it('Only owner can remove available fee value.', async () => {
        const feeValueToRemove = availableFeeValues[0];
        dexProxy = dexProxy.connect(alice);

        await expect(dexProxy.removeFeeValue(feeValueToRemove)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        );
    });

    it('Owner can set available dexes.', async () => {
        const newAvailableDex1 = '0x0000000000000000000000000000000000000003';
        const newAvailableDex2 = '0x0000000000000000000000000000000000000004';
        dexProxy = dexProxy.connect(owner);

        await dexProxy.setDexes([newAvailableDex1, newAvailableDex2]);
        const isDex1Available = await dexProxy.dexes(newAvailableDex1);
        const isDex2Available = await dexProxy.dexes(newAvailableDex2);
        const areOldValuesAvailable = await Promise.all(
            availableDexesList.map(value => dexProxy.dexes(value))
        );

        expect(isDex1Available).to.be.eq(true);
        expect(isDex2Available).to.be.eq(true);
        expect(areOldValuesAvailable).to.eql(availableDexesList.map(() => true));
    });

    it('Only owner can set available dexes.', async () => {
        const newAvailableDex = '0x0000000000000000000000000000000000000003';
        dexProxy = dexProxy.connect(alice);

        await expect(dexProxy.setDexes([newAvailableDex])).to.be.revertedWith(
            'Ownable: caller is not the owner'
        );
    });

    it('Owner can remove available dex.', async () => {
        const dexToRemove = availableDexesList[0];
        dexProxy = dexProxy.connect(owner);

        await dexProxy.removeDex(dexToRemove);
        const isRemovedDexAvailable = await dexProxy.dexes(dexToRemove);

        await expect(isRemovedDexAvailable).to.be.eq(false);
    });

    it('Only owner can remove available dex.', async () => {
        const dexToRemove = availableDexesList[0];
        dexProxy = dexProxy.connect(alice);

        await expect(dexProxy.removeDex(dexToRemove)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        );
    });
});
