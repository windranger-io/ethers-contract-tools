import { ContractReceipt, utils } from 'ethers';
import { Log } from '@ethersproject/abstract-provider';
import { TypedEvent, TypedEventFilter } from './event-types';
export declare type EventDataDecoder = (log: Log) => utils.Result;
export interface ExtendedEventFilter<T = object> extends TypedEventFilter<TypedEvent<unknown[], T>> {
    nonIndexed?: unknown[];
    decodeEventData: EventDataDecoder;
}
/**
 * Parses logs for the specific event type
 *
 * @param logs to be parsed
 * @param filter to pick and decode log entries
 */
export declare function filterEventFromLog<T>(logs: Array<Log>, filter: ExtendedEventFilter<T>): T[];
declare type UnwrapEventFilter<T> = T extends ExtendedEventFilter<infer R> ? R : never;
declare type UnwrapEventFilters<T extends [...ExtendedEventFilter[]]> = T extends [
    infer Head extends ExtendedEventFilter,
    ...infer Tail extends [...ExtendedEventFilter[]]
] ? [UnwrapEventFilter<Head>, ...UnwrapEventFilters<Tail>] : [];
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
export declare function expectEvents<T extends ExtendedEventFilter[]>(receipt: ContractReceipt, ...filters: T): UnwrapEventFilters<T>;
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
export declare function expectEmittersAndEvents<T extends ExtendedEventFilter[]>(receipt: ContractReceipt, forwardOnly: boolean, ...filters: T): [string[], UnwrapEventFilters<T>];
export declare function newExtendedEventFilter<T>(eventName: string, emitter: string, decoder: utils.Interface, filter: Partial<T>): ExtendedEventFilter<T>;
export {};
