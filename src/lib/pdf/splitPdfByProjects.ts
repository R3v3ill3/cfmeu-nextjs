import { PDFDocument } from 'pdf-lib'

export interface ProjectDefinition {
  startPage: number  // 1-indexed
  endPage: number    // 1-indexed
  tentativeName: string
  mode: 'new_project' | 'existing_project'
  projectId?: string  // For existing_project mode
}

export interface SplitResult {
  fileName: string
  pdfBytes: Uint8Array
  pageCount: number
  definition: ProjectDefinition
}

/**
 * Splits a PDF into multiple PDFs based on project definitions
 * @param pdfBytes Original PDF as Uint8Array
 * @param definitions Project boundary definitions
 * @returns Array of split PDF results
 */
export async function splitPdfByProjects(
  pdfBytes: Uint8Array,
  definitions: ProjectDefinition[]
): Promise<SplitResult[]> {
  // Load the source PDF
  const sourcePdf = await PDFDocument.load(pdfBytes)
  const totalPages = sourcePdf.getPageCount()

  // Validate definitions
  for (const def of definitions) {
    if (def.startPage < 1 || def.startPage > totalPages) {
      throw new Error(
        `Invalid startPage ${def.startPage} for "${def.tentativeName}"`
      )
    }
    if (def.endPage < def.startPage || def.endPage > totalPages) {
      throw new Error(
        `Invalid endPage ${def.endPage} for "${def.tentativeName}"`
      )
    }
  }

  // Check for overlaps (optional but recommended)
  const usedPages = new Set<number>()
  for (const def of definitions) {
    for (let i = def.startPage; i <= def.endPage; i++) {
      if (usedPages.has(i)) {
        throw new Error(`Page ${i} is assigned to multiple projects`)
      }
      usedPages.add(i)
    }
  }

  // Split PDFs
  const results: SplitResult[] = []

  for (const definition of definitions) {
    // Create new PDF document
    const newPdf = await PDFDocument.create()

    // Copy pages from source (convert to 0-indexed)
    const pageIndices = []
    for (let i = definition.startPage - 1; i < definition.endPage; i++) {
      pageIndices.push(i)
    }

    const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices)
    copiedPages.forEach((page) => newPdf.addPage(page))

    // Serialize to bytes
    const pdfBytes = await newPdf.save()

    // Generate filename
    const sanitizedName = definition.tentativeName
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50)

    const fileName = `${sanitizedName}-pages-${definition.startPage}-${definition.endPage}.pdf`

    results.push({
      fileName,
      pdfBytes,
      pageCount: definition.endPage - definition.startPage + 1,
      definition,
    })
  }

  return results
}
