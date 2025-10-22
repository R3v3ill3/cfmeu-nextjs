"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminClient = getAdminClient;
exports.closeAdminClient = closeAdminClient;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("./config");
let cachedClient = null;
function getAdminClient() {
    if (!cachedClient) {
        cachedClient = (0, supabase_js_1.createClient)(config_1.config.supabaseUrl, config_1.config.supabaseServiceKey, {
            auth: {
                persistSession: false,
            },
            db: {
                schema: 'public'
            },
            global: {
                headers: {
                    'x-application-name': 'cfmeu-scraper-worker'
                }
            }
        });
    }
    return cachedClient;
}
// Add cleanup function for graceful shutdown
function closeAdminClient() {
    if (cachedClient) {
        // Supabase client doesn't have explicit close, but clear reference
        cachedClient = null;
    }
}
