"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = void 0;
exports.makeCacheKey = makeCacheKey;
class InMemoryTtlCache {
    constructor() {
        this.store = new Map();
    }
    get(key) {
        const entry = this.store.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }
    set(key, value, ttlMs) {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
    delete(key) {
        this.store.delete(key);
    }
}
exports.cache = new InMemoryTtlCache();
function makeCacheKey(prefix, scope, obj) {
    const norm = JSON.stringify(obj, Object.keys(obj).sort());
    return `${prefix}:${scope}:${norm}`;
}
