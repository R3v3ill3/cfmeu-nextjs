"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractWithOpenAI = extractWithOpenAI;
const openai_1 = __importDefault(require("openai"));
const config_1 = require("../config");
const prompts_1 = require("./prompts");
const client = new openai_1.default({
    apiKey: config_1.config.openaiApiKey,
});
async function extractWithOpenAI(imageBuffers) {
    const startTime = Date.now();
    try {
        // Convert buffers to base64 data URLs
        const imageUrls = imageBuffers.map((buffer) => ({
            type: 'image_url',
            image_url: {
                url: `data:image/png;base64,${buffer.toString('base64')}`,
                detail: 'high',
            },
        }));
        // Build message content
        const content = [
            { type: 'text', text: prompts_1.CLAUDE_SYSTEM_PROMPT },
        ];
        imageBuffers.forEach((_, index) => {
            content.push(imageUrls[index]);
            content.push({
                type: 'text',
                text: (0, prompts_1.CLAUDE_USER_PROMPT)(index + 1, imageBuffers.length),
            });
        });
        // Call OpenAI API
        const response = await client.chat.completions.create({
            model: config_1.config.openaiModel,
            max_tokens: config_1.config.maxTokens,
            messages: [
                {
                    role: 'user',
                    content,
                },
            ],
        });
        const responseText = response.choices[0]?.message?.content || '';
        // Parse JSON
        let jsonText = responseText?.trim() || '';
        if (!jsonText) {
            throw new Error('Empty or undefined response from OpenAI');
        }
        if (jsonText.startsWith('```')) {
            // Safely handle markdown code block removal
            jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
        }
        if (!jsonText || jsonText.length === 0) {
            throw new Error('Empty response from OpenAI after processing');
        }
        const extractedData = JSON.parse(jsonText);
        // Calculate cost (rough estimate for vision)
        const totalTokens = response.usage?.total_tokens || 0;
        const costUsd = (totalTokens / 1000) * config_1.config.openaiCostPer1kTokens;
        const processingTimeMs = Date.now() - startTime;
        return {
            success: true,
            extractedData,
            provider: 'openai',
            costUsd,
            processingTimeMs,
            imagesProcessed: imageBuffers.length,
        };
    }
    catch (error) {
        console.error('[openai] Extraction failed:', error);
        return {
            success: false,
            provider: 'openai',
            costUsd: 0,
            processingTimeMs: Date.now() - startTime,
            imagesProcessed: imageBuffers.length,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
