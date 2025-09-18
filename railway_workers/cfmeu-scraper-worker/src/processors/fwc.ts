import * as cheerio from 'cheerio'
import puppeteer, { Browser } from 'puppeteer'
import { SupabaseClient } from '@supabase/supabase-js'
import { appendEvent, updateProgress } from '../jobs'
import { FwcJobPayload, ScraperJob } from '../types'

export interface FwcLookupSummary {
  succeeded: number
  failed: number
}

interface FwcSearchResult {
  title: string
  agreementType: string
  status: string
  approvedDate?: string
  expiryDate?: string
  lodgementNumber?: string
  documentUrl?: string
  summaryUrl?: string
  downloadToken?: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function processFwcJob(
  client: SupabaseClient,
  job: ScraperJob
): Promise<FwcLookupSummary> {
  const payload = (job.payload ?? {}) as Partial<FwcJobPayload>
  const employerIds = Array.isArray(payload.employerIds) ? payload.employerIds : []
  const searchOverrides = payload.options?.searchOverrides ?? {}
  const autoLink = payload.options?.autoLink !== false

  if (employerIds.length === 0) {
    await appendEvent(client, job.id, 'fwc_no_employers')
    return { succeeded: 0, failed: 0 }
  }

  const { data: employers, error: employerError } = await client.from('employers').select('id, name').in('id', employerIds)

  if (employerError) {
    throw new Error(`Failed to load employer names: ${employerError.message}`)
  }

  const employerMap = new Map<string, string>(
    (employers ?? []).map((row: { id: string; name: string | null }) => [row.id, row.name ?? ''])
  )

  let succeeded = 0
  let failed = 0

  const browser = await getBrowser()
  try {
    for (const [index, employerId] of employerIds.entries()) {
      const employerName = employerMap.get(employerId) ?? employerId
      const searchTermOverride = searchOverrides[employerId]
      await appendEvent(client, job.id, 'fwc_employer_started', { employerId, employerName })

      try {
        const queryCandidates = buildQueryCandidates(employerName, searchTermOverride)
        let results: FwcSearchResult[] = []
        let usedQuery = queryCandidates[0] ?? employerName

        for (const candidate of queryCandidates) {
          await appendEvent(client, job.id, 'fwc_employer_query_attempt', {
            employerId,
            employerName,
            query: candidate,
          })
          const attemptResults = await searchFwcAgreements(browser, candidate)
          if (attemptResults.length > 0) {
            results = attemptResults
            usedQuery = candidate
            break
          }
        }

        const limitedResults = results.slice(0, 15)

        await appendEvent(client, job.id, 'fwc_employer_results', {
          employerId,
          employerName,
          query: usedQuery,
          resultsCount: results.length,
          firstTitle: results[0]?.title,
          results: autoLink ? undefined : limitedResults,
        })

        if (results.length > 0) {
          if (autoLink) {
            const bestResult = results[0]
            await upsertEbaRecord(client, employerId, bestResult)
            succeeded += 1
            await appendEvent(client, job.id, 'fwc_employer_succeeded', {
              employerId,
              employerName,
              resultTitle: bestResult.title,
              status: bestResult.status,
            })
          } else {
            succeeded += 1
            await appendEvent(client, job.id, 'fwc_employer_candidates', {
              employerId,
              employerName,
              query: usedQuery,
              results: limitedResults,
            })
          }
        } else {
          failed += 1
          await appendEvent(client, job.id, 'fwc_employer_no_results', {
            employerId,
            employerName,
          })
        }
      } catch (error) {
        failed += 1
        await appendEvent(client, job.id, 'fwc_employer_failed', {
          employerId,
          employerName,
          error: error instanceof Error ? error.message : 'unknown error',
        })
        console.error('[worker] fwc_lookup employer failed', employerId, error)
      }

      await updateProgress(client, job.id, index + 1)
      await sleep(1000)
    }
  } finally {
    await browser.close()
  }

  return { succeeded, failed }
}

async function getBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
  })
}

async function searchFwcAgreements(browser: Browser, companyName: string): Promise<FwcSearchResult[]> {
  const simplifiedName = simplifyCompanyName(companyName)
  const query = simplifiedName ? `cfmeu construction nsw ${simplifiedName}` : companyName

  const searchUrl = new URL('https://www.fwc.gov.au/document-search')
  searchUrl.searchParams.set('q', query)
  searchUrl.searchParams.set('options', 'SearchType_3,SortOrder_agreement-relevance,ExpiryFromDate_01/01/2024')
  searchUrl.searchParams.set('pagesize', '50')
  searchUrl.searchParams.set(
    'facets',
    'AgreementStatusDesc_Approved,AgreementType_Single-enterprise Agreement,AgreementIndustry_Building metal and civil construction industries'
  )

  const page = await browser.newPage()
  page.setDefaultNavigationTimeout(60000)
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36'
  )

  try {
    await page.goto(searchUrl.toString(), { waitUntil: 'networkidle2', timeout: 45000 })
    await page.waitForSelector('a h3', { timeout: 30000 })
    const content = await page.content()
    const parsed = parseSearchResults(content, query)
    console.log(`[worker] FWC search`, { query, resultCount: parsed.length })
    return parsed
  } finally {
    await page.close()
  }
}

