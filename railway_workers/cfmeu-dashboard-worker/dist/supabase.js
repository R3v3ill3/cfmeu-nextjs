"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServiceRoleClient = getServiceRoleClient;
exports.getUserClientFromToken = getUserClientFromToken;
exports.verifyJWT = verifyJWT;
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
/**
 * Create a Supabase client for a user based on their JWT token.
 *
 * IMPORTANT: We use the service role key with auth.persistSession=false and manually
 * validate the JWT. This is because:
 * 1. Setting JWT in global.headers doesn't work for auth.getUser()
 * 2. setSession() requires a refresh_token which we don't have in this context
 * 3. The service role client can query any data, but we validate permissions separately
 */
function getUserClientFromToken(jwt) {
    // Use service role client for queries, but we'll validate the JWT separately in ensureAuthorizedUser
    const client = (0, supabase_js_1.createClient)(config_1.config.supabaseUrl, config_1.config.supabaseServiceKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    return client;
}
/**
 * Verify and decode a JWT token using the service role client.
 * Returns the user data if valid, throws if invalid.
 */
async function verifyJWT(jwt) {
    const serviceClient = getServiceRoleClient();
    // Use service role to verify the JWT by calling auth.getUser with the token
    const { data, error } = await serviceClient.auth.getUser(jwt);
    if (error || !data?.user) {
        throw new Error('Invalid or expired token');
    }
    return data.user;
}
