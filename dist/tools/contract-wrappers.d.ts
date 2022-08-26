import { BaseContract, Contract, ContractFactory, Signer } from 'ethers';
declare const FACTORY_SUFFIX: "__factory";
declare type ContractFactoryName<K extends string> = `${K}${typeof FACTORY_SUFFIX}`;
declare type ExtractContractName<K extends string> = K extends `${infer R}${typeof FACTORY_SUFFIX}` ? R & string : never;
export declare type Imports = Record<string, unknown>;
declare type PromiseOrValue<T> = T | Promise<T>;
interface InterfaceFactory<C extends BaseContract> {
    createInterface(): C['interface'];
    connect(address: string, signerOrProvider: Signer): C;
}
interface Deployable<C extends Contract, A extends unknown[]> extends ContractFactory {
    deploy(...args: A): Promise<C>;
}
declare type ContractFactoryConstructor<C extends Contract = Contract, A extends unknown[] = unknown[]> = new (signer: Signer) => Deployable<C, A>;
declare type ExtractContractType<F> = F extends ContractFactoryConstructor<infer R> ? R : never;
declare type ExtractDeployArgs<F> = F extends ContractFactoryConstructor<Contract, infer R> ? R : never;
declare type ExtractBaseContractType<F> = F extends InterfaceFactory<infer R> ? R : never;
declare type ExtractInterfaceType<F> = F extends InterfaceFactory<infer R> ? R['interface'] : never;
export declare type ContractDeployFunction<I extends Imports> = <N extends ExtractContractName<keyof I & string>>(name: N, deployArgs: ExtractDeployArgs<I[ContractFactoryName<N>]>, signer?: Signer) => Promise<ExtractContractType<I[ContractFactoryName<N>]>>;
export declare type ContractAttachFunction<I extends Imports> = <N extends ExtractContractName<keyof I & string>>(name: N, address: string, signer?: Signer) => ExtractBaseContractType<I[ContractFactoryName<N>]>;
export declare type ContractAsyncAttachFunction<I extends Imports> = <N extends ExtractContractName<keyof I & string>>(name: N, address: string, signer?: Signer) => Promise<ExtractBaseContractType<I[ContractFactoryName<N>]>>;
export declare type ContractInterfaceFunction<I extends Imports> = <N extends ExtractContractName<keyof I & string>>(name: N) => ExtractInterfaceType<I[ContractFactoryName<N>]>;
export interface ImportedFactories<I extends Imports> {
    deploy: ContractDeployFunction<I>;
    attach: ContractAttachFunction<I>;
    interface: ContractInterfaceFunction<I>;
    deployWithDelegate(delegateFn: (factory: ContractFactory, deployArgs: unknown[]) => Promise<Contract>, signer?: PromiseOrValue<Signer>): ContractDeployFunction<I>;
    attachWithDelegate(delegateFn: (factory: ContractFactory, address: string) => Promise<Contract>, signer?: PromiseOrValue<Signer>): ContractAsyncAttachFunction<I>;
}
export declare function wrapImportedFactories<I extends Imports>(imports: I, defaultSigner?: PromiseOrValue<Signer>): ImportedFactories<I>;
export {};
