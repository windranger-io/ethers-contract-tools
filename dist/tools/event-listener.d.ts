import { BaseContract, Event } from 'ethers';
/**
 * Converts the unvalidated event, into a typed version, verifying the shape.
 */
export interface EventConverter<T> {
    (parameters: Event): T;
}
/**
 * Listeners for a single type of contract event.
 */
export declare class EventListener<T> {
    _events: T[];
    constructor(contract: BaseContract, eventName: string, convert: EventConverter<T>);
    events(): T[];
}
