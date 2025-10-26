/**
 * Real-time Database Triggers System
 * Manages database triggers and functions for real-time data synchronization
 */

import { supabase } from '@/integrations/supabase/client';
import { incrementalSync } from './IncrementalSync';

export interface TriggerDefinition {
  name: string;
  table: string;
  events: Array<'INSERT' | 'UPDATE' | 'DELETE'>;
  functionName: string;
  enabled: boolean;
  priority: number;
  conditions?: string;
}

export interface TriggerFunction {
  name: string;
  schema: string;
  language: 'sql' | 'plpgsql';
  code: string;
  parameters?: string;
  returns: string;
}

export interface TriggerEvent {
  id: string;
  tableName: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  recordId: string;
  oldData?: any;
  newData?: any;
  changedFields?: string[];
  timestamp: string;
  processed: boolean;
  error?: string;
}

export class RealtimeTriggers {
  private triggerDefinitions: Map<string, TriggerDefinition> = new Map();
  private triggerFunctions: Map<string, TriggerFunction> = new Map();

  /**
   * Initialize real-time triggers system
   */
  async initialize(): Promise<void> {
    console.log('Initializing Real-time Triggers system...');

    try {
      // Create trigger functions
      await this.createTriggerFunctions();

      // Create database triggers
      await this.createDatabaseTriggers();

      // Load existing trigger definitions
      await this.loadTriggerDefinitions();

      // Test trigger functionality
      await this.testTriggers();

      console.log('Real-time Triggers system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Real-time Triggers system:', error);
      throw error;
    }
  }

