import {ContractReceipt, utils} from 'ethers'
import {Log} from '@ethersproject/abstract-provider'
import {expect} from 'chai'
import {TypedEvent, TypedEventFilter} from './event-types'

export type EventDataDecoder = (log: Log) => utils.Result

export interface ExtendedEventFilter<T = object>
    extends TypedEventFilter<TypedEvent<unknown[], T>> {
    nonIndexed?: unknown[]
    decodeEventData: EventDataDecoder
}

function decodeEventLogs(
    logs: Array<Log>,
    decoderLookup: (
        emitter: string,
        topic0: string
    ) => EventDataDecoder | undefined
): utils.Result[] {
    const found: utils.Result[] = []
    for (const entry of logs) {
        const decodeFn = decoderLookup(
            entry.address.toUpperCase(),
            entry.topics[0]
        )
        // eslint-disable-next-line no-undefined
        if (decodeFn !== undefined) {
            found.push(decodeFn(entry))
        }
    }
    return found
}

function filtersToDecoders(
    filters: Array<ExtendedEventFilter>
): Map<string, Map<string, EventDataDecoder>> {
    const result = new Map<string, Map<string, EventDataDecoder>>()
    for (const filter of filters) {
        if (filter.address && filter.topics) {
            const eventType = filter.topics[0]
            if (typeof eventType === 'string') {
                const addr = filter.address.toUpperCase()
                let subMap = result.get(addr)
                // eslint-disable-next-line no-undefined
                if (subMap === undefined) {
                    subMap = new Map<string, EventDataDecoder>()
                    result.set(addr, subMap)
                }
                subMap.set(eventType, filter.decodeEventData)
            }
        }
    }
    return result
}

/**
 * Parses logs for the specific event type
 *
 * @param logs to be parsed
 * @param filter to pick and decode log entries
 */
export function filterEventFromLog<T>(
    logs: Array<Log>,
    filter: ExtendedEventFilter<T>
): T[] {
    const decoders = filtersToDecoders([filter])
    return decodeEventLogs(logs, (emitter, topic) =>
        decoders.get(emitter)?.get(topic)
    ) as unknown[] as T[]
}

type UnwrapEventFilter<T> = T extends ExtendedEventFilter<infer R> ? R : never

type UnwrapEventFilters<T extends [...ExtendedEventFilter[]]> = T extends [
    infer Head extends ExtendedEventFilter,
    ...infer Tail extends [...ExtendedEventFilter[]]
]
    ? [UnwrapEventFilter<Head>, ...UnwrapEventFilters<Tail>]
    : []

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
export function expectEvents<T extends ExtendedEventFilter[]>(
    receipt: ContractReceipt,
    ...filters: T
): UnwrapEventFilters<T> {
    const [, result] = _orderedFilter(receipt.logs, filters, false)
    return result as UnwrapEventFilters<T>
}

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
export function expectEmittersAndEvents<T extends ExtendedEventFilter[]>(
    receipt: ContractReceipt,
    forwardOnly: boolean,
    ...filters: T
): [string[], UnwrapEventFilters<T>] {
    const [emitters, result] = _orderedFilter(
        receipt.logs,
        filters,
        forwardOnly
    )
    return [emitters, result as UnwrapEventFilters<T>]
}

function _orderedFilter(
    actuals: Array<Log>,
    expecteds: ExtendedEventFilter[],
    forwardOnly?: boolean
): [string[], utils.Result[]] {
    const result: utils.Result[] = []
    const resultAddr: string[] = []
    const matched: boolean[] = new Array<boolean>(actuals.length)
    let prevActualIndex = -1

    for (let i = 0; i < expecteds.length; i++) {
        for (
            let j = forwardOnly ? prevActualIndex + 1 : 0;
            j < actuals.length;
            j++
        ) {
            if (matched[j]) {
                // eslint-disable-next-line no-continue
                continue
            }
            const actual = actuals[j]
            const expected = expecteds[i]
            if (_matchTopics(actual, expected)) {
                const decoded = expected.decodeEventData(actual)
                if (
                    // eslint-disable-next-line no-undefined
                    expected.nonIndexed === undefined ||
                    _matchProperties(decoded, expected.nonIndexed)
                ) {
                    expect(j, 'Wrong order of events').gt(prevActualIndex)
                    prevActualIndex = j
                    matched[j] = true
                    result.push(decoded)
                    resultAddr.push(actual.address)
                    break
                }
            }
        }
    }

    expect(result.length, 'Not all expected events were found').eq(
        expecteds.length
    )

    return [resultAddr, result]
}

