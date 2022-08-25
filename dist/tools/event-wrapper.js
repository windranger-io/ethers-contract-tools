"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapEventType = void 0;
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const event_filters_1 = require("./event-filters");
const event_listener_1 = require("./event-listener");
const transaction_1 = require("./transaction");
function findEventArgs(name, receipt, emitter) {
    const found = [];
    const addr = emitter.address.toUpperCase();
    const parser = emitter.interface;
    const fragment = parser.getEvent(name);
    const id = ethers_1.utils.id(fragment.format());
    for (const entry of receipt.logs) {
        if (entry.topics[0] === id && entry.address.toUpperCase() === addr) {
            const parsed = parser.decodeEventLog(fragment, entry.data, entry.topics);
            found.push(parsed);
        }
    }
    (0, chai_1.expect)(found.length, `Failed to find any event matching name: ${name}`).is.greaterThan(0);
    return found;
}
const wrapEventType = (customName, emitter) => new (class {
    constructor() {
        this.withTuple = this;
    }
    expectOne(receipt, expected) {
        const args = findEventArgs(this.toString(), receipt, emitter);
        (0, chai_1.expect)(args.length, `Expecting a single event ${this.toString()}`).equals(1);
        return this.verifyArgs(args[0], expected);
    }
    expectOrdered(receipt, expecteds, forwardOnly) {
        const filters = expecteds.map((expected) => this.newFilter(expected));
        const [, events] = (0, event_filters_1.expectEmittersAndEvents)(receipt, forwardOnly ?? false, ...filters);
        return events;
    }
    all(receipt, fn) {
        const args = findEventArgs(this.toString(), receipt, emitter);
        // eslint-disable-next-line no-undefined
        if (fn === undefined) {
            args.forEach((arg) => {
                this.verifyArgs(arg);
            });
            return args;
        }
        return fn(args);
    }
    async waitAll(source, fn) {
        const receipt = await (0, transaction_1.successfulTransaction)(source);
        this.all(receipt, fn);
        return receipt;
    }
    toString() {
        return this.name();
    }
    name() {
        return customName;
    }
    verifyArgs(args, expected) {
        const n = this.toString();
        if ((expected ?? null) !== null) {
            _verifyByProperties(expected, n, args);
        }
        _verifyByFragment(emitter.interface.getEvent(n), n, args);
        return args;
    }
    newListener() {
        const n = this.toString();
        const fragment = emitter.interface.getEvent(n);
        return new event_listener_1.EventListener(emitter, n, (event) => {
            const args = event.args ?? {};
            _verifyByFragment(fragment, n, args);
            return args;
        });
    }
    newFilter(filter, emitterAddress) {
        const n = this.toString();
        return (0, event_filters_1.newExtendedEventFilter)(n, emitterAddress ?? emitter.address, emitter.interface, filter);
    }
})();
exports.wrapEventType = wrapEventType;
const _verifyByFragment = (fragment, name, args) => {
    fragment.inputs.forEach((param, index) => {
        (0, chai_1.expect)(args[index], `Property ${name}[${index}] is undefined`).is.not
            .undefined;
        if (param.name) {
            (0, chai_1.expect)(args[param.name], `Property ${name}.${param.name} is undefined`).is.not.undefined;
        }
    });
};
const _verifyByProperties = (expected, name, args) => {
    if (Array.isArray(expected)) {
        ;
        expected.forEach((value, index) => {
            if ((value ?? null) !== null) {
                (0, chai_1.expect)(args[index], `Mismatched value of property ${name}[${index}]`).eq(value);
            }
        });
    }
    Object.entries(expected).forEach(([propName, value]) => {
        if ((value ?? null) !== null) {
            (0, chai_1.expect)(args[propName], `Mismatched value of property ${name}.${propName}`).eq(value);
        }
    });
};
//# sourceMappingURL=event-wrapper.js.map