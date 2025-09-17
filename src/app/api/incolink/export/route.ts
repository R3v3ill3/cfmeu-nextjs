import { NextRequest, NextResponse } from 'next/server'

// Important: Puppeteer must run on the Node.js runtime, not on Edge
export const runtime = 'nodejs'

type ExportResult = {
  filename: string
  contentType: string
  bytes: Uint8Array
}

async function getBrowser() {
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL_ENV
  if (isProd) {
    const puppeteerCore = (await import('puppeteer-core')).default
    const { default: chromium } = await import('@sparticuz/chromium')
    const executablePath = await chromium.executablePath()
    return puppeteerCore.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      executablePath,
      headless: chromium.headless
    })
  } else {
    const puppeteer = (await import('puppeteer')).default
    return puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH
    })
  }
}

async function waitForSelectorAny(page: any, selectors: string[], timeout = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    for (const sel of selectors) {
      const el = await page.$(sel)
      if (el) return el
    }
    await page.waitForTimeout(200)
  }
  throw new Error(`Timeout waiting for any selector: ${selectors.join(', ')}`)
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
    await page.waitForTimeout(250)
  }
  throw new Error(`Timeout waiting in any frame for selectors: ${selectors.join(', ')}`)
}

async function clickByTextAnyFrame(page: any, text: string, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  const lowerNeedle = text.toLowerCase()
  while (Date.now() < deadline) {
    const frames = page.frames()
    for (const frame of frames) {
      const handle = await frame.evaluateHandle((needle: string) => {
        const elements = Array.from(document.querySelectorAll('button, a, [role="button"]'))
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i] as HTMLElement
          const textContent = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
          if (textContent.indexOf(needle) !== -1) {
            return el
          }
        }
        return null
      }, lowerNeedle)
      const elementHandle = handle.asElement()
      if (elementHandle) {
        try {
          await elementHandle.evaluate((el: any) => (el as HTMLElement).scrollIntoView({ block: 'center' }))
        } catch {}
        await elementHandle.click()
        await elementHandle.dispose()
        return true
      }
      await handle.dispose()
    }
    await page.waitForTimeout(250)
  }
  return false
}

function parseFilename(disposition?: string | null) {
  if (!disposition) return null
  const m = /filename\*?=(?:UTF-8'')?"?([^\";]+)"?/i.exec(disposition)
  return m ? decodeURIComponent(m[1]) : null
}

async function findFirstNonZeroInvoice(page: any): Promise<string | null> {
  // Try main frame first
  try {
    const rows = await page.$$eval('table tbody tr', (trs: Element[]) =>
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
      if (r.linkText && amount > 0) {
        return r.linkText
      }
    }
  } catch {}

  // Try across frames
  const frames = page.frames()
  for (const frame of frames) {
    try {
      const rows = await frame.$$eval('table tbody tr', (trs: Element[]) =>
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
        if (r.linkText && amount > 0) {
          return r.linkText
        }
      }
    } catch {}
  }

  // Fallback: choose first numeric-looking anchor anywhere
  try {
    const links = await page.$$eval('a', (as: Element[]) =>
      (as as HTMLAnchorElement[])
        .map((a) => (a.textContent || '').trim())
        .filter((t) => /^\d{5,}$/.test(t))
    )
    return links[0] || null
  } catch {
    return null
  }
}

async function clickAnchorWithTextAnyFrame(page: any, exactText: string): Promise<boolean> {
  const frames = page.frames()
  const all = [page, ...frames]
  for (const ctx of all) {
    try {
      const handle = await ctx.evaluateHandle((needle: string) => {
        const links = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[]
        return links.find((a) => (a.textContent || '').trim() === String(needle).trim()) || null
      }, exactText)
      const el = handle.asElement()
      if (el) {
        await el.click()
        await el.dispose()
        return true
      }
      await handle.dispose()
    } catch {}
  }
  return false
}

