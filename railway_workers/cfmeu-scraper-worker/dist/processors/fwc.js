"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FwcSearchError = void 0;
exports.processFwcJob = processFwcJob;
const cheerio = __importStar(require("cheerio"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const jobs_1 = require("../jobs");
class FwcSearchError extends Error {
    constructor(message, context) {
        super(message);
        this.name = 'FwcSearchError';
        this.context = context;
    }
}
exports.FwcSearchError = FwcSearchError;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function processFwcJob(client, job) {
    const payload = (job.payload ?? {});
    const employerIds = Array.isArray(payload.employerIds) ? payload.employerIds : [];
    const searchOverrides = payload.options?.searchOverrides ?? {};
    const autoLink = payload.options?.autoLink !== false;
    if (employerIds.length === 0) {
        await (0, jobs_1.appendEvent)(client, job.id, 'fwc_no_employers');
        return { succeeded: 0, failed: 0 };
    }
    const { data: employers, error: employerError } = await client.from('employers').select('id, name').in('id', employerIds);
    if (employerError) {
        throw new Error(`Failed to load employer names: ${employerError.message}`);
    }
    const employerMap = new Map((employers ?? []).map((row) => [row.id, row.name ?? '']));
    let succeeded = 0;
    let failed = 0;
    const browser = await getBrowser();
    try {
        console.log('[worker] FWC job started', {
            jobId: job.id,
            employerIds: employerIds.length,
            autoLink,
        });
        for (const [index, employerId] of employerIds.entries()) {
            const employerName = employerMap.get(employerId) ?? employerId;
            const searchTermOverride = searchOverrides[employerId];
            await (0, jobs_1.appendEvent)(client, job.id, 'fwc_employer_started', { employerId, employerName });
            try {
                console.log('[worker] FWC employer lookup', {
                    employerId,
                    employerName,
                });
                const queryCandidates = buildQueryCandidates(employerName, searchTermOverride);
                let results = [];
                let usedQuery = queryCandidates[0] ?? employerName;
                for (const candidate of queryCandidates) {
                    await (0, jobs_1.appendEvent)(client, job.id, 'fwc_employer_query_attempt', {
                        employerId,
                        employerName,
                        query: candidate,
                    });
                    const attemptResults = await searchFwcAgreements(browser, candidate);
                    if (attemptResults.length > 0) {
                        results = attemptResults;
                        usedQuery = candidate;
                        break;
                    }
                }
                const limitedResults = results.slice(0, 15);
                await (0, jobs_1.appendEvent)(client, job.id, 'fwc_employer_results', {
                    employerId,
                    employerName,
                    query: usedQuery,
                    resultsCount: results.length,
                    firstTitle: results[0]?.title,
                    results: autoLink ? undefined : limitedResults,
                });
                if (results.length > 0) {
                    if (autoLink) {
                        const bestResult = results[0];
                        await upsertEbaRecord(client, employerId, bestResult);
                        succeeded += 1;
                        await (0, jobs_1.appendEvent)(client, job.id, 'fwc_employer_succeeded', {
                            employerId,
                            employerName,
                            resultTitle: bestResult.title,
                            status: bestResult.status,
                        });
                    }
                    else {
                        succeeded += 1;
                        await (0, jobs_1.appendEvent)(client, job.id, 'fwc_employer_candidates', {
                            employerId,
                            employerName,
                            query: usedQuery,
                            results: limitedResults,
                        });
                    }
                }
                else {
                    failed += 1;
                    await (0, jobs_1.appendEvent)(client, job.id, 'fwc_employer_no_results', {
                        employerId,
                        employerName,
                    });
                }
            }
            catch (error) {
                failed += 1;
                const basePayload = {
                    employerId,
                    employerName,
                    error: error instanceof Error ? error.message : 'unknown error',
                };
                if (error instanceof FwcSearchError) {
                    basePayload.debug = error.context;
                    await (0, jobs_1.appendEvent)(client, job.id, 'fwc_employer_debug', {
                        employerId,
                        employerName,
                        context: error.context,
                    });
                }
                await (0, jobs_1.appendEvent)(client, job.id, 'fwc_employer_failed', basePayload);
                console.error('[worker] fwc_lookup employer failed', employerId, error);
            }
            await (0, jobs_1.updateProgress)(client, job.id, index + 1);
            await sleep(1000);
        }
    }
    finally {
        await browser.close();
    }
    return { succeeded, failed };
}
async function getBrowser() {
    return puppeteer_1.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
    });
}
async function searchFwcAgreements(browser, companyName) {
    const simplifiedName = simplifyCompanyName(companyName);
    const query = simplifiedName ? `cfmeu construction nsw ${simplifiedName}` : companyName;
    const searchUrl = new URL('https://www.fwc.gov.au/document-search');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('options', 'SearchType_3,SortOrder_agreement-relevance,ExpiryFromDate_01/01/2024');
    searchUrl.searchParams.set('pagesize', '50');
    searchUrl.searchParams.set('facets', 'AgreementStatusDesc_Approved,AgreementType_Single-enterprise Agreement,AgreementIndustry_Building metal and civil construction industries');
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36');
    try {
        try {
            await page.goto(searchUrl.toString(), { waitUntil: 'networkidle2', timeout: 45000 });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const pageUrl = page.url();
            const pageTitle = await page.title().catch(() => 'unknown');
            const htmlSample = truncateForLog(await page.content().catch(() => ''));
            throw new FwcSearchError(message, {
                stage: 'goto',
                query,
                pageUrl,
                pageTitle,
                htmlSample,
                errorMessage: message,
            });
        }
        let content;
        let waitedForViewModel = false;
        let waitWarningContext = null;
        try {
            await page.waitForFunction(() => typeof window !== 'undefined' &&
                Boolean(window.aspViewModel?.documentResult), { timeout: 30000 });
            waitedForViewModel = true;
        }
        catch (error) {
            const [pageUrl, pageTitle, hasAsp] = await Promise.all([
                page.url(),
                page.title().catch(() => 'unknown'),
                page
                    .evaluate(() => Boolean(window.aspViewModel))
                    .catch(() => false),
            ]);
            content = await page.content();
            const snippet = truncateForLog(content);
            const message = error instanceof Error ? error.message : String(error);
            console.warn('[worker] FWC aspViewModel wait timed out', {
                query,
                pageUrl,
                pageTitle,
                hasAspViewModel: hasAsp,
                htmlSample: snippet,
                error: message,
            });
            waitWarningContext = {
                stage: 'wait_for_viewmodel',
                query,
                pageUrl,
                pageTitle,
                hasAspViewModel: hasAsp,
                htmlSample: snippet,
                errorMessage: message,
            };
        }
        const finalContent = content ?? (await page.content());
        const parsed = parseSearchResults(finalContent, query);
        console.log(`[worker] FWC search`, {
            query,
            resultCount: parsed.length,
            waitedForViewModel,
            waitWarning: Boolean(waitWarningContext),
        });
        if (parsed.length === 0 && waitWarningContext) {
            throw new FwcSearchError(waitWarningContext.errorMessage ?? 'FWC results empty after wait timeout', waitWarningContext);
        }
        return parsed;
    }
    catch (error) {
        if (error instanceof FwcSearchError) {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        const pageUrl = await page.url();
        const pageTitle = await page.title().catch(() => 'unknown');
        const htmlSample = truncateForLog(await page.content().catch(() => ''));
        throw new FwcSearchError(message, {
            stage: 'parse',
            query,
            pageUrl,
            pageTitle,
            htmlSample,
            errorMessage: message,
        });
    }
    finally {
        await page.close();
    }
}
function simplifyCompanyName(companyName) {
    if (!companyName)
        return '';
    let simplified = companyName
        .replace(/\s+(Pty\s+Ltd|Pty\.?\s*Ltd\.?|Limited|Ltd\.?|Incorporated|Inc\.?|Corporation|Corp\.?)$/i, '')
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\s+(Group|Holdings|Enterprises|Services|Solutions|Systems|Technologies|International|Australia|Australian)$/i, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const words = simplified.split(' ').filter((word) => word.length > 2);
    simplified = words.slice(0, 3).join(' ');
    return simplified;
}
function truncateForLog(value, max = 1200) {
    if (value.length <= max)
        return value;
    return `${value.slice(0, max)}…`;
}
function buildQueryCandidates(companyName, override) {
    const candidates = new Set();
    const cleanOverride = override?.trim();
    const simplified = simplifyCompanyName(companyName);
    const basePrefix = (term) => `cfmeu construction nsw ${term}`.trim();
    if (cleanOverride) {
        candidates.add(cleanOverride);
        candidates.add(basePrefix(cleanOverride));
    }
    if (simplified && simplified !== cleanOverride) {
        candidates.add(basePrefix(simplified));
        candidates.add(simplified);
    }
    if (companyName && companyName !== simplified && companyName !== cleanOverride) {
        candidates.add(basePrefix(companyName));
        candidates.add(companyName);
    }
    if (candidates.size === 0) {
        candidates.add(basePrefix(companyName || ''));
        candidates.add(companyName || '');
    }
    return Array.from(candidates).filter((q) => q.trim().length > 0);
}
function parseSearchResults(html, searchQuery) {
    const viewModel = extractAspViewModel(html);
    if (viewModel?.documentResult) {
        const token = viewModel.documentResult.token ?? undefined;
        const rawResults = Array.isArray(viewModel.documentResult.results)
            ? viewModel.documentResult.results
            : [];
        const parsedResults = rawResults
            .map((raw) => mapViewModelResult(raw, token))
            .filter((result) => Boolean(result));
        if (parsedResults.length > 0) {
            return parsedResults;
        }
    }
    return parseLegacyHtml(html);
}
function extractAspViewModel(html) {
    const match = html.match(/aspViewModel\s*=\s*(\{[\s\S]*?\})\s*;\s*<\/script>/);
    if (!match)
        return null;
    try {
        return JSON.parse(match[1]);
    }
    catch (error) {
        console.warn('[worker] Failed to parse aspViewModel JSON', error);
        return null;
    }
}
function mapViewModelResult(raw, token) {
    const document = raw.document ?? {};
    const title = pickString(raw.DocumentTitle, document.DocumentTitle, raw.AgreementTitle, document.AgreementTitle);
    if (!title)
        return null;
    const agreementType = pickString(raw.AgreementType, document.AgreementType) || 'Single-enterprise Agreement';
    const status = pickString(raw.AgreementStatusDesc, document.AgreementStatusDesc) || 'Unknown';
    const approvedDate = normalizeAspDate(raw.DocumentDates || document.DocumentDates);
    const expiryDate = normalizeAspDate(raw.NominalExpiryDate || document.NominalExpiryDate);
    const lodgementNumber = pickString(raw.PublicationID, document.PublicationID);
    const decodedUrl = decodeStorageUrl(document.metadata_storage_path);
    const documentUrl = decodedUrl ? appendToken(decodedUrl, token) : undefined;
    return {
        title,
        agreementType,
        status,
        approvedDate: approvedDate ?? undefined,
        expiryDate: expiryDate ?? undefined,
        lodgementNumber: lodgementNumber ?? undefined,
        documentUrl,
        summaryUrl: undefined,
        downloadToken: token,
    };
}
function ensureArray(value) {
    if (Array.isArray(value))
        return value;
    if (value === undefined || value === null)
        return [];
    return [value];
}
function pickString(...candidates) {
    for (const candidate of candidates) {
        const values = ensureArray(candidate);
        for (const value of values) {
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed)
                    return trimmed;
            }
        }
    }
    return null;
}
function normalizeAspDate(value) {
    const [first] = ensureArray(value);
    if (!first || typeof first !== 'string')
        return null;
    const trimmed = first.trim();
    if (!trimmed)
        return null;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
    }
    return trimmed;
}
function decodeStorageUrl(value) {
    if (typeof value !== 'string' || !value)
        return undefined;
    try {
        const decoded = Buffer.from(value, 'base64').toString('utf8').trim();
        return decoded.replace(/(\.pdf|\.doc|\.docx|\.rtf|\.zip)(\d+)$/i, '$1');
    }
    catch {
        return undefined;
    }
}
function appendToken(url, token) {
    if (!token)
        return url;
    const normalizedToken = token.startsWith('?') ? token : `?${token}`;
    return url.includes('?') ? `${url}&${normalizedToken.slice(1)}` : `${url}${normalizedToken}`;
}
function parseLegacyHtml(html) {
    const $ = cheerio.load(html);
    const results = [];
    const agreementLinks = $('a h3').parent();
    agreementLinks.each((_, linkElement) => {
        const $link = $(linkElement);
        const $container = $link.closest('div').parent();
        const title = $link.find('h3').text().trim();
        if (!title || title.length < 10)
            return;
        let documentUrl = $link.attr('href') || '';
        if (documentUrl && !documentUrl.startsWith('http')) {
            documentUrl = `https://www.fwc.gov.au${documentUrl}`;
        }
        const $metadataContainer = $container.find('div').last();
        const metadataText = $metadataContainer.text();
        let status = 'Unknown';
        let agreementId = '';
        let approvedDate = '';
        let expiryDate = '';
        const statusMatch = metadataText.match(/\b(Approved|Terminated|Replaced|Superseded)\b/i);
        if (statusMatch)
            status = statusMatch[1];
        const idMatch = metadataText.match(/\b(AE\d+)\b/);
        if (idMatch)
            agreementId = idMatch[1];
        const approvedMatch = metadataText.match(/Approved:\s*(\d{1,2}\s+\w+\s+\d{4})/i);
        if (approvedMatch)
            approvedDate = approvedMatch[1];
        const expiryMatch = metadataText.match(/Nominal expiry date:\s*(\d{1,2}\s+\w+\s+\d{4})/i);
        if (expiryMatch)
            expiryDate = expiryMatch[1];
        const summaryUrlMatch = metadataText.match(/Summary:\s*(https?:\/\/\S+)/i);
        const summaryUrl = summaryUrlMatch ? summaryUrlMatch[1] : undefined;
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
        });
    });
    return results;
}
async function upsertEbaRecord(client, employerId, result) {
    const { data: existingRecord, error: fetchError } = await client
        .from('company_eba_records')
        .select('id')
        .eq('employer_id', employerId)
        .maybeSingle();
    if (fetchError) {
        throw new Error(`Failed to fetch existing EBA record: ${fetchError.message}`);
    }
    const updateData = {
        fwc_document_url: result.documentUrl,
        fwc_lodgement_number: result.lodgementNumber,
        fwc_certified_date: normalizeDateInput(result.approvedDate),
        nominal_expiry_date: normalizeDateInput(result.expiryDate),
        comments: existingRecord
            ? `Updated from FWC search. Agreement: ${result.title}. Status: ${result.status}.`
            : `Auto-imported from FWC search. Agreement: ${result.title}. Status: ${result.status}.`,
    };
    if (existingRecord) {
        const { error } = await client
            .from('company_eba_records')
            .update(updateData)
            .eq('id', existingRecord.id);
        if (error) {
            throw new Error(`Failed to update existing EBA record: ${error.message}`);
        }
    }
    else {
        const { error } = await client
            .from('company_eba_records')
            .insert({
            employer_id: employerId,
            eba_file_number: result.title.substring(0, 100),
            ...updateData,
        });
        if (error) {
            throw new Error(`Failed to insert new EBA record: ${error.message}`);
        }
    }
    const { error: employerUpdateError } = await client
        .from('employers')
        .update({ enterprise_agreement_status: true })
        .eq('id', employerId);
    if (employerUpdateError) {
        throw new Error(`Failed to update employer status: ${employerUpdateError.message}`);
    }
}
function normalizeDateInput(value) {
    if (!value)
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
    }
    const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (match) {
        const dd = match[1].padStart(2, '0');
        const mm = match[2].padStart(2, '0');
        let yyyy = match[3];
        if (yyyy.length === 2) {
            yyyy = (Number(yyyy) > 50 ? '19' : '20') + yyyy;
        }
        return `${yyyy}-${mm}-${dd}`;
    }
    return null;
}
