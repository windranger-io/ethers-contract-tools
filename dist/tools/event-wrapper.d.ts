import { Contract, ContractReceipt } from 'ethers';
import { ExtendedEventFilter } from './event-filters';
import { EventListener } from './event-listener';
import { ContractReceiptSource } from './transaction';
declare type PartialTuple<T extends unknown[]> = T extends [infer Head, ...infer Tail] ? [(Head | null)?, ...PartialTuple<Tail>] : [];
declare type EventIn<A extends unknown[], O extends object> = (PartialTuple<A> & O) | A | O;
declare type PartialEventIn<A extends unknown[], O extends object> = (PartialTuple<A> & Partial<O>) | PartialTuple<A> | Partial<O>;
export declare type EventFactoryWithTuple<A extends unknown[], O extends object> = EventFactoryOmni<A, O, A & O>;
export interface EventFactory<A extends unknown[], O extends object> extends EventFactoryOmni<A, O, O> {
    readonly withTuple: EventFactoryWithTuple<A, O>;
}
export interface EventFactoryOmni<A extends unknown[], O extends object, R extends O> {
    expectOne(receipt: ContractReceipt, expected?: EventIn<A, O>): R;
    /**
     * Parses logs of the receipt by the given filters.
     * This function matches the provided sequence of filters agains logs.
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
     * @param expecteds a set of filters to match and parse log entries
     * @param forwardOnly prevents backward logs matching when is true
     * @return a set of parsed log entries matched by filters
     */
    expectOrdered(receipt: ContractReceipt, expecteds: PartialEventIn<A, O>[], forwardOnly?: boolean): R[];
    all<Result = R[]>(receipt: ContractReceipt, fn?: (args: R[]) => Result): Result;
    waitAll(source: ContractReceiptSource, fn: (args: R[]) => void): Promise<ContractReceipt>;
    toString(): string;
    name(): string;
    newListener(): EventListener<R>;
    newFilter(args?: PartialEventIn<A, O>, emitterAddress?: string | '*'): ExtendedEventFilter<R>;
}
export declare const wrapEventType: <A extends unknown[], O extends object>(customName: string, emitter: Contract) => EventFactory<A, O>;
export {};
