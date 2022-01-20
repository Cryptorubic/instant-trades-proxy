import { BLOCKCHAIN_NAME } from './models/BLOCKCHAIN_NAME';
import { NATIVE_TOKEN_ADDRESS } from './constants/NATIVE_TOKEN_ADDRESS';

export const TOKENS = {
    ETH: {
        blockchain: BLOCKCHAIN_NAME.ETHEREUM,
        address: NATIVE_TOKEN_ADDRESS,
        decimals: 18,
        symbol: 'ETH',
        name: 'Ethereum'
    },
    USDT: {
        blockchain: BLOCKCHAIN_NAME.ETHEREUM,
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        decimals: 6,
        symbol: 'USDT',
        name: 'Tether USD'
    },
    RBC: {
        blockchain: BLOCKCHAIN_NAME.ETHEREUM,
        address: '0xa4eed63db85311e22df4473f87ccfc3dadcfa3e3',
        decimals: 18,
        symbol: 'RBC',
        name: 'Rubic'
    },
    WETH: {
        blockchain: BLOCKCHAIN_NAME.ETHEREUM,
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        decimals: 18,
        symbol: 'WETH',
        name: 'Wrapped Ether'
    },
    BNB: {
        blockchain: BLOCKCHAIN_NAME.BINANCE_SMART_CHAIN,
        address: NATIVE_TOKEN_ADDRESS,
        decimals: 18,
        symbol: 'BNB',
        name: 'Bnb'
    },
    BUSD: {
        blockchain: BLOCKCHAIN_NAME.BINANCE_SMART_CHAIN,
        address: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
        decimals: 18,
        symbol: 'BUSD',
        name: 'BUSD Token'
    },
    BRBC: {
        blockchain: BLOCKCHAIN_NAME.BINANCE_SMART_CHAIN,
        address: '0x8e3bcc334657560253b83f08331d85267316e08a',
        decimals: 18,
        symbol: 'BRBC',
        name: 'Rubic'
    },
    CAKE: {
        blockchain: BLOCKCHAIN_NAME.BINANCE_SMART_CHAIN,
        address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
        decimals: 18,
        symbol: 'CAKE',
        name: 'PancakeSwap Token'
    }
} as const;
