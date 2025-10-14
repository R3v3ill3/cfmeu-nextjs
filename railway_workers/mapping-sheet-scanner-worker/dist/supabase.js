"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminClient = getAdminClient;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("./config");
function getAdminClient() {
    return (0, supabase_js_1.createClient)(config_1.config.supabaseUrl, config_1.config.supabaseServiceKey, {
        auth: { persistSession: false },
    });
}
