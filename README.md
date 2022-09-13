# Contract Tools for Ethers+Typechain 

Strongly-typed zero-code handling for events and contracts.
This is a tooling package for [solidity-template](https://github.com/windranger-io/windranger-solidity-template) but it is also usable independently.

This package contains tooling for tests and deploys and it provides:
* strictly typed access to contracts by contract names
* strictly typed handing of events

Typed handling of events also supports extraction & filtering of events emitted by contracts **called inside** a transaction.

## Pre-requisite

This tooling requires ethers and ethers typechain for contracts.

## Installation


```bash
npm install --save-dev @windranger-io/windranger-tools-ethers
# or
yarn add --dev @windranger-io/windranger-tools-ethers
```


### Installation of event type handler

This tooling requires access to ethers typechains of a project. For this, the following files should be added to the project.

#### File `events.ts`

```typescript
import {BaseContract} from 'ethers'
import {wrapEventType} from '@windranger-io/windranger-tools-ethers'
import {TypedEvent, TypedEventFilter} from '<path to typechain root>/common'

/*
 * This method MUST be local to handle typing information properly.
 */
export const eventOf = <
    C extends BaseContract,
    N extends keyof C['filters'] & string,
    E extends ReturnType<C['filters'][N]> extends TypedEventFilter<
        infer R extends TypedEvent
    >
        ? R
        : never
>(
    emitter: C,
    name: N
) =>
    wrapEventType<
        E extends TypedEvent<infer A, object> ? A : never,
        E extends TypedEvent<unknown[], infer O extends object> ? O : never
    >(name, emitter)


```

#### File `contracts.ts`

```typescript
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers'
import {ethers, upgrades} from 'hardhat'

import {wrapImportedFactories} from '@windranger-io/windranger-tools-ethers/dist/tools/contract-wrappers'
import * as types from '<path to typechain root>'

const typedFactories = wrapImportedFactories(types, signer(0))

/**
 * Deploys a contract, that may or may not have constructor parameters.
 *
 * @param name the case sensitive name of the contract in the Solidity file.
 */
export const deployContract = typedFactories.deploy.bind(typedFactories)

/**
 * Deploys an admin proxy with the contract as the implementation behind.
 * The contract may or may not have constructor parameters.
 *
 * @param name the case sensitive name of the contract in the Solidity file.
 */
export const deployContractWithProxy = typedFactories.deployWithDelegate(
    async (factory, deployArgs) => {
        const contract = await upgrades.deployProxy(factory, [...deployArgs], {
            kind: 'uups'
        })
        return contract.deployed()
    }
)

/**
 * Upgrades an implementation contract that has a proxy contract in front.
 *
 * @param name the case sensitive name of the contract in the Solidity file.
 * @param address existing address of a proxy with the implementation behind.
 */
export const upgradeContract = typedFactories.attachWithDelegate(
    async (factory, address) => {
        const contract = await upgrades.upgradeProxy(address, factory)
        return contract.deployed()
    }
)

async function signer(index: number): Promise<SignerWithAddress> {
    const signers = await ethers.getSigners()
    return signers[index]
}
```



# Usage

## Typed access to contracts by name

The given code above adds methods `deployContract`, `deployContractWithProxy` and `upgradeContract` with the following properties:

- **name is checked at compile time** (in IDE / during transpile) to be a deploy-able contract
- result has a typechain type based on the name, e.g. for the name ‘Tub’, result will be `Tub`
- arguments for deploy are also a strictly typed tuple that matches the `deploy` function and **checked at compile time**:
    - (breaking change) for deploy without arguments an empty array should be provided explicitly.


```typescript
import * from './contracts'

// This function will deploy a contract of a type Box.
// The result will have type Box or a compile-time error when there is no such contract.
// And the list of arguments is also type-checked to match declared deploy args.
const box = await deployContract('Box', [])

// This function will deploy a contract of a type Box and use it as a proxy implementation.
// The result will have type Box or a compile-time error when there is no such contract.
// And the list of arguments is also type-checked to match declared deploy args.
// The contract will be deployed under a proxy.
const boxV1 = await deployContractWithProxy('Box', [], admin)

// This function will use OpenZeppelin to deploy a contract of a type BoxV2 and use it as a new implementation for the given proxy.
// The result will have type BoxV2 or a compile-time error when there is no such contract.
const boxV2 = await upgradeContract('BoxV2', boxV1.address)

```

## Typed access to events

To use typed event access and filtering, first invoke 

`eventOf(<typed contract>, '<event name>')` where

* The first argument must be a contract of a type generated by ethers typechain.
* The second argument is name of an event. This name is checked at compile time.

The result of this function is a helper that facilitates extraction and filtering of events from transactions.

Here is a simple example of use.

```typescript

const box = await deployContract('Box', [])
const storedEvent = eventOf(box, 'Stored')

...

// This method will read the event log from someContract.doSomething() transaction
// and will find all events of type Stored emitted by box.address.
// The fould list of **decoded and typed** events is passed to the callback.
// Transaction receipt is returned, so other events can be extracted from the same call.
const receipt = await storedEvent.waitAll(
    someContract.doSomething(), 
    (events) => {
        expect(events.length).eq(2)
        expect(events[0].value).eq('Sample Value 1')
        expect(events[1].value).eq('Sample Value 2')
    }
);

```

## Advanced use

Additional documentation is provided [here](./Events.md).

Detailed examples of use in tests are provided [here](https://github.com/windranger-io/windranger-solidity-template/blob/framework/adv-sizer/test/events.test.ts).
