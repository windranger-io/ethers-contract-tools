import type { Event, EventFilter } from "ethers";
export interface TypedEvent<TArgsArray extends Array<any> = any, TArgsObject = any> extends Event {
    args: TArgsArray & TArgsObject;
}
export interface TypedEventFilter<_TEvent extends TypedEvent> extends EventFilter {
}
export declare type PromiseOrValue<T> = T | Promise<T>;
export declare type EventFilters = {
    [name: string]: (...args: Array<any>) => EventFilter;
};