  /**
   * Create all necessary trigger functions
   */
  private async createTriggerFunctions(): Promise<void> {
    console.log('Creating trigger functions...');

    const functions: TriggerFunction[] = [
      {
        name: 'log_sync_event',
        schema: 'public',
        language: 'plpgsql',
        parameters: 'p_table_name TEXT, p_operation TEXT, p_record_id TEXT, p_old_data JSONB, p_new_data JSONB',
        returns: 'void',
        code: `
          DECLARE
            v_changed_fields TEXT[];
            v_event_id TEXT;
          BEGIN
            -- Generate unique event ID
            v_event_id := 'sync_event_' || EXTRACT(EPOCH FROM NOW())::TEXT || '_' || substr(md5(random()::TEXT), 1, 8);

            -- Determine changed fields for updates
            IF p_operation = 'UPDATE' AND p_old_data IS NOT NULL AND p_new_data IS NOT NULL THEN
              SELECT ARRAY_AGG(key) INTO v_changed_fields
              FROM jsonb_object_keys(p_new_data) AS key
              WHERE p_new_data ->> key IS DISTINCT FROM p_old_data ->> key;
            END IF;

            -- Insert sync event
            INSERT INTO public.sync_events (
              event_id,
              table_name,
              operation,
              record_id,
              old_data,
              new_data,
              changed_fields,
              event_timestamp,
              processed
            ) VALUES (
              v_event_id,
              p_table_name,
              p_operation,
              p_record_id,
              p_old_data,
              p_new_data,
              COALESCE(v_changed_fields, ARRAY[]::TEXT[]),
              NOW(),
              false
            );

            -- Log to audit trail
            INSERT INTO public.audit_logs (
              id,
              migration_id,
              action,
              actor,
              object_type,
              object_id,
              new_values,
              timestamp
            ) VALUES (
              'audit_' || v_event_id,
              v_event_id,
              'realtime_data_change',
              'trigger_system',
              'data_change',
              p_record_id,
              jsonb_build_object(
                'table_name', p_table_name,
                'operation', p_operation,
                'old_data', p_old_data,
                'new_data', p_new_data,
                'changed_fields', v_changed_fields
              ),
              NOW()
            );

            EXCEPTION WHEN OTHERS THEN
              -- Log error but don't fail the operation
              INSERT INTO public.sync_errors (
                id,
                table_name,
                record_id,
                operation,
                error_message,
                error_timestamp
              ) VALUES (
                'error_' || v_event_id,
                p_table_name,
                p_record_id,
                p_operation,
                SQLERRM,
                NOW()
              );
          END;
        `
      },
      {
        name: 'recalculate_employer_rating',
        schema: 'public',
        language: 'plpgsql',
        parameters: 'p_employer_id TEXT',
        returns: 'void',
        code: `
          DECLARE
            v_rating_id TEXT;
            v_new_rating TEXT;
            v_scores JSONB;
          BEGIN
            -- Calculate new rating scores
            SELECT
              jsonb_build_object(
                'eba_compliance', COALESCE(c.eba_compliance_score, 0),
                'cbus_compliance', COALESCE(c.cbus_compliance_score, 0),
                'incolink_compliance', COALESCE(c.incolink_compliance_score, 0),
                'site_visit_score', COALESCE(s.site_visit_score, 0),
                'historical_performance', COALESCE(h.historical_performance_score, 0),
                'worker_welfare', COALESCE(w.worker_welfare_score, 0)
              ) INTO v_scores
            FROM (
              SELECT
                (SELECT AVG(eba_compliance_score) FROM eba_rating_factors WHERE employer_id = p_employer_id) as eba_compliance_score,
                (SELECT AVG(compliance_score) FROM compliance_rating_factors WHERE employer_id = p_employer_id AND factor_type = 'cbus') as cbus_compliance_score,
                (SELECT AVG(compliance_score) FROM compliance_rating_factors WHERE employer_id = p_employer_id AND factor_type = 'incolink') as incolink_compliance_score,
                (SELECT AVG(impact_score) FROM site_visit_rating_impacts WHERE employer_id = p_employer_id AND visit_date >= NOW() - INTERVAL '6 months') as site_visit_score,
                70 as historical_performance_score, -- Placeholder
                80 as worker_welfare_score -- Placeholder
            ) c, (
              SELECT 1 as dummy
            ) s, (
              SELECT 1 as dummy
            ) h, (
              SELECT 1 as dummy
            ) w;

            -- Determine rating based on weighted average
            IF (v_scores->>'eba_compliance')::NUMERIC >= 80 AND
               (v_scores->>'cbus_compliance')::NUMERIC >= 80 AND
               (v_scores->>'incolink_compliance')::NUMERIC >= 80 THEN
              v_new_rating := 'green';
            ELSIF (v_scores->>'eba_compliance')::NUMERIC >= 60 AND
                  (v_scores->>'cbus_compliance')::NUMERIC >= 60 AND
                  (v_scores->>'incolink_compliance')::NUMERIC >= 60 THEN
              v_new_rating := 'amber';
            ELSE
              v_new_rating := 'red';
            END IF;

            -- Update employer final rating
            INSERT INTO public.employer_final_ratings (
              id,
              employer_id,
              overall_rating,
              eba_compliance_score,
              cbus_compliance_score,
              incolink_compliance_score,
              site_visit_score,
              historical_performance_score,
              worker_welfare_score,
              last_updated,
              data_quality_score
            ) VALUES (
              'rating_' || p_employer_id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT,
              p_employer_id,
              v_new_rating,
              (v_scores->>'eba_compliance')::NUMERIC,
              (v_scores->>'cbus_compliance')::NUMERIC,
              (v_scores->>'incolink_compliance')::NUMERIC,
              (v_scores->>'site_visit_score')::NUMERIC,
              (v_scores->>'historical_performance')::NUMERIC,
              (v_scores->>'worker_welfare')::NUMERIC,
              NOW(),
              85 -- Placeholder quality score
            )
            ON CONFLICT (employer_id)
            DO UPDATE SET
              overall_rating = EXCLUDED.overall_rating,
              eba_compliance_score = EXCLUDED.eba_compliance_score,
              cbus_compliance_score = EXCLUDED.cbus_compliance_score,
              incolink_compliance_score = EXCLUDED.incolink_compliance_score,
              site_visit_score = EXCLUDED.site_visit_score,
              historical_performance_score = EXCLUDED.historical_performance_score,
              worker_welfare_score = EXCLUDED.worker_welfare_score,
              last_updated = EXCLUDED.last_updated,
              data_quality_score = EXCLUDED.data_quality_score;

            -- Log rating recalculation
            INSERT INTO public.rating_recalculation_log (
              id,
              employer_id,
              previous_rating,
              new_rating,
              calculation_details,
              recalculated_at
            ) VALUES (
              'rating_log_' || p_employer_id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT,
              p_employer_id,
              (SELECT overall_rating FROM employer_final_ratings WHERE employer_id = p_employer_id),
              v_new_rating,
              v_scores,
              NOW()
            )
            ON CONFLICT (id) DO NOTHING;

          END;
        `
      },
      {
        name: 'update_project_impact_scores',
        schema: 'public',
        language: 'plpgsql',
        parameters: 'p_project_id TEXT',
        returns: 'void',
        code: `
          DECLARE
            employer_record RECORD;
            impact_score NUMERIC;
          BEGIN
            -- Update impact scores for all employers on this project
            FOR employer_record IN
              SELECT DISTINCT employer_id
              FROM project_assignments
              WHERE project_id = p_project_id
            LOOP
              -- Calculate new impact score based on project changes
              SELECT COALESCE(
                (SELECT AVG(impact_score)
                 FROM project_compliance_impacts
                 WHERE project_id = p_project_id AND employer_id = employer_record.employer_id),
                50
              ) INTO impact_score;

              -- Update site visit impacts if this affects site visit scores
              UPDATE site_visit_rating_impacts
              SET impact_score = GREATEST(impact_score, impact_score * 1.1),
                  updated_at = NOW()
              WHERE employer_id = employer_record.employer_id
                AND project_id = p_project_id;

              -- Trigger rating recalculation
              PERFORM recalculate_employer_rating(employer_record.employer_id);
            END LOOP;
          END;
        `
      },
      {
        name: 'handle_employer_data_change',
        schema: 'public',
        language: 'plpgsql',
        parameters: 'p_employer_id TEXT, p_operation TEXT',
        returns: 'void',
        code: `
          BEGIN
            -- Handle employer data changes
            CASE p_operation
              WHEN 'INSERT' THEN
                -- New employer - initialize rating factors
                INSERT INTO eba_rating_factors (
                  employer_id, eba_status, coverage_level, worker_count,
                  compliance_score, last_verified, verification_source
                ) VALUES (
                  p_employer_id, 'none', 0, 10, 0, NOW(), 'system_default'
                )
                ON CONFLICT (employer_id) DO NOTHING;

                INSERT INTO compliance_rating_factors (
                  employer_id, factor_type, score, weight, last_checked, status
                )
                SELECT p_employer_id, factor_type, 0, 0.2, NOW(), 'inactive'
                FROM unnest(ARRAY['cbus', 'incolink', 'workers_comp', 'tax', 'super']) AS factor_type
                ON CONFLICT (employer_id, factor_type) DO NOTHING;

              WHEN 'UPDATE' THEN
                -- Employer updated - check if rating recalculation is needed
                IF EXISTS (
                  SELECT 1 FROM sync_events
                  WHERE table_name = 'employers'
                    AND record_id = p_employer_id
                    AND processed = false
                    AND changed_fields && ARRAY['name', 'employer_type', 'enterprise_agreement_status']
                ) THEN
                  PERFORM recalculate_employer_rating(p_employer_id);
                END IF;

              WHEN 'DELETE' THEN
                -- Employer deleted - archive related data
                UPDATE employer_final_ratings
                SET overall_rating = 'archived',
                    last_updated = NOW()
                WHERE employer_id = p_employer_id;
            END CASE;
          END;
        `
      }
    ];

    for (const func of functions) {
      try {
        await this.createFunction(func);
        this.triggerFunctions.set(func.name, func);
        console.log(`Created trigger function: ${func.name}`);
      } catch (error) {
        console.error(`Failed to create function ${func.name}:`, error);
      }
    }
  }