function _matchTopics(actual: Log, expected: ExtendedEventFilter): boolean {
    if (
        // eslint-disable-next-line no-undefined
        expected.address !== undefined &&
        actual.address.toUpperCase() !== expected.address.toUpperCase()
    ) {
        return false
    }

    let i = -1
    for (const expectedTopic of expected.topics ?? []) {
        i++
        if (i >= actual.topics.length) {
            return false
        }
        if (expectedTopic !== null && expectedTopic !== actual.topics[i]) {
            return false
        }
    }

    return true
}

function _matchProperties(actual: utils.Result, expected: unknown[]): boolean {
    return !expected.some((value, index) => {
        if ((value ?? null) === null) {
            return false
        }
        const eq = isDeepEqual(value, actual[index])
        return !eq
    })
}

function isDeepEqual(v0: unknown, v1: unknown): boolean {
    if (typeof v0 !== typeof v1) {
        return false
    }
    if (typeof v0 !== 'object') {
        return v0 === v1
    }
    if (Array.isArray(v0)) {
        if (!Array.isArray(v1)) {
            return false
        }
        const a0 = v0 as unknown[]
        const a1 = v1 as unknown[]
        return (
            a0.length === a1.length &&
            !a0.some((value, i) => !isDeepEqual(value, a1[i]))
        )
    }

    const k0 = Object.getOwnPropertyNames(v0)
    const k1 = Object.getOwnPropertyNames(v1 as object)

    if (k0.length !== k1.length) {
        return false
    }
    const s1 = new Set(k1)
    for (const key of k0) {
        if (!s1.has(key)) {
            return false
        }

        if (
            !isDeepEqual(
                (v0 as Record<string, unknown>)[key],
                (v1 as Record<string, unknown>)[key]
            )
        ) {
            return false
        }
    }

    return true
}

export function newExtendedEventFilter<T>(
    eventName: string,
    emitter: string,
    decoder: utils.Interface,
    filter: Partial<T>
): ExtendedEventFilter<T> {
    let address: string | undefined
    if (emitter !== '*') {
        expect(utils.isAddress(emitter), 'Invalid address').is.true
        address = emitter
    }

    const fragment = decoder.getEvent(eventName)
    const [args, nonIndexed] = _buildFilterArgs(fragment, filter)

    return {
        address,
        topics: decoder.encodeFilterTopics(fragment, args),
        nonIndexed: nonIndexed,
        decodeEventData(log: Log): utils.Result {
            return decoder.decodeEventLog(fragment, log.data, log.topics)
        }
    }
}

const _buildFilterArgs = (
    fragment: utils.EventFragment,
    properties:
        | Record<string, unknown>
        | unknown[]
        | (Record<string, unknown> & unknown[])
): [unknown[], unknown[]?] => {
    const indexed: unknown[] = []
    const nonIndexed: unknown[] = []
    let hasNonIndexed = false

    const isArray = Array.isArray(properties)
    const arrayCount = isArray ? (properties as unknown[]).length : 0
    if (isArray) {
        expect(arrayCount, 'Inconsistend set of indexed properties').lte(
            fragment.inputs.length
        )
    }

    let namedCount = 0
    // eslint-disable-next-line @typescript-eslint/no-for-in-array
    for (const key in properties) {
        if (!isArray || isNaN(parseInt(key, 10))) {
            namedCount++
        }
    }

    if (namedCount > 0 || arrayCount > 0) {
        fragment.inputs.forEach((param, index) => {
            let namedValue = (properties as Record<string, unknown>)[param.name]
            let value = isArray
                ? (properties as unknown[])[index] ?? null
                : null

            // eslint-disable-next-line no-undefined
            if (namedValue === undefined) {
                namedValue = null
            } else {
                namedCount--
            }

            if (namedValue !== null) {
                if (value === null) {
                    value = namedValue
                } else {
                    // check for consistency of the input
                    expect(namedValue).eq(value)
                }
            }

            if (param.indexed) {
                indexed.push(value)
                nonIndexed.push(null)
            } else {
                indexed.push(null)
                nonIndexed.push(value)
                if (value !== null) {
                    hasNonIndexed = true
                }
            }
        })
        expect(namedCount, 'Inconsistend set of named properties').eq(0)
    }

    return hasNonIndexed ? [indexed, nonIndexed] : [indexed]
}