function simplifyCompanyName(companyName: string): string {
  if (!companyName) return ''

  let simplified = companyName
    .replace(/\s+(Pty\s+Ltd|Pty\.?\s*Ltd\.?|Limited|Ltd\.?|Incorporated|Inc\.?|Corporation|Corp\.?)$/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+(Group|Holdings|Enterprises|Services|Solutions|Systems|Technologies|International|Australia|Australian)$/i, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = simplified.split(' ').filter((word) => word.length > 2)
  simplified = words.slice(0, 3).join(' ')
  return simplified
}

function buildQueryCandidates(companyName: string, override?: string | null): string[] {
  const candidates = new Set<string>()
  const cleanOverride = override?.trim()
  const simplified = simplifyCompanyName(companyName)

  const basePrefix = (term: string) => `cfmeu construction nsw ${term}`.trim()

  if (cleanOverride) {
    candidates.add(cleanOverride)
    candidates.add(basePrefix(cleanOverride))
  }

  if (simplified && simplified !== cleanOverride) {
    candidates.add(basePrefix(simplified))
    candidates.add(simplified)
  }

  if (companyName && companyName !== simplified && companyName !== cleanOverride) {
    candidates.add(basePrefix(companyName))
    candidates.add(companyName)
  }

  if (candidates.size === 0) {
    candidates.add(basePrefix(companyName || ''))
    candidates.add(companyName || '')
  }

  return Array.from(candidates).filter((q) => q.trim().length > 0)
}

function parseSearchResults(html: string, searchQuery: string): FwcSearchResult[] {
  const $ = cheerio.load(html)
  const results: FwcSearchResult[] = []

  const agreementLinks = $('a h3').parent()

  agreementLinks.each((_, linkElement) => {
    const $link = $(linkElement)
    const $container = $link.closest('div').parent()

    const title = $link.find('h3').text().trim()
    if (!title || title.length < 10) return

    let documentUrl = $link.attr('href') || ''
    if (documentUrl && !documentUrl.startsWith('http')) {
      documentUrl = `https://www.fwc.gov.au${documentUrl}`
    }

    const $metadataContainer = $container.find('div').last()
    const metadataText = $metadataContainer.text()

    let status = 'Unknown'
    let agreementId = ''
    let approvedDate = ''
    let expiryDate = ''

    const statusMatch = metadataText.match(/\b(Approved|Terminated|Replaced|Superseded)\b/i)
    if (statusMatch) status = statusMatch[1]

    const idMatch = metadataText.match(/\b(AE\d+)\b/)
    if (idMatch) agreementId = idMatch[1]

    const approvedMatch = metadataText.match(/Approved:\s*(\d{1,2}\s+\w+\s+\d{4})/i)
    if (approvedMatch) approvedDate = approvedMatch[1]

    const expiryMatch = metadataText.match(/Nominal expiry date:\s*(\d{1,2}\s+\w+\s+\d{4})/i)
    if (expiryMatch) expiryDate = expiryMatch[1]

    const summaryUrlMatch = metadataText.match(/Summary:\s*(https?:\/\/\S+)/i)
    const summaryUrl = summaryUrlMatch ? summaryUrlMatch[1] : undefined

    results.push({
      title,
      agreementType: 'Single-enterprise Agreement',
      status,
      approvedDate,
      expiryDate,
      lodgementNumber: agreementId,
      documentUrl,
      summaryUrl,
      downloadToken: undefined,
    })
  })

  return results
}

async function upsertEbaRecord(client: SupabaseClient, employerId: string, result: FwcSearchResult) {
  const { data: existingRecord, error: fetchError } = await client
    .from('company_eba_records')
    .select('id')
    .eq('employer_id', employerId)
    .maybeSingle()

  if (fetchError) {
    throw new Error(`Failed to fetch existing EBA record: ${fetchError.message}`)
  }

  const updateData = {
    fwc_document_url: result.documentUrl,
    fwc_lodgement_number: result.lodgementNumber,
    fwc_certified_date: normalizeDateInput(result.approvedDate),
    nominal_expiry_date: normalizeDateInput(result.expiryDate),
    comments: existingRecord
      ? `Updated from FWC search. Agreement: ${result.title}. Status: ${result.status}.`
      : `Auto-imported from FWC search. Agreement: ${result.title}. Status: ${result.status}.`,
  }

  if (existingRecord) {
    const { error } = await client
      .from('company_eba_records')
      .update(updateData)
      .eq('id', existingRecord.id)

    if (error) {
      throw new Error(`Failed to update existing EBA record: ${error.message}`)
    }
  } else {
    const { error } = await client
      .from('company_eba_records')
      .insert({
        employer_id: employerId,
        eba_file_number: result.title.substring(0, 100),
        ...updateData,
      })

    if (error) {
      throw new Error(`Failed to insert new EBA record: ${error.message}`)
    }
  }

  const { error: employerUpdateError } = await client
    .from('employers')
    .update({ enterprise_agreement_status: true })
    .eq('id', employerId)

  if (employerUpdateError) {
    throw new Error(`Failed to update employer status: ${employerUpdateError.message}`)
  }
}

function normalizeDateInput(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (match) {
    const dd = match[1].padStart(2, '0')
    const mm = match[2].padStart(2, '0')
    let yyyy = match[3]
    if (yyyy.length === 2) {
      yyyy = (Number(yyyy) > 50 ? '19' : '20') + yyyy
    }
    return `${yyyy}-${mm}-${dd}`
  }

  return null
}
