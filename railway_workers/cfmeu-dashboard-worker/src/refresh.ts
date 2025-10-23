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

      // Refresh employers comprehensive view (primary view used by Railway worker)
      try {
        await svc.rpc('refresh_employers_comprehensive_view_logged', { p_triggered_by: 'worker-cron' })
        logger.info('✅ Refreshed employers_list_comprehensive')
      } catch (employerRefreshErr: any) {
        // Log as warning if employers view refresh fails, but don't break other refreshes
        if (employerRefreshErr?.message?.includes('does not exist')) {
          logger.debug('Employers comprehensive view not available yet, skipping')
        } else {
          logger.warn({ err: employerRefreshErr }, 'Failed to refresh employers comprehensive view')
        }
      }

      // Also refresh legacy employers_search_optimized if it exists (for backward compatibility)
      try {
        await svc.rpc('refresh_employers_search_view_logged', { p_triggered_by: 'worker-cron' })
        logger.info('✅ Refreshed employers_search_optimized (legacy)')
      } catch (legacyRefreshErr: any) {
        if (!legacyRefreshErr?.message?.includes('does not exist')) {
          logger.debug({ err: legacyRefreshErr }, 'Legacy employers view refresh skipped')
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


