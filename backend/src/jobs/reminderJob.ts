import { prisma } from '../lib/prisma.js';
import { sendReminderEmail } from '../services/email.service.js';
import { logger } from '../lib/logger.js';

interface ReminderRule {
  type: string;
  offsetDays: number; // negative = before due, positive = after due
  statuses: string[];
}

const RULES: ReminderRule[] = [
  { type: 'DUE_SOON',   offsetDays: -7,  statuses: ['SENT', 'VIEWED'] },
  { type: 'DUE_TODAY',  offsetDays: 0,   statuses: ['SENT', 'VIEWED', 'PART_PAID'] },
  { type: 'OVERDUE_3',  offsetDays: 3,   statuses: ['SENT', 'VIEWED', 'PART_PAID', 'OVERDUE'] },
  { type: 'OVERDUE_7',  offsetDays: 7,   statuses: ['SENT', 'VIEWED', 'PART_PAID', 'OVERDUE'] },
  { type: 'OVERDUE_14', offsetDays: 14,  statuses: ['SENT', 'VIEWED', 'PART_PAID', 'OVERDUE'] },
];

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export async function processReminders(): Promise<void> {
  const today = startOfDay(new Date());

  for (const rule of RULES) {
    // The trigger date = dueDate - offsetDays (for negative offset) or dueDate + offsetDays
    // i.e. dueDate = today - offsetDays
    const triggerDueDate = addDays(today, -rule.offsetDays);
    const nextDay = addDays(triggerDueDate, 1);

    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: rule.statuses },
        dueDate: {
          gte: triggerDueDate,
          lt: nextDay,
        },
        // Only invoices whose client email we have
        client: { contactEmail: { not: '' } },
      },
      include: {
        client: { select: { name: true, contactEmail: true } },
        reminderLogs: { where: { reminderType: rule.type } },
        payments: { select: { amount: true } },
      },
    });

    for (const invoice of invoices) {
      // Skip if already sent this reminder type
      if (invoice.reminderLogs.length > 0) continue;

      const paidSoFar = invoice.payments.reduce((s, p) => s + p.amount, 0);
      const remaining = invoice.total - paidSoFar;
      if (remaining <= 0) continue;

      try {
        await sendReminderEmail({
          to: invoice.client.contactEmail,
          clientName: invoice.client.name,
          invoiceNumber: invoice.invoiceNumber,
          amount: remaining,
          dueDate: invoice.dueDate,
          reminderType: rule.type,
          invoiceId: invoice.id,
        });

        await prisma.reminderLog.create({
          data: {
            invoiceId: invoice.id,
            reminderType: rule.type,
            sentAt: new Date(),
            emailTo: invoice.client.contactEmail,
            status: 'SENT',
          },
        });
      } catch (err) {
        logger.error('Reminder failed', { invoiceId: invoice.id, type: rule.type, err });
        await prisma.reminderLog.create({
          data: {
            invoiceId: invoice.id,
            reminderType: rule.type,
            sentAt: new Date(),
            emailTo: invoice.client.contactEmail,
            status: 'FAILED',
          },
        });
      }
    }
  }

  logger.info('Reminder job completed');
}

export async function sendManualReminder(invoiceId: string, actorId: string): Promise<{ sent: boolean; reason?: string }> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: { select: { name: true, contactEmail: true } },
      payments: { select: { amount: true } },
    },
  });

  if (!invoice) return { sent: false, reason: 'Invoice not found' };
  if (!invoice.client.contactEmail) return { sent: false, reason: 'No client email' };

  const paidSoFar = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = invoice.total - paidSoFar;
  const reminderType = invoice.status === 'OVERDUE' ? 'OVERDUE_7' : 'DUE_TODAY';

  await sendReminderEmail({
    to: invoice.client.contactEmail,
    clientName: invoice.client.name,
    invoiceNumber: invoice.invoiceNumber,
    amount: remaining,
    dueDate: invoice.dueDate,
    reminderType,
    invoiceId,
  });

  await prisma.reminderLog.create({
    data: {
      invoiceId,
      reminderType: 'MANUAL',
      sentAt: new Date(),
      emailTo: invoice.client.contactEmail,
      status: 'SENT',
    },
  });

  void actorId;
  return { sent: true };
}
