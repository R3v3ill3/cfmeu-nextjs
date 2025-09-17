import { NextRequest, NextResponse } from 'next/server'

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
    return puppeteer.launch({ headless: true })
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function toCsv(rows: string[][]): string {
  const esc = (s: unknown) => '"' + String(s ?? '').replace(/"/g, '""') + '"'
  return rows.map((r) => r.map(esc).join(',')).join('\n')
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

export async function POST(request: NextRequest) {
  let browser: any
  let page: any
  try {
    const { incolinkNumber, invoiceNumber } = await request.json()
    if (!incolinkNumber) {
      return NextResponse.json({ error: 'incolinkNumber is required' }, { status: 400 })
    }

    const email = process.env.INCOLINK_EMAIL
    const password = process.env.INCOLINK_PASSWORD
    if (!email || !password) {
      return NextResponse.json({ error: 'Missing INCOLINK_EMAIL/INCOLINK_PASSWORD' }, { status: 500 })
    }

    browser = await getBrowser()
    page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36')
    page.setDefaultNavigationTimeout(60000)

    // Login
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

    // Search employer number
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

    // Open invoice
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
        const links = await page.$$eval('a', (as: any[]) =>
          as.map((a) => (a.textContent || '').trim()).filter((t: string) => /^\d{5,}$/.test(t))
        )
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

    // Extract first-column CSV rows
    try {
      await waitForSelectorAnyFrame(page, ['table tbody tr', 'div[role="grid"] div[role="row"]'], 20000)
    } catch {}

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

    const parsed = firstColTexts
      .map((raw) => {
        const m = /^\s*([^,]+)\s*,\s*(.*?)\s*\((\d+)\)\s*$/.exec(raw)
        if (!m) return { surname: '', given_names: '', member_number: '', raw }
        return { surname: m[1], given_names: m[2], member_number: m[3], raw }
      })
      .filter((r) => r.member_number || /\(\d+\)/.test(r.raw))

    const header = ['surname', 'given_names', 'member_number', 'raw']
    const rows = parsed.map((r) => [r.surname, r.given_names, r.member_number, r.raw])
    const csv = toCsv([header, ...rows])

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="invoice-${targetInvoice}-members.csv"`
      }
    })
  } catch (error) {
    console.error('Incolink invoice members CSV failed:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    if (page) { try { await page.close() } catch {} }
    if (browser) { try { await browser.close() } catch {} }
  }
}


