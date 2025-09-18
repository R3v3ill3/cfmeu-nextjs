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
exports.processFwcJob = processFwcJob;
const cheerio = __importStar(require("cheerio"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const jobs_1 = require("../jobs");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function processFwcJob(client, job) {
    const payload = (job.payload ?? {});
    const employerIds = Array.isArray(payload.employerIds) ? payload.employerIds : [];
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
        for (const [index, employerId] of employerIds.entries()) {
            const employerName = employerMap.get(employerId) ?? employerId;
            await (0, jobs_1.appendEvent)(client, job.id, 'fwc_employer_started', { employerId, employerName });
            try {
                const results = await searchFwcAgreements(browser, employerName);
                if (results.length > 0) {
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
                    failed += 1;
                    await (0, jobs_1.appendEvent)(client, job.id, 'fwc_employer_no_results', {
                        employerId,
                        employerName,
                    });
                }
            }
            catch (error) {
                failed += 1;
                await (0, jobs_1.appendEvent)(client, job.id, 'fwc_employer_failed', {
                    employerId,
                    employerName,
                    error: error instanceof Error ? error.message : 'unknown error',
                });
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
        await page.goto(searchUrl.toString(), { waitUntil: 'networkidle2', timeout: 45000 });
        await page.waitForSelector('a h3', { timeout: 30000 });
        const content = await page.content();
        return parseSearchResults(content, query);
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
function parseSearchResults(html, searchQuery) {
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
        fwc_certified_date: result.approvedDate ?? null,
        nominal_expiry_date: result.expiryDate ?? null,
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
