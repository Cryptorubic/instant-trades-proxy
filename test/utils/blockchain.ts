import { BigNumber } from 'ethers';
import { BigNumber as BN } from 'bignumber.js';
import { network, ethers, config } from 'hardhat';
import { NATIVE_TOKEN_ADDRESS } from './constants/NATIVE_TOKEN_ADDRESS';

export function toWei(amount: string, decimals = 18): BigNumber {
    return BigNumber.from(new BN(amount).multipliedBy(10 ** decimals).toFixed());
}

function toBytes32(bn: BigNumber): string {
    return ethers.utils.hexlify(ethers.utils.zeroPad(bn.toHexString(), 32));
}

async function setStorageAt(address: string, index: string, value: string): Promise<void> {
    await ethers.provider.send('hardhat_setStorageAt', [address, index, value]);
    await ethers.provider.send('evm_mine', []);
}

async function findBalancesSlot(tokenAddress: string) {
    const encode = (types: string[], values: unknown[]) =>
        ethers.utils.defaultAbiCoder.encode(types, values);
    const account = ethers.constants.AddressZero;
    const probeA = encode(['uint'], [1]);
    const probeB = encode(['uint'], [2]);
    const token = await ethers.getContractAt('IERC20', tokenAddress);

    for (let i = 0; i < 100; i++) {
        let probedSlot = ethers.utils.keccak256(encode(['address', 'uint'], [account, i]));
        // remove padding for JSON RPC
        while (probedSlot.startsWith('0x0')) probedSlot = '0x' + probedSlot.slice(3);
        const prev = await network.provider.send('eth_getStorageAt', [
            tokenAddress,
            probedSlot,
            'latest'
        ]);
        // make sure the probe will change the slot value
        const probe = prev === probeA ? probeB : probeA;

        await setStorageAt(tokenAddress, probedSlot, probe);

        const balance = await token.balanceOf(account);
        // reset to previous value
        await setStorageAt(tokenAddress, probedSlot, prev);
        if (balance.eq(ethers.BigNumber.from(probe))) {
            return i;
        }
    }
    throw new Error('Balances slot not found.');
}

export async function setTokenBalance(
    tokenAddress: string,
    amount: BigNumber,
    receiver?: string
): Promise<void> {
    if (!receiver) {
        const signers = await ethers.getSigners();
        receiver = signers[0].address;
    }
    const balanceSlot = await findBalancesSlot(tokenAddress);
    const index = ethers.utils.solidityKeccak256(['uint256', 'uint256'], [receiver, balanceSlot]);

    await setStorageAt(tokenAddress, index.toString(), toBytes32(amount).toString());
}

export async function resetNetwork(): Promise<void> {
    const jsonRpcUrl = config.networks.hardhat.forking?.url;
    const blockNumber = config.networks.hardhat.forking?.blockNumber;
    await network.provider.send('hardhat_reset', [{ forking: { jsonRpcUrl, blockNumber } }]);
}

export async function getBalance(userAddress: string, tokenAddress: string): Promise<BigNumber> {
    if (tokenAddress === NATIVE_TOKEN_ADDRESS) {
        return ethers.provider.getBalance(userAddress);
    }

    const token = await ethers.getContractAt('IERC20', tokenAddress);
    return token.balanceOf(userAddress);
}

export async function getTransactionFeeByReceipt(transactionReceipt: {
    transactionHash: string;
    gasUsed: BigNumber;
}): Promise<BigNumber> {
    const transaction = (await ethers.provider.getTransaction(transactionReceipt.transactionHash))!;
    return transactionReceipt.gasUsed.mul(transaction.gasPrice!);
}

export async function getTransactionFeeByHash(transactionHash: string): Promise<BigNumber> {
    const transaction = (await ethers.provider.getTransaction(transactionHash))!;
    const transactionReceipt = (await ethers.provider.getTransactionReceipt(transactionHash))!;
    return transactionReceipt.gasUsed.mul(transaction.gasPrice!);
}
