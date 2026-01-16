interface EbaContactDetails {
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
}

export interface ProcessedEbaData {
  company_name: string;
  eba_file_number?: string;
  sector?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  comments?: string;
  fwc_document_url?: string;
  
  // Workflow date fields
  docs_prepared?: string;
  date_barg_docs_sent?: string;
  followup_email_sent?: string;
  out_of_office_received?: string;
  followup_phone_call?: string;
  date_draft_signing_sent?: string;
  eba_data_form_received?: string;
  date_eba_signed?: string;
  date_vote_occurred?: string;
  eba_lodged_fwc?: string;
  fwc_lodgement_number?: string;
  fwc_matter_number?: string;
  fwc_certified_date?: string;
}

// Parse contact details from the spreadsheet format
export function parseEbaContactDetails(
  contactName: string,
  contactPhone: string,
  contactEmail: string
): EbaContactDetails {
  const result: EbaContactDetails = {};
  
  if (contactName && contactName.trim() !== '') {
    result.contact_name = contactName.trim();
  }
  
  if (contactPhone && contactPhone.trim() !== '') {
    result.contact_phone = contactPhone.trim();
  }
  
  if (contactEmail && contactEmail.trim() !== '') {
    result.contact_email = contactEmail.trim();
  }
  
  return result;
}

// Parse date field that might contain multiple dates
export function parseEbaDate(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined

  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().split('T')[0]
  }

  if (typeof value === 'number' && !isNaN(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30)
    const date = new Date(excelEpoch + value * 24 * 60 * 60 * 1000)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  }

  const dateString = String(value).trim()
  if (!dateString) return undefined

  // Extract the first date if multiple dates are present (dd.mm.yyyy)
  const dotMatch = dateString.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/)
  if (dotMatch) {
    const day = dotMatch[1]
    const month = dotMatch[2]
    const year = dotMatch[3]
    const fullYear = year.length === 2 ? `20${year}` : year
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const slashMatch = dateString.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (slashMatch) {
    let day = slashMatch[1]
    let month = slashMatch[2]
    const year = slashMatch[3]
    if (parseInt(slashMatch[1], 10) <= 12 && parseInt(slashMatch[2], 10) > 12) {
      day = slashMatch[2]
      month = slashMatch[1]
    }
    const fullYear = year.length === 2 ? `20${year}` : year
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const parsed = new Date(dateString)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0]
  }

  return undefined
}

export function processEbaRow(row: Record<string, any>): ProcessedEbaData | null {
  const companyName =
    row['Company Name'] ||
    row['Company name'] ||
    row['company_name'] ||
    row['Company'] ||
    row['company'];
  
  // Skip rows with missing company name
  if (!companyName || companyName.trim() === '') {
    return null;
  }
  
  const contactDetails = parseEbaContactDetails(
    row['Contact Name'] || row['contact_name'] || '',
    row['Contact #'] || row['contact_phone'] || '',
    row['Email Address'] || row['email_address'] || ''
  );
  
  return {
    company_name: companyName.trim(),
    eba_file_number: row['EBA File'] || row['eba_file'] || undefined,
    sector: row['Sector'] || row['sector'] || undefined,
    comments: row['COMMENTS'] || row['comments'] || undefined,
    fwc_lodgement_number: row['FWC Lodgement #'] || row['fwc_lodgement_number'] || undefined,
    fwc_matter_number: row['FWC Matter #'] || row['fwc_matter_number'] || undefined,
    fwc_document_url:
      row['FWC Document Search Link'] ||
      row['FWC Document URL'] ||
      row['fwc_document_url'] ||
      row['Document URL'] ||
      row['document_url'] ||
      undefined,
    
    ...contactDetails,
    
    // Parse all the date fields
    docs_prepared: parseEbaDate(row['Docs prepared'] || row['docs_prepared'] || ''),
    date_barg_docs_sent: parseEbaDate(row['Date Barg DOCS/F20 sent'] || row['date_barg_docs_sent'] || ''),
    followup_email_sent: parseEbaDate(row['F/up Email sent for EBA Data Form'] || row['followup_email_sent'] || ''),
    out_of_office_received: parseEbaDate(row['Out of office email recvd'] || row['out_of_office_received'] || ''),
    followup_phone_call: parseEbaDate(row['F/up Phone Call for EBA Data Form'] || row['followup_phone_call'] || ''),
    date_draft_signing_sent: parseEbaDate(row['Date Draft/SIGNING  EBAs Sent'] || row['date_draft_signing_sent'] || ''),
    eba_data_form_received: parseEbaDate(row['EBA Data Form Recvd'] || row['eba_data_form_received'] || ''),
    date_eba_signed: parseEbaDate(row['Date EBA Signed'] || row['date_eba_signed'] || ''),
    date_vote_occurred: parseEbaDate(row['Date Vote Occurred'] || row['date_vote_occurred'] || ''),
    eba_lodged_fwc: parseEbaDate(row['EBA Lodged with FWC'] || row['eba_lodged_fwc'] || ''),
    fwc_certified_date: parseEbaDate(row['FWC Certified Date'] || row['fwc_certified_date'] || '')
  };
}

export function processEbaData(csvData: any[]): ProcessedEbaData[] {
  return csvData
    .map(row => processEbaRow(row))
    .filter((row): row is ProcessedEbaData => row !== null);
}