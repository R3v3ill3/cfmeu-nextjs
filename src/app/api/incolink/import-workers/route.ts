import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

async function getBrowser() {
  if (process.env.VERCEL_ENV) {
    const puppeteerCore = await import('puppeteer-core')
    const { default: chromium } = await import('@sparticuz/chromium')
    return puppeteerCore.default.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    })
  } else {
    const puppeteer = (await import('puppeteer')).default
    return puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH
    })
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function waitForSelectorAnyFrame(page: any, selectors: string[], timeout = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const frames = page.frames()
    for (const frame of frames) {
      for (const sel of selectors) {
        const el = await frame.$(sel)
        if (el) return el
      }
    }
    await delay(250)
  }
  throw new Error(`Timeout waiting in any frame for selectors: ${selectors.join(', ')}`)
}

type ParsedMember = { surname: string; given_names: string; member_number: string; raw: string }

async function fetchMembersFromIncolink(incolinkNumber: string, invoiceNumber?: string): Promise<{ members: ParsedMember[], invoiceNumber: string, invoiceDate: string | null }> {
  const email = process.env.INCOLINK_EMAIL
  const password = process.env.INCOLINK_PASSWORD
  if (!email || !password) throw new Error('Missing INCOLINK_EMAIL or INCOLINK_PASSWORD')

  const browser = await getBrowser()
  let page: any
  try {
    page = await browser.newPage()
    // Handle potential popup windows that the portal may open
    page.on('popup', async (p: any) => {
      try { page = p } catch {}
    })
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36')
    page.setDefaultNavigationTimeout(60000)

    await page.goto('https://compliancelink.incolink.org.au/', { waitUntil: 'networkidle2' })
    const emailInput = (await page.$('input[type="email"]')) || (await page.$('input[placeholder*="Email" i]'))
    await emailInput.type(email, { delay: 20 })
    const pwInput = (await page.$('input[type="password"]')) || (await page.$('input[placeholder*="Password" i]'))
    await pwInput.type(password, { delay: 20 })
    try {
      const terms = await page.$('#termsAndConditionsAccepted')
      if (terms) {
        const isChecked = await page.evaluate((el: any) => (el as HTMLInputElement).checked, terms)
        if (!isChecked) await terms.click()
      }
    } catch {}
    const loginBtn = await page.$('#loginButton')
    if (loginBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
        loginBtn.click()
      ])
    } else {
      const submit = (await page.$('button[type="submit"]')) || (await page.$('button'))
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
        submit?.click().catch(async () => pwInput.press('Enter'))
      ])
    }

    const searchInput = await waitForSelectorAnyFrame(page, [
      '#formEmployerSearch',
      'input[name="employerSearch.SearchText"]',
      'input[placeholder*="No or Name" i]',
      'input[type="search"]'
    ], 60000)
    await searchInput.click({ clickCount: 3 })
    await searchInput.type(String(incolinkNumber), { delay: 25 })
    await page.keyboard.press('Enter')
    await delay(1500)

    let targetInvoice = invoiceNumber as string | undefined
    if (!targetInvoice) {
      try {
        const rows = await page.$$eval('table tbody tr', (trs: any[]) =>
          trs.map((tr) => {
            const tds = Array.from(tr.querySelectorAll('td')) as HTMLTableCellElement[]
            const text = tds.map((td) => (td.textContent || '').trim())
            const link = tr.querySelector('a')
            return { text, linkText: link ? (link.textContent || '').trim() : null }
          })
        )
        for (const r of rows) {
          const amountCell = r.text.find((t: string) => /\$/.test(t))
          const amount = amountCell ? Number(amountCell.replace(/[^0-9.-]/g, '')) : 0
          if (r.linkText && amount > 0) { targetInvoice = r.linkText; break }
        }
      } catch {}
      if (!targetInvoice) {
        const links = await page.$$eval('a', (as: any[]) => as.map((a) => (a.textContent || '').trim()).filter((t: string) => /^\d{5,}$/.test(t)))
        targetInvoice = links[0]
      }
    }
    if (!targetInvoice) throw new Error('Could not find a target invoice link')

    const clicked = await (async () => {
      const handle = await page.evaluateHandle((invoiceText: any) => {
        const links = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[]
        return links.find((a) => (a.textContent || '').trim() === String(invoiceText).trim()) || null
      }, targetInvoice)
      const el = handle.asElement()
      if (el) { await el.click(); await el.dispose(); return true }
      await handle.dispose(); return false
    })()
    if (!clicked) throw new Error('Invoice link element not found')
    await delay(1000)

    try { await waitForSelectorAnyFrame(page, ['table tbody tr', 'div[role="grid"] div[role="row"]'], 20000) } catch {}

    // Attempt to read an invoice date from visible content (common label-based extraction)
    const invoiceDate: string | null = await (async () => {
      try {
        // Look for date-like patterns near labels
        const dateFromDom = await page.evaluate(() => {
          const candidates: string[] = []
          const root = document.body
          const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
          const lines: string[] = []
          while (textWalker.nextNode()) {
            const t = (textWalker.currentNode.textContent || '').trim()
            if (t) lines.push(t)
          }
          const joined = lines.join(' ')
          // Simple AU date formats: dd/mm/yyyy or dd-mm-yyyy
          const m = joined.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/)
          return m ? m[1] : null
        })
        if (dateFromDom) return dateFromDom
      } catch {}
      return null
    })()

    const firstColTextsArrays = await Promise.all(
      page.frames().map(async (frame: any) => {
        try {
          const inTables = await frame.$$eval('table tbody tr, table tr', (trs: any[]) =>
            (trs as Element[])
              .map((tr) => {
                const td = tr.querySelector('td')
                if (!td) return ''
                const a = td.querySelector('a')
                const span = td.querySelector('span')
                const node = (a || span || td) as HTMLElement
                return (node.textContent || '').trim()
              })
              .filter((t) => !!t)
          )
          const inGrids = await frame.$$eval('div[role="grid"] div[role="row"]', (rows: any[]) =>
            (rows as Element[])
              .map((row) => {
                const cell = row.querySelector('div[role="cell"], td, th') as HTMLElement | null
                return cell ? (cell.textContent || '').trim() : ''
              })
              .filter((t) => !!t)
          )
          return [...inTables, ...inGrids]
        } catch {
          return [] as string[]
        }
      })
    )

    const firstColTexts = firstColTextsArrays
      .flat()
      .map((t) => (t || '').replace(/\s+/g, ' ').trim())
      .filter((t) => !!t && t.toLowerCase() !== 'default')

    const parsed: ParsedMember[] = firstColTexts
      .map((raw) => {
        const m = /^\s*([^,]+)\s*,\s*(.*?)\s*\((\d+)\)\s*$/.exec(raw)
        if (!m) return { surname: '', given_names: '', member_number: '', raw }
        return { surname: m[1], given_names: m[2], member_number: m[3], raw }
      })
      .filter((r) => r.member_number || /\(\d+\)/.test(r.raw))

    return { members: parsed, invoiceNumber: String(targetInvoice), invoiceDate }
  } finally {
    if (page) { try { await page.close() } catch {} }
    try { await (await browser).close() } catch {}
  }
}

