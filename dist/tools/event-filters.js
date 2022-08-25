"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newExtendedEventFilter = exports.expectEmittersAndEvents = exports.expectEvents = exports.filterEventFromLog = void 0;
const ethers_1 = require("ethers");
const chai_1 = require("chai");
function decodeEventLogs(logs, decoderLookup) {
    const found = [];
    for (const entry of logs) {
        const decodeFn = decoderLookup(entry.address.toUpperCase(), entry.topics[0]);
        // eslint-disable-next-line no-undefined
        if (decodeFn !== undefined) {
            found.push(decodeFn(entry));
        }
    }
    return found;
}
function filtersToDecoders(filters) {
    const result = new Map();
    for (const filter of filters) {
        if (filter.address && filter.topics) {
            const eventType = filter.topics[0];
            if (typeof eventType === 'string') {
                const addr = filter.address.toUpperCase();
                let subMap = result.get(addr);
                // eslint-disable-next-line no-undefined
                if (subMap === undefined) {
                    subMap = new Map();
                    result.set(addr, subMap);
                }
                subMap.set(eventType, filter.decodeEventData);
            }
        }
    }
    return result;
}
/**
 * Parses logs for the specific event type
 *
 * @param logs to be parsed
 * @param filter to pick and decode log entries
 */
function filterEventFromLog(logs, filter) {
    const decoders = filtersToDecoders([filter]);
    return decodeEventLogs(logs, (emitter, topic) => decoders.get(emitter)?.get(topic));
}
exports.filterEventFromLog = filterEventFromLog;
/**
 * Parses logs of the receipt by the given filters.
 * This function matches the provided sequence of filters agains logs.
 * A matched log entry is removed from further matching.
 *
 * Throws an error when:
 * - a filter N matches a log entry with lower index than a filter N-1
 * - not all filters have a match
 *
 * NB! This function have a special handling for `indexed` event arguments
 * of dynamic types (`string`, `bytes`, `arrays`) - these types can be used
 * for filtering, but decoded fields will not have values, but special
 * Indexed objects with hash.
 *
 * @param receipt to provide logs for parsing
 * @param filters a set of filters to match and parse log entries
 * @return a set of parsed log entries matched by the filters
 */
function expectEvents(receipt, ...filters) {
    const [, result] = _orderedFilter(receipt.logs, filters, false);
    return result;
}
exports.expectEvents = expectEvents;
/**
 * Parses logs of the receipt by the given filters.
 * This function matches the provided sequence of filters agains logs.
 * This function also returns emmitters of the matched events, so it is
 * usable with filters where an emitter is not specified.
 *
 * When forwardOnly is false only a matched log entry is removed from further matching;
 * othterwise, all log entries before the matched entry are also excluded.
 * Use forwardOnly = false for a distinct set of events to make sure that ordering is correct.
 * Use forwardOnly = true to extract a few events of the same type when some of events are exact and some are not.
 *
 * NB! This function have a special handling for `indexed` event arguments
 * of dynamic types (`string`, `bytes`, `arrays`) - these types can be used
 * for filtering, but decoded fields will not have values, but special
 * Indexed objects with hash.
 *
 * Throws an error when:
 * - a filter N matches a log entry with lower index than a filter N-1
 * - not all filters have a match
 *
 * @param receipt to provide logs for parsing
 * @param forwardOnly prevents backward logs matching when is true
 * @param filters a set of filters to match and parse log entries
 * @return a set of emmitters and parsed log entries matched by the filters
 */
