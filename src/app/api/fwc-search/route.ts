import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

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

export async function POST(request: NextRequest) {
  try {
    const { companyName, searchTerm } = await request.json();
    
    if (!companyName && !searchTerm) {
      return NextResponse.json(
        { error: 'Company name or search term is required' },
        { status: 400 }
      );
    }

    // Build FWC search URL
    const query = searchTerm || `cfmeu construction ${companyName}`;
    const searchUrl = new URL('https://www.fwc.gov.au/document-search');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('options', 'SearchType_3,SortOrder_agreement-relevance');
    searchUrl.searchParams.set('pagesize', '50');
    searchUrl.searchParams.set('facets', 'AgreementStatusDesc_Approved,AgreementType_Single-enterprise Agreement,AgreementIndustry_Building metal and civil construction industries');

    console.log(`🔍 Searching FWC for: "${query}"`);
    console.log(`📍 Search URL: ${searchUrl.toString()}`);

    // Fetch search results with proper headers
    const response = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      // Add timeout
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      console.error(`❌ FWC search failed: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `FWC search failed: ${response.statusText}`, results: [] },
        { status: response.status }
      );
    }

    const html = await response.text();
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
    
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Search request timed out. Please try again.', results: [] },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to search FWC database', results: [] },
      { status: 500 }
    );
  }
}

function parseSearchResults(html: string, searchQuery: string): FWCSearchResult[] {
  const $ = cheerio.load(html);
  const results: FWCSearchResult[] = [];

  // Look for search result items - FWC uses various selectors
  const searchSelectors = [
    '.search-result',
    '.document-result', 
    '.agreement-result',
    '[data-document-type="agreement"]',
    '.result-item'
  ];

  let resultElements: cheerio.Cheerio<cheerio.Element> = $();
  
  // Try different selectors to find results
  for (const selector of searchSelectors) {
    resultElements = $(selector);
    if (resultElements.length > 0) {
      console.log(`📋 Found ${resultElements.length} results using selector: ${selector}`);
      break;
    }
  }

  // If no structured results, look for any links containing agreement info
  if (resultElements.length === 0) {
    console.log('🔍 No structured results found, scanning for agreement links...');
    resultElements = $('a').filter((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().toLowerCase();
      return href.includes('agreement') || href.includes('document') || 
             text.includes('agreement') || text.includes('eba');
    });
    console.log(`📋 Found ${resultElements.length} potential agreement links`);
  }

  resultElements.each((index, element) => {
    try {
      const $el = $(element);
      
      // Extract title - try multiple approaches
      let title = $el.find('h3, h4, .title, .document-title').first().text().trim() ||
                  $el.find('a').first().text().trim() ||
                  $el.text().trim().split('\n')[0].trim();

      // Skip if title is too generic or empty
      if (!title || title.length < 10 || 
          title.toLowerCase().includes('search') ||
          title.toLowerCase().includes('filter')) {
        return;
      }

      // Extract document URL
      let documentUrl = $el.find('a').first().attr('href') || '';
      if (documentUrl && !documentUrl.startsWith('http')) {
        documentUrl = `https://www.fwc.gov.au${documentUrl}`;
      }

      // Extract metadata
      const metadata = $el.text();
      
      // Parse agreement type
      let agreementType = 'Single-enterprise Agreement';
      if (metadata.toLowerCase().includes('multi-enterprise')) {
        agreementType = 'Multi-enterprise Agreement';
      }

      // Parse status
      let status = 'Unknown';
      if (metadata.toLowerCase().includes('approved')) {
        status = 'Approved';
      } else if (metadata.toLowerCase().includes('terminated')) {
        status = 'Terminated';
      } else if (metadata.toLowerCase().includes('replaced')) {
        status = 'Replaced';
      }

      // Extract dates using regex
      const approvedMatch = metadata.match(/approved[:\s]*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i);
      const expiryMatch = metadata.match(/expir[a-z]*[:\s]*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i);
      const lodgementMatch = metadata.match(/lodgement[:\s]*([A-Z0-9]+)/i);

      // Extract download links - look for PDF or document download URLs
      let downloadUrl = '';
      $el.find('a').each((_, link) => {
        const href = $(link).attr('href') || '';
        const linkText = $(link).text().toLowerCase();
        if (href.includes('.pdf') || 
            linkText.includes('download') || 
            linkText.includes('view document') ||
            href.includes('/documents/')) {
          downloadUrl = href.startsWith('http') ? href : `https://www.fwc.gov.au${href}`;
          return false; // break
        }
      });

      const result: FWCSearchResult = {
        title: title.substring(0, 200), // Limit title length
        agreementType,
        status,
        approvedDate: approvedMatch?.[1],
        expiryDate: expiryMatch?.[1],
        lodgementNumber: lodgementMatch?.[1],
        documentUrl: documentUrl || undefined,
        summaryUrl: downloadUrl || undefined,
      };

      // Only add if we have meaningful data
      if (result.title.length > 10) {
        results.push(result);
      }

    } catch (error) {
      console.error('Error parsing search result:', error);
    }
  });

  // If still no results, provide fallback message
  if (results.length === 0) {
    console.log('⚠️ No EBA results could be parsed from FWC response');
    console.log('📄 HTML preview:', html.substring(0, 500));
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
  const { searchParams } = new URL(request.url);
  const companyName = searchParams.get('company');
  
  if (!companyName) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
  }

  // Return manual search URL for user to open
  const manualSearchUrl = new URL('https://www.fwc.gov.au/document-search');
  manualSearchUrl.searchParams.set('q', `cfmeu construction ${companyName}`);
  manualSearchUrl.searchParams.set('options', 'SearchType_3,SortOrder_agreement-relevance');
  manualSearchUrl.searchParams.set('facets', 'AgreementStatusDesc_Approved,AgreementType_Single-enterprise Agreement,AgreementIndustry_Building metal and civil construction industries');

  return NextResponse.json({ 
    manualSearchUrl: manualSearchUrl.toString(),
    message: 'Open this URL to manually search for EBAs'
  });
}
