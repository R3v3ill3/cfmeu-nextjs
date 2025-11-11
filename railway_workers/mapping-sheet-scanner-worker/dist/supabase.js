"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminClient = getAdminClient;
exports.closeAdminClient = closeAdminClient;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("./config");
let adminClientInstance = null;
function getAdminClient() {
    if (!adminClientInstance) {
        adminClientInstance = (0, supabase_js_1.createClient)(config_1.config.supabaseUrl, config_1.config.supabaseServiceKey, {
            auth: { persistSession: false },
            db: {
                schema: 'public'
            },
            global: {
                headers: {
                    'x-application-name': 'mapping-sheet-scanner-worker'
                }
            },
            // Supabase JS uses REST API (not persistent connections)
            // Connection pooling is handled by Supabase's edge functions
            // This singleton pattern ensures we reuse the HTTP client across requests
        });
        console.log('[supabase] Admin client initialized (singleton pattern, REST API)');
    }
    return adminClientInstance;
}
// Add cleanup function for graceful shutdown
function closeAdminClient() {
    if (adminClientInstance) {
        // Supabase client doesn't have explicit close, but clear reference
        adminClientInstance = null;
    }
}
