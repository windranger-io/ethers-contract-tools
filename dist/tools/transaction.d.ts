import { ContractTransaction } from 'ethers';
import { ContractReceipt } from '@ethersproject/contracts/src.ts/index';
export declare type ContractReceiptSource = ContractReceipt | Promise<ContractReceipt> | ContractTransaction | Promise<ContractTransaction>;
export declare function contractReceiptOf(av: ContractReceiptSource, confirmations?: number): Promise<ContractReceipt>;
/**
 * The expectation is successful transaction (with receipt).
 *
 * @param transaction waits for the receipt, verifying it is a success.
 */
export declare function successfulTransaction(transaction: ContractReceiptSource): Promise<ContractReceipt>;
