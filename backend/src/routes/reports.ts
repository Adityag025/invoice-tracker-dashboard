import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/authenticate.js';

const router = Router();
router.use(authenticate);

router.get('/ar-aging', async (req: AuthRequest, res: Response) => {
  const { clientId } = req.query as Record<string, string>;
  const now = new Date();
  const where: Record<string, unknown> = {
    status: { in: ['SENT', 'VIEWED', 'PART_PAID', 'OVERDUE'] },
  };
  if (clientId) where.clientId = clientId;

  const invoices = await prisma.invoice.findMany({
    where,
    include: { client: { select: { name: true } }, payments: true },
  });

  const buckets = { '0-30': [], '31-60': [], '61-90': [], '90+': [] } as Record<string, unknown[]>;
  for (const inv of invoices) {
    const totalPaid = inv.payments.reduce((s, p) => s + p.amount, 0);
    const outstanding = inv.total - totalPaid;
    if (outstanding <= 0) continue;
    const days = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
    const bucket = days <= 0 ? '0-30' : days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
    (buckets[bucket] as unknown[]).push({ ...inv, outstanding, daysOverdue: days });
  }

  res.json(buckets);
});

router.get('/revenue', async (req: AuthRequest, res: Response) => {
  const { months = '12' } = req.query as Record<string, string>;
  const from = new Date();
  from.setMonth(from.getMonth() - parseInt(months));

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { issueDate: { gte: from } },
      select: { issueDate: true, total: true, clientId: true },
    }),
    prisma.payment.findMany({
      where: { paymentDate: { gte: from } },
      select: { paymentDate: true, amount: true },
    }),
  ]);

  const billedByMonth: Record<string, number> = {};
  const collectedByMonth: Record<string, number> = {};

  for (const inv of invoices) {
    const key = inv.issueDate.toISOString().slice(0, 7);
    billedByMonth[key] = (billedByMonth[key] ?? 0) + inv.total;
  }
  for (const pay of payments) {
    const key = pay.paymentDate.toISOString().slice(0, 7);
    collectedByMonth[key] = (collectedByMonth[key] ?? 0) + pay.amount;
  }

  res.json({ billed: billedByMonth, collected: collectedByMonth });
});

router.get('/summary', async (req: AuthRequest, res: Response) => {
  const [totalInvoiced, totalCollected, totalOutstanding, totalOverdue, pendingApproval] = await Promise.all([
    prisma.invoice.aggregate({ _sum: { total: true } }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.invoice.aggregate({ where: { status: { in: ['SENT', 'VIEWED', 'PART_PAID', 'OVERDUE'] } }, _sum: { total: true } }),
    prisma.invoice.aggregate({ where: { status: 'OVERDUE' }, _sum: { total: true } }),
    prisma.invoice.count({ where: { status: 'PENDING_APPROVAL' } }),
  ]);

  res.json({
    totalInvoiced: totalInvoiced._sum.total ?? 0,
    totalCollected: totalCollected._sum.amount ?? 0,
    totalOutstanding: totalOutstanding._sum.total ?? 0,
    totalOverdue: totalOverdue._sum.total ?? 0,
    pendingApproval,
  });
});

export default router;
