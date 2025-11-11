import { supabase } from '@/integrations/supabase/client';
import { normalizeEmployerName } from '@/lib/employers/normalize';
import type { CreateEmployerAliasRequest, EmployerAlias, BulkUpdateAliasesRequest } from './employerOperations';

export interface BulkCreateAliasesResult {
  successful: EmployerAlias[];
  failed: Array<{
    alias: string;
    employer_id: string;
    error: string;
  }>;
  skipped: Array<{
    alias: string;
    employer_id: string;
    reason: string;
  }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
}

export interface BulkUpdateAliasesResult {
  successful: EmployerAlias[];
  failed: Array<{
    id: string;
    error: string;
  }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

export interface BulkDeleteAliasesResult {
  successful: string[];
  failed: Array<{
    id: string;
    error: string;
  }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

/**
 * Bulk create multiple employer aliases efficiently
 * Optimized for performance with batch processing and duplicate detection
 */
export async function bulkCreateAliases(
  requests: CreateEmployerAliasRequest[],
  options: {
    batchSize?: number;
    skipDuplicates?: boolean;
    validateBeforeInsert?: boolean;
    userId?: string;
  } = {}
): Promise<BulkCreateAliasesResult> {
  const {
    batchSize = 50,
    skipDuplicates = true,
    validateBeforeInsert = true,
    userId
  } = options;

  const result: BulkCreateAliasesResult = {
    successful: [],
    failed: [],
    skipped: [],
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    skippedCount: 0
  };

  try {
    // Pre-process and normalize all aliases
    const normalizedRequests = requests.map(req => ({
      ...req,
      alias_normalized: normalizeEmployerName(req.alias).normalized,
      alias: req.alias.trim()
    }));

    // Group by employer for efficient duplicate checking
    const aliasesByEmployer = new Map<string, typeof normalizedRequests>();
    normalizedRequests.forEach(req => {
      if (!aliasesByEmployer.has(req.employer_id)) {
        aliasesByEmployer.set(req.employer_id, []);
      }
      aliasesByEmployer.get(req.employer_id)!.push(req);
    });

    // Process in batches to avoid overwhelming the database
    const requestBatches: CreateEmployerAliasRequest[][] = [];
    for (let i = 0; i < normalizedRequests.length; i += batchSize) {
      requestBatches.push(normalizedRequests.slice(i, i + batchSize));
    }

    for (const batch of requestBatches) {
      result.totalProcessed += batch.length;

      if (validateBeforeInsert) {
        // Validate batch for duplicates within the batch
        const batchValidation = await validateAliasBatch(batch);

        // Add duplicates to skipped
        result.skipped.push(...batchValidation.duplicates.map(dup => ({
          alias: dup.alias,
          employer_id: dup.employer_id,
          reason: 'Duplicate within batch'
        })));
        result.skippedCount += batchValidation.duplicates.length;

        // Process only unique aliases
        const uniqueAliases = batchValidation.unique;
        if (uniqueAliases.length === 0) continue;

        // Check for existing aliases in database
        const existingAliases = await checkExistingAliases(uniqueAliases);

        const toInsert: CreateEmployerAliasRequest[] = [];
        for (const req of uniqueAliases) {
          const existing = existingAliases.find(
            ext => ext.employer_id === req.employer_id &&
                   ext.alias_normalized === req.alias_normalized
          );

          if (existing) {
            if (skipDuplicates) {
              result.skipped.push({
                alias: req.alias,
                employer_id: req.employer_id,
                reason: 'Alias already exists'
              });
              result.skippedCount++;
            } else {
              result.failed.push({
                alias: req.alias,
                employer_id: req.employer_id,
                error: 'Alias already exists'
              });
              result.failureCount++;
            }
          } else {
            toInsert.push({
              ...req,
              created_by: userId || req.created_by,
              source_system: req.source_system || 'bulk_import',
              collected_at: new Date().toISOString()
            });
          }
        }

        if (toInsert.length === 0) continue;

        // Insert the batch
        const { data, error } = await supabase
          .from('employer_aliases')
          .insert(toInsert.map(req => ({
            alias: req.alias,
            alias_normalized: req.alias_normalized,
            employer_id: req.employer_id,
            source_system: req.source_system,
            source_identifier: req.source_identifier || req.alias,
            collected_at: req.collected_at,
            collected_by: req.collected_by,
            is_authoritative: req.is_authoritative !== undefined ? req.is_authoritative : true,
            notes: req.notes,
            created_by: req.created_by
          })))
          .select();

        if (error) {
          console.error('Bulk insert failed:', error);
          // Mark all as failed
          result.failed.push(...toInsert.map(req => ({
            alias: req.alias,
            employer_id: req.employer_id,
            error: error.message
          })));
          result.failureCount += toInsert.length;
        } else {
          result.successful.push(...(data || []));
          result.successCount += (data || []).length;
        }
      } else {
        // Skip validation, insert directly
        const { data, error } = await supabase
          .from('employer_aliases')
          .insert(batch.map(req => ({
            alias: req.alias,
            alias_normalized: req.alias_normalized,
            employer_id: req.employer_id,
            source_system: req.source_system || 'bulk_import',
            source_identifier: req.source_identifier || req.alias,
            collected_at: new Date().toISOString(),
            collected_by: req.collected_by,
            is_authoritative: req.is_authoritative !== undefined ? req.is_authoritative : true,
            notes: req.notes,
            created_by: userId || req.created_by
          })))
          .select();

        if (error) {
          console.error('Bulk insert failed:', error);
          result.failed.push(...batch.map(req => ({
            alias: req.alias,
            employer_id: req.employer_id,
            error: error.message
          })));
          result.failureCount += batch.length;
        } else {
          result.successful.push(...(data || []));
          result.successCount += (data || []).length;
        }
      }

      // Small delay between batches to be respectful of database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return result;
  } catch (error) {
    console.error('Unexpected error in bulk create aliases:', error);
    return {
      ...result,
      failed: [
        ...result.failed,
        ...requests.slice(result.totalProcessed - result.successCount - result.failureCount - result.skippedCount)
          .map(req => ({
            alias: req.alias,
            employer_id: req.employer_id,
            error: 'Unexpected error occurred'
          }))
      ]
    };
  }
}

/**
 * Bulk update multiple employer aliases
 */
export async function bulkUpdateAliases(
  request: BulkUpdateAliasesRequest,
  options: {
    batchSize?: number;
    validateBeforeUpdate?: boolean;
    userId?: string;
  } = {}
): Promise<BulkUpdateAliasesResult> {
  const {
    batchSize = 50,
    validateBeforeUpdate = true,
    userId
  } = options;

  const result: BulkUpdateAliasesResult = {
    successful: [],
    failed: [],
    totalProcessed: request.updates.length,
    successCount: 0,
    failureCount: 0
  };

  try {
    const updateBatches: typeof request.updates[] = [];
    for (let i = 0; i < request.updates.length; i += batchSize) {
      updateBatches.push(request.updates.slice(i, i + batchSize));
    }

    for (const batch of updateBatches) {
      if (validateBeforeUpdate) {
        // Validate each update
        const validUpdates = [];
        for (const update of batch) {
          // Validate that the alias exists
          const { data: existing, error: checkError } = await supabase
            .from('employer_aliases')
            .select('id')
            .eq('id', update.id)
            .single();

          if (checkError || !existing) {
            result.failed.push({
              id: update.id,
              error: 'Alias not found'
            });
            result.failureCount++;
            continue;
          }

          // If updating alias text, check for duplicates
          if (update.alias) {
            const normalizedAlias = normalizeEmployerName(update.alias).normalized;
            const { data: duplicate, error: dupError } = await supabase
              .from('employer_aliases')
              .select('id, employer_id')
              .eq('alias_normalized', normalizedAlias)
              .neq('id', update.id)
              .maybeSingle();

            if (dupError) {
              result.failed.push({
                id: update.id,
                error: 'Failed to validate alias uniqueness'
              });
              result.failureCount++;
              continue;
            }

            if (duplicate) {
              result.failed.push({
                id: update.id,
                error: 'This alias already exists for another employer'
              });
              result.failureCount++;
              continue;
            }
          }

          validUpdates.push({
            ...update,
            ...(update.alias ? {
              alias: update.alias.trim(),
              alias_normalized: normalizeEmployerName(update.alias).normalized
            } : {})
          });
        }

        if (validUpdates.length === 0) continue;

        // Perform batch update
        const updatePromises = validUpdates.map(async (update) => {
          const { data, error } = await supabase
            .from('employer_aliases')
            .update({
              alias: update.alias,
              alias_normalized: update.alias ? normalizeEmployerName(update.alias).normalized : undefined,
              is_authoritative: update.is_authoritative,
              notes: update.notes
            })
            .eq('id', update.id)
            .select()
            .single();

          return { data, error, id: update.id };
        });

        const updateResults = await Promise.all(updatePromises);

        updateResults.forEach(({ data, error, id }) => {
          if (error) {
            result.failed.push({
              id,
              error: error.message
            });
            result.failureCount++;
          } else {
            result.successful.push(data);
            result.successCount++;
          }
        });
      } else {
        // Skip validation, update directly
        const updatePromises = batch.map(async (update) => {
          const { data, error } = await supabase
            .from('employer_aliases')
            .update({
              alias: update.alias,
              alias_normalized: update.alias ? normalizeEmployerName(update.alias).normalized : undefined,
              is_authoritative: update.is_authoritative,
              notes: update.notes
            })
            .eq('id', update.id)
            .select()
            .single();

          return { data, error, id: update.id };
        });

        const updateResults = await Promise.all(updatePromises);

        updateResults.forEach(({ data, error, id }) => {
          if (error) {
            result.failed.push({
              id,
              error: error.message
            });
            result.failureCount++;
          } else {
            result.successful.push(data);
            result.successCount++;
          }
        });
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return result;
  } catch (error) {
    console.error('Unexpected error in bulk update aliases:', error);
    return result;
  }
}

/**
 * Bulk delete multiple employer aliases
 */
export async function bulkDeleteAliases(
  aliasIds: string[],
  options: {
    batchSize?: number;
    validateBeforeDelete?: boolean;
    userId?: string;
  } = {}
): Promise<BulkDeleteAliasesResult> {
  const {
    batchSize = 50,
    validateBeforeDelete = true,
    userId
  } = options;

  const result: BulkDeleteAliasesResult = {
    successful: [],
    failed: [],
    totalProcessed: aliasIds.length,
    successCount: 0,
    failureCount: 0
  };

  try {
    const deleteBatches: string[][] = [];
    for (let i = 0; i < aliasIds.length; i += batchSize) {
      deleteBatches.push(aliasIds.slice(i, i + batchSize));
    }

    for (const batch of deleteBatches) {
      if (validateBeforeDelete) {
        // Validate that all aliases exist
        const { data: existingAliases, error: checkError } = await supabase
          .from('employer_aliases')
          .select('id')
          .in('id', batch);

        if (checkError) {
          result.failed.push(...batch.map(id => ({
            id,
            error: 'Failed to validate alias existence'
          })));
          result.failureCount += batch.length;
          continue;
        }

        const existingIds = (existingAliases || []).map(a => a.id);
        const missingIds = batch.filter(id => !existingIds.includes(id));

        if (missingIds.length > 0) {
          result.failed.push(...missingIds.map(id => ({
            id,
            error: 'Alias not found'
          })));
          result.failureCount += missingIds.length;
        }

        const validIds = batch.filter(id => existingIds.includes(id));
        if (validIds.length === 0) continue;

        // Delete valid aliases
        const { error: deleteError } = await supabase
          .from('employer_aliases')
          .delete()
          .in('id', validIds);

        if (deleteError) {
          result.failed.push(...validIds.map(id => ({
            id,
            error: deleteError.message
          })));
          result.failureCount += validIds.length;
        } else {
          result.successful.push(...validIds);
          result.successCount += validIds.length;
        }
      } else {
        // Skip validation, delete directly
        const { error: deleteError } = await supabase
          .from('employer_aliases')
          .delete()
          .in('id', batch);

        if (deleteError) {
          result.failed.push(...batch.map(id => ({
            id,
            error: deleteError.message
          })));
          result.failureCount += batch.length;
        } else {
          result.successful.push(...batch);
          result.successCount += batch.length;
        }
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return result;
  } catch (error) {
    console.error('Unexpected error in bulk delete aliases:', error);
    return result;
  }
}

// Helper functions
async function validateAliasBatch(requests: CreateEmployerAliasRequest[]): Promise<{
  unique: CreateEmployerAliasRequest[];
  duplicates: CreateEmployerAliasRequest[];
}> {
  const seen = new Map<string, CreateEmployerAliasRequest>();
  const duplicates: CreateEmployerAliasRequest[] = [];

  requests.forEach(req => {
    const key = `${req.employer_id}:${req.alias_normalized}`;
    if (seen.has(key)) {
      duplicates.push(req);
    } else {
      seen.set(key, req);
    }
  });

  return {
    unique: Array.from(seen.values()),
    duplicates
  };
}

async function checkExistingAliases(requests: CreateEmployerAliasRequest[]): Promise<Array<{
  employer_id: string;
  alias_normalized: string;
}>> {
  if (requests.length === 0) return [];

  const checks = requests.map(req => ({
    employer_id: req.employer_id,
    alias_normalized: req.alias_normalized
  }));

  // Batch check existing aliases
  const { data, error } = await supabase
    .from('employer_aliases')
    .select('employer_id, alias_normalized')
    .or(checks.map(check =>
      `and(employer_id.eq.${check.employer_id},alias_normalized.eq.${check.alias_normalized})`
    ).join(','));

  return data || [];
}