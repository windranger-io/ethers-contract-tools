"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.successfulTransaction = exports.contractReceiptOf = void 0;
const chai_1 = require("chai");
async function contractReceiptOf(av, confirmations) {
    const v = await av;
    return 'gasUsed' in v ? v : v.wait(confirmations);
}
exports.contractReceiptOf = contractReceiptOf;
/**
 * The expectation is successful transaction (with receipt).
 *
 * @param transaction waits for the receipt, verifying it is a success.
 */
async function successfulTransaction(transaction) {
    const receipt = await contractReceiptOf(transaction, 1);
    // Transaction status code https://eips.ethereum.org/EIPS/eip-1066
    const SUCCESS = 1;
    (0, chai_1.expect)(receipt).is.not.undefined;
    (0, chai_1.expect)(receipt.status).equals(SUCCESS);
    return receipt;
}
exports.successfulTransaction = successfulTransaction;
//# sourceMappingURL=transaction.js.map