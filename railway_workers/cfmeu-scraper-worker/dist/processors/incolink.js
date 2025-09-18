"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processIncolinkJob = processIncolinkJob;
const puppeteer_1 = __importDefault(require("puppeteer"));
const config_1 = require("../config");
const jobs_1 = require("../jobs");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function processIncolinkJob(client, job) {
    const payload = (job.payload ?? {});
    const employerIds = Array.isArray(payload.employerIds) ? payload.employerIds : [];
    if (employerIds.length === 0) {
        await (0, jobs_1.appendEvent)(client, job.id, 'incolink_no_employers');
        return { succeeded: 0, failed: 0, createdWorkers: 0, matchedWorkers: 0, placementsCreated: 0, placementsSkipped: 0 };
    }
    const { data: employers, error: employerError } = await client
        .from('employers')
        .select('id, name, incolink_id')
        .in('id', employerIds);
    if (employerError) {
        throw new Error(`Failed to load employers: ${employerError.message}`);
    }
    const employerMap = new Map((employers ?? []).map((row) => [
        row.id,
        { name: row.name ?? '', incolinkId: row.incolink_id ?? '' },
    ]));
    let succeeded = 0;
    let failed = 0;
    let createdWorkers = 0;
    let matchedWorkers = 0;
    let placementsCreated = 0;
    let placementsSkipped = 0;
    const browser = await getBrowser();
    try {
        for (const [index, employerId] of employerIds.entries()) {
            const employerInfo = employerMap.get(employerId);
            if (!employerInfo || !employerInfo.incolinkId) {
                failed += 1;
                await (0, jobs_1.appendEvent)(client, job.id, 'incolink_employer_missing_id', {
                    employerId,
                    employerName: employerInfo?.name ?? employerId,
                });
                await (0, jobs_1.updateProgress)(client, job.id, index + 1);
                continue;
            }
            await (0, jobs_1.appendEvent)(client, job.id, 'incolink_employer_started', {
                employerId,
                employerName: employerInfo.name,
                incolinkId: employerInfo.incolinkId,
            });
            try {
                const invoiceResult = await fetchMembersFromIncolink(browser, employerInfo.incolinkId, payload.invoiceNumber);
                const processed = await persistMembers(client, employerId, invoiceResult);
                succeeded += 1;
                createdWorkers += processed.createdWorkers;
                matchedWorkers += processed.matchedWorkers;
                placementsCreated += processed.placementsCreated;
                placementsSkipped += processed.placementsSkipped;
                await (0, jobs_1.appendEvent)(client, job.id, 'incolink_employer_succeeded', {
                    employerId,
                    invoiceNumber: invoiceResult.invoiceNumber,
                    invoiceDate: invoiceResult.invoiceDate,
                    counts: processed,
                });
            }
            catch (error) {
                failed += 1;
                await (0, jobs_1.appendEvent)(client, job.id, 'incolink_employer_failed', {
                    employerId,
                    error: error instanceof Error ? error.message : 'unknown error',
                });
            }
            await (0, jobs_1.updateProgress)(client, job.id, index + 1);
            await sleep(1500);
        }
    }
    finally {
        await browser.close();
    }
    return { succeeded, failed, createdWorkers, matchedWorkers, placementsCreated, placementsSkipped };
}
async function getBrowser() {
    return puppeteer_1.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
    });
}
async function fetchMembersFromIncolink(browser, incolinkNumber, invoiceNumber) {
    const email = config_1.config.incolinkEmail;
    const password = config_1.config.incolinkPassword;
    const page = await browser.newPage();
    page.on('popup', async (popup) => {
        if (!popup)
            return;
        try {
            await popup.close();
        }
        catch { }
    });
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36');
        page.setDefaultNavigationTimeout(60000);
        await page.goto('https://compliancelink.incolink.org.au/', { waitUntil: 'networkidle2' });
        const emailInput = (await page.$('input[type="email"]')) || (await page.$('input[placeholder*="Email" i]'));
        if (!emailInput)
            throw new Error('Incolink email input not found');
        await emailInput.type(email, { delay: 20 });
        const pwInput = (await page.$('input[type="password"]')) || (await page.$('input[placeholder*="Password" i]'));
        if (!pwInput)
            throw new Error('Incolink password input not found');
        await pwInput.type(password, { delay: 20 });
        try {
            const terms = await page.$('#termsAndConditionsAccepted');
            if (terms) {
                const isChecked = await page.evaluate((el) => el.checked, terms);
                if (!isChecked)
                    await terms.click();
            }
        }
        catch { }
        const loginBtn = await page.$('#loginButton');
        if (loginBtn) {
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
                loginBtn.click(),
            ]);
        }
        else {
            const submit = (await page.$('button[type="submit"]')) || (await page.$('button'));
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
                submit?.click().catch(async () => pwInput.press('Enter')),
            ]);
        }
        const searchInput = await waitForSelectorAnyFrame(page, [
            '#formEmployerSearch',
            'input[name="employerSearch.SearchText"]',
            'input[placeholder*="No or Name" i]',
            'input[type="search"]',
        ]);
        await searchInput.click({ clickCount: 3 });
        await searchInput.type(String(incolinkNumber), { delay: 25 });
        await page.keyboard.press('Enter');
        await sleep(1500);
        let targetInvoice = invoiceNumber;
        if (!targetInvoice) {
            targetInvoice = await detectInvoiceSelection(page);
        }
        if (!targetInvoice)
            throw new Error('Could not find a target invoice link');
        const clicked = await clickInvoiceLink(page, targetInvoice);
        if (!clicked)
            throw new Error('Invoice link element not found');
        await sleep(1000);
        try {
            await waitForSelectorAnyFrame(page, ['table tbody tr', 'div[role="grid"] div[role="row"]'], 20000);
        }
        catch { }
        const invoiceDate = await extractInvoiceDate(page);
        const members = await extractMembers(page);
        return { members, invoiceNumber: targetInvoice, invoiceDate };
    }
    finally {
        try {
            await page.close();
        }
        catch { }
    }
}
async function waitForSelectorAnyFrame(page, selectors, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        for (const frame of page.frames()) {
            for (const selector of selectors) {
                const el = await frame.$(selector);
                if (el)
                    return el;
            }
        }
        await sleep(250);
    }
    throw new Error(`Timeout waiting for selectors: ${selectors.join(', ')}`);
}
async function detectInvoiceSelection(page) {
    try {
        const rows = await page.$$eval('table tbody tr', (trs) => trs.map((tr) => {
            const tds = Array.from(tr.querySelectorAll('td'));
            const text = tds.map((td) => (td.textContent || '').trim());
            const link = tr.querySelector('a');
            return {
                text,
                linkText: link ? (link.textContent || '').trim() : null,
            };
        }));
        for (const row of rows) {
            const amountCell = row.text.find((t) => /\$/.test(t));
            const amount = amountCell ? Number(amountCell.replace(/[^0-9.-]/g, '')) : 0;
            if (row.linkText && amount > 0) {
                return row.linkText;
            }
        }
    }
    catch { }
    try {
        const links = await page.$$eval('a', (as) => as
            .map((a) => (a.textContent || '').trim())
            .filter((text) => /^\d{5,}$/.test(text)));
        return links[0];
    }
    catch { }
    return undefined;
}
async function clickInvoiceLink(page, invoice) {
    return page.evaluate((invoiceText) => {
        const anchors = Array.from(document.querySelectorAll('a'));
        const target = anchors.find((a) => (a.textContent || '').trim() === String(invoiceText).trim());
        if (target) {
            target.click();
            return true;
        }
        return false;
    }, invoice);
}
async function extractInvoiceDate(page) {
    try {
        const date = await page.evaluate(() => {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            const lines = [];
            while (walker.nextNode()) {
                const text = (walker.currentNode.textContent || '').trim();
                if (text)
                    lines.push(text);
            }
            const combined = lines.join(' ');
            const match = combined.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/);
            return match ? match[1] : null;
        });
        return date ?? null;
    }
    catch {
        return null;
    }
}
async function extractMembers(page) {
    const frameResults = await Promise.all(page.frames().map(async (frame) => {
        try {
            const tableTexts = await frame.$$eval('table tbody tr, table tr', (trs) => trs
                .map((tr) => {
                const td = tr.querySelector('td');
                if (!td)
                    return '';
                const link = td.querySelector('a');
                const span = td.querySelector('span');
                const node = (link || span || td);
                return (node.textContent || '').trim();
            })
                .filter(Boolean));
            const gridTexts = await frame.$$eval('div[role="grid"] div[role="row"]', (rows) => rows
                .map((row) => {
                const cell = row.querySelector('div[role="cell"], td, th');
                return cell ? (cell.textContent || '').trim() : '';
            })
                .filter(Boolean));
            return [...tableTexts, ...gridTexts];
        }
        catch {
            return [];
        }
    }));
    return frameResults
        .flat()
        .map((text) => text.replace(/\s+/g, ' ').trim())
        .filter((text) => text && text.toLowerCase() !== 'default')
        .map((raw) => {
        const match = /^\s*([^,]+)\s*,\s*(.*?)\s*\((\d+)\)\s*$/.exec(raw);
        if (!match) {
            return { surname: '', given_names: '', member_number: '', raw };
        }
        return {
            surname: match[1],
            given_names: match[2],
            member_number: match[3],
            raw,
        };
    })
        .filter((entry) => entry.member_number || /\(\d+\)/.test(entry.raw));
}
async function persistMembers(client, employerId, invoice) {
    const today = new Date().toISOString().slice(0, 10);
    let createdWorkers = 0;
    let matchedWorkers = 0;
    let placementsCreated = 0;
    let placementsSkipped = 0;
    for (const member of invoice.members) {
        const firstName = member.given_names?.trim() || '';
        const surname = member.surname?.trim() || '';
        const memberNo = member.member_number?.trim() || null;
        let workerId = null;
        if (memberNo) {
            const { data: byMember } = await client
                .from('workers')
                .select('id')
                .eq('incolink_member_id', memberNo)
                .maybeSingle();
            if (byMember?.id) {
                workerId = byMember.id;
            }
        }
        if (!workerId && firstName && surname) {
            const { data: byName } = await client
                .from('workers')
                .select('id')
                .ilike('first_name', firstName)
                .ilike('surname', surname)
                .limit(1);
            if (byName && byName.length > 0) {
                workerId = byName[0].id;
            }
        }
        if (!workerId) {
            const { data: inserted, error } = await client
                .from('workers')
                .insert({
                first_name: firstName || '(unknown)',
                surname: surname || '(unknown)',
                union_membership_status: 'unknown',
                incolink_member_id: memberNo,
            })
                .select('id')
                .maybeSingle();
            if (error)
                throw error;
            workerId = inserted?.id ?? null;
            if (workerId) {
                createdWorkers += 1;
            }
        }
        else {
            if (memberNo) {
                await client
                    .from('workers')
                    .update({ incolink_member_id: memberNo })
                    .eq('id', workerId)
                    .is('incolink_member_id', null);
            }
            matchedWorkers += 1;
        }
        if (!workerId)
            continue;
        const { data: existingPlacement } = await client
            .from('worker_placements')
            .select('id, end_date')
            .eq('worker_id', workerId)
            .eq('employer_id', employerId)
            .order('start_date', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (existingPlacement && !existingPlacement.end_date) {
            placementsSkipped += 1;
        }
        else {
            const { error: placementError } = await client
                .from('worker_placements')
                .insert({
                worker_id: workerId,
                employer_id: employerId,
                job_site_id: null,
                employment_status: 'permanent',
                start_date: today,
            });
            if (!placementError) {
                placementsCreated += 1;
            }
        }
        if (invoice.invoiceDate) {
            const normalized = normalizeDate(invoice.invoiceDate);
            const dateToSet = normalized ?? invoice.invoiceDate;
            await client.from('workers').update({ incolink_last_matched: dateToSet }).eq('id', workerId);
        }
    }
    if (invoice.invoiceDate) {
        const normalized = normalizeDate(invoice.invoiceDate);
        const dateToSet = normalized ?? invoice.invoiceDate;
        await client.from('employers').update({ incolink_last_matched: dateToSet }).eq('id', employerId);
    }
    return { createdWorkers, matchedWorkers, placementsCreated, placementsSkipped };
}
function normalizeDate(value) {
    const match = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (!match)
        return null;
    const dd = match[1].padStart(2, '0');
    const mm = match[2].padStart(2, '0');
    let yyyy = match[3];
    if (yyyy.length === 2) {
        yyyy = (Number(yyyy) > 50 ? '19' : '20') + yyyy;
    }
    return `${yyyy}-${mm}-${dd}`;
}
