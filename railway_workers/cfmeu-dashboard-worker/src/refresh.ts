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
      // Refresh all materialized views
      await svc.rpc('refresh_patch_project_mapping_view')
      await svc.rpc('refresh_project_list_comprehensive_view')

      // Also refresh employers_search_optimized if the function exists
      try {
        await svc.rpc('refresh_employers_search_view_logged', { p_triggered_by: 'worker-cron' })
      } catch (employerRefreshErr: any) {
        // Log as warning if employers view refresh fails, but don't break other refreshes
        if (employerRefreshErr?.message?.includes('does not exist')) {
          logger.debug('Employers search view not available, skipping')
        } else {
          logger.warn({ err: employerRefreshErr }, 'Failed to refresh employers search view')
        }
      }

      const ms = Date.now() - start
      logger.info({ ms }, 'Refreshed materialized views')
    } catch (err) {
      logger.error({ err }, 'Failed to refresh materialized views')
    }
  })

  logger.info({ cron }, 'Scheduled materialized view refreshes')
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


