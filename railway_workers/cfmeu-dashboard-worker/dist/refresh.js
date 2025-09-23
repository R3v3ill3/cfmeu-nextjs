"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleMaterializedViewRefreshes = scheduleMaterializedViewRefreshes;
const node_cron_1 = __importDefault(require("node-cron"));
const supabase_1 = require("./supabase");
const config_1 = require("./config");
function scheduleMaterializedViewRefreshes(logger) {
    const cron = config_1.config.refreshCron; // default: every 10 minutes
    node_cron_1.default.schedule(cron, async () => {
        const start = Date.now();
        const svc = (0, supabase_1.getServiceRoleClient)();
        try {
            await svc.rpc('refresh_patch_project_mapping_view');
            await svc.rpc('refresh_project_list_comprehensive_view');
            const ms = Date.now() - start;
            logger.info({ ms }, 'Refreshed materialized views');
        }
        catch (err) {
            logger.error({ err }, 'Failed to refresh materialized views');
        }
    });
}
