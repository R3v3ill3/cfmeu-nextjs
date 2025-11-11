import { PDFDocument } from 'pdf-lib'
import { ProjectDefinition, SplitResult } from './splitPdfByProjects'
import { createBatchedRequest, formatBytes, getMemoryWarning, PerformanceMonitor } from '@/lib/performance/adaptivePolling'
import { uploadSplitPdfs } from './uploadSplitPdfs'

export interface OptimizedSplitResult extends SplitResult {
  processingTime: number
  memoryUsage: number
}

export interface ProcessingOptions {
  enableMemoryOptimization?: boolean
  batchSize?: number
  concurrency?: number
  maxMemoryUsage?: number // In bytes
  onProgress?: (progress: number, current: string) => void
  onMemoryWarning?: (warning: string) => void
}

export class OptimizedPdfProcessor {
  private performanceMonitor: PerformanceMonitor
  private options: Required<ProcessingOptions>

  constructor(options: ProcessingOptions = {}) {
    this.options = {
      enableMemoryOptimization: options.enableMemoryOptimization ?? true,
      batchSize: options.batchSize ?? 3,
      concurrency: options.concurrency ?? 2,
      maxMemoryUsage: options.maxMemoryUsage ?? 100 * 1024 * 1024, // 100MB
      onProgress: options.onProgress ?? (() => {}),
      onMemoryWarning: options.onMemoryWarning ?? (() => {})
    }

    this.performanceMonitor = new PerformanceMonitor()
  }

