"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'INCOLINK_EMAIL',
    'INCOLINK_PASSWORD',
];
for (const key of required) {
    if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
}
exports.config = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
    incolinkEmail: process.env.INCOLINK_EMAIL,
    incolinkPassword: process.env.INCOLINK_PASSWORD,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 5000),
    lockTimeoutMs: Number(process.env.LOCK_TIMEOUT_MS ?? 5 * 60000),
};
