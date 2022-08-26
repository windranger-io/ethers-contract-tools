import {BaseContract, Contract, ContractFactory, Signer} from 'ethers'

const FACTORY_SUFFIX = '__factory' as const
type ContractFactoryName<K extends string> = `${K}${typeof FACTORY_SUFFIX}`
type ExtractContractName<K extends string> =
    K extends `${infer R}${typeof FACTORY_SUFFIX}` ? R & string : never

export type Imports = Record<string, unknown>

type PromiseOrValue<T> = T | Promise<T>

interface InterfaceFactory<C extends BaseContract> {
    createInterface(): C['interface']
    connect(address: string, signerOrProvider: Signer): C
}

interface Deployable<C extends Contract, A extends unknown[]>
    extends ContractFactory {
    deploy(...args: A): Promise<C>
}

type ContractFactoryConstructor<
    C extends Contract = Contract,
    A extends unknown[] = unknown[]
> = new (signer: Signer) => Deployable<C, A>
type ExtractContractType<F> = F extends ContractFactoryConstructor<infer R>
    ? R
    : never
type ExtractDeployArgs<F> = F extends ContractFactoryConstructor<
    Contract,
    infer R
>
    ? R
    : never
type ExtractBaseContractType<F> = F extends InterfaceFactory<infer R>
    ? R
    : never
type ExtractInterfaceType<F> = F extends InterfaceFactory<infer R>
    ? R['interface']
    : never

export type ContractDeployFunction<I extends Imports> = <
    N extends ExtractContractName<keyof I & string>
>(
    name: N,
    deployArgs: ExtractDeployArgs<I[ContractFactoryName<N>]>,
    signer?: Signer
) => Promise<ExtractContractType<I[ContractFactoryName<N>]>>
export type ContractAttachFunction<I extends Imports> = <
    N extends ExtractContractName<keyof I & string>
>(
    name: N,
    address: string,
    signer?: Signer
) => ExtractBaseContractType<I[ContractFactoryName<N>]>
export type ContractAsyncAttachFunction<I extends Imports> = <
    N extends ExtractContractName<keyof I & string>
>(
    name: N,
    address: string,
    signer?: Signer
) => Promise<ExtractBaseContractType<I[ContractFactoryName<N>]>>
export type ContractInterfaceFunction<I extends Imports> = <
    N extends ExtractContractName<keyof I & string>
>(
    name: N
) => ExtractInterfaceType<I[ContractFactoryName<N>]>

export interface ImportedFactories<I extends Imports> {
    deploy: ContractDeployFunction<I>
    attach: ContractAttachFunction<I>
    interface: ContractInterfaceFunction<I>
    deployWithDelegate(
        delegateFn: (
            factory: ContractFactory,
            deployArgs: unknown[]
        ) => Promise<Contract>,
        signer?: PromiseOrValue<Signer>
    ): ContractDeployFunction<I>
    attachWithDelegate(
        delegateFn: (
            factory: ContractFactory,
            address: string
        ) => Promise<Contract>,
        signer?: PromiseOrValue<Signer>
    ): ContractAsyncAttachFunction<I>
}

export function wrapImportedFactories<I extends Imports>(
    imports: I,
    defaultSigner?: PromiseOrValue<Signer>
): ImportedFactories<I> {
    return new (class implements ImportedFactories<I> {
        findSignerAsync(
            s1?: PromiseOrValue<Signer>,
            s2?: PromiseOrValue<Signer>
        ): PromiseOrValue<Signer> {
            const s = s1 ?? s2 ?? defaultSigner
            if (s) {
                return s
            }
            throw new Error('Signer is not available')
        }

        findSigner(s1?: Signer): Signer {
            if (s1) {
                return s1
            }
            if (Signer.isSigner(defaultSigner)) {
                return defaultSigner
            }
            throw new Error('Signer is not available or needs to be resolved')
        }

        factoryClassByName(name: string): InterfaceFactory<BaseContract> {
            const factoryClass = imports[
                `${name}${FACTORY_SUFFIX}`
            ] as InterfaceFactory<BaseContract>
            if (!factoryClass) {
                throw new Error(`Factory is missing for contract type: ${name}`)
            }
            return factoryClass
        }

        async deploy<N extends ExtractContractName<keyof I & string>>(
            name: N,
            deployArgs: ExtractDeployArgs<I[ContractFactoryName<N>]>,
            signer?: Signer
        ): Promise<ExtractContractType<I[ContractFactoryName<N>]>> {
            const factoryClass = this.factoryClassByName(
                name
            ) as unknown as ContractFactoryConstructor
            const factory = new factoryClass(await this.findSignerAsync(signer))
            const contract = await factory.deploy(...deployArgs)
            const deployed = (await contract.deployed()) as ExtractContractType<
                I[ContractFactoryName<N>]
            >
            return deployed
        }

        deployWithDelegate(
            delegateFn: (
                factory: ContractFactory,
                deployArgs: unknown[]
            ) => Promise<Contract>,
            signer?: PromiseOrValue<Signer>
        ): ContractDeployFunction<I> {
            const fn = async (
                name: string,
                deployArgs: unknown[],
                signer2?: Signer
            ): Promise<Contract> => {
                const factoryClass = this.factoryClassByName(
                    name
                ) as unknown as ContractFactoryConstructor
                const factory = new factoryClass(
                    await this.findSignerAsync(signer2, signer)
                )
                return delegateFn(factory, deployArgs)
            }
            return fn as unknown as ContractDeployFunction<I>
        }

        attach<N extends ExtractContractName<keyof I & string>>(
            name: N,
            address: string,
            signer?: Signer
        ): ExtractBaseContractType<I[ContractFactoryName<N>]> {
            const factoryClass = this.factoryClassByName(name)
            return factoryClass.connect(
                address,
                this.findSigner(signer)
            ) as ExtractBaseContractType<I[ContractFactoryName<N>]>
        }

        attachWithDelegate(
            delegateFn: (
                factory: ContractFactory,
                address: string
            ) => Promise<Contract>,
            signer?: PromiseOrValue<Signer>
        ): ContractAsyncAttachFunction<I> {
            const fn = async (
                name: string,
                address: string,
                signer2?: Signer
            ): Promise<Contract> => {
                const factoryClass = this.factoryClassByName(
                    name
                ) as unknown as ContractFactoryConstructor
                const factory = new factoryClass(
                    await this.findSignerAsync(signer2, signer)
                )
                return delegateFn(factory, address)
            }
            return fn as unknown as ContractAsyncAttachFunction<I>
        }

        interface<N extends ExtractContractName<keyof I & string>>(
            name: N
        ): ExtractInterfaceType<I[ContractFactoryName<N>]> {
            const factoryClass = this.factoryClassByName(name)
            return factoryClass.createInterface() as ExtractInterfaceType<
                I[ContractFactoryName<N>]
            >
        }
    })()
}
