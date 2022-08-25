/**
 * Whether the side effects being awaited have occurred.
 */
export interface SideEffectOccurrence {
    (): boolean;
}
/**
 * Delays processing, with an early exit condition.
 *
 * @param earlyStop awaiting the side effect.
 * @param maximumDelayMs most amount of time to await side effect.
 */
export declare function occurrenceAtMost(earlyStop: SideEffectOccurrence, maximumDelayMs: number): Promise<void>;