  /**
   * Create database triggers for all monitored tables
   */
  private async createDatabaseTriggers(): Promise<void> {
    console.log('Creating database triggers...');

    const triggers: TriggerDefinition[] = [
      {
        name: 'employers_trigger',
        table: 'employers',
        events: ['INSERT', 'UPDATE', 'DELETE'],
        functionName: 'log_sync_event',
        enabled: true,
        priority: 100
      },
      {
        name: 'projects_trigger',
        table: 'projects',
        events: ['INSERT', 'UPDATE', 'DELETE'],
        functionName: 'log_sync_event',
        enabled: true,
        priority: 90
      },
      {
        name: 'project_assignments_trigger',
        table: 'project_assignments',
        events: ['INSERT', 'UPDATE', 'DELETE'],
        functionName: 'log_sync_event',
        enabled: true,
        priority: 85
      },
      {
        name: 'compliance_checks_trigger',
        table: 'compliance_checks',
        events: ['INSERT', 'UPDATE'],
        functionName: 'log_sync_event',
        enabled: true,
        priority: 80
      },
      {
        name: 'site_visits_trigger',
        table: 'site_visits',
        events: ['INSERT', 'UPDATE'],
        functionName: 'log_sync_event',
        enabled: true,
        priority: 75
      },
      {
        name: 'company_eba_records_trigger',
        table: 'company_eba_records',
        events: ['INSERT', 'UPDATE', 'DELETE'],
        functionName: 'log_sync_event',
        enabled: true,
        priority: 70
      },
      {
        name: 'employer_rating_recalc_trigger',
        table: 'employers',
        events: ['UPDATE'],
        functionName: 'recalculate_employer_rating',
        enabled: true,
        priority: 60,
        conditions: "WHEN (NEW.enterprise_agreement_status IS DISTINCT FROM OLD.enterprise_agreement_status)"
      },
      {
        name: 'project_impact_trigger',
        table: 'projects',
        events: ['UPDATE'],
        functionName: 'update_project_impact_scores',
        enabled: true,
        priority: 50,
        conditions: "WHEN (NEW.status IS DISTINCT FROM OLD.status OR NEW.value IS DISTINCT FROM OLD.value)"
      }
    ];

    for (const trigger of triggers) {
      try {
        await this.createTrigger(trigger);
        this.triggerDefinitions.set(trigger.name, trigger);
        console.log(`Created database trigger: ${trigger.name}`);
      } catch (error) {
        console.error(`Failed to create trigger ${trigger.name}:`, error);
      }
    }
  }

