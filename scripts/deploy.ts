import hardhat from 'hardhat';

async function main() {
    const KOVAN_UNISWAP_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
    const DexProxy = await hardhat.ethers.getContractFactory('DexProxy');
    const dexProxy = await DexProxy.deploy(
        25,
        100,
        50,
        '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
        [100, 200],
        [KOVAN_UNISWAP_ADDRESS]
    );

    await dexProxy.deployed();

    await hardhat.run('verify:verify', {
        address: dexProxy.address,
        constructorArguments: [
            25,
            75,
            '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
            [100, 200],
            [KOVAN_UNISWAP_ADDRESS]
        ]
    });

    console.log('DexProxy deployed to:', dexProxy.address);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
