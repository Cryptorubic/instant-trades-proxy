import { BLOCKCHAIN_NAME } from './BLOCKCHAIN_NAME';

export interface Token {
    blockchain: BLOCKCHAIN_NAME;
    address: string;
    decimals: number;
    symbol: string;
    name: string;
}