function expectEmittersAndEvents(receipt, forwardOnly, ...filters) {
    const [emitters, result] = _orderedFilter(receipt.logs, filters, forwardOnly);
    return [emitters, result];
}
exports.expectEmittersAndEvents = expectEmittersAndEvents;
function _orderedFilter(actuals, expecteds, forwardOnly) {
    const result = [];
    const resultAddr = [];
    const matched = new Array(actuals.length);
    let prevActualIndex = -1;
    for (let i = 0; i < expecteds.length; i++) {
        for (let j = forwardOnly ? prevActualIndex + 1 : 0; j < actuals.length; j++) {
            if (matched[j]) {
                // eslint-disable-next-line no-continue
                continue;
            }
            const actual = actuals[j];
            const expected = expecteds[i];
            if (_matchTopics(actual, expected)) {
                const decoded = expected.decodeEventData(actual);
                if (
                // eslint-disable-next-line no-undefined
                expected.nonIndexed === undefined ||
                    _matchProperties(decoded, expected.nonIndexed)) {
                    (0, chai_1.expect)(j, 'Wrong order of events').gt(prevActualIndex);
                    prevActualIndex = j;
                    matched[j] = true;
                    result.push(decoded);
                    resultAddr.push(actual.address);
                    break;
                }
            }
        }
    }
    (0, chai_1.expect)(result.length, 'Not all expected events were found').eq(expecteds.length);
    return [resultAddr, result];
}
function _matchTopics(actual, expected) {
    if (
    // eslint-disable-next-line no-undefined
    expected.address !== undefined &&
        actual.address.toUpperCase() !== expected.address.toUpperCase()) {
        return false;
    }
    let i = -1;
    for (const expectedTopic of expected.topics ?? []) {
        i++;
        if (i >= actual.topics.length) {
            return false;
        }
        if (expectedTopic !== null && expectedTopic !== actual.topics[i]) {
            return false;
        }
    }
    return true;
}
function _matchProperties(actual, expected) {
    return !expected.some((value, index) => {
        if ((value ?? null) === null) {
            return false;
        }
        const eq = isDeepEqual(value, actual[index]);
        return !eq;
    });
}
function isDeepEqual(v0, v1) {
    if (typeof v0 !== typeof v1) {
        return false;
    }
    if (typeof v0 !== 'object') {
        return v0 === v1;
    }
    if (Array.isArray(v0)) {
        if (!Array.isArray(v1)) {
            return false;
        }
        const a0 = v0;
        const a1 = v1;
        return (a0.length === a1.length &&
            !a0.some((value, i) => !isDeepEqual(value, a1[i])));
    }
    const k0 = Object.getOwnPropertyNames(v0);
    const k1 = Object.getOwnPropertyNames(v1);
    if (k0.length !== k1.length) {
        return false;
    }
    const s1 = new Set(k1);
    for (const key of k0) {
        if (!s1.has(key)) {
            return false;
        }
        if (!isDeepEqual(v0[key], v1[key])) {
            return false;
        }
    }
    return true;
}
function newExtendedEventFilter(eventName, emitter, decoder, filter) {
    let address;
    if (emitter !== '*') {
        (0, chai_1.expect)(ethers_1.utils.isAddress(emitter), 'Invalid address').is.true;
        address = emitter;
    }
    const fragment = decoder.getEvent(eventName);
    const [args, nonIndexed] = _buildFilterArgs(fragment, filter);
    return {
        address,
        topics: decoder.encodeFilterTopics(fragment, args),
        nonIndexed: nonIndexed,
        decodeEventData(log) {
            return decoder.decodeEventLog(fragment, log.data, log.topics);
        }
    };
}
exports.newExtendedEventFilter = newExtendedEventFilter;
const _buildFilterArgs = (fragment, properties) => {
    const indexed = [];
    const nonIndexed = [];
    let hasNonIndexed = false;
    let maxIndexed = -1;
    let namedCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-for-in-array
    for (const key in properties) {
        const v = parseInt(key, 10);
        if (isNaN(v)) {
            namedCount++;
        }
        else if (v > maxIndexed) {
            maxIndexed = v;
        }
    }
    (0, chai_1.expect)(maxIndexed, 'Inconsistend set of indexed properties').lt(fragment.inputs.length);
    if (namedCount > 0 || maxIndexed >= 0) {
        fragment.inputs.forEach((param, index) => {
            let namedValue = properties[param.name];
            let value = index <= maxIndexed
                ? properties[index] ?? null
                : null;
            // eslint-disable-next-line no-undefined
            if (namedValue === undefined) {
                namedValue = null;
            }
            else {
                namedCount--;
            }
            if (namedValue !== null) {
                if (value === null) {
                    value = namedValue;
                }
                else {
                    // check for consistency of the input
                    (0, chai_1.expect)(namedValue).eq(value);
                }
            }
            if (param.indexed) {
                indexed.push(value);
                nonIndexed.push(null);
            }
            else {
                indexed.push(null);
                nonIndexed.push(value);
                if (value !== null) {
                    hasNonIndexed = true;
                }
            }
        });
        (0, chai_1.expect)(namedCount, 'Inconsistend set of named properties').eq(0);
    }
    return hasNonIndexed ? [indexed, nonIndexed] : [indexed];
};
//# sourceMappingURL=event-filters.js.map