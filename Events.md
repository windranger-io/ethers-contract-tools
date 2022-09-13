# Zero-code typed events

This section provides description of improvement made for the test framework. These improvements provide significant reduce of boilerplate code for events together with strict type checks.

With the new tooling:

- there is no need to write custom code to define event objects and to check them
- same code works for events from a called contract and from contracts called internally

This tooling **requires ethers typechains**.

## Representation of event fields

This tooling uses 3 forms of event representations:

- Object-only - this representation is an object with properties named by arguments of a relevant solidity event. **NB!** Nameless arguments can not be filtered or accessed this way.
- Tuple-only - this representation provides access to all fields by index.
- Mixed - mixes both ones.

All forms have strictly typed properties.

By default:

- **filters and expected** values accept **ANY** of these 3 forms;
- **results** (decoded events) are given as the **object-only** type to avoid the clutter of methods from array.

To access a result with the mixed form a property `withTuple` (see below), and the underlying result object is always in the mixed form.

**NB! Indexed** event attributes of **dynamic** types like `string`, `array` or `struct` are stored as hash only and can not be decoded. So, these attributes can be provide as values for filters and expected values, but result (decoded) values will only have a value substitute of type `Indexed`.

## Event type wrapper

To work with an event, it only needs to invoke `eventOf` method, e.g.

```typescript
const receipt = await successfulTransaction(box.store(value))
eventOf(box, 'Store').expectOne(receipt, {value})
expect(await box.value()).equals(value)

```

This method takes a contract (event emitter) and a name of the event. The name parameter is **strictly typed** and use of a wrong name will be an error in IDE / during transpiling.

The `eventOf` method returns an event type wrapper with the following members:

```typescript
export interface EventFactoryOmni<A extends unknown[], O extends object, R extends O> {
    expectOne(receipt: ContractReceipt, expected?: EventIn<A, O>): R;
    
    expectOrdered(receipt: ContractReceipt, expecteds: PartialEventIn<A, O>[], forwardOnly?: boolean): R[];
    
    all<Result = R[]>(receipt: ContractReceipt, fn?: (args: R[]) => Result): Result;
    
    waitAll(source: ContractReceiptSource, fn: (args: R[]) => void): Promise<ContractReceipt>;
    
    newListener(): EventListener<R>;

    newFilter(args?: PartialEventIn<A, O>, emitterAddress?: string | '*'): ExtendedEventFilter<R>;
}
```

- `expectOne` looks for only one event of the type and from the emitter given into `eventOf` and can also use the partial expected to match the event.
- `expectOrdered` looks for a sequence of events of the same type and emitter and matches them to the provided list of partial filters. It is an equivalent of the existing `verifyOrdered`
- `all` finds all events of the same type and emitter and either apply the mapping callback (which can also be useful to reduce scope of intermediate variables) or return the events as is.
- `waitAll` is a convenience form of `all` that accepts either value or `Promise` of either `ContractTransaction` or `ContractReceipt`. This method performs a successful transaction check, so it can be combined was a contract call (see below).
- `newListerner` creates a listener for this event type and emitter.
- `newFilter` creates a filter that can be applied for the advanced event handling describe below.

## Examples of use

