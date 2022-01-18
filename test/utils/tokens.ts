import { BLOCKCHAIN_NAME } from './models/BLOCKCHAIN_NAME';

export const TOKENS = {
    ETH: {
        blockchain: BLOCKCHAIN_NAME.ETHEREUM,
        address: '0x0000000000000000000000000000000000000000',
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
        address: '0x0000000000000000000000000000000000000000',
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
    }
} as const;