async function performIncolinkExport(incolinkNumber: string, invoiceNumber?: string): Promise<ExportResult> {
  const browser = await getBrowser()
  let page: any
  try {
    page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36')
    page.setDefaultNavigationTimeout(60000)

    const email = process.env.INCOLINK_EMAIL
    const password = process.env.INCOLINK_PASSWORD
    if (!email || !password) {
      throw new Error('Missing INCOLINK_EMAIL or INCOLINK_PASSWORD environment variables')
    }

    // Track the first attachment-like response (download)
    let downloadResponse: any = null
    page.on('response', async (res: any) => {
      const cd = res.headers()['content-disposition']
      if (!downloadResponse && cd && /attachment/i.test(cd)) {
        downloadResponse = res
      }
    })

    // 1) Login
    await page.goto('https://compliancelink.incolink.org.au/', { waitUntil: 'networkidle2' })

    const emailInput = (await page.$('input[type="email"]')) || (await page.$('input[placeholder*="Email" i]')) || (await waitForSelectorAny(page, ['input[type="email"]', 'input[placeholder*="Email" i]']))
    await emailInput.type(email, { delay: 20 })
    const pwInput = (await page.$('input[type="password"]')) || (await page.$('input[placeholder*="Password" i]')) || (await waitForSelectorAny(page, ['input[type="password"]', 'input[placeholder*="Password" i]']))
    await pwInput.type(password, { delay: 20 })

    // Terms checkbox (best-effort)
    try {
      const terms = await page.$('#termsAndConditionsAccepted')
      if (terms) {
        const isChecked = await page.evaluate((el: any) => (el as HTMLInputElement).checked, terms)
        if (!isChecked) {
          await terms.click()
        }
      }
    } catch {}

    const loginBtn = await page.$('#loginButton')
    if (loginBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
        loginBtn.click()
      ])
    } else {
      const clicked = (await page.$('button[type="submit"]')) || (await waitForSelectorAny(page, ['button[type="submit"]'], 5000))
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
        clicked.click().catch(async () => pwInput.press('Enter'))
      ])
    }

    // 2) Search employer number (find the search input possibly in a frame)
    const searchInput = await waitForSelectorAnyFrame(
      page,
      [
        '#formEmployerSearch',
        'input[name="employerSearch.SearchText"]',
        'input[placeholder*="Employer Search" i]',
        'input[placeholder*="No or Name" i]',
        'input[aria-label*="No or Name" i]',
        'input[type="search"]'
      ],
      60000
    )
    await searchInput.click({ clickCount: 3 })
    await searchInput.type(String(incolinkNumber), { delay: 25 })
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1500)

    // 3) Resolve invoice number to open
    const targetInvoice = invoiceNumber || (await findFirstNonZeroInvoice(page))
    if (!targetInvoice) {
      throw new Error('Could not find a target invoice link')
    }

    const clicked = await clickAnchorWithTextAnyFrame(page, String(targetInvoice))
    if (!clicked) {
      throw new Error('Invoice link element not found')
    }
    await page.waitForTimeout(1500)

    // 4) Click Export
    const exportClicked = (await clickByTextAnyFrame(page, 'Export Invoice Details', 15000)) || (await clickByTextAnyFrame(page, 'Export', 5000))
    if (!exportClicked) {
      throw new Error('Could not find Export Invoice Details button')
    }

    // Wait for the attachment response
    const deadline = Date.now() + 60000
    while (!downloadResponse && Date.now() < deadline) {
      await page.waitForTimeout(200)
    }
    if (!downloadResponse) {
      throw new Error('Did not observe a downloadable response')
    }

    const buf: Buffer = await downloadResponse.buffer()
    const headers = downloadResponse.headers()
    const fname = parseFilename(headers['content-disposition']) || `incolink-invoice-${targetInvoice}.bin`
    const ctype = headers['content-type'] || 'application/octet-stream'

    return { filename: fname, contentType: ctype, bytes: new Uint8Array(buf) }
  } finally {
    if (page) {
      try { await page.close() } catch {}
    }
    try { await (await browser).close() } catch {}
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const incolinkNumber = String(body.incolinkNumber || body.employerNumber || body.number || '').trim()
    const invoiceNumber = body.invoiceNumber ? String(body.invoiceNumber).trim() : undefined

    if (!incolinkNumber) {
      return NextResponse.json({ error: 'incolinkNumber is required' }, { status: 400 })
    }

    const result = await performIncolinkExport(incolinkNumber, invoiceNumber)

    // Stream back the file buffer
    return new NextResponse(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename.replace(/"/g, '')}"`,
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('Incolink export failed:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