Various examples of use are provided here:
[https://github.com/windranger-io/windranger-solidity-template/blob/framework/adv-sizer/test/events.test.ts](https://github.com/windranger-io/windranger-solidity-template/blob/framework/adv-sizer/test/events.test.ts)

Some excerpt are provided below.

### Check for a single event

By object-form

```typescript
    eventOf(box, 'Store').expectOne(receipt, {value})
```


By tuple-form

```typescript
    // inputs always take objectm tuple or mixed form
    eventOf(box, 'Store').expectOne(receipt, [value])

    // withTuple should be specified to get an output as typle/mixed type
    const ev = eventOf(box, 'Store').withTuple.expectOne(receipt)
    expect(ev[0]).eq(value)
```

Please note, that `withTuple` is only required to **receive** the tuple/mixed form as a result. Tuple-based filters / expected can be provided at any time.

### Find all events

Async find all, combined with a contract method call

```typescript
    const eventStore = eventOf(tub, 'Store')
    ...

    // Use of a waitAll() can the outcome of a contract call to reduce boilerplate
    // and will invoke the callback for found events.
    // The receipt is returned to access other events in the transaction.
    const receipt = await eventStore.waitAll(
        tub.multiStore(['1', '2', '3', '4', '5']),
        (events) => {
            expect(events.length).eq(5)
        }
    )
```

Sync find all

```typescript
    const eventStore = eventOf(tub, 'Store')

    // a resolved recept can be filtered/mapped by all() with a callback
    const mapped = eventStore.all(receipt, (events) =>
        events.map((ev) => ev.value)
    )
    expect(mapped).eqls(['1', '2', '3', '4', '5'])

    // or just get a list of matched events
    const events = eventStore.all(receipt)
    expect(events.length).eq(5)

```

### Find a sequence of events

There is `expectOrdered` function to match event of the same time and from the same emitter to be in the specific sequence.

The following code will succeed for any set of events where the Stored event with value 2 is followed by the Stored event with value 5, with any other events in the middle. And it will fail if the event with value 5 preceeds the one with value 2.


```typescript
    const eventStore = eventOf(tub, 'Store')
    ...
    const events = eventStore.expectOrdered(receipt, [
        {value: '2'},
        {value: '5'}
    ])
    expect(events.length).eq(2)
    expect(events[0].value).eq('2')
    expect(events[1].value).eq('5')
```

This behavior is sutable for checks, but may not be suitable to find a set of events starting from a specific one.
For this case there is an optional `forwardOnly` parameter:
* When forwardOnly is false only a matched log entry is removed from further matching;
* othterwise, all log entries before the matched entry are also excluded.

Use forwardOnly = false for a distinct set of events to make sure that ordering is correct.
Use forwardOnly = true to extract a few events of the same type when some of events are exact and some are not.

### Find event from a nested contract

This example calls `tub1` contract and filters for an event from `tub2`

```typescript
    const tub1 = await deployContract('Tub', [])
    const tub2 = await deployContract('Tub', [])

    const eventIndexed2 = eventOf(tub2, 'IndexedEvent')

    // it calls `tub1`, but filters events for `tub2`
    const receipt = await eventIndexed2.waitAll(
        tub1.nestedStore('testValue', [tub2.address]),
        (events) => {
            expect(events.length).eq(1)
        }
    )
```

### Find sequence of events from multiple nested contracts

This example below demonstrates finding a sequence of events of different types and from different contracts.

**NB! The returned values are returned as a strictly typed tuple of events**, hence, each returned event has a type that corresponds to the relevant filter. This can be seen by use of different attributes in the last 2 lines of this example.

```typescript
    const tub1 = await deployContract('Tub', [])
    const tub2 = await deployContract('Tub', [])

    const receipt = await successfulTransaction(
        tub.nestedStore('testValue', [tub1.address, tub2.address])
    )

    const eventStore0 = eventOf(tub, 'Store')
    const eventIndexed1 = eventOf(tub1, 'IndexedEvent')
    const eventStore2 = eventOf(tub2, 'Store')

    // pick the first event from tub with the given type and attribute
    // and the second from tub2 of the given type
    {
        const events = expectEvents(
            receipt,
            eventStore0.newFilter({value: 'testValue'}),
            eventStore2.newFilter({})
        )
        expect(events.length).eq(2)
        expect(events[0].value).eq('testValue')
        expect(events[1].value).eq('++testValue')
    }

    // pick the first event from tub1 with one type
    // and the second event from tub2 with another type
    {
        const events = expectEvents(
            receipt,
            // indexed strings/bytes can be used as filters
            eventIndexed1.newFilter({boxValue: '+testValue'}),
            eventStore2.newFilter() // same as newFilter({})
        )
        expect(events.length).eq(2)

        // Indexed strings/bytes can be used as filters
        // but can NOT be decoded into original values.
        // Instead the value is substituted with a special type
        expect(utils.Indexed.isIndexed(events[0].boxValue)).is.true

        // The returned values are strictly typed tuple of events,
        // so each entry provide fields relevant to its event type.
        expect(events[0].nested).eqls([tub2.address])
        expect(events[1].value).eq('++testValue')
    }
```
