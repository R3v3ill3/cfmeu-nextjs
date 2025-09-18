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
      waitUntil: 'networkidle2', // Wait for network to be idle
      timeout: 45000
    });
    
    console.log('Page loaded. Waiting for results to render...');
    
    // It's good practice to wait for a selector that indicates results are loaded.
    // Based on manual inspection, the results are inside a div that gets populated.
    // We can wait for the presence of the result headings.
    await page.waitForSelector('a h3', { timeout: 30000 });

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
  const $ = cheerio.load(html);
  const results: FWCSearchResult[] = [];

  console.log('🔍 Parsing FWC search results...');
  
  // Based on browser inspection, FWC uses a structure like:
  // - Each result is in a container with heading level 3
  // - Metadata is in sibling generic containers
  // - PDF links are in the format /document-search/view/3/[encoded]
  
  // Find all h3 headings that are agreement titles (inside links)
  const agreementLinks = $('a h3').parent();
  console.log(`📋 Found ${agreementLinks.length} agreement title links`);
  
  agreementLinks.each((index, linkElement) => {
    try {
      const $link = $(linkElement);
      const $container = $link.closest('div').parent(); // Get the parent container
      
      // Extract title from h3
      const title = $link.find('h3').text().trim();
      if (!title || title.length < 10) return;
      
      console.log(`📄 Processing agreement: ${title}`);
      
      // Extract document URL
      let documentUrl = $link.attr('href') || '';
      if (documentUrl && !documentUrl.startsWith('http')) {
        documentUrl = `https://www.fwc.gov.au${documentUrl}`;
      }
      
      // Find the metadata container (sibling to the link container)
      const $metadataContainer = $container.find('div').last(); // Usually the last div has metadata
      const metadataText = $metadataContainer.text();
      
      console.log(`📊 Metadata for ${title.substring(0, 30)}...: ${metadataText.substring(0, 200)}`);
      
      // Extract specific metadata fields
      let status = 'Unknown';
      let agreementId = '';
      let approvedDate = '';
      let expiryDate = '';
      let abn = '';
      let employerName = '';
      
      // Look for status (Approved, Terminated, etc.)
      const statusMatch = metadataText.match(/\b(Approved|Terminated|Replaced|Superseded)\b/i);
      if (statusMatch) status = statusMatch[1];
      
      // Look for agreement ID (format: AE123456)
      const idMatch = metadataText.match(/\b(AE\d+)\b/);
      if (idMatch) agreementId = idMatch[1];
      
      // Look for approved date
      const approvedMatch = metadataText.match(/Approved:\s*(\d{1,2}\s+\w+\s+\d{4})/i);
      if (approvedMatch) approvedDate = approvedMatch[1];
      
      // Look for expiry date
      const expiryMatch = metadataText.match(/Nominal expiry:\s*(\d{1,2}\s+\w+\s+\d{4})/i);
      if (expiryMatch) expiryDate = expiryMatch[1];
      
      // Look for ABN
      const abnMatch = metadataText.match(/ABN:\s*(\d+)/);
      if (abnMatch) abn = abnMatch[1];
      
      // Extract employer name (usually after ABN or before ABN)
      const employerMatch = title.match(/^([^-]+)/);
      if (employerMatch) employerName = employerMatch[1].trim();
      
      // Find PDF download link
      let pdfUrl = '';
      const $pdfLink = $container.find('a').filter((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().toLowerCase();
        return href.includes('/document-search/view/') || text.includes('pdf');
      }).first();
      
      if ($pdfLink.length > 0) {
        pdfUrl = $pdfLink.attr('href') || '';
        if (pdfUrl && !pdfUrl.startsWith('http')) {
          pdfUrl = `https://www.fwc.gov.au${pdfUrl}`;
        }
      }

      const result: FWCSearchResult = {
        title: title,
        agreementType: 'Single-enterprise Agreement', // Default, could be parsed from metadata
        status: status,
        approvedDate: approvedDate || undefined,
        expiryDate: expiryDate || undefined,
        lodgementNumber: agreementId || undefined,
        documentUrl: pdfUrl || documentUrl,
        summaryUrl: documentUrl,
      };

      console.log(`✅ Parsed result:`, {
        title: result.title.substring(0, 50),
        status: result.status,
        agreementId,
        approvedDate,
        expiryDate
      });

      results.push(result);

    } catch (error) {
      console.error('Error parsing agreement result:', error);
    }
  });

  console.log(`✅ Successfully parsed ${results.length} EBA results`);

  // If still no results, provide detailed debugging
  if (results.length === 0) {
    console.log('⚠️ No EBA results could be parsed from FWC response. Dumping full HTML for review.');
    console.log('📄 Full FWC Response HTML:', html);
    
    // Debug: Check what elements exist
    const $ = cheerio.load(html);
    console.log('🔍 Page title:', $('title').text());
    console.log('🔍 Main headings:', $('h1, h2, h3').map((_, el) => $(el).text().trim()).get());
    console.log('🔍 Links found:', $('a').length);
    console.log('🔍 Forms found:', $('form').length);
    
    // Check for common FWC page elements
    const commonElements = ['.search-results', '.results', '.documents', '.agreements', '.no-results', '.error'];
    commonElements.forEach(selector => {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`🔍 Found ${selector}:`, elements.first().text().trim().substring(0, 200));
      }
    });
  }

  // Remove duplicates based on title similarity
  const uniqueResults = results.filter((result, index, arr) => {
    return index === arr.findIndex(r => 
      r.title.toLowerCase().trim() === result.title.toLowerCase().trim()
    );
  });

  return uniqueResults.slice(0, 20); // Limit to 20 results
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