  async processPdfInBatches(
    pdfBytes: Uint8Array,
    definitions: ProjectDefinition[]
  ): Promise<OptimizedSplitResult[]> {
    this.performanceMonitor.start()

    try {
      // Check for memory warnings
      const memoryWarning = getMemoryWarning(pdfBytes.length)
      if (memoryWarning.warning) {
        this.options.onMemoryWarning(memoryWarning.message)
      }

      // Validate definitions first
      this.validateDefinitions(pdfBytes, definitions)

      // Load the source PDF once
      this.options.onProgress(10, 'Loading PDF document...')
      const sourcePdf = await this.loadPdfOptimized(pdfBytes)

      // Process in batches to manage memory
      const results: OptimizedSplitResult[] = []
      const batches = this.createBatches(definitions)

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        const progress = 10 + (i / batches.length) * 80

        this.options.onProgress(
          progress,
          `Processing batch ${i + 1} of ${batches.length}...`
        )

        const batchResults = await this.processBatch(
          sourcePdf,
          batch,
          i,
          batches.length
        )
        results.push(...batchResults)

        // Force garbage collection if available
        if (this.options.enableMemoryOptimization && typeof window !== 'undefined' && 'gc' in window) {
          try {
            (window as any).gc()
          } catch (e) {
            // Ignore if gc is not available
          }
        }
      }

      this.options.onProgress(100, 'Processing complete')
      return results

    } finally {
      this.performanceMonitor.stop()
    }
  }

  private async loadPdfBytesOptimized(pdfBytes: Uint8Array): Promise<Uint8Array> {
    // For now, return the bytes as-is since we're not handling file loading here
    // The file loading is handled in the component
    this.options.onProgress(5, 'Processing PDF bytes...')
    return pdfBytes
  }

  private async loadPdfOptimized(pdfBytes: Uint8Array): Promise<PDFDocument> {
    try {
      // Use PDF-lib's load with options for better memory management
      return await PDFDocument.load(pdfBytes, {
        updateMetadata: false, // Don't update metadata to save memory
      })
    } catch (error) {
      console.error('Failed to load PDF:', error)
      throw new Error(`Failed to load PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private validateDefinitions(pdfBytes: Uint8Array, definitions: ProjectDefinition[]): void {
    // Quick validation without loading the full PDF
    if (pdfBytes.length < 4) {
      throw new Error('Invalid PDF file')
    }

    // Check PDF header
    const header = new TextDecoder().decode(pdfBytes.slice(0, 4))
    if (header !== '%PDF') {
      throw new Error('File is not a valid PDF')
    }

    // Validate definitions
    for (const def of definitions) {
      if (def.startPage < 1) {
        throw new Error(`Invalid startPage ${def.startPage} for "${def.tentativeName}"`)
      }
      if (def.endPage < def.startPage) {
        throw new Error(`Invalid endPage ${def.endPage} for "${def.tentativeName}"`)
      }
    }

    // Check for overlaps
    const usedPages = new Set<number>()
    for (const def of definitions) {
      for (let i = def.startPage; i <= def.endPage; i++) {
        if (usedPages.has(i)) {
          throw new Error(`Page ${i} is assigned to multiple projects`)
        }
        usedPages.add(i)
      }
    }
  }

  private createBatches(definitions: ProjectDefinition[]): ProjectDefinition[][] {
    const batches: ProjectDefinition[][] = []

    for (let i = 0; i < definitions.length; i += this.options.batchSize) {
      batches.push(definitions.slice(i, i + this.options.batchSize))
    }

    return batches
  }

  private async processBatch(
    sourcePdf: PDFDocument,
    batch: ProjectDefinition[],
    batchIndex: number,
    totalBatches: number
  ): Promise<OptimizedSplitResult[]> {
    const results: OptimizedSplitResult[] = []

    for (const definition of batch) {
      const startTime = Date.now()

      try {
        const result = await this.processSingleDefinition(sourcePdf, definition)
        const processingTime = Date.now() - startTime

        results.push({
          ...result,
          processingTime,
          memoryUsage: this.estimateCurrentMemoryUsage()
        })

        this.performanceMonitor.recordRequest(result.pdfBytes.length)

      } catch (error) {
        this.performanceMonitor.recordFailure()
        console.error(`Failed to process ${definition.tentativeName}:`, error)
        throw error
      }
    }

    return results
  }

  private async processSingleDefinition(
    sourcePdf: PDFDocument,
    definition: ProjectDefinition
  ): Promise<SplitResult> {
    // Create new PDF document
    const newPdf = await PDFDocument.create()

    // Copy pages from source (convert to 0-indexed)
    const pageIndices = []
    for (let i = definition.startPage - 1; i < definition.endPage; i++) {
      pageIndices.push(i)
    }

    const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices)
    copiedPages.forEach((page) => newPdf.addPage(page))

    // Save with compression options
    const pdfBytes = await newPdf.save({
      useObjectStreams: true, // Better compression
      addDefaultPage: false,  // Don't add empty pages
    })

    // Generate filename
    const sanitizedName = definition.tentativeName
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50)

    const fileName = `${sanitizedName}-pages-${definition.startPage}-${definition.endPage}.pdf`

    return {
      fileName,
      pdfBytes,
      pageCount: definition.endPage - definition.startPage + 1,
      definition,
    }
  }

  private estimateMemoryUsage(chunks: Uint8Array[]): number {
    return chunks.reduce((total, chunk) => total + chunk.length, 0)
  }

  private estimateCurrentMemoryUsage(): number {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (performance as any)) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }

  getPerformanceMetrics() {
    return this.performanceMonitor.getMetrics()
  }
}

// Optimized upload utility with parallel processing
export class OptimizedPdfUploader {
  private performanceMonitor: PerformanceMonitor

  constructor() {
    this.performanceMonitor = new PerformanceMonitor()
  }

  async uploadSplitPdfsInParallel(
    batchId: string,
    userId: string,
    splitResults: SplitResult[],
    concurrency: number = 3
  ): Promise<any[]> {
    this.performanceMonitor.start()

    try {
      const uploadResults = await createBatchedRequest(
        splitResults,
        1, // Process one at a time per batch, but run multiple batches in parallel
        async (batch) => {
          const [result] = batch
          return await this.uploadSinglePdf(batchId, userId, result)
        },
        concurrency
      )

      return uploadResults

    } finally {
      this.performanceMonitor.stop()
    }
  }

  private async uploadSinglePdf(
    batchId: string,
    userId: string,
    result: SplitResult
  ): Promise<any> {
    // Create a temporary array with single result
    const uploadedFiles = await uploadSplitPdfs(batchId, userId, [result])
    return uploadedFiles[0]
  }

  getPerformanceMetrics() {
    return this.performanceMonitor.getMetrics()
  }
}