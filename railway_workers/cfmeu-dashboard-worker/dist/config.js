"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
];
for (const key of requiredVars) {
    if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
}
exports.config = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
    databaseUrl: process.env.DATABASE_URL ?? null,
    refreshCron: process.env.REFRESH_CRON ?? '*/10 * * * *',
    port: Number(process.env.PORT ?? 3000),
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 15000),
    corsOrigin: process.env.CORS_ORIGIN || '*',
};
