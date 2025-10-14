import { useMemo } from 'react'

type AliasEventBase = {
  employerId: string
  alias: string
  normalized: string
  sourceSystem?: string
  sourceIdentifier?: string | null
  projectId?: string | null
  csvRole?: string | null
  collectedBy?: string | null
  notes?: string | null
}

export type AliasInsertEvent = AliasEventBase

export type AliasConflictEvent = AliasEventBase & {
  conflictReason?: string
  conflictingEmployers?: Array<{
    employerId: string
    employerName?: string | null
  }>
}

export type AliasFailureEvent = AliasEventBase & {
  error: Error
}

export type AliasSearchEvent = {
  query: string
  matchMode?: string
  includeAliases: boolean
  resultCount: number
  responseTimeMs: number
  hasAliasMatches?: boolean
}

type AliasTelemetryOptions = {
  scope?: string
  actorId?: string | null
  emitter?: {
    info?: typeof console.info
    warn?: typeof console.warn
    error?: typeof console.error
  }
}

const DEFAULT_SCOPE = 'alias_flow'

export function useAliasTelemetry(options: AliasTelemetryOptions = {}): AliasTelemetry {
  const { scope = DEFAULT_SCOPE, actorId = null, emitter } = options
  const info = emitter?.info ?? console.info
  const warn = emitter?.warn ?? console.warn
  const error = emitter?.error ?? console.error

  return useMemo(() => {
    const base = {
      scope,
      actorId,
    }

    return {
      logInsert(event: AliasInsertEvent) {
        info('alias.insert', {
          ...base,
          timestamp: new Date().toISOString(),
          ...event,
        })
      },
      logConflict(event: AliasConflictEvent) {
        warn('alias.conflict', {
          ...base,
          timestamp: new Date().toISOString(),
          ...event,
        })
      },
      logFailure(event: AliasFailureEvent) {
        error('alias.failure', {
          ...base,
          timestamp: new Date().toISOString(),
          ...event,
          errorMessage: event.error?.message ?? 'Unknown alias telemetry failure',
        })
      },
      logSearchQuery(event: AliasSearchEvent) {
        info('alias.search', {
          ...base,
          timestamp: new Date().toISOString(),
          ...event,
        })
      },
    }
  }, [actorId, scope, info, warn, error])
}

type AliasTelemetry = {
  logInsert: (event: AliasInsertEvent) => void
  logConflict: (event: AliasConflictEvent) => void
  logFailure: (event: AliasFailureEvent) => void
  logSearchQuery: (event: AliasSearchEvent) => void
}

