import hardhat from 'hardhat';
import {
    dexes,
    prodAvailableFeeValues,
    prodPromoterFee,
    prodProviderBaseFee,
    prodProviderDiscountFee,
    prodProviderFeeTarget
} from '../constants';

async function main() {
    const blockchainName = hardhat.network.name;

    const dexesList = dexes[blockchainName as keyof typeof dexes];
    if (!dexesList) {
        throw Error(`Dexes for blockchain ${blockchainName} was not set.`);
    }

    const DexProxy = await hardhat.ethers.getContractFactory('DexProxy');

    const constructorArguments: Parameters<typeof DexProxy.deploy> = [
        prodPromoterFee,
        prodProviderBaseFee,
        prodProviderDiscountFee,
        prodProviderFeeTarget,
        prodAvailableFeeValues,
        dexesList
    ];
    const dexProxy = await DexProxy.deploy(...constructorArguments);

    await dexProxy.deployed();

    console.log(`DexProxy deployed in ${blockchainName} to:`, dexProxy.address);

    await hardhat.run('verify:verify', {
        address: dexProxy.address,
        constructorArguments
    });

    console.log('DexProxy is verified.');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
