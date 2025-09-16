import 'dotenv/config'
import puppeteer, { type Page, type ElementHandle } from 'puppeteer'
import fs from 'node:fs/promises'
import path from 'node:path'

const PORTAL_URL = 'https://compliancelink.incolink.org.au/'

function parseFilename(disposition?: string) {
  if (!disposition) return null
  const m = /filename\*?=(?:UTF-8'')?"?([^\";]+)"?/i.exec(disposition)
  return m ? decodeURIComponent(m[1]) : null
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function waitForSelectorAny(page: Page, selectors: string[], timeout = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    for (const sel of selectors) {
      const el = await page.$(sel)
      if (el) return el
    }
    await delay(200)
  }
  throw new Error(`Timeout waiting for any selector: ${selectors.join(', ')}`)
}

async function waitForSelectorAnyFrame(page: Page, selectors: string[], timeout = 30000) {
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

async function debugDump(page: Page, label: string) {
  try {
    const outDir = path.resolve(process.cwd(), 'tmp', 'incolink')
    await fs.mkdir(outDir, { recursive: true })
    const ts = Date.now()
    const png = path.join(outDir, `${ts}-${label}.png`)
    const htmlPath = path.join(outDir, `${ts}-${label}.html`)
    await page.screenshot({ path: png as `${string}.png`, fullPage: true }).catch(() => {})
    const html = await page.content().catch(() => '<no content>')
    await fs.writeFile(htmlPath, html || '<empty>')
    console.log(`Saved debug dump → ${png} and ${htmlPath}`)
  } catch {}
}

async function installDownloadInterceptorsAnyFrame(page: Page) {
  const script = () => {
    try {
      // @ts-ignore
      (window as any).__downloadIntercept = (window as any).__downloadIntercept || { blobs: [], urls: [], anchors: [] }
      const cap = (window as any).__downloadIntercept
      // @ts-ignore
      if (!(window as any).__patchedCreateObjectURL) {
        // @ts-ignore
        (window as any).__patchedCreateObjectURL = true
        const orig = URL.createObjectURL.bind(URL)
        URL.createObjectURL = function(obj: any) {
          try { cap.blobs.push(obj) } catch {}
          return orig(obj)
        }
      }
      // @ts-ignore
      if (!(window as any).__patchedWindowOpen) {
        // @ts-ignore
        (window as any).__patchedWindowOpen = true
        const origOpen = window.open?.bind(window)
        window.open = function(url: string | URL, target?: string, features?: string) {
          try { cap.urls.push(String(url)) } catch {}
          return origOpen ? origOpen(String(url), target, features) : null
        } as any
      }
      // @ts-ignore
      if (!(window as any).__patchedAnchorClick) {
        // @ts-ignore
        (window as any).__patchedAnchorClick = true
        const origClick = HTMLAnchorElement.prototype.click
        HTMLAnchorElement.prototype.click = function(this: HTMLAnchorElement) {
          try { cap.anchors.push({ href: this.href, download: this.download }) } catch {}
          return origClick.call(this)
        }
      }
    } catch {}
  }
  await page.evaluate(script).catch(() => {})
  const frames = page.frames()
  for (const frame of frames) {
    try { await frame.evaluate(script) } catch {}
  }
}

async function clickByText(page: Page, text: string) {
  const handle = await page.evaluateHandle((t) => {
    const elements = Array.from(document.querySelectorAll('button, a')) as Element[]
    const lowerNeedle = String(t).toLowerCase()
    return (
      elements.find((el) => (el.textContent || '').trim().toLowerCase().includes(lowerNeedle)) || null
    )
  }, text)
  const elementHandle = handle.asElement() as ElementHandle<Element> | null
  if (elementHandle) {
    await (elementHandle as ElementHandle<Element>).click()
    await elementHandle.dispose()
    return true
  }
  await handle.dispose()
  return false
}

async function clickByTextAnyFrame(page: Page, text: string, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  const lowerNeedle = text.toLowerCase()
  while (Date.now() < deadline) {
    const frames = page.frames()
    for (const frame of frames) {
      const handle = await frame.evaluateHandle((needle) => {
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
      const elementHandle = handle.asElement() as ElementHandle<Element> | null
      if (elementHandle) {
        try { await (elementHandle as ElementHandle<Element>).evaluate((el) => (el as HTMLElement).scrollIntoView({ block: 'center' })) } catch {}
        await (elementHandle as ElementHandle<Element>).click()
        await elementHandle.dispose()
        return true
      }
      await handle.dispose()
    }
    await delay(250)
  }
  return false
}

async function main() {
  const email = process.env.INCOLINK_EMAIL
  const password = process.env.INCOLINK_PASSWORD
  const employerNo = process.argv[2] || process.env.INCOLINK_EMPLOYER_NO || '7125150'

  if (!email || !password) {
    console.error('Set INCOLINK_EMAIL and INCOLINK_PASSWORD in .env')
    process.exit(1)
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH
  })
  let page: Page = await browser.newPage()
  page.on('popup', async (p) => {
    try { console.log('Detected popup window, switching context.'); page = p as Page } catch {}
  })
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36')
  page.setDefaultNavigationTimeout(60000)

  page.on('request', (req) => {
    const u = req.url()
    if (req.resourceType() === 'xhr' || req.resourceType() === 'fetch') {
      if (u.includes('invoice') || u.includes(employerNo)) {
        console.log('XHR/FETCH →', req.method(), u)
      }
    }
  })
  page.on('response', async (res) => {
    const u = res.url()
    const cd = res.headers()['content-disposition']
    if (cd && /attachment/i.test(cd)) {
      console.log('Download response:', u, cd)
    } else if (u.includes('invoice')) {
      console.log('Response:', res.status(), u)
    }
  })

  console.log('Opening portal…', PORTAL_URL)
  await page.goto(PORTAL_URL, { waitUntil: 'networkidle2' })

  const emailInput = (await page.$('input[type="email"]')) || (await page.$('input[placeholder*="Email" i]')) || (await waitForSelectorAny(page, ['input[type="email"]', 'input[placeholder*="Email" i]']))
  await emailInput!.type(email, { delay: 20 })

  const pwInput = (await page.$('input[type="password"]')) || (await page.$('input[placeholder*="Password" i]')) || (await waitForSelectorAny(page, ['input[type="password"]', 'input[placeholder*="Password" i]']))
  await pwInput!.type(password, { delay: 20 })

  try {
    const terms = await page.$('#termsAndConditionsAccepted')
    if (terms) {
      const isChecked = await page.evaluate((el) => (el as HTMLInputElement).checked, terms)
      if (!isChecked) { await (terms as ElementHandle<Element>).click() }
    }
  } catch {}

  let clickedLogin = false
  const loginBtn = await page.$('#loginButton')
  if (loginBtn) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
      (loginBtn as ElementHandle<Element>).click().then(() => (clickedLogin = true))
    ])
  } else {
    clickedLogin = (await clickByText(page, 'Login')) || (await clickByText(page, 'Sign in')) || (await (await page.$('button[type="submit"]'))?.click().then(() => true).catch(() => false)) || false
    if (clickedLogin) { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null) }
  }

  if (!clickedLogin) { throw new Error('Could not locate Login button.') }

  await page.waitForNetworkIdle({ idleTime: 800, timeout: 60000 })
  const searchInput = await waitForSelectorAnyFrame(page, [
    '#formEmployerSearch',
    'input[name="employerSearch.SearchText"]',
    'input[placeholder*="Employer Search" i]',
    'input[placeholder*="No or Name" i]',
    'input[placeholder*="Employer" i]',
    'input[placeholder*="Find" i]',
    'input[aria-label*="No or Name" i]',
    'input[aria-label*="Employer" i]',
    'input[type="search"]'
  ], 60000)

  await (searchInput as any).click({ clickCount: 3 })
  await (searchInput as any).type(employerNo, { delay: 25 })
  await page.keyboard.press('Enter')
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 60000 })

  let targetInvoice: string | null = null
  try {
    const rows = await page.$$eval('table tbody tr', (trs) =>
      trs.map((tr) => {
        const tds = Array.from(tr.querySelectorAll('td'))
        const text = tds.map((td) => (td.textContent || '').trim())
        const link = tr.querySelector('a')
        return { text, linkText: link ? (link.textContent || '').trim() : null }
      })
    )
    for (const r of rows as any[]) {
      const amountCell = r.text.find((t: string) => t.includes('$'))
      const amount = amountCell ? Number((amountCell.replace(/[^0-9.-]/g, ''))) : 0
      if (r.linkText && amount > 0) { targetInvoice = r.linkText; break }
    }
  } catch {}

  if (!targetInvoice) {
    const links = await page.$$eval('a', (as) =>
      as.map((a) => (a.textContent || '').trim()).filter((t) => /^\d{5,}$/.test(t as string))
    )
    targetInvoice = (links as string[])[0] || null
  }

  if (!targetInvoice) { throw new Error('Could not find a target invoice link.') }

  console.log('Opening invoice:', targetInvoice)
  const invHandle = await page.evaluateHandle((invoiceText) => {
    const links = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[]
    return links.find((a) => (a.textContent || '').trim() === String(invoiceText).trim()) || null
  }, targetInvoice)
  const invEl = invHandle.asElement() as ElementHandle<Element> | null
  if (!invEl) throw new Error('Invoice link element not found.')
  await invEl.click()
  await invEl.dispose()
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 60000 })

  // 3.5) Extract first-column member data and save CSV
  try {
    // Ensure invoice detail grid/table is mounted
    try {
      await waitForSelectorAnyFrame(
        page,
        [
          'table tbody tr',
          'table tr',
          'div[role="grid"] div[role="row"]'
        ],
        60000
      )
    } catch {}

    // Collect first-column text from any visible tables or ARIA grids across frames
    const firstColTextsArrays = await Promise.all(
      page.frames().map(async (frame) => {
        try {
          const inTables = await frame.$$eval('table tbody tr, table tr', (trs) =>
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

          // ARIA grid (e.g., QuickGrid)
          const inGrids = await frame.$$eval('div[role="grid"] div[role="row"]', (rows) =>
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

    // Parse into { surname, given_names, member_number }
    const parsed = firstColTexts
      .map((raw) => {
        const m = /^\s*([^,]+)\s*,\s*(.*?)\s*\((\d+)\)\s*$/.exec(raw)
        if (!m) return { surname: '', given_names: '', member_number: '', raw }
        return { surname: m[1], given_names: m[2], member_number: m[3], raw }
      })
      // Keep only rows that either matched or at least look like they have () with digits
      .filter((r) => r.member_number || /\(\d+\)/.test(r.raw))

    if (parsed.length) {
      const outDir = path.resolve(process.cwd(), 'tmp', 'incolink')
      await fs.mkdir(outDir, { recursive: true })
      const csvPath = path.join(outDir, `invoice-${targetInvoice}-members.csv`)
      const esc = (s: unknown) => '"' + String(s ?? '').replace(/"/g, '""') + '"'
      const header = ['surname', 'given_names', 'member_number', 'raw']
      const rows = parsed.map((r) => [r.surname, r.given_names, r.member_number, r.raw])
      const csv = [header.map(esc).join(','), ...rows.map((row) => row.map(esc).join(','))].join('\n')
      await fs.writeFile(csvPath, csv)
      console.log('Saved members CSV:', csvPath, 'rows:', rows.length)
    } else {
      console.log('No member rows detected in first column; skipping CSV.')
    }
  } catch (e) {
    console.log('Member CSV extraction failed (continuing):', e)
  }

  const dlWait = page.waitForResponse((res) => {
    const cd = res.headers()['content-disposition']
    return !!cd && /attachment/i.test(cd)
  }, { timeout: 60000 }).catch(() => null)
  await installDownloadInterceptorsAnyFrame(page)

  let exportClicked = (await clickByTextAnyFrame(page, 'Export Invoice Details')) || (await clickByTextAnyFrame(page, 'Export')) || false

  if (!exportClicked) {
    const fallback = await page.evaluateHandle(() => {
      const imgs = Array.from(document.querySelectorAll('img[alt]')) as HTMLImageElement[]
      let targetImg: HTMLImageElement | null = null
      for (let i = 0; i < imgs.length; i++) {
        const alt = (imgs[i].alt || '').toLowerCase()
        if (alt.indexOf('export invoice details') !== -1) { targetImg = imgs[i]; break }
      }
      if (!targetImg) return null
      let el: Element | null = targetImg
      while (el && el.tagName !== 'BUTTON' && el.tagName !== 'A') { el = el.parentElement }
      return el || null
    })
    const btn = fallback.asElement()
    if (btn) {
      try { await btn.evaluate((el) => (el as HTMLElement).scrollIntoView({ block: 'center' })) } catch {}
      await btn.click()
      await btn.dispose()
      exportClicked = true
    } else {
      await fallback.dispose()
    }
  }

  if (!exportClicked) { throw new Error('Could not find Export Invoice Details button.') }

  const res = await dlWait
  const outDir = path.resolve(process.cwd(), 'tmp', 'incolink')
  await fs.mkdir(outDir, { recursive: true })
  if (res) {
    const buf = await res.buffer()
    const fname = parseFilename(res.headers()['content-disposition']) || `invoice-${targetInvoice}.bin`
    const outPath = path.join(outDir, fname)
    await fs.writeFile(outPath, buf)
    console.log('Saved export via response:', outPath)
  } else {
    await debugDump(page, 'export-no-download')
    throw new Error('Did not observe a downloadable response.')
  }

  await browser.close()
}

main().catch(async (e) => {
  console.error('Probe failed:', e)
  process.exit(1)
})


