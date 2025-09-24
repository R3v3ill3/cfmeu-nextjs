import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import XLSX from 'xlsx'

const PORT = Number(process.env.PORT || 3250)
const MAX_FILE_SIZE_BYTES = 1_000_000 // 1MB hard cap (files typically <250KB)
const MAX_ROWS_PER_SHEET = 25_000 // safety guard far above expected size

const app = Fastify({
  logger: true
})

await app.register(cors, {
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  methods: ['POST', 'OPTIONS']
})
await app.register(multipart, {
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1
  }
})

type NormalizedProjectRow = {
  projectId: string
  projectName: string
  projectStage: string
  projectStatus?: string
  localValue?: number
  fundingTypePrimary?: string
  ownerTypeLevel1Primary?: string
  constructionStartDate?: string
  constructionEndDate?: string
  projectAddress?: string
  projectTown?: string
  projectState?: string
  postCode?: string
  latitude?: number
  longitude?: number
  lastUpdate?: string
}

type NormalizedCompanyRow = {
  projectId: string
  companyId?: string
  companyName: string
  roleOnProject: string
}

function trimString(value: unknown): string | undefined {
  const s = String(value ?? '').trim()
  return s.length ? s : undefined
}

function parseNumber(value: unknown): number | undefined {
  const s = String(value ?? '').replace(/[^0-9.-]+/g, '')
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

function parseDateToIso(value: unknown): string | undefined {
  const s = String(value ?? '').trim()
  if (!s) return undefined
  const d = new Date(s)
  if (!Number.isFinite(d.getTime())) return undefined
  return d.toISOString()
}

function dropTopBlankRow(ws: XLSX.WorkSheet): XLSX.WorkSheet {
  const range = XLSX.utils.decode_range(ws['!ref'] as string)
  // Read the first row; if all cells empty, shift range down by one
  let firstRowEmpty = true
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })]
    if (cell && String(cell.v ?? '').trim().length > 0) {
      firstRowEmpty = false
      break
    }
  }
  if (!firstRowEmpty) return ws
  // Move data up by one row
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const from = XLSX.utils.encode_cell({ r, c })
      const to = XLSX.utils.encode_cell({ r: r - 1, c })
      // @ts-ignore - worksheet is indexable
      ws[to] = ws[from]
      // @ts-ignore
      delete ws[from]
    }
  }
  // Update range
  const newRef = XLSX.utils.encode_range({ s: { r: range.s.r, c: range.s.c }, e: { r: range.e.r - 1, c: range.e.c } })
  ws['!ref'] = newRef
  return ws
}

function normalizeProjects(rows: any[]): NormalizedProjectRow[] {
  const out: NormalizedProjectRow[] = []
  for (const row of rows) {
    const projectId = trimString(row['Project ID'] ?? row['PID'] ?? row['ProjectID'])
    if (!projectId) continue // cannot include rows without a project id
    const item: NormalizedProjectRow = {
      projectId,
      projectName: trimString(row['Project Name']) ?? '',
      projectStage: trimString(row['Project Stage']) ?? ''
    }
    item.projectStatus = trimString(row['Project Status'])
    item.localValue = parseNumber(row['Local Value'] ?? row['Value'] ?? row['LocalValue'])
    item.fundingTypePrimary = trimString(row['Funding Type Primary'] ?? row['Funding Type'])
    item.ownerTypeLevel1Primary = trimString(row['Owner Type Level 1 Primary'] ?? row['Owner Type'])
    item.constructionStartDate = parseDateToIso(row['Construction Start Date (Original format)'] ?? row['Construction Start Date'])
    item.constructionEndDate = parseDateToIso(row['Construction End Date (Original format)'] ?? row['Construction End Date'])
    item.projectAddress = trimString(row['Project Address'] ?? row['Address'])
    item.projectTown = trimString(row['Project Town / Suburb'] ?? row['Town'] ?? row['Suburb'] ?? row['Project Town'])
    item.projectState = trimString(row['Project Province / State'] ?? row['State'] ?? row['Province'])
    item.postCode = trimString(row['Post Code'] ?? row['Postcode'] ?? row['Postal Code'])
    item.latitude = parseNumber(row['Latitude'] ?? row['Lat'])
    item.longitude = parseNumber(row['Longitude'] ?? row['Long'] ?? row['Lng'])
    item.lastUpdate = parseDateToIso(row['Last Update'] ?? row['Updated'] ?? row['LastUpdated'])
    // Require essential fields: projectId, projectName, projectStage
    if (item.projectName && item.projectStage) out.push(item)
  }
  return out
}