  /**
   * Create a trigger function
   */
  private async createFunction(func: TriggerFunction): Promise<void> {
    const dropSql = `DROP FUNCTION IF EXISTS ${func.schema}.${func.name}(${func.parameters || ''});`;
    const createSql = `
      CREATE OR REPLACE FUNCTION ${func.schema}.${func.name}(${func.parameters || ''})
      RETURNS ${func.returns}
      LANGUAGE ${func.language}
      SECURITY DEFINER
      AS $$
        ${func.code}
      $$;
    `;

    try {
      await supabase.rpc('execute_sql', { sql: dropSql });
      await supabase.rpc('execute_sql', { sql: createSql });
    } catch (error) {
      throw new Error(`Failed to create function ${func.name}: ${error}`);
    }
  }

  /**
   * Create a database trigger
   */
  private async createTrigger(trigger: TriggerDefinition): Promise<void> {
    const dropSql = `DROP TRIGGER IF EXISTS ${trigger.name} ON public.${trigger.table};`;
    const createSql = `
      CREATE TRIGGER ${trigger.name}
      AFTER ${trigger.events.join(' OR ')}
      ON public.${trigger.table}
      FOR EACH ROW
      ${trigger.conditions || ''}
      EXECUTE FUNCTION ${trigger.functionName}(
        '${trigger.table}',
        CASE
          WHEN TG_OP = 'INSERT' THEN 'INSERT'
          WHEN TG_OP = 'UPDATE' THEN 'UPDATE'
          WHEN TG_OP = 'DELETE' THEN 'DELETE'
        END,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END::jsonb,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END::jsonb
      );
    `;

    try {
      await supabase.rpc('execute_sql', { sql: dropSql });
      await supabase.rpc('execute_sql', { sql: createSql });
    } catch (error) {
      throw new Error(`Failed to create trigger ${trigger.name}: ${error}`);
    }
  }

  /**
   * Load existing trigger definitions from database
   */
  private async loadTriggerDefinitions(): Promise<void> {
    try {
      const { data: triggers } = await supabase
        .from('database_triggers')
        .select('*');

      if (triggers) {
        for (const trigger of triggers) {
          this.triggerDefinitions.set(trigger.name, trigger);
        }
      }

      console.log(`Loaded ${this.triggerDefinitions.size} trigger definitions`);
    } catch (error) {
      console.warn('Could not load trigger definitions from database:', error);
    }
  }

  /**
   * Test trigger functionality
   */
  private async testTriggers(): Promise<void> {
    console.log('Testing trigger functionality...');

    try {
      // Test that trigger functions exist and are callable
      await supabase.rpc('log_sync_event', {
        p_table_name: 'test',
        p_operation: 'TEST',
        p_record_id: 'test_id',
        p_old_data: null,
        p_new_data: null
      });

      console.log('Trigger test completed successfully');
    } catch (error) {
      console.error('Trigger test failed:', error);
    }
  }

  /**
   * Enable or disable a trigger
   */
  async setTriggerEnabled(triggerName: string, enabled: boolean): Promise<void> {
    const trigger = this.triggerDefinitions.get(triggerName);
    if (!trigger) {
      throw new Error(`Trigger not found: ${triggerName}`);
    }

    const sql = enabled
      ? `ALTER TABLE public.${trigger.table} ENABLE TRIGGER ${triggerName};`
      : `ALTER TABLE public.${trigger.table} DISABLE TRIGGER ${triggerName};`;

    try {
      await supabase.rpc('execute_sql', { sql });
      trigger.enabled = enabled;
      console.log(`${enabled ? 'Enabled' : 'Disabled'} trigger: ${triggerName}`);
    } catch (error) {
      throw new Error(`Failed to ${enabled ? 'enable' : 'disable'} trigger ${triggerName}: ${error}`);
    }
  }

  /**
   * Add a new trigger
   */
  async addTrigger(trigger: TriggerDefinition): Promise<void> {
    try {
      await this.createTrigger(trigger);
      this.triggerDefinitions.set(trigger.name, trigger);

      // Store in database for persistence
      await supabase
        .from('database_triggers')
        .upsert({
          name: trigger.name,
          table: trigger.table,
          events: trigger.events,
          function_name: trigger.functionName,
          enabled: trigger.enabled,
          priority: trigger.priority,
          conditions: trigger.conditions || null,
          created_at: new Date().toISOString()
        });

      console.log(`Added new trigger: ${trigger.name}`);
    } catch (error) {
      throw new Error(`Failed to add trigger ${trigger.name}: ${error}`);
    }
  }

  /**
   * Remove a trigger
   */
  async removeTrigger(triggerName: string): Promise<void> {
    const trigger = this.triggerDefinitions.get(triggerName);
    if (!trigger) {
      throw new Error(`Trigger not found: ${triggerName}`);
    }

    const sql = `DROP TRIGGER IF EXISTS ${triggerName} ON public.${trigger.table};`;

    try {
      await supabase.rpc('execute_sql', { sql });
      this.triggerDefinitions.delete(triggerName);

      // Remove from database
      await supabase
        .from('database_triggers')
        .delete()
        .eq('name', triggerName);

      console.log(`Removed trigger: ${triggerName}`);
    } catch (error) {
      throw new Error(`Failed to remove trigger ${triggerName}: ${error}`);
    }
  }