function normalizeName(s: string) {
  return (s || '').trim().toLowerCase()
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  try {
    const { employerId, invoiceNumber } = await request.json()
    if (!employerId) return NextResponse.json({ error: 'employerId is required' }, { status: 400 })

    // Get employer to read incolink_id
    const { data: employer, error: empErr } = await supabase
      .from('employers')
      .select('id, name, incolink_id')
      .eq('id', employerId)
      .maybeSingle()
    if (empErr) throw empErr
    if (!employer) return NextResponse.json({ error: 'Employer not found' }, { status: 404 })
    if (!employer.incolink_id) return NextResponse.json({ error: 'Employer has no incolink_id' }, { status: 400 })

    const { members, invoiceNumber: resolvedInvoice, invoiceDate } = await fetchMembersFromIncolink(String(employer.incolink_id), invoiceNumber)

    const today = new Date().toISOString().slice(0, 10)
    let createdWorkers = 0
    let matchedWorkers = 0
    let placementsCreated = 0
    let placementsSkipped = 0

    for (const m of members) {
      const firstName = m.given_names?.trim() || ''
      const surname = m.surname?.trim() || ''
      const memberNo = m.member_number?.trim() || null

      // 1) Find existing worker by incolink_member_id
      let workerId: string | null = null
      if (memberNo) {
        const { data: byIncolink } = await supabase
          .from('workers')
          .select('id')
          .eq('incolink_member_id', memberNo)
          .maybeSingle()
        if (byIncolink?.id) {
          workerId = byIncolink.id
        }
      }

      // 2) Fallback match by name (case-insensitive)
      if (!workerId && firstName && surname) {
        const { data: byNameRows } = await supabase
          .from('workers')
          .select('id, first_name, surname')
          .ilike('first_name', firstName)
          .ilike('surname', surname)
          .limit(5)
        if (byNameRows && byNameRows.length > 0) {
          workerId = byNameRows[0].id
        }
      }

      // 3) Create if not found
      if (!workerId) {
        const { data: inserted, error: insErr } = await supabase
          .from('workers')
          .insert({
            first_name: firstName || '(unknown)',
            surname: surname || '(unknown)',
            union_membership_status: 'unknown', // Incolink workers have unknown union status by default
            incolink_member_id: memberNo
          })
          .select('id')
          .maybeSingle()
        if (insErr) throw insErr
        workerId = inserted?.id || null
        if (workerId) createdWorkers += 1
      } else {
        // For existing workers, preserve their union status but ensure incolink_member_id is set
        if (memberNo) {
          await supabase.from('workers').update({ incolink_member_id: memberNo }).eq('id', workerId).is('incolink_member_id', null)
        }
        matchedWorkers += 1
      }

      if (!workerId) continue

      // 4) Ensure placement exists for this employer
      const { data: existingPlacement } = await supabase
        .from('worker_placements')
        .select('id, end_date')
        .eq('worker_id', workerId)
        .eq('employer_id', employerId)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingPlacement && !existingPlacement.end_date) {
        placementsSkipped += 1
      } else {
        const { error: plErr } = await supabase
          .from('worker_placements')
          .insert({
            worker_id: workerId,
            employer_id: employerId,
            job_site_id: null,
            employment_status: 'permanent',
            start_date: today
          })
        if (!plErr) placementsCreated += 1
      }

      // Update worker last_incolink_payment date when known
      if (invoiceDate) {
        // Normalize to ISO date if in dd/mm/yyyy
        const iso = (() => {
          const m = invoiceDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
          if (!m) return null
          const dd = m[1].padStart(2, '0')
          const mm = m[2].padStart(2, '0')
          let yyyy = m[3]
          if (yyyy.length === 2) yyyy = (Number(yyyy) > 50 ? '19' : '20') + yyyy
          return `${yyyy}-${mm}-${dd}`
        })()
        const dateToSet = iso || invoiceDate
        await supabase.from('workers').update({ last_incolink_payment: dateToSet }).eq('id', workerId)
      }
    }

    // Update employer last_incolink_payment date
    if (invoiceDate) {
      const iso = (() => {
        const m = invoiceDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
        if (!m) return null
        const dd = m[1].padStart(2, '0')
        const mm = m[2].padStart(2, '0')
        let yyyy = m[3]
        if (yyyy.length === 2) yyyy = (Number(yyyy) > 50 ? '19' : '20') + yyyy
        return `${yyyy}-${mm}-${dd}`
      })()
      const dateToSet = iso || invoiceDate
      await supabase.from('employers').update({ last_incolink_payment: dateToSet }).eq('id', employerId)
    }

    return NextResponse.json({
      employerId,
      invoiceNumber: resolvedInvoice,
      invoiceDate: invoiceDate || null,
      counts: { createdWorkers, matchedWorkers, placementsCreated, placementsSkipped, totalParsed: members.length }
    })
  } catch (error) {
    console.error('Incolink import-workers failed:', error)
    const anyErr = error as any
    const message = (anyErr && (anyErr.message || anyErr.error)) ? (anyErr.message || anyErr.error) : (typeof error === 'string' ? error : JSON.stringify(error))
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


