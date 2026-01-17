"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sentry = void 0;
exports.initMonitoring = initMonitoring;
exports.setupSentryErrorHandler = setupSentryErrorHandler;
exports.captureError = captureError;
exports.flushEvents = flushEvents;
// Sentry monitoring integration for scraper worker
const Sentry = __importStar(require("@sentry/node"));
exports.Sentry = Sentry;
let isInitialized = false;
// Initialize Sentry for this worker
function initMonitoring() {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        console.log('[Monitoring] SENTRY_DSN not set, monitoring disabled');
        return;
    }
    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.RAILWAY_GIT_COMMIT_SHA || 'local',
        // Only enable in production or when debug is set
        enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_DEBUG === 'true',
        // Sample rate for performance monitoring
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        // Add service name tag
        initialScope: {
            tags: {
                service: 'cfmeu-scraper-worker',
            },
        },
        // Before sending, add context
        beforeSend(event) {
            // Don't send in development unless debug is enabled
            if (process.env.NODE_ENV === 'development' && process.env.SENTRY_DEBUG !== 'true') {
                return null;
            }
            return event;
        },
    });
    isInitialized = true;
    console.log('[Monitoring] Sentry initialized for scraper worker');
}
// Setup Express error handler - call after all routes are defined
function setupSentryErrorHandler(app) {
    if (isInitialized) {
        Sentry.setupExpressErrorHandler(app);
    }
}
// Capture error with context
function captureError(error, context) {
    if (!isInitialized)
        return;
    Sentry.captureException(error, {
        extra: context,
        tags: {
            service: 'cfmeu-scraper-worker',
        },
    });
}
// Flush events before shutdown
async function flushEvents() {
    if (isInitialized) {
        await Sentry.close(2000);
    }
}
