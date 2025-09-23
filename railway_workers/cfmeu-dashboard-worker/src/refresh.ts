import nodeCron from 'node-cron'
import type { Logger } from 'pino'
import { getServiceRoleClient } from './supabase'
import { config } from './config'

export function scheduleMaterializedViewRefreshes(logger: Logger) {
  const cron = config.refreshCron // default: every 10 minutes

  nodeCron.schedule(cron, async () => {
    const start = Date.now()
    const svc = getServiceRoleClient()
    try {
      await svc.rpc('refresh_patch_project_mapping_view')
      await svc.rpc('refresh_project_list_comprehensive_view')
      const ms = Date.now() - start
      logger.info({ ms }, 'Refreshed materialized views')
    } catch (err) {
      logger.error({ err }, 'Failed to refresh materialized views')
    }
  })
}

export function refreshPatchProjectMappingViewInBackground(logger: Logger) {
  const svc = getServiceRoleClient()
  void (async () => {
    try {
      const { error } = await svc.rpc('refresh_patch_project_mapping_view')
      if (error) {
        logger.warn({ err: error }, 'Failed to auto-refresh patch_project_mapping_view')
      } else {
        logger.info('Auto-refreshed patch_project_mapping_view after fallback')
      }
    } catch (e) {
      logger.warn({ err: e }, 'Failed to auto-refresh patch_project_mapping_view')
    }
  })()
}


