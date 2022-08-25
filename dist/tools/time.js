"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.occurrenceAtMost = void 0;
const PAUSE_TIME_INCREMENT_MS = 100;
/**
 * Delays processing, with an early exit condition.
 *
 * @param earlyStop awaiting the side effect.
 * @param maximumDelayMs most amount of time to await side effect.
 */
async function occurrenceAtMost(earlyStop, maximumDelayMs) {
    let passedMs = 0;
    while (!earlyStop() && passedMs < maximumDelayMs) {
        await sleep(PAUSE_TIME_INCREMENT_MS);
        passedMs += PAUSE_TIME_INCREMENT_MS;
    }
}
exports.occurrenceAtMost = occurrenceAtMost;
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
//# sourceMappingURL=time.js.map