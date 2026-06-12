import puppeteer from 'puppeteer';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const AGENCY_NAME = process.env.AGENCY_NAME ?? 'Your Agency';
const AGENCY_GSTIN = process.env.AGENCY_GSTIN ?? '';
const AGENCY_ADDRESS = process.env.AGENCY_ADDRESS ?? '';
const AGENCY_STATE_CODE = process.env.AGENCY_STATE_CODE ?? '27';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function buildInvoiceHtml(invoice: Awaited<ReturnType<typeof fetchInvoiceForPdf>>): string {
  const items = invoice!.items;
  const isInterState = invoice!.client.stateCode !== AGENCY_STATE_CODE;

  const itemRows = items.map(item => {
    const base = item.quantity * item.unitRate;
    const tax = item.lineTotal - base;
    return `
      <tr>
        <td>${item.description}</td>
        <td class="center">${item.hsnSac ?? ''}</td>
        <td class="right">${item.quantity}</td>
        <td class="right">${fmt(item.unitRate)}</td>
        <td class="right">${item.taxRate}%</td>
        <td class="right">${fmt(tax)}</td>
        <td class="right bold">${fmt(item.lineTotal)}</td>
      </tr>`;
  }).join('');

  const taxRows = isInterState
    ? `<tr><td colspan="5"></td><td>IGST</td><td class="right">${fmt(invoice!.taxTotal)}</td></tr>`
    : `
      <tr><td colspan="5"></td><td>CGST</td><td class="right">${fmt(invoice!.taxTotal / 2)}</td></tr>
      <tr><td colspan="5"></td><td>SGST</td><td class="right">${fmt(invoice!.taxTotal / 2)}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #1a1a2e; background: #fff; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 24px; }
  .agency-name { font-size: 22px; font-weight: 700; color: #2563eb; }
  .agency-meta { font-size: 10px; color: #6b7280; margin-top: 4px; line-height: 1.5; }
  .invoice-badge { text-align: right; }
  .invoice-title { font-size: 28px; font-weight: 300; color: #9ca3af; letter-spacing: 2px; text-transform: uppercase; }
  .invoice-number { font-size: 16px; font-weight: 700; color: #2563eb; margin-top: 4px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .meta-box h3 { font-size: 10px; text-transform: uppercase; color: #9ca3af; letter-spacing: 1px; margin-bottom: 6px; }
  .meta-box p { font-size: 12px; line-height: 1.6; }
  .meta-box .bold { font-weight: 700; font-size: 14px; }
  .dates { display: flex; gap: 32px; margin-bottom: 24px; }
  .date-item { }
  .date-item .label { font-size: 10px; text-transform: uppercase; color: #9ca3af; letter-spacing: 1px; }
  .date-item .value { font-weight: 600; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  thead tr { background: #2563eb; color: white; }
  thead th { padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  thead th.right { text-align: right; }
  thead th.center { text-align: center; }
  tbody tr { border-bottom: 1px solid #f3f4f6; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody td { padding: 9px 8px; }
  tbody td.right { text-align: right; }
  tbody td.center { text-align: center; }
  tbody td.bold { font-weight: 600; }
  tfoot tr { border-top: 1px solid #e5e7eb; }
  tfoot td { padding: 8px; }
  tfoot td.right { text-align: right; }
  .total-row td { font-weight: 700; font-size: 14px; color: #2563eb; border-top: 2px solid #2563eb; }
  .notes { margin-top: 24px; padding: 14px; background: #f9fafb; border-left: 3px solid #2563eb; border-radius: 4px; }
  .notes h3 { font-size: 10px; text-transform: uppercase; color: #9ca3af; letter-spacing: 1px; margin-bottom: 6px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 10px; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; background: #dcfce7; color: #166534; }
  .po-ref { font-size: 11px; color: #6b7280; margin-top: 4px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="agency-name">${AGENCY_NAME}</div>
      <div class="agency-meta">
        ${AGENCY_ADDRESS ? `${AGENCY_ADDRESS}<br/>` : ''}
        ${AGENCY_GSTIN ? `GSTIN: ${AGENCY_GSTIN}` : ''}
      </div>
    </div>
    <div class="invoice-badge">
      <div class="invoice-title">Invoice</div>
      <div class="invoice-number">${invoice!.invoiceNumber}</div>
      <span class="status-badge">${invoice!.status}</span>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <h3>Bill To</h3>
      <p class="bold">${invoice!.client.name}</p>
      <p>${invoice!.client.contactName}</p>
      <p>${invoice!.client.contactEmail}</p>
      ${invoice!.client.gstin ? `<p>GSTIN: ${invoice!.client.gstin}</p>` : ''}
      ${invoice!.client.address ? `<p>${invoice!.client.address}</p>` : ''}
    </div>
    <div class="meta-box" style="text-align:right">
      <h3>Invoice Details</h3>
      <p><strong>Date:</strong> ${fmtDate(invoice!.issueDate)}</p>
      <p><strong>Due:</strong> ${fmtDate(invoice!.dueDate)}</p>
      ${invoice!.poNumber ? `<p><strong>PO Ref:</strong> ${invoice!.poNumber}</p>` : ''}
      ${invoice!.project ? `<p><strong>Project:</strong> ${invoice!.project.name}</p>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="center">HSN/SAC</th>
        <th class="right">Qty</th>
        <th class="right">Rate</th>
        <th class="right">Tax%</th>
        <th class="right">Tax Amt</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr><td colspan="5"></td><td>Subtotal</td><td class="right">${fmt(invoice!.subtotal)}</td></tr>
      ${taxRows}
      <tr class="total-row"><td colspan="5"></td><td>TOTAL</td><td class="right">${fmt(invoice!.total)}</td></tr>
    </tfoot>
  </table>

  ${invoice!.notes ? `
  <div class="notes">
    <h3>Notes</h3>
    <p>${invoice!.notes}</p>
  </div>` : ''}

  <div class="footer">
    This is a computer-generated invoice. ${AGENCY_GSTIN ? `GSTIN: ${AGENCY_GSTIN} |` : ''} Thank you for your business.
  </div>
</body>
</html>`;
}

async function fetchInvoiceForPdf(invoiceId: string) {
  return prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      client: true,
      project: { select: { name: true } },
    },
  });
}

export async function generateClientStatementPdf(clientId: string, from?: Date, to?: Date): Promise<Buffer> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error('Client not found');

  const where: Record<string, unknown> = { clientId };
  if (from || to) {
    where.issueDate = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: { payments: { orderBy: { paymentDate: 'asc' } } },
    orderBy: { issueDate: 'asc' },
  });

  let runningBalance = 0;
  const rows = invoices.flatMap(inv => {
    const rows: { date: string; description: string; debit: number; credit: number; balance: number }[] = [];
    runningBalance += inv.total;
    rows.push({ date: fmtDate(inv.issueDate), description: `Invoice ${inv.invoiceNumber}`, debit: inv.total, credit: 0, balance: runningBalance });
    for (const pay of inv.payments) {
      runningBalance -= pay.amount;
      rows.push({ date: fmtDate(pay.paymentDate), description: `Payment — ${pay.method}${pay.referenceNumber ? ' / ' + pay.referenceNumber : ''}`, debit: 0, credit: pay.amount, balance: runningBalance });
    }
    return rows;
  });

  const period = from && to
    ? `${fmtDate(from)} to ${fmtDate(to)}`
    : from ? `From ${fmtDate(from)}` : to ? `Up to ${fmtDate(to)}` : 'All time';

  const rowHtml = rows.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${r.description}</td>
      <td class="right">${r.debit > 0 ? fmt(r.debit) : ''}</td>
      <td class="right green">${r.credit > 0 ? fmt(r.credit) : ''}</td>
      <td class="right bold ${r.balance > 0 ? 'red' : 'green'}">${fmt(Math.abs(r.balance))}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #1a1a2e; background: #fff; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 24px; }
  .agency-name { font-size: 22px; font-weight: 700; color: #2563eb; }
  .title { font-size: 20px; font-weight: 300; color: #9ca3af; letter-spacing: 2px; text-transform: uppercase; }
  .subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; }
  .meta { display: flex; gap: 32px; margin-bottom: 24px; background: #f9fafb; padding: 16px; border-radius: 8px; }
  .meta-item .label { font-size: 10px; text-transform: uppercase; color: #9ca3af; letter-spacing: 1px; }
  .meta-item .value { font-weight: 600; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #2563eb; color: white; }
  thead th { padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  thead th.right { text-align: right; }
  tbody tr { border-bottom: 1px solid #f3f4f6; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody td { padding: 9px 8px; }
  td.right { text-align: right; }
  td.bold { font-weight: 600; }
  td.green { color: #16a34a; }
  td.red { color: #dc2626; }
  .summary { margin-top: 24px; text-align: right; }
  .summary-row { display: flex; justify-content: flex-end; gap: 32px; padding: 8px 0; border-top: 1px solid #e5e7eb; }
  .summary-row.total { font-weight: 700; font-size: 14px; color: #2563eb; border-top: 2px solid #2563eb; }
  .footer { margin-top: 32px; text-align: center; color: #9ca3af; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
</style></head>
<body>
  <div class="header">
    <div>
      <div class="agency-name">${AGENCY_NAME}</div>
      ${AGENCY_GSTIN ? `<div style="font-size:10px;color:#6b7280;margin-top:4px">GSTIN: ${AGENCY_GSTIN}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div class="title">Account Statement</div>
      <div class="subtitle">Period: ${period}</div>
    </div>
  </div>

  <div class="meta">
    <div class="meta-item">
      <div class="label">Client</div>
      <div class="value">${client.name}</div>
    </div>
    ${client.gstin ? `<div class="meta-item"><div class="label">GSTIN</div><div class="value">${client.gstin}</div></div>` : ''}
    <div class="meta-item">
      <div class="label">Contact</div>
      <div class="value">${client.contactName}</div>
    </div>
    <div class="meta-item">
      <div class="label">Email</div>
      <div class="value">${client.contactEmail}</div>
    </div>
    <div class="meta-item">
      <div class="label">Closing Balance</div>
      <div class="value" style="color:${runningBalance > 0 ? '#dc2626' : '#16a34a'}">${fmt(Math.abs(runningBalance))} ${runningBalance > 0 ? 'Due' : 'Advance'}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Description</th>
        <th class="right">Debit (₹)</th>
        <th class="right">Credit (₹)</th>
        <th class="right">Balance (₹)</th>
      </tr>
    </thead>
    <tbody>${rowHtml || '<tr><td colspan="5" style="text-align:center;padding:32px;color:#9ca3af">No transactions found</td></tr>'}</tbody>
  </table>

  <div class="footer">${AGENCY_NAME} · Generated ${fmtDate(new Date())} · This is a computer-generated statement.</div>
</body></html>`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', margin: { top: '0', right: '0', bottom: '0', left: '0' }, printBackground: true });
    return Buffer.from(pdf);
  } catch (err) {
    logger.error('Statement PDF generation failed', { clientId, err });
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}

export async function generateInvoicePdf(invoiceId: string): Promise<Buffer> {
  const invoice = await fetchInvoiceForPdf(invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  const html = buildInvoiceHtml(invoice);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } catch (err) {
    logger.error('PDF generation failed', { invoiceId, err });
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}
