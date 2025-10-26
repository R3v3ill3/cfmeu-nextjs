// Performance Optimization Utilities and Caching Strategies for the Rating Calculation Engine

import {
  TrafficLightRating,
  ConfidenceLevel,
  FinalRatingResult
} from '../types/RatingTypes';
import {
  CalculationContext,
  CalculationConfig,
  PerformanceMetrics,
  ProcessingStats,
  CacheStrategy,
  LogLevel
} from '../types/CalculationTypes';

// =============================================================================
// PERFORMANCE OPTIMIZATION INTERFACES
// =============================================================================

export interface IPerformanceOptimizer {
  optimizeCalculation(
    calculation: () => Promise<any>,
    context: CalculationContext,
    options?: OptimizationOptions
  ): Promise<any>;
  monitorPerformance<T>(operation: () => T, operationName: string): T;
  getPerformanceMetrics(): Promise<PerformanceMetrics>;
  resetMetrics(): void;
  enableProfiling(enabled: boolean): void;
}

export interface ICacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  getStats(): Promise<CacheStats>;
  warmup(keys: string[]): Promise<void>;
  cleanup(): Promise<void>;
}

export interface IBatchProcessor {
  processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options?: BatchProcessingOptions
  ): Promise<R[]>;
  processBatchWithProgress<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options?: BatchProcessingOptions
  ): Promise<{ results: R[]; progress: BatchProgress }>;
}

// =============================================================================
// PERFORMANCE OPTIMIZATION OPTIONS
// =============================================================================

export interface OptimizationOptions {
  enable_caching?: boolean;
  cache_ttl?: number;
  enable_parallel_processing?: boolean;
  max_concurrency?: number;
  enable_memory_optimization?: boolean;
  memory_limit_mb?: number;
  enable_fast_path?: boolean;
  timeout_ms?: number;
  retry_attempts?: number;
  enable_compression?: boolean;
}

export interface BatchProcessingOptions {
  batch_size?: number;
  max_concurrency?: number;
  progress_callback?: (progress: BatchProgress) => void;
  error_handling?: 'fail_fast' | 'collect_errors' | 'retry';
  retry_attempts?: number;
  retry_delay_ms?: number;
  enable_detailed_progress?: boolean;
}

export interface BatchProgress {
  total_items: number;
  processed_items: number;
  failed_items: number;
  success_rate: number;
  estimated_completion?: Date;
  current_batch?: number;
  total_batches?: number;
  items_per_second?: number;
  eta_seconds?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hit_rate: number;
  total_requests: number;
  memory_usage_bytes: number;
  evictions: number;
  expired_items: number;
  oldest_item_age_ms: number;
  newest_item_age_ms: number;
}

// =============================================================================
// PERFORMANCE OPTIMIZER IMPLEMENTATION
// =============================================================================

export class PerformanceOptimizer implements IPerformanceOptimizer {
  private metrics: PerformanceMetrics;
  private cacheManager: ICacheManager;
  private batchProcessor: IBatchProcessor;
  private profilingEnabled: boolean = false;
  private operationTimes: Map<string, number[]> = new Map();

  constructor(
    cacheManager?: ICacheManager,
    batchProcessor?: IBatchProcessor
  ) {
    this.metrics = this.initializeMetrics();
    this.cacheManager = cacheManager || new MemoryCacheManager();
    this.batchProcessor = batchProcessor || new BatchProcessor();
  }

