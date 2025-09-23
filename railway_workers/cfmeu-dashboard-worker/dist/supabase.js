"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServiceRoleClient = getServiceRoleClient;
exports.getUserClientFromToken = getUserClientFromToken;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("./config");
let cachedServiceClient = null;
function getServiceRoleClient() {
    if (!cachedServiceClient) {
        cachedServiceClient = (0, supabase_js_1.createClient)(config_1.config.supabaseUrl, config_1.config.supabaseServiceKey, {
            auth: { persistSession: false },
        });
    }
    return cachedServiceClient;
}
function getUserClientFromToken(jwt) {
    // Use anon key behavior by passing no key, then attach Authorization via global header
    const client = (0, supabase_js_1.createClient)(config_1.config.supabaseUrl, config_1.config.supabaseServiceKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    return client;
}
