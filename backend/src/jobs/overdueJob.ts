import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export async function escalateOverdueInvoices(): Promise<number> {
  const now = new Date();

  const stale = await prisma.invoice.findMany({
    where: {
      status: { in: ['SENT', 'VIEWED', 'PART_PAID'] },
      dueDate: { lt: now },
    },
    select: { id: true },
  });

  if (stale.length === 0) return 0;

  await prisma.$transaction([
    prisma.invoice.updateMany({
      where: { id: { in: stale.map(i => i.id) } },
      data: { status: 'OVERDUE' },
    }),
    ...stale.map(inv =>
      prisma.invoiceEvent.create({
        data: {
          invoiceId: inv.id,
          eventType: 'AUTO_OVERDUE',
          metadata: { escalatedAt: now.toISOString() },
        },
      })
    ),
  ]);

  logger.info(`Escalated ${stale.length} invoices to OVERDUE`);
  return stale.length;
}
