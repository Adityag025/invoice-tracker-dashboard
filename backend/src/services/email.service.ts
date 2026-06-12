import { Resend } from 'resend';
import { logger } from '../lib/logger.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? 'invoices@agency.local';
const AGENCY_NAME = process.env.AGENCY_NAME ?? 'Agency';

export interface ReminderEmailPayload {
  to: string;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: Date;
  reminderType: string;
  invoiceId: string;
}

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

function buildSubject(type: string, invoiceNumber: string): string {
  switch (type) {
    case 'DUE_SOON':        return `Payment Reminder: Invoice ${invoiceNumber} is due in 7 days`;
    case 'DUE_TODAY':       return `Payment Due Today: Invoice ${invoiceNumber}`;
    case 'OVERDUE_3':       return `Overdue Notice: Invoice ${invoiceNumber} (3 days overdue)`;
    case 'OVERDUE_7':       return `Overdue Notice: Invoice ${invoiceNumber} (7 days overdue)`;
    case 'OVERDUE_14':      return `Final Notice: Invoice ${invoiceNumber} (14 days overdue)`;
    case 'PENDING_APPROVAL': return `Approval Required: Invoice ${invoiceNumber}`;
    case 'APPROVED':        return `Invoice ${invoiceNumber} Approved ✓`;
    case 'REJECTED':        return `Invoice ${invoiceNumber} Needs Revision`;
    default:                return `Invoice Reminder: ${invoiceNumber}`;
  }
}

function buildHtml(p: ReminderEmailPayload): string {
  const dueFmt = p.dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const isOverdue = ['OVERDUE_3', 'OVERDUE_7', 'OVERDUE_14'].includes(p.reminderType);
  const urgencyColor = isOverdue ? '#dc2626' : '#2563eb';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 32px 16px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
    <div style="background: ${urgencyColor}; padding: 28px 32px;">
      <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 600;">${AGENCY_NAME}</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">Invoice ${p.reminderType.replace(/_/g, ' ').toLowerCase()}</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">Dear ${p.clientName},</p>
      <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 28px;">
        ${isOverdue
          ? `This is a reminder that payment for invoice <strong>${p.invoiceNumber}</strong> is now overdue.`
          : `This is a friendly reminder that invoice <strong>${p.invoiceNumber}</strong> ${p.reminderType === 'DUE_TODAY' ? 'is due today' : 'will be due in 7 days'}.`
        }
      </p>
      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 28px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Invoice Number</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${p.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Amount Due</td>
            <td style="padding: 6px 0; color: ${urgencyColor}; font-size: 18px; font-weight: 700; text-align: right;">${fmtINR(p.amount)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Due Date</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${dueFmt}</td>
          </tr>
        </table>
      </div>
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        Please arrange payment at your earliest convenience. If you have already made the payment, please disregard this notice.
      </p>
    </div>
    <div style="background: #f8fafc; border-top: 1px solid #e5e7eb; padding: 20px 32px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">${AGENCY_NAME} · Automated invoice reminder</p>
    </div>
  </div>
</body>
</html>`;
}

export interface InvoiceEmailPayload {
  to: string;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: Date;
  invoiceId: string;
}

export async function sendInvoiceEmail(p: InvoiceEmailPayload): Promise<void> {
  const subject = `Invoice ${p.invoiceNumber} from ${AGENCY_NAME}`;
  const dueFmt = p.dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 32px 16px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
    <div style="background: #2563eb; padding: 28px 32px;">
      <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 600;">${AGENCY_NAME}</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">Invoice ${p.invoiceNumber}</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">Dear ${p.clientName},</p>
      <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 28px;">
        Please find your invoice <strong>${p.invoiceNumber}</strong> attached. Payment is due by <strong>${dueFmt}</strong>.
      </p>
      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 28px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Invoice Number</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${p.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Amount Due</td>
            <td style="padding: 6px 0; color: #2563eb; font-size: 18px; font-weight: 700; text-align: right;">${fmtINR(p.amount)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Due Date</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${dueFmt}</td>
          </tr>
        </table>
      </div>
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        Please arrange payment by the due date. If you have any questions, reply to this email.
      </p>
    </div>
    <div style="background: #f8fafc; border-top: 1px solid #e5e7eb; padding: 20px 32px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">${AGENCY_NAME} · Invoice notification</p>
    </div>
  </div>
</body>
</html>`;

  if (!resend) {
    logger.info('EMAIL (no RESEND_API_KEY — logging only)', { to: p.to, subject, invoiceId: p.invoiceId });
    return;
  }

  const { error } = await resend.emails.send({ from: FROM, to: p.to, subject, html });
  if (error) throw new Error(`Resend error: ${error.message}`);
  logger.info('Invoice email sent', { to: p.to, invoiceId: p.invoiceId });
}

export async function sendReminderEmail(p: ReminderEmailPayload): Promise<void> {
  const subject = buildSubject(p.reminderType, p.invoiceNumber);
  const html = buildHtml(p);

  if (!resend) {
    logger.info('EMAIL (no RESEND_API_KEY — logging only)', { to: p.to, subject, invoiceId: p.invoiceId });
    return;
  }

  const { error } = await resend.emails.send({ from: FROM, to: p.to, subject, html });
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
  logger.info('Reminder email sent', { to: p.to, type: p.reminderType, invoiceId: p.invoiceId });
}
