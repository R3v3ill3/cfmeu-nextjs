import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

export interface FWCSearchResult {
  title: string;
  agreementType: string;
  status: string;
  approvedDate?: string;
  expiryDate?: string;
  lodgementNumber?: string;
  documentUrl?: string;
  summaryUrl?: string;
  downloadToken?: string; // For handling dynamic URLs
}

// Function to simplify company names for better search results
function simplifyCompanyName(companyName: string): string {
  if (!companyName) return '';
  
  let simplified = companyName
    // Remove common company suffixes
    .replace(/\s+(Pty\s+Ltd|Pty\.?\s*Ltd\.?|Limited|Ltd\.?|Incorporated|Inc\.?|Corporation|Corp\.?)$/i, '')
    // Remove parenthetical information (like "Formerly known as...")
    .replace(/\s*\([^)]*\)/g, '')
    // Remove common business words that might confuse search
    .replace(/\s+(Group|Holdings|Enterprises|Services|Solutions|Systems|Technologies|International|Australia|Australian)$/i, '')
    // Remove punctuation and extra spaces
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Take only the first few significant words (max 3)
  const words = simplified.split(' ').filter(word => word.length > 2);
  simplified = words.slice(0, 3).join(' ');
  
  console.log(`📝 Simplified "${companyName}" → "${simplified}"`);
  return simplified;
}

async function getBrowser() {
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL_ENV;
  if (isProd) {
    const puppeteerCore = (await import('puppeteer-core')).default;
    const { default: chromium } = await import('@sparticuz/chromium');
    const executablePath = await chromium.executablePath();
    return puppeteerCore.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      executablePath,
      headless: chromium.headless,
    });
  } else {
    const puppeteer = (await import('puppeteer')).default;
    return puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH,
    });
  }
}

export async function POST(request: NextRequest) {
  let browser;
  try {
    const { companyName, searchTerm } = await request.json();
    
    if (!companyName && !searchTerm) {
      return NextResponse.json(
        { error: 'Company name or search term is required' },
        { status: 400 }
      );
    }

    // Build FWC search URL with simplified company name and expiry filter
    const simplifiedCompanyName = simplifyCompanyName(companyName);
    const query = searchTerm || `cfmeu construction nsw ${simplifiedCompanyName}`;
    const searchUrl = new URL('https://www.fwc.gov.au/document-search');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('options', 'SearchType_3,SortOrder_agreement-relevance,ExpiryFromDate_01/01/2024'); // SearchType_3 = Agreements, recent expiry
    searchUrl.searchParams.set('pagesize', '50');
    searchUrl.searchParams.set('facets', 'AgreementStatusDesc_Approved,AgreementType_Single-enterprise Agreement,AgreementIndustry_Building metal and civil construction industries');

    console.log(`🔍 Searching FWC for: "${query}"`);
    console.log(`📍 Search URL: ${searchUrl.toString()}`);

    browser = await getBrowser();
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36');

    console.log('Navigating to FWC page...');
    await page.goto(searchUrl.toString(), {
      waitUntil: 'networkidle2',
      timeout: 45000
    });

    console.log('Page loaded. Waiting for results to render...');

    await page.waitForFunction(
      () => typeof window !== 'undefined' && (window as any).aspViewModel?.documentResult !== undefined,
      { timeout: 30000 }
    );

    console.log('Results selector found. Getting page content.');
    const html = await page.content();
    
    const results = parseSearchResults(html, query);

    console.log(`✅ Found ${results.length} EBA results for "${query}"`);
    
    return NextResponse.json({ 
      results, 
      searchQuery: query,
      searchUrl: searchUrl.toString(),
      totalFound: results.length
    });

  } catch (error) {
    console.error('❌ FWC search error:', error);
    
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Search request timed out waiting for FWC results. The site may be slow or blocking requests. Please try again.', results: [] },
          { status: 408 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to search FWC database using Puppeteer', results: [] },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function parseSearchResults(html: string, searchQuery: string): FWCSearchResult[] {
  console.log('🔍 Parsing FWC search results...');
  const viewModel = extractAspViewModel(html);
  if (viewModel?.documentResult) {
    const token = viewModel.documentResult.token ?? undefined;
    const rawResults = Array.isArray(viewModel.documentResult.results)
      ? viewModel.documentResult.results
      : [];

    const parsedResults = rawResults
      .map(raw => mapViewModelResult(raw, token))
      .filter((result): result is FWCSearchResult => Boolean(result));

    console.log(`📋 Parsed ${parsedResults.length} results from FWC view model`);
    if (parsedResults.length > 0) {
      return dedupeResults(parsedResults);
    }
  }

  console.log('⚠️ Falling back to legacy HTML parsing for FWC results');
  const legacyResults = parseLegacyHtml(html);
  console.log(`📋 Parsed ${legacyResults.length} results via legacy parser`);
  return dedupeResults(legacyResults);
}

type AspViewModel = {
  documentResult?: {
    results?: Array<Record<string, any>>;
    token?: string;
  };
};

function extractAspViewModel(html: string): AspViewModel | null {
  const match = html.match(/aspViewModel\s*=\s*(\{[\s\S]*?\})\s*;\s*<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as AspViewModel;
  } catch (error) {
    console.warn('⚠️ Failed to parse aspViewModel JSON', error);
    return null;
  }
}

function mapViewModelResult(raw: Record<string, any>, token?: string): FWCSearchResult | null {
  const document = raw.document ?? {};

  const title = pickString(raw.DocumentTitle, document.DocumentTitle, raw.AgreementTitle, document.AgreementTitle);
  if (!title) return null;

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

function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function pickString(...candidates: Array<unknown>): string | null {
  for (const candidate of candidates) {
    const values = ensureArray(candidate as any);
    for (const value of values) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
    }
  }
  return null;
}

function normalizeAspDate(value: unknown): string | null {
  const [first] = ensureArray(value as any);
  if (!first || typeof first !== 'string') return null;
  const trimmed = first.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return trimmed;
}

function decodeStorageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8').trim();
    return decoded.replace(/(\.pdf|\.doc|\.docx|\.rtf|\.zip)(\d+)$/i, '$1');
  } catch {
    return undefined;
  }
}

