import {expect} from 'chai'
import {BaseContract, Contract, ContractReceipt, utils} from 'ethers'
import {EventFilters, TypedEvent, TypedEventFilter} from './event-types'
import {
    expectEmittersAndEvents,
    ExtendedEventFilter,
    newExtendedEventFilter
} from './event-filters'
import {EventListener} from './event-listener'
import {ContractReceiptSource, successfulTransaction} from './transaction'

function findEventArgs(
    name: string,
    receipt: ContractReceipt,
    emitter: Contract
): utils.Result[] {
    const found: utils.Result[] = []

    const addr = emitter.address.toUpperCase()
    const parser = emitter.interface

    const fragment = parser.getEvent(name)
    const id = utils.id(fragment.format())

    for (const entry of receipt.logs) {
        if (entry.topics[0] === id && entry.address.toUpperCase() === addr) {
            const parsed = parser.decodeEventLog(
                fragment,
                entry.data,
                entry.topics
            )
            found.push(parsed)
        }
    }

    expect(
        found.length,
        `Failed to find any event matching name: ${name}`
    ).is.greaterThan(0)

    return found
}

type PartialTuple<T extends unknown[]> = T extends [infer Head, ...infer Tail]
    ? [(Head | null)?, ...PartialTuple<Tail>]
    : []

type EventIn<T extends TypedEvent> = T extends TypedEvent<infer A, infer O>
    ? (PartialTuple<A> & O) | A | O
    : never

type PartialEventIn<T extends TypedEvent> = T extends TypedEvent<
    infer A,
    infer O
>
    ? (PartialTuple<A> & Partial<O>) | PartialTuple<A> | Partial<O>
    : never

type EventOut<T extends TypedEvent> = T extends TypedEvent<infer A, infer O>
    ? A & O
    : never

export interface EventFactory<T extends TypedEvent = TypedEvent> {
    expectOne(receipt: ContractReceipt, expected?: EventIn<T>): EventOut<T>

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
    expectOrdered(
        receipt: ContractReceipt,
        expecteds: PartialEventIn<T>[],
        forwardOnly?: boolean
    ): EventOut<T>[]

    all<Result = EventOut<T>[]>(
        receipt: ContractReceipt,
        fn?: (args: EventOut<T>[]) => Result
    ): Result

    waitAll(
        source: ContractReceiptSource,
        fn?: (args: EventOut<T>[]) => void
    ): Promise<ContractReceipt>

    toString(): string
    name(): string

    newListener(): EventListener<EventOut<T>>
    newFilter(
        args?: PartialEventIn<T>,
        emitterAddress?: string | '*'
    ): ExtendedEventFilter<EventOut<T>>
}

const _wrap = <T extends TypedEvent>(
    template: T, // only for type
    customName: string,
    emitter: Contract
): EventFactory<T> =>
    new (class implements EventFactory<T> {
        expectOne<R = EventOut<T>>(
            receipt: ContractReceipt,
            expected?: EventIn<T>
        ): R {
            const args = findEventArgs(this.toString(), receipt, emitter)

            expect(
                args.length,
                `Expecting a single event ${this.toString()}`
            ).equals(1)
            return this.verifyArgs<R>(args[0], expected)
        }

        expectOrdered(
            receipt: ContractReceipt,
            expecteds: PartialEventIn<T>[],
            forwardOnly?: boolean
        ): EventOut<T>[] {
            const filters = expecteds.map((expected) =>
                this.newFilter(expected)
            )
            const [, events] = expectEmittersAndEvents(
                receipt,
                forwardOnly ?? false,
                ...filters
            )
            return events
        }

        all<Result = EventOut<T>[]>(
            receipt: ContractReceipt,
            fn?: (args: EventOut<T>[]) => Result
        ): Result {
            const args = findEventArgs(this.toString(), receipt, emitter)

            // eslint-disable-next-line no-undefined
            if (fn === undefined) {
                args.forEach((arg): void => {
                    this.verifyArgs(arg)
                })
                return args as unknown as Result
            }

            return fn(args as unknown as EventOut<T>[])
        }

        async waitAll(
            source: ContractReceiptSource,
            fn?: (args: EventOut<T>[]) => void
        ): Promise<ContractReceipt> {
            const receipt = await successfulTransaction(source)
            this.all(receipt, fn)
            return receipt
        }

        toString(): string {
            return this.name()
        }

        name(): string {
            return customName
        }

        private verifyArgs<R = EventOut<T>>(
            args: utils.Result,
            expected?: PartialEventIn<T>
        ): R {
            const n = this.toString()
            if ((expected ?? null) !== null) {
                _verifyByProperties(expected, n, args)
            }
            _verifyByFragment(emitter.interface.getEvent(n), n, args)
            return args as unknown as R
        }

        newListener<R = EventOut<T>>(): EventListener<R> {
            const n = this.toString()

            const fragment = emitter.interface.getEvent(n)
            return new EventListener<R>(emitter, n, (event) => {
                const args = event.args ?? ({} as utils.Result)
                _verifyByFragment(fragment, n, args)
                return args as unknown as R
            })
        }

        newFilter(
            filter?: PartialEventIn<T>,
            emitterAddress?: string
        ): ExtendedEventFilter<EventOut<T>> {
            const n = this.toString()
            return newExtendedEventFilter<EventOut<T>>(
                n,
                emitterAddress ?? emitter.address,
                emitter.interface,
                filter as unknown as EventOut<T>
            )
        }
    })()

const _verifyByFragment = (
    fragment: utils.EventFragment,
    name: string,
    args: utils.Result
) => {
    fragment.inputs.forEach((param, index) => {
        expect(args[index], `Property ${name}[${index}] is undefined`).is.not
            .undefined

        if (param.name) {
            expect(
                args[param.name],
                `Property ${name}.${param.name} is undefined`
            ).is.not.undefined
        }
    })
}

const _verifyByProperties = <T>(
    expected: T,
    name: string,
    args: utils.Result
) => {
    if (Array.isArray(expected)) {
        ;(expected as unknown[]).forEach((value, index) => {
            if ((value ?? null) !== null) {
                expect(
                    args[index],
                    `Mismatched value of property ${name}[${index}]`
                ).eq(value)
            }
        })
    }
    Object.entries(expected).forEach(([propName, value]) => {
        if ((value ?? null) !== null) {
            expect(
                args[propName],
                `Mismatched value of property ${name}.${propName}`
            ).eq(value)
        }
    })
}

class ContractEventFilters<F extends EventFilters> extends BaseContract {
    readonly filters!: F
}

type ExtractEventFilters<T extends BaseContract> =
    T extends ContractEventFilters<infer F> ? F : never

type EventFilterType<T extends TypedEventFilter<TypedEvent>> =
    T extends TypedEventFilter<infer R extends TypedEvent> ? R : never

export const eventOf = <
    C extends BaseContract,
    N extends keyof ExtractEventFilters<C> & string
>(
    emitter: C,
    name: N
): EventFactory<EventFilterType<ReturnType<ExtractEventFilters<C>[N]>>> =>
    _wrap(
        null as unknown as EventFilterType<
            ReturnType<ExtractEventFilters<C>[N]>
        >,
        name,
        emitter
    )

export const newEventListener = <
    C extends BaseContract,
    N extends keyof ExtractEventFilters<C> & string
>(
    emitter: C,
    name: N
): EventListener<
    EventOut<EventFilterType<ReturnType<ExtractEventFilters<C>[N]>>>
> => eventOf(emitter, name).newListener()
