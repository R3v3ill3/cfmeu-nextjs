"use strict";
/**
 * Timeout utilities for API calls with AbortController support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoutError = void 0;
exports.withTimeout = withTimeout;
exports.createTimeoutController = createTimeoutController;
exports.withTimeoutAndRetry = withTimeoutAndRetry;
exports.logTimeoutIncident = logTimeoutIncident;
class TimeoutError extends Error {
    constructor(message, timeoutMs) {
        super(message);
        this.timeoutMs = timeoutMs;
        this.name = 'TimeoutError';
    }
}
exports.TimeoutError = TimeoutError;
/**
 * Wraps a promise with timeout functionality using AbortController
 * @param promise The promise to wrap
 * @param options Timeout configuration
 * @returns The result of the promise or throws TimeoutError
 */
async function withTimeout(promise, options) {
    const { timeoutMs, operationName = 'Operation' } = options;
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new TimeoutError(`${operationName} timed out after ${timeoutMs}ms`, timeoutMs));
        }, timeoutMs);
        promise
            .then((result) => {
            clearTimeout(timeoutId);
            resolve(result);
        })
            .catch((error) => {
            clearTimeout(timeoutId);
            reject(error);
        });
    });
}
/**
 * Creates an AbortController that automatically aborts after a timeout
 * @param timeoutMs Timeout in milliseconds
 * @returns Object with AbortController and cleanup function
 */
function createTimeoutController(timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeoutMs);
    const cleanup = () => {
        clearTimeout(timeoutId);
    };
    return { controller, cleanup };
}
/**
 * Wraps an async function with retry logic for timeout errors
 * @param fn The async function to wrap
 * @param options Configuration for timeout and retry behavior
 * @returns Result of the function or throws after retries exhausted
 */
async function withTimeoutAndRetry(fn, options) {
    const { timeoutMs, maxRetries, operationName = 'Operation', onRetry } = options;
    let lastError;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            return await withTimeout(fn(), { timeoutMs, operationName });
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (error instanceof TimeoutError && attempt <= maxRetries) {
                console.warn(`[timeout] ${operationName} attempt ${attempt}/${maxRetries + 1} timed out after ${timeoutMs}ms, retrying...`);
                if (onRetry) {
                    onRetry(attempt, lastError);
                }
                continue;
            }
            throw lastError;
        }
    }
    throw lastError;
}
/**
 * Logs timeout incidents for monitoring
 */
function logTimeoutIncident(operationName, timeoutMs, metadata) {
    console.error('[timeout-incident]', {
        timestamp: new Date().toISOString(),
        operation: operationName,
        timeoutMs,
        ...metadata,
    });
}