  async optimizeCalculation<T>(
    calculation: () => Promise<T>,
    context: CalculationContext,
    options: OptimizationOptions = {}
  ): Promise<T> {
    const startTime = Date.now();
    const operationId = this.generateOperationId(context);

    try {
      // Check if fast path is enabled and applicable
      if (options.enable_fast_path && this.canUseFastPath(context, options)) {
        return this.executeFastPath(calculation, context, operationId);
      }

      // Check cache first
      if (options.enable_caching !== false) {
        const cacheKey = this.generateCacheKey(context, options);
        const cached = await this.cacheManager.get<T>(cacheKey);
        if (cached) {
          this.recordMetrics(operationId, 'cache_hit', Date.now() - startTime);
          return cached;
        }
      }

      // Execute calculation with monitoring
      const result = await this.monitorPerformance(async () => {
        return await this.executeCalculationWithOptimizations(calculation, context, options);
      }, operationId);

      // Cache result if enabled
      if (options.enable_caching !== false) {
        const cacheKey = this.generateCacheKey(context, options);
        await this.cacheManager.set(cacheKey, result, options.cache_ttl);
      }

      this.recordMetrics(operationId, 'success', Date.now() - startTime);
      return result;

    } catch (error) {
      this.recordMetrics(operationId, 'error', Date.now() - startTime);
      throw error;
    }
  }

