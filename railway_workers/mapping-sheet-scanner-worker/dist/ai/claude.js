"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractWithClaude = extractWithClaude;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const config_1 = require("../config");
const prompts_1 = require("./prompts");
const timeout_1 = require("../utils/timeout");
const client = new sdk_1.default({
    apiKey: config_1.config.claudeApiKey,
});
async function extractWithClaude(pdfBuffer, selectedPages) {
    const startTime = Date.now();
    let retryCount = 0;
    let timedOut = false;
    try {
        // Build message content with PDF document
        const content = [
            {
                type: 'document',
                source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: pdfBuffer.toString('base64'),
                },
            },
            {
                type: 'text',
                text: selectedPages
                    ? `IMPORTANT: Focus ONLY on pages ${selectedPages.join(', ')} of this PDF. Ignore all other pages completely.\n\n${(0, prompts_1.CLAUDE_USER_PROMPT)(1, selectedPages.length)}`
                    : `Analyze all pages of this PDF mapping sheet.\n\n${(0, prompts_1.CLAUDE_USER_PROMPT)(1, 3)}`,
            },
        ];
        // Call Claude API with timeout protection and retry logic
        const message = await (0, timeout_1.withTimeoutAndRetry)(async () => {
            // Create timeout controller for request cancellation
            const { controller, cleanup } = (0, timeout_1.createTimeoutController)(config_1.config.claudeTimeoutMs);
            try {
                const response = await client.messages.create({
                    model: config_1.config.claudeModel,
                    max_tokens: config_1.config.maxTokens,
                    system: prompts_1.CLAUDE_SYSTEM_PROMPT,
                    messages: [
                        {
                            role: 'user',
                            content,
                        },
                    ],
                }, {
                    signal: controller.signal,
                });
                cleanup();
                return response;
            }
            catch (error) {
                cleanup();
                throw error;
            }
        }, {
            timeoutMs: config_1.config.claudeTimeoutMs,
            maxRetries: config_1.config.claudeMaxRetries,
            operationName: 'Claude API call',
            onRetry: (attempt, error) => {
                retryCount = attempt;
                console.warn(`[claude] Retry ${attempt}/${config_1.config.claudeMaxRetries} after timeout (${config_1.config.claudeTimeoutMs}ms)`);
            },
        });
        // Extract JSON from response
        const responseText = message.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text || '') // Handle undefined text blocks
            .join('\n');
        // Debug: Log Claude's actual response
        console.log('[claude] Raw response length:', responseText?.length || 0);
        console.log('[claude] Raw response preview:', responseText?.substring(0, 200) || 'empty');
        // Parse JSON (may be wrapped in markdown code blocks)
        let jsonText = responseText?.trim() || '';
        if (!jsonText) {
            throw new Error('Empty or undefined response from Claude');
        }
        if (jsonText.startsWith('```')) {
            // Safely handle markdown code block removal
            jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
        }
        console.log('[claude] Parsing JSON length:', jsonText?.length || 0);
        console.log('[claude] JSON preview:', jsonText?.substring(0, 200) || 'empty');
        if (!jsonText || jsonText.length === 0) {
            throw new Error('Empty response from Claude after processing');
        }
        const extractedData = JSON.parse(jsonText);
        // Calculate cost
        const inputTokens = message.usage.input_tokens;
        const outputTokens = message.usage.output_tokens;
        const costUsd = (inputTokens / 1000) * config_1.config.claudeCostPer1kInput +
            (outputTokens / 1000) * config_1.config.claudeCostPer1kOutput;
        const processingTimeMs = Date.now() - startTime;
        return {
            success: true,
            extractedData,
            provider: 'claude',
            costUsd,
            processingTimeMs,
            inputTokens,
            outputTokens,
            imagesProcessed: selectedPages?.length || 1,
            timedOut: false,
            retryCount,
        };
    }
    catch (error) {
        const isTimeout = error instanceof timeout_1.TimeoutError;
        if (isTimeout) {
            timedOut = true;
            // Log timeout incident for monitoring
            (0, timeout_1.logTimeoutIncident)('Claude API extraction', config_1.config.claudeTimeoutMs, {
                selectedPages: selectedPages?.join(', ') || 'all',
                pdfSizeBytes: pdfBuffer.length,
                retryCount,
                model: config_1.config.claudeModel,
            });
        }
        console.error('[claude] Extraction failed:', error);
        console.error('[claude] Error details:', {
            isTimeout,
            retryCount,
            processingTimeMs: Date.now() - startTime,
        });
        return {
            success: false,
            provider: 'claude',
            costUsd: 0,
            processingTimeMs: Date.now() - startTime,
            imagesProcessed: selectedPages?.length || 1,
            error: error instanceof Error ? error.message : 'Unknown error',
            timedOut,
            retryCount,
        };
    }
}
