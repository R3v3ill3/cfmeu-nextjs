import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from 'canvas'
import sharp from 'sharp'
import { config } from '../config'

// Disable worker - we're running in Node.js, not browser
GlobalWorkerOptions.workerSrc = ''

export async function convertPdfToImages(
  pdfBuffer: Buffer, 
  selectedPages?: number[]
): Promise<Buffer[]> {
  try {
    // Load PDF
    const loadingTask = getDocument({
      data: new Uint8Array(pdfBuffer),
    })
    const pdf = await loadingTask.promise

    // Determine which pages to process
    let pagesToProcess: number[]
    if (selectedPages && selectedPages.length > 0) {
      // Use selected pages, but ensure they're within bounds
      pagesToProcess = selectedPages.filter(p => p >= 1 && p <= pdf.numPages)
    } else {
      // Default: process up to maxPdfPages
      const numPages = Math.min(pdf.numPages, config.maxPdfPages)
      pagesToProcess = Array.from({ length: numPages }, (_, i) => i + 1)
    }

    const imageBuffers: Buffer[] = []

    // Convert each page to image
    for (const pageNum of pagesToProcess) {
      const page = await pdf.getPage(pageNum)
      
      // Set scale for high quality (2x for better OCR/vision)
      const scale = 2.0
      const viewport = page.getViewport({ scale })

      // Create canvas
      const canvas = createCanvas(viewport.width, viewport.height)
      const context = canvas.getContext('2d')

      // Render PDF page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      }
      await page.render(renderContext).promise

      // Convert canvas to PNG buffer via sharp (for optimization)
      const rawBuffer = canvas.toBuffer('image/png')
      const optimizedBuffer = await sharp(rawBuffer)
        .png({ quality: 90, compressionLevel: 6 })
        .toBuffer()

      imageBuffers.push(optimizedBuffer)
    }

    return imageBuffers
  } catch (error) {
    console.error('[pdf-converter] Failed to convert PDF:', error)
    throw new Error(`PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