  monitorPerformance<T>(operation: () => T, operationName: string): T {
    if (!this.profilingEnabled) {
      return operation();
    }

    const startTime = Date.now();
    let result: T;
    let error: Error | null = null;

    try {
      result = operation();
    } catch (e) {
      error = e as Error;
      throw e;
    } finally {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Record operation time
      if (!this.operationTimes.has(operationName)) {
        this.operationTimes.set(operationName, []);
      }
      this.operationTimes.get(operationName)!.push(duration);

      // Keep only last 100 measurements
      const times = this.operationTimes.get(operationName)!;
      if (times.length > 100) {
        times.splice(0, times.length - 100);
      }

      // Log performance if it's slow
      if (duration > 1000) { // 1 second threshold
        console.warn(`Slow operation detected: ${operationName} took ${duration}ms`);
      }
    }

    return result!;
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const now = Date.now();
    const cacheStats = await this.cacheManager.getStats();

    // Calculate operation statistics
    const operationStats = this.calculateOperationStats();

    return {
      calculation_time_ms: this.metrics.calculation_time_ms,
      memory_usage_mb: this.metrics.memory_usage_mb,
      database_queries: this.metrics.database_queries,
      cache_hit_rate: cacheStats.hit_rate,
      data_points_processed: this.metrics.data_points_processed,
      complexity_score: this.metrics.complexity_score,
      success_rate: operationStats.success_rate,
      average_response_time_ms: operationStats.average_response_time,
      operations_per_second: operationStats.operations_per_second,
      error_rate: operationStats.error_rate,
      timestamp: now
    };
  }

  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.operationTimes.clear();
  }

  enableProfiling(enabled: boolean): void {
    this.profilingEnabled = enabled;
  }

  // -------------------------------------------------------------------------
  // PRIVATE OPTIMIZATION METHODS
  // -------------------------------------------------------------------------

  private async executeFastPath<T>(
    calculation: () => Promise<T>,
    context: CalculationContext,
    operationId: string
  ): Promise<T> {
    // Fast path for simple calculations
    if (this.isSimpleCalculation(context)) {
      return this.monitorPerformance(calculation, `${operationId}_fast`);
    }
    return calculation();
  }

  private canUseFastPath(context: CalculationContext, options: OptimizationOptions): boolean {
    // Conditions for fast path
    return options.enable_fast_path &&
           this.isSimpleCalculation(context) &&
           !options.enable_parallel_processing;
  }

  private isSimpleCalculation(context: CalculationContext): boolean {
    // Simple calculation: single employer, minimal data, no complex reconciliation
    return context.lookback_days.project <= 90 &&
           context.lookback_days.expertise <= 60 &&
           context.method === 'weighted_average' &&
           Object.keys(context.weights).length <= 3;
  }

  private async executeCalculationWithOptimizations<T>(
    calculation: () => Promise<T>,
    context: CalculationContext,
    options: OptimizationOptions
  ): Promise<T> {
    // Apply memory optimization if enabled
    if (options.enable_memory_optimization) {
      return this.executeWithMemoryOptimization(calculation, options);
    }

    // Apply timeout if specified
    if (options.timeout_ms) {
      return this.executeWithTimeout(calculation, options.timeout_ms);
    }

    // Apply retry logic if specified
    if (options.retry_attempts && options.retry_attempts > 0) {
      return this.executeWithRetry(calculation, options.retry_attempts);
    }

    return calculation();
  }

  private async executeWithMemoryOptimization<T>(
    calculation: () => Promise<T>,
    options: OptimizationOptions
  ): Promise<T> {
    const memoryLimit = options.memory_limit_mb || 512; // 512MB default
    const currentMemory = this.getCurrentMemoryUsage();

    if (currentMemory > memoryLimit) {
      // Force garbage collection if possible
      if (global.gc) {
        global.gc();
      }

      // Check memory again after GC
      const newMemory = this.getCurrentMemoryUsage();
      if (newMemory > memoryLimit) {
        console.warn(`Memory limit exceeded: ${newMemory}MB > ${memoryLimit}MB`);
      }
    }

    return calculation();
  }

  private async executeWithTimeout<T>(
    calculation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Calculation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      calculation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private async executeWithRetry<T>(
    calculation: () => Promise<T>,
    maxAttempts: number,
    currentAttempt: number = 1
  ): Promise<T> {
    try {
      return await calculation();
    } catch (error) {
      if (currentAttempt >= maxAttempts) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.pow(2, currentAttempt - 1) * 1000;
      await this.sleep(delay);

      return this.executeWithRetry(calculation, maxAttempts, currentAttempt + 1);
    }
  }

  private generateCacheKey(context: CalculationContext, options: OptimizationOptions): string {
    const keyData = {
      employer_id: context.employer_id,
      calculation_date: context.calculation_date?.toISOString(),
      method: context.method,
      weights: context.weights,
      lookback_days: context.lookback_days,
      options_hash: this.hashOptions(options)
    };

    return `calculation_${btoa(JSON.stringify(keyData))}`;
  }

  private hashOptions(options: OptimizationOptions): string {
    const optionsString = JSON.stringify({
      enable_caching: options.enable_caching,
      cache_ttl: options.cache_ttl,
      enable_parallel_processing: options.enable_parallel_processing,
      max_concurrency: options.max_concurrency
    });

    let hash = 0;
    for (let i = 0; i < optionsString.length; i++) {
      const char = optionsString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private generateOperationId(context: CalculationContext): string {
    return `${context.employer_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private recordMetrics(operationId: string, resultType: string, durationMs: number): void {
    // Update basic metrics
    this.metrics.calculation_time_ms = Math.max(this.metrics.calculation_time_ms, durationMs);

    // Update operation-specific metrics
    if (!this.metrics.operation_metrics) {
      this.metrics.operation_metrics = new Map();
    }

    const existingMetrics = this.metrics.operation_metrics.get(resultType) || {
      count: 0,
      total_time: 0,
      average_time: 0,
      min_time: Infinity,
      max_time: 0
    };

    existingMetrics.count++;
    existingMetrics.total_time += durationMs;
    existingMetrics.average_time = existingMetrics.total_time / existingMetrics.count;
    existingMetrics.min_time = Math.min(existingMetrics.min_time, durationMs);
    existingMetrics.max_time = Math.max(existingMetrics.max_time, durationMs);

    this.metrics.operation_metrics.set(resultType, existingMetrics);
  }

  private calculateOperationStats(): any {
    const totalOperations = Array.from(this.metrics.operation_metrics?.values() || [])
      .reduce((sum, metrics) => sum + metrics.count, 0);

    const totalErrors = this.metrics.operation_metrics?.get('error')?.count || 0;
    const totalSuccesses = this.metrics.operation_metrics?.get('success')?.count || 0;

    const successRate = totalOperations > 0 ? totalSuccesses / totalOperations : 1;
    const errorRate = totalOperations > 0 ? totalErrors / totalOperations : 0;

    const averageResponseTime = Array.from(this.operationTimes.values())
      .flat()
      .reduce((sum, time, _, arr) => sum + time / arr.length, 0);

    return {
      success_rate: successRate,
      error_rate: errorRate,
      average_response_time: averageResponseTime,
      operations_per_second: totalOperations / (Date.now() - this.metrics.timestamp) * 1000
    };
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      calculation_time_ms: 0,
      memory_usage_mb: 0,
      database_queries: 0,
      cache_hit_rate: 0,
      data_points_processed: 0,
      complexity_score: 0,
      success_rate: 1,
      timestamp: Date.now(),
      operation_metrics: new Map()
    };
  }

  private getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024; // Convert to MB
    }
    return 0; // Fallback for browser environment
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// MEMORY CACHE MANAGER IMPLEMENTATION
// =============================================================================

export class MemoryCacheManager implements ICacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout;
  private stats: CacheStats;

  constructor(maxSize: number = 1000, cleanupIntervalMs: number = 60000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.stats = this.initializeStats();

    // Set up periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.stats.total_requests++;
      return null;
    }

    // Check if entry has expired
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.cache.delete(key);
      this.stats.expired_items++;
      this.stats.misses++;
      this.stats.total_requests++;
      return null;
    }

    // Update access statistics
    entry.hitCount++;
    entry.lastAccessed = new Date();

    this.stats.hits++;
    this.stats.total_requests++;
    this.stats.hit_rate = this.stats.hits / this.stats.total_requests;

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : undefined;
    const size = this.calculateSize(value);

    const entry: CacheEntry<T> = {
      value,
      createdAt: new Date(),
      lastAccessed: new Date(),
      expiresAt,
      hitCount: 0,
      size,
      ttl: ttlSeconds
    };

    this.cache.set(key, entry);
    this.updateMemoryUsage();
  }

  async delete(key: string): Promise<void> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateMemoryUsage();
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.updateMemoryUsage();
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async getStats(): Promise<CacheStats> {
    this.updateStats();
    return { ...this.stats };
  }

  async warmup(keys: string[]): Promise<void> {
    // In a real implementation, this would pre-populate the cache
    // For now, it's a placeholder
    console.log(`Cache warmup requested for ${keys.length} keys`);
  }

  async cleanup(): Promise<void> {
    const now = new Date();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.stats.expired_items++;
    }

    this.updateMemoryUsage();
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = new Date();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  private calculateSize(value: any): number {
    // Rough estimation of object size in bytes
    return JSON.stringify(value).length * 2; // Assume 2 bytes per character
  }

  private updateMemoryUsage(): void {
    this.stats.memory_usage_bytes = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0);

    // Update age statistics
    const now = new Date();
    let oldestAge = 0;
    let newestAge = Infinity;

    for (const entry of this.cache.values()) {
      const age = now.getTime() - entry.createdAt.getTime();
      oldestAge = Math.max(oldestAge, age);
      newestAge = Math.min(newestAge, age);
    }

    this.stats.oldest_item_age_ms = oldestAge;
    this.stats.newest_item_age_ms = newestAge;
  }

  private updateStats(): void {
    this.stats.hit_rate = this.stats.total_requests > 0
      ? this.stats.hits / this.stats.total_requests
      : 0;
  }

  private initializeStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      hit_rate: 0,
      total_requests: 0,
      memory_usage_bytes: 0,
      evictions: 0,
      expired_items: 0,
      oldest_item_age_ms: 0,
      newest_item_age_ms: 0
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// =============================================================================
// BATCH PROCESSOR IMPLEMENTATION
// =============================================================================

export class BatchProcessor implements IBatchProcessor {
  private defaultOptions: BatchProcessingOptions;

  constructor(defaultOptions?: BatchProcessingOptions) {
    this.defaultOptions = {
      batch_size: 10,
      max_concurrency: 5,
      error_handling: 'collect_errors',
      retry_attempts: 3,
      retry_delay_ms: 1000,
      enable_detailed_progress: true,
      ...defaultOptions
    };
  }

  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options?: BatchProcessingOptions
  ): Promise<R[]> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const result = await this.processBatchWithProgress(items, processor, mergedOptions);
    return result.results;
  }

  async processBatchWithProgress<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options?: BatchProcessingOptions
  ): Promise<{ results: R[]; progress: BatchProgress }> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const batchSize = mergedOptions.batch_size || 10;
    const maxConcurrency = mergedOptions.max_concurrency || 5;

    if (items.length === 0) {
      return {
        results: [],
        progress: this.createProgress(0, 0, 0, 0)
      };
    }

    // Create batches
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    const results: R[] = [];
    let processedItems = 0;
    let failedItems = 0;
    const startTime = Date.now();

    // Process batches with concurrency control
    const semaphore = new Semaphore(maxConcurrency);

    const batchPromises = batches.map(async (batch, batchIndex) => {
      await semaphore.acquire();

      try {
        const batchResults = await this.processBatchItem(batch, processor, mergedOptions, batchIndex, batches.length);

        processedItems += batchResults.successful.length;
        failedItems += batchResults.failed.length;

        // Update progress
        if (mergedOptions.progress_callback) {
          const progress = this.createProgress(
            items.length,
            processedItems,
            failedItems,
            Date.now() - startTime,
            batchIndex + 1,
            batches.length
          );
          mergedOptions.progress_callback(progress);
        }

        return batchResults.successful;

      } finally {
        semaphore.release();
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.flat());

    const finalProgress = this.createProgress(
      items.length,
      processedItems,
      failedItems,
      Date.now() - startTime
    );

    return {
      results,
      progress: finalProgress
    };
  }

  private async processBatchItem<T, R>(
    batch: T[],
    processor: (item: T) => Promise<R>,
    options: BatchProcessingOptions,
    batchIndex: number,
    totalBatches: number
  ): Promise<{ successful: R[]; failed: Array<{ item: T; error: Error }> }> {
    const successful: R[] = [];
    const failed: Array<{ item: T; error: Error }> = [];

    for (const item of batch) {
      try {
        const result = await this.processItemWithRetry(item, processor, options);
        successful.push(result);
      } catch (error) {
        const errorObj = error as Error;

        if (options.error_handling === 'fail_fast') {
          throw errorObj;
        } else {
          failed.push({ item, error: errorObj });
        }
      }
    }

    return { successful, failed };
  }

  private async processItemWithRetry<T, R>(
    item: T,
    processor: (item: T) => Promise<R>,
    options: BatchProcessingOptions,
    attempt: number = 1
  ): Promise<R> {
    try {
      return await processor(item);
    } catch (error) {
      if (attempt < (options.retry_attempts || 0)) {
        const delay = (options.retry_delay_ms || 1000) * Math.pow(2, attempt - 1);
        await this.sleep(delay);
        return this.processItemWithRetry(item, processor, options, attempt + 1);
      }
      throw error;
    }
  }

  private createProgress(
    totalItems: number,
    processedItems: number,
    failedItems: number,
    elapsedMs: number,
    currentBatch?: number,
    totalBatches?: number
  ): BatchProgress {
    const successRate = processedItems > 0 ? processedItems / (processedItems + failedItems) : 0;
    const itemsPerSecond = elapsedMs > 0 ? (processedItems + failedItems) / (elapsedMs / 1000) : 0;
    const etaSeconds = itemsPerSecond > 0 ? (totalItems - processedItems - failedItems) / itemsPerSecond : 0;

    return {
      total_items: totalItems,
      processed_items: processedItems,
      failed_items: failedItems,
      success_rate: successRate,
      estimated_completion: etaSeconds > 0 ? new Date(Date.now() + etaSeconds * 1000) : undefined,
      current_batch,
      total_batches,
      items_per_second: itemsPerSecond,
      eta_seconds: etaSeconds
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// UTILITY CLASSES
// =============================================================================

interface CacheEntry<T> {
  value: T;
  createdAt: Date;
  lastAccessed: Date;
  expiresAt?: Date;
  hitCount: number;
  size: number;
  ttl?: number;
}

class Semaphore {
  private permits: number;
  private waitQueue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise(resolve => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!;
      resolve();
    }
  }
}

// =============================================================================
// PERFORMANCE MONITORING
// =============================================================================

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private isEnabled: boolean = true;

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  static enable(): void {
    PerformanceMonitor.getInstance().isEnabled = true;
  }

  static disable(): void {
    PerformanceMonitor.getInstance().isEnabled = false;
  }

  static startTimer(operationName: string): string {
    if (!PerformanceMonitor.getInstance().isEnabled) {
      return '';
    }

    const timerId = `${operationName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!PerformanceMonitor.getInstance().metrics.has(operationName)) {
      PerformanceMonitor.getInstance().metrics.set(operationName, []);
    }

    return timerId;
  }

  static endTimer(operationName: string, timerId: string): number {
    if (!PerformanceMonitor.getInstance().isEnabled || !timerId) {
      return 0;
    }

    // Extract timestamp from timer ID
    const timestamp = parseInt(timerId.split('_')[1]);
    const duration = Date.now() - timestamp;

    const metrics = PerformanceMonitor.getInstance().metrics.get(operationName);
    if (metrics) {
      metrics.push({
        operation: operationName,
        duration,
        timestamp: new Date()
      });

      // Keep only last 1000 measurements
      if (metrics.length > 1000) {
        metrics.splice(0, metrics.length - 1000);
      }
    }

    return duration;
  }

  static getMetrics(operationName?: string): Map<string, PerformanceMetric[]> {
    if (operationName) {
      const metrics = PerformanceMonitor.getInstance().metrics.get(operationName);
      return metrics ? new Map([[operationName, metrics]]) : new Map();
    }

    return new Map(PerformanceMonitor.getInstance().metrics);
  }

  static clearMetrics(operationName?: string): void {
    if (operationName) {
      PerformanceMonitor.getInstance().metrics.delete(operationName);
    } else {
      PerformanceMonitor.getInstance().metrics.clear();
    }
  }
}

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
}

// =============================================================================
// OPTIMIZATION UTILITIES
// =============================================================================

export class OptimizationUtils {
  static createMemoizedFunction<T extends (...args: any[]) => any>(
    fn: T,
    keyGenerator?: (...args: Parameters<T>) => string
  ): T {
    const cache = new Map<string, ReturnType<T>>();

    return ((...args: Parameters<T>) => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

      if (cache.has(key)) {
        return cache.get(key)!;
      }

      const result = fn(...args);
      cache.set(key, result);
      return result;
    }) as T;
  }

  static debounce<T extends (...args: any[]) => any>(
    fn: T,
    delayMs: number
  ): T {
    let timeoutId: NodeJS.Timeout;

    return ((...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delayMs);
    }) as T;
  }

  static throttle<T extends (...args: any[]) => any>(
    fn: T,
    delayMs: number
  ): T {
    let lastCall = 0;

    return ((...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delayMs) {
        lastCall = now;
        return fn(...args);
      }
    }) as T;
  }

  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage = 'Operation timed out'
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      )
    ]);
  }

  static async retry<T>(
    operation: () => Promise<T>,
    maxAttempts: number,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
        }
      }
    }

    throw lastError!;
  }

  static createLazy<T>(factory: () => T): () => T {
    let instance: T | undefined;

    return () => {
      if (instance === undefined) {
        instance = factory();
      }
      return instance;
    };
  }

  static async parallelMap<T, R>(
    items: T[],
    mapper: (item: T) => Promise<R>,
    concurrency: number = 5
  ): Promise<R[]> {
    const results: R[] = [];
    const semaphore = new Semaphore(concurrency);

    const promises = items.map(async (item) => {
      await semaphore.acquire();
      try {
        const result = await mapper(item);
        results.push(result);
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(promises);
    return results;
  }
}

// Export for backward compatibility
export {
  CacheManager,
  BatchProcessor,
  PerformanceMonitor
};