  /**
   * Get trigger statistics
   */
  async getTriggerStatistics(): Promise<{
    totalTriggers: number;
    enabledTriggers: number;
    disabledTriggers: number;
    triggerEventsLast24h: number;
    errorCountLast24h: number;
    triggersByTable: Record<string, number>;
  }> {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        { count: totalEvents },
        { count: errorCount },
        { data: triggerEvents }
      ] = await Promise.all([
        supabase
          .from('sync_events')
          .select('*', { count: 'exact', head: true })
          .gte('event_timestamp', yesterday.toISOString()),
        supabase
          .from('sync_errors')
          .select('*', { count: 'exact', head: true })
          .gte('error_timestamp', yesterday.toISOString()),
        supabase
          .from('sync_events')
          .select('table_name')
          .gte('event_timestamp', yesterday.toISOString())
      ]);

      const triggersByTable: Record<string, number> = {};
      if (triggerEvents) {
        for (const event of triggerEvents) {
          triggersByTable[event.table_name] = (triggersByTable[event.table_name] || 0) + 1;
        }
      }

      return {
        totalTriggers: this.triggerDefinitions.size,
        enabledTriggers: Array.from(this.triggerDefinitions.values()).filter(t => t.enabled).length,
        disabledTriggers: Array.from(this.triggerDefinitions.values()).filter(t => !t.enabled).length,
        triggerEventsLast24h: totalEvents || 0,
        errorCountLast24h: errorCount || 0,
        triggersByTable
      };

    } catch (error) {
      console.error('Error getting trigger statistics:', error);
      return {
        totalTriggers: this.triggerDefinitions.size,
        enabledTriggers: 0,
        disabledTriggers: 0,
        triggerEventsLast24h: 0,
        errorCountLast24h: 0,
        triggersByTable: {}
      };
    }
  }

  /**
   * Force trigger execution for testing
   */
  async testTriggerExecution(triggerName: string, testData: any): Promise<boolean> {
    const trigger = this.triggerDefinitions.get(triggerName);
    if (!trigger) {
      throw new Error(`Trigger not found: ${triggerName}`);
    }

    try {
      // Insert test data to trigger the trigger
      const { error } = await supabase
        .from(trigger.table)
        .insert(testData);

      if (error) {
        throw error;
      }

      // Check if trigger fired by looking for sync events
      const { data: events } = await supabase
        .from('sync_events')
        .select('*')
        .eq('table_name', trigger.table)
        .order('event_timestamp', { ascending: false })
        .limit(1);

      // Clean up test data
      await supabase
        .from(trigger.table)
        .delete()
        .eq('id', testData.id);

      return (events?.length || 0) > 0;

    } catch (error) {
      console.error(`Error testing trigger ${triggerName}:`, error);
      return false;
    }
  }

  /**
   * Get trigger health status
   */
  async getTriggerHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: Array<{
      trigger: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  }> {
    const issues: Array<{
      trigger: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    try {
      // Check for recent trigger errors
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const { data: recentErrors } = await supabase
        .from('sync_errors')
        .select('*')
        .gte('error_timestamp', oneHourAgo.toISOString());

      if (recentErrors && recentErrors.length > 0) {
        const errorCounts = recentErrors.reduce((acc, error) => {
          acc[error.table_name] = (acc[error.table_name] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        for (const [table, count] of Object.entries(errorCounts)) {
          const trigger = Array.from(this.triggerDefinitions.values())
            .find(t => t.table === table);

          if (trigger) {
            issues.push({
              trigger: trigger.name,
              issue: `${count} errors in the last hour`,
              severity: count > 10 ? 'high' : count > 5 ? 'medium' : 'low'
            });
          }
        }
      }

      // Check for disabled critical triggers
      const criticalTriggers = ['employers_trigger', 'compliance_checks_trigger', 'company_eba_records_trigger'];
      for (const triggerName of criticalTriggers) {
        const trigger = this.triggerDefinitions.get(triggerName);
        if (trigger && !trigger.enabled) {
          issues.push({
            trigger: triggerName,
            issue: 'Critical trigger is disabled',
            severity: 'high'
          });
        }
      }

      // Check for stale triggers (no events in last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { data: recentEvents } = await supabase
        .from('sync_events')
        .select('table_name')
        .gte('event_timestamp', oneDayAgo.toISOString())
        .distinct();

      const activeTables = new Set(recentEvents?.map(e => e.table_name) || []);

      for (const trigger of this.triggerDefinitions.values()) {
        if (trigger.enabled && !activeTables.has(trigger.table)) {
          // Check if table has any data
          const { count } = await supabase
            .from(trigger.table)
            .select('*', { count: 'exact', head: true });

          if (count && count > 0) {
            issues.push({
              trigger: trigger.name,
              issue: 'No trigger events detected in 24 hours for table with data',
              severity: 'medium'
            });
          }
        }
      }

      // Determine overall health
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (issues.some(i => i.severity === 'high')) {
        status = 'unhealthy';
      } else if (issues.some(i => i.severity === 'medium')) {
        status = 'degraded';
      }

      return { status, issues };

    } catch (error) {
      console.error('Error checking trigger health:', error);
      return {
        status: 'unhealthy',
        issues: [{
          trigger: 'system',
          issue: 'Unable to check trigger health',
          severity: 'high'
        }]
      };
    }
  }

  /**
   * Create supporting tables for triggers
   */
  async createSupportingTables(): Promise<void> {
    const tables = [
      // Sync events table
      `
        CREATE TABLE IF NOT EXISTS sync_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_id TEXT UNIQUE NOT NULL,
          table_name TEXT NOT NULL,
          operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
          record_id TEXT NOT NULL,
          old_data JSONB,
          new_data JSONB,
          changed_fields TEXT[],
          event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          processed BOOLEAN DEFAULT FALSE,
          processed_at TIMESTAMP WITH TIME ZONE,
          error TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_sync_events_table_processed
          ON sync_events(table_name, processed, event_timestamp);
        CREATE INDEX IF NOT EXISTS idx_sync_events_record
          ON sync_events(table_name, record_id);
      `,
      // Sync errors table
      `
        CREATE TABLE IF NOT EXISTS sync_errors (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          error_id TEXT UNIQUE NOT NULL,
          table_name TEXT NOT NULL,
          record_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          error_message TEXT NOT NULL,
          error_details JSONB,
          error_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          resolved BOOLEAN DEFAULT FALSE,
          resolved_at TIMESTAMP WITH TIME ZONE
        );

        CREATE INDEX IF NOT EXISTS idx_sync_errors_table_resolved
          ON sync_errors(table_name, resolved, error_timestamp);
      `,
      // Database triggers table
      `
        CREATE TABLE IF NOT EXISTS database_triggers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT UNIQUE NOT NULL,
          table_name TEXT NOT NULL,
          events TEXT[] NOT NULL,
          function_name TEXT NOT NULL,
          enabled BOOLEAN DEFAULT TRUE,
          priority INTEGER DEFAULT 0,
          conditions TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_database_triggers_table_enabled
          ON database_triggers(table_name, enabled);
      `,
      // Rating recalculation log
      `
        CREATE TABLE IF NOT EXISTS rating_recalculation_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          employer_id TEXT NOT NULL,
          previous_rating TEXT,
          new_rating TEXT NOT NULL,
          calculation_details JSONB,
          recalculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          trigger_reason TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_rating_recalc_employer
          ON rating_recalculation_log(employer_id, recalculated_at);
      `
    ];

    for (const tableSql of tables) {
      try {
        await supabase.rpc('execute_sql', { sql: tableSql });
      } catch (error) {
        console.error('Error creating supporting table:', error);
      }
    }
  }
}

// Export singleton instance
export const realtimeTriggers = new RealtimeTriggers();