import nodeCron from 'node-cron'
import type { Logger } from 'pino'
import { getServiceRoleClient } from './supabase'
import { config } from './config'

async function callOrganizingMetricsWarmEndpoint(logger: Logger) {
  if (!config.organizingMetricsWarmUrl || !config.organizingMetricsWarmToken) {
    logger.debug('Skipping organizing metrics warm-up (missing URL or token)')
    return
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const response = await fetch(config.organizingMetricsWarmUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.organizingMetricsWarmToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      const body = await response.text()
      logger.warn({ status: response.status, body }, 'Organizing metrics warm-up request failed')
    } else {
      logger.info('Organizing metrics warm-up successful')
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      logger.warn('Organizing metrics warm-up timed out')
    } else {
      logger.warn({ err }, 'Organizing metrics warm-up errored')
    }
  }
}

export function scheduleMaterializedViewRefreshes(logger: Logger) {
  const cron = config.refreshCron // default: every 10 minutes

  nodeCron.schedule(cron, async () => {
    const start = Date.now()
    const svc = getServiceRoleClient()
    try {
      // Refresh all materialized views
      await svc.rpc('refresh_patch_project_mapping_view')
      await svc.rpc('refresh_project_list_comprehensive_view')
      await svc.rpc('refresh_active_eba_employers')

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

export async function warmOrganizingMetricsCache(logger: Logger) {
  await callOrganizingMetricsWarmEndpoint(logger)
}

/**
 * Schedule weekly dashboard snapshots
 * Runs every Monday at 2 AM
 */
export function scheduleWeeklyDashboardSnapshots(logger: Logger) {
  // Cron: Every Monday at 2 AM (0 2 * * 1)
  const cron = config.dashboardSnapshotCron ?? '0 2 * * 1'

  nodeCron.schedule(cron, async () => {
    const start = Date.now()
    const svc = getServiceRoleClient()
    
    try {
      logger.info('Creating weekly dashboard snapshot...')
      
      // Call the create_dashboard_snapshot function
      const { data: snapshotId, error } = await svc.rpc('create_dashboard_snapshot', {
        p_snapshot_date: new Date().toISOString().split('T')[0], // Today's date as YYYY-MM-DD
        p_snapshot_type: 'weekly',
      })

      if (error) {
        logger.error({ err: error }, 'Failed to create dashboard snapshot')
        return
      }

      const ms = Date.now() - start
      logger.info({ snapshotId, ms }, '✅ Created weekly dashboard snapshot')
    } catch (err) {
      logger.error({ err }, 'Failed to create dashboard snapshot')
    }
  })

  logger.info({ cron }, 'Scheduled weekly dashboard snapshots')
}