function normalizeCompanies(rows: any[]): NormalizedCompanyRow[] {
  const out: NormalizedCompanyRow[] = []
  for (const row of rows) {
    const projectId = trimString(row['Project ID'] ?? row['PID'] ?? row['ProjectID'])
    const companyName = trimString(row['Company Name'] ?? row['Company'])
    const roleOnProject = trimString(row['Role on Project'] ?? row['Role'])
    const companyId = trimString(row['Company ID'] ?? row['CompanyID'] ?? row['Company_ID'] ?? row['CID'])
    if (!projectId || !companyName || !roleOnProject) continue
    out.push({ projectId, companyName, roleOnProject, companyId })
  }
  return out
}

function validateHeaders(headers: string[], expected: string[]): { ok: boolean; missing: string[]; unexpected: string[] } {
  const lower = new Set(headers.map(h => h.trim().toLowerCase()))
  const missing = expected.filter(h => !lower.has(h.toLowerCase()))
  const unexpected = headers.filter(h => !expected.some(e => e.toLowerCase() === h.trim().toLowerCase()))
  return { ok: missing.length === 0, missing, unexpected }
}

app.post('/bci/normalize-xlsx', async (request, reply) => {
  const mp = await request.file({ limits: { fileSize: MAX_FILE_SIZE_BYTES } })
  if (!mp) {
    return reply.code(400).send({ error: 'No file uploaded' })
  }
  const filename = mp.filename || 'upload.xlsx'
  if (!/\.(xlsx|xlsm|xlam)$/i.test(filename)) {
    return reply.code(400).send({ error: 'Invalid file type. Please upload an .xlsx file.' })
  }

  // Write to a tmp file to allow XLSX to read from disk
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bci-'))
  const tmpPath = path.join(tmpDir, filename)
  const writeStream = await fs.open(tmpPath, 'w')
  try {
    for await (const chunk of mp.file) {
      await writeStream.write(chunk)
    }
  } finally {
    await writeStream.close()
  }

  try {
    const wb = XLSX.readFile(tmpPath, { cellDates: true })
    const projectSheetName = wb.SheetNames.find(n => /^project$/i.test(n))
    const companySheetName = wb.SheetNames.find(n => /^company|companies$/i.test(n))
    if (!projectSheetName || !companySheetName) {
      return reply.code(400).send({ error: 'Workbook must contain "Project" and "Company" sheets.' })
    }

    // Clone sheets and drop first blank row if present
    const projectWs = dropTopBlankRow({ ...wb.Sheets[projectSheetName] })
    const companyWs = dropTopBlankRow({ ...wb.Sheets[companySheetName] })

    const projectJson = XLSX.utils.sheet_to_json(projectWs, { defval: '' })
    const companyJson = XLSX.utils.sheet_to_json(companyWs, { defval: '' })

    if (projectJson.length > MAX_ROWS_PER_SHEET || companyJson.length > MAX_ROWS_PER_SHEET) {
      return reply.code(400).send({ error: 'Sheet is too large.' })
    }

    // Validate headers using the first row keys
    const projHeaders = Object.keys(projectJson[0] || {})
    const compHeaders = Object.keys(companyJson[0] || {})

    // Expected minimal columns (lowercased for comparison)
    const expectedProject = [
      'Project ID', 'Project Name', 'Project Stage'
    ]
    const expectedCompany = [
      'Project ID', 'Company Name', 'Role on Project'
    ]

    const projCheck = validateHeaders(projHeaders, expectedProject)
    const compCheck = validateHeaders(compHeaders, expectedCompany)

    if (!projCheck.ok || !compCheck.ok) {
      return reply.code(400).send({
        error: 'Template mismatch',
        details: {
          project: { missing: projCheck.missing, unexpected: projCheck.unexpected },
          company: { missing: compCheck.missing, unexpected: compCheck.unexpected }
        },
        guidance: 'Please re-export from BCI using the standard template.'
      })
    }

    const projects = normalizeProjects(projectJson)
    const companies = normalizeCompanies(companyJson)

    return reply.send({
      projects,
      companies,
      warnings: []
    })
  } catch (e: any) {
    request.log.error(e)
    return reply.code(500).send({ error: 'Failed to parse workbook' })
  } finally {
    try { await fs.unlink(tmpPath) } catch {}
    try { await fs.rmdir(tmpDir) } catch {}
  }
})

app.get('/health', async () => ({ status: 'ok' }))

app.listen({ port: PORT, host: '0.0.0.0' })
  .then(() => app.log.info(`bci-import-worker listening on http://localhost:${PORT}`))
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })


