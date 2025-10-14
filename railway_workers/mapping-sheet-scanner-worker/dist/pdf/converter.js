"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertPdfToImages = convertPdfToImages;
const pdfjs_dist_1 = require("pdfjs-dist");
const canvas_1 = require("canvas");
const sharp_1 = __importDefault(require("sharp"));
const config_1 = require("../config");
// Disable worker - we're running in Node.js, not browser
pdfjs_dist_1.GlobalWorkerOptions.workerSrc = '';
async function convertPdfToImages(pdfBuffer, selectedPages) {
    try {
        // Load PDF
        const loadingTask = (0, pdfjs_dist_1.getDocument)({
            data: new Uint8Array(pdfBuffer),
        });
        const pdf = await loadingTask.promise;
        // Determine which pages to process
        let pagesToProcess;
        if (selectedPages && selectedPages.length > 0) {
            // Use selected pages, but ensure they're within bounds
            pagesToProcess = selectedPages.filter(p => p >= 1 && p <= pdf.numPages);
        }
        else {
            // Default: process up to maxPdfPages
            const numPages = Math.min(pdf.numPages, config_1.config.maxPdfPages);
            pagesToProcess = Array.from({ length: numPages }, (_, i) => i + 1);
        }
        const imageBuffers = [];
        // Convert each page to image
        for (const pageNum of pagesToProcess) {
            const page = await pdf.getPage(pageNum);
            // Set scale for high quality (2x for better OCR/vision)
            const scale = 2.0;
            const viewport = page.getViewport({ scale });
            // Create canvas
            const canvas = (0, canvas_1.createCanvas)(viewport.width, viewport.height);
            const context = canvas.getContext('2d');
            // Render PDF page to canvas
            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };
            await page.render(renderContext).promise;
            // Convert canvas to PNG buffer via sharp (for optimization)
            const rawBuffer = canvas.toBuffer('image/png');
            const optimizedBuffer = await (0, sharp_1.default)(rawBuffer)
                .png({ quality: 90, compressionLevel: 6 })
                .toBuffer();
            imageBuffers.push(optimizedBuffer);
        }
        return imageBuffers;
    }
    catch (error) {
        console.error('[pdf-converter] Failed to convert PDF:', error);
        throw new Error(`PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
