"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventListener = void 0;
const chai_1 = require("chai");
/**
 * Listeners for a single type of contract event.
 */
class EventListener {
    constructor(contract, eventName, convert) {
        this._events = [];
        captureEvents(contract, eventName, (event) => {
            this._events.push(convert(event));
        });
    }
    events() {
        return this._events;
    }
}
exports.EventListener = EventListener;
function captureEvents(contract, eventName, react) {
    contract.on(eventName, (...args) => {
        (0, chai_1.expect)(args.length, 'The event details are missing').is.greaterThanOrEqual(1);
        /*
         * Array is organised with each parameter being an entry,
         * last entry being the entire transaction receipt.
         */
        const lastEntry = args.length - 1;
        const event = args[lastEntry];
        (0, chai_1.expect)(event.blockNumber, 'The event should have a block number').is.not
            .undefined;
        react(event);
    });
}
//# sourceMappingURL=event-listener.js.map