function appendToken(url: string, token?: string): string {
  if (!token) return url;
  const normalizedToken = token.startsWith('?') ? token : `?${token}`;
  return url.includes('?') ? `${url}&${normalizedToken.slice(1)}` : `${url}${normalizedToken}`;
}

function parseLegacyHtml(html: string): FWCSearchResult[] {
  const $ = cheerio.load(html);
  const results: FWCSearchResult[] = [];

  const agreementLinks = $('a h3').parent();

  agreementLinks.each((_, linkElement) => {
    const $link = $(linkElement);
    const $container = $link.closest('div').parent();

    const title = $link.find('h3').text().trim();
    if (!title || title.length < 10) return;

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
    if (statusMatch) status = statusMatch[1];

    const idMatch = metadataText.match(/\b(AE\d+)\b/);
    if (idMatch) agreementId = idMatch[1];

    const approvedMatch = metadataText.match(/Approved:\s*(\d{1,2}\s+\w+\s+\d{4})/i);
    if (approvedMatch) approvedDate = approvedMatch[1];

    const expiryMatch = metadataText.match(/Nominal expiry:\s*(\d{1,2}\s+\w+\s+\d{4})/i);
    if (expiryMatch) expiryDate = expiryMatch[1];

    const summaryUrlMatch = metadataText.match(/Summary:\s*(https?:\/\/\S+)/i);
    const summaryUrl = summaryUrlMatch ? summaryUrlMatch[1] : undefined;

    results.push({
      title,
      agreementType: 'Single-enterprise Agreement',
      status,
      approvedDate: approvedDate || undefined,
      expiryDate: expiryDate || undefined,
      lodgementNumber: agreementId || undefined,
      documentUrl,
      summaryUrl,
    });
  });

  return results;
}

function dedupeResults(results: FWCSearchResult[]): FWCSearchResult[] {
  const unique = results.filter((result, index, arr) => {
    return index === arr.findIndex(r => r.title.toLowerCase().trim() === result.title.toLowerCase().trim());
  });

  return unique.slice(0, 20);
}

// Manual search endpoint for fallback
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const companyName = searchParams.get('company');
  
  if (!companyName) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
  }

  // Return manual search URL for user to open
  const simplifiedCompanyName = simplifyCompanyName(companyName);
  const manualSearchUrl = new URL('https://www.fwc.gov.au/document-search');
  manualSearchUrl.searchParams.set('q', `cfmeu construction nsw ${simplifiedCompanyName}`);
  manualSearchUrl.searchParams.set('options', 'SearchType_3,SortOrder_agreement-relevance,ExpiryFromDate_01/01/2024');
  manualSearchUrl.searchParams.set('pagesize', '50');
  manualSearchUrl.searchParams.set('facets', 'AgreementStatusDesc_Approved,AgreementType_Single-enterprise Agreement,AgreementIndustry_Building metal and civil construction industries');

  return NextResponse.json({ 
    manualSearchUrl: manualSearchUrl.toString(),
    message: 'Open this URL to manually search for EBAs'
  });
}
