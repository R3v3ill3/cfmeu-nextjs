# Mapping Sheet Scanner Worker

Railway worker for scanning handwritten mapping sheets with AI (Claude/OpenAI Vision).

## Purpose

Processes uploaded PDF scans of handwritten CFMEU NSW MappingSheets forms and extracts structured data using AI vision models.

## Architecture

- Polls `scraper_jobs` table for `mapping_sheet_scan` job types
- Downloads PDFs from Supabase Storage
- Converts PDF pages to images
- Sends images to Claude 3.5 Sonnet (primary) or OpenAI GPT-4 Vision (fallback)
- Extracts structured JSON data from handwritten forms
- Stores results in `mapping_sheet_scans` table

## Environment Variables

Required:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin access
- `CLAUDE_API_KEY` - Anthropic API key
- `OPENAI_API_KEY` - OpenAI API key (fallback)

Optional:
- `POLL_INTERVAL_MS` - Job polling interval (default: 5000)
- `MAX_RETRIES` - Max retry attempts (default: 3)
- `SCANNER_VERBOSE_LOGS` - Set to `true` to enable detailed polling logs (default: `false`)

## Local Development

```bash
npm install
npm run dev
```

Worker will start polling for jobs on localhost.

## Deployment

Deployed to Railway with automatic deploys from git commits.

Each worker instance in this folder is isolated for independent deployment.

## Cost Tracking

All AI API costs are tracked in `mapping_sheet_scan_costs` table:
- Claude 3.5 Sonnet: ~$0.003 per 1K input tokens, $0.015 per 1K output tokens
- OpenAI GPT-4 Vision: ~$0.01 per 1K tokens

Average cost per 3-page scan: $0.10 - $0.30

## Testing Locally

1. Start worker: `npm run dev`
2. Upload a scan through the main app
3. Watch console for processing logs
4. Check database for extracted data

## Supported PDF Formats

- Maximum 3 pages
- Maximum 10MB file size
- PDF format only
- Recommended: 300 DPI color scans
