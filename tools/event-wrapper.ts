import {expect} from 'chai'
import {Contract, ContractReceipt, utils} from 'ethers'
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

type EventIn<A extends unknown[], O extends object> =
    | (PartialTuple<A> & O)
    | A
    | O

type PartialEventIn<A extends unknown[], O extends object> =
    | (PartialTuple<A> & Partial<O>)
    | PartialTuple<A>
    | Partial<O>

export type EventFactoryWithTuple<
    A extends unknown[],
    O extends object
> = EventFactoryOmni<A, O, A & O>

export interface EventFactory<A extends unknown[], O extends object>
    extends EventFactoryOmni<A, O, O> {
    readonly withTuple: EventFactoryWithTuple<A, O>
}

export interface EventFactoryOmni<
    A extends unknown[],
    O extends object,
    R extends O
> {
    expectOne(receipt: ContractReceipt, expected?: EventIn<A, O>): R

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
        expecteds: PartialEventIn<A, O>[],
        forwardOnly?: boolean
    ): R[]

    all<Result = R[]>(
        receipt: ContractReceipt,
        fn?: (args: R[]) => Result
    ): Result

    waitAll(
        source: ContractReceiptSource,
        fn: (args: R[]) => void
    ): Promise<ContractReceipt>

    toString(): string
    name(): string

    newListener(afterBlock?: number): EventListener<R>
    newFilter(
        args?: PartialEventIn<A, O>,
        emitterAddress?: string | '*'
    ): ExtendedEventFilter<R>
}

export const wrapEventType = <A extends unknown[], O extends object>(
    customName: string,
    emitter: Contract
): EventFactory<A, O> =>
    new (class implements EventFactory<A, O> {
        withTuple = this as unknown as EventFactoryWithTuple<A, O>

        expectOne(receipt: ContractReceipt, expected?: EventIn<A, O>): O {
            const args = findEventArgs(this.toString(), receipt, emitter)

            expect(
                args.length,
                `Expecting a single event ${this.toString()}`
            ).equals(1)
            return this.verifyArgs(args[0], expected as PartialEventIn<A, O>)
        }

        expectOrdered(
            receipt: ContractReceipt,
            expecteds: PartialEventIn<A, O>[],
            forwardOnly?: boolean
        ): O[] {
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

        all<Result = O[]>(
            receipt: ContractReceipt,
            fn?: (args: O[]) => Result
        ): Result {
            const args = findEventArgs(this.toString(), receipt, emitter)

            // eslint-disable-next-line no-undefined
            if (fn === undefined) {
                args.forEach((arg): void => {
                    this.verifyArgs(arg)
                })
                return args as unknown as Result
            }

            return fn(args as unknown as O[])
        }

        async waitAll(
            source: ContractReceiptSource,
            fn?: (args: O[]) => void
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

        private verifyArgs(
            args: utils.Result,
            expected?: PartialEventIn<A, O>
        ): O {
            const n = this.toString()
            if ((expected ?? null) !== null) {
                _verifyByProperties(expected, n, args)
            }
            _verifyByFragment(emitter.interface.getEvent(n), n, args)
            return args as unknown as O
        }

        newListener(afterBlock?: number): EventListener<O> {
            const n = this.toString()

            const fragment = emitter.interface.getEvent(n)
            return new EventListener<O>(emitter, n, (event) => {
                const args = event.args ?? ({} as utils.Result)
                _verifyByFragment(fragment, n, args)
                return args as unknown as O
            }, afterBlock)
        }

        newFilter(
            filter?: PartialEventIn<A, O>,
            emitterAddress?: string
        ): ExtendedEventFilter<O> {
            const n = this.toString()
            return newExtendedEventFilter<O>(
                n,
                emitterAddress ?? emitter.address,
                emitter.interface,
                filter as unknown as O
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
    Object.entries(expected as unknown as object).forEach(([propName, value]) => {
        if ((value ?? null) !== null) {
            expect(
                args[propName],
                `Mismatched value of property ${name}.${propName}`
            ).eq(value)
        }
    })
}
