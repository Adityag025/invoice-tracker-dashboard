import { Router, Response } from 'express';
import { Payment } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest, ROLE_LEVEL } from '../middleware/authenticate.js';

interface InvoiceItemRow {
  taxType: string;
  taxRate: number;
  quantity: number;
  unitRate: number;
  lineTotal: number;
}

const router = Router();
router.use(authenticate);

async function buildScope(req: AuthRequest): Promise<Record<string, unknown>> {
  const role = req.user?.role ?? '';
  const userId = req.user?.userId ?? '';
  const level = ROLE_LEVEL[role] ?? 0;

  if (level >= ROLE_LEVEL['ACCOUNT_DIRECTOR']) return {};

  if (role === 'POD_HEAD') {
    const pods = await prisma.pod.findMany({ where: { podHeadId: userId, active: true }, select: { id: true } });
    const podIds = pods.map(p => p.id);
    return { client: { podId: { in: podIds } } };
  }

  return { createdById: userId };
}

router.get('/ar-aging', async (req: AuthRequest, res: Response) => {
  const { clientId } = req.query as Record<string, string>;
  const now = new Date();
  const scope = await buildScope(req);
  const where: Record<string, unknown> = {
    status: { in: ['SENT', 'VIEWED', 'PART_PAID', 'OVERDUE'] },
    ...scope,
  };
  if (clientId) where.clientId = clientId;

  const invoices = await prisma.invoice.findMany({
    where,
    include: { client: { select: { name: true } }, payments: true },
  });

  const buckets = { '0-30': [], '31-60': [], '61-90': [], '90+': [] } as Record<string, unknown[]>;
  for (const inv of invoices) {
    const totalPaid = inv.payments.reduce((s: number, p: Payment) => s + p.amount, 0);
    const outstanding = inv.total - totalPaid;
    if (outstanding <= 0) continue;
    const days = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
    const bucket = days <= 0 ? '0-30' : days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
    (buckets[bucket] as unknown[]).push({ ...inv, outstanding, daysOverdue: days });
  }

  res.json(buckets);
});

router.get('/revenue', async (req: AuthRequest, res: Response) => {
  const { months = '6', fyStart } = req.query as Record<string, string>;
  let from: Date;
  if (fyStart) {
    from = new Date(fyStart);
  } else {
    from = new Date();
    from.setMonth(from.getMonth() - parseInt(months));
  }
  const scope = await buildScope(req);

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { issueDate: { gte: from }, ...scope },
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
  const scope = await buildScope(req);
  const [totalInvoiced, totalCollected, totalOutstanding, totalOverdue, pendingApproval] = await Promise.all([
    prisma.invoice.aggregate({ where: scope, _sum: { total: true } }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.invoice.aggregate({ where: { status: { in: ['SENT', 'VIEWED', 'PART_PAID', 'OVERDUE'] }, ...scope }, _sum: { total: true } }),
    prisma.invoice.aggregate({ where: { status: 'OVERDUE', ...scope }, _sum: { total: true } }),
    prisma.invoice.count({ where: { status: 'PENDING_APPROVAL', ...scope } }),
  ]);

  res.json({
    totalInvoiced: totalInvoiced._sum.total ?? 0,
    totalCollected: totalCollected._sum.amount ?? 0,
    totalOutstanding: totalOutstanding._sum.total ?? 0,
    totalOverdue: totalOverdue._sum.total ?? 0,
    pendingApproval,
  });
});

router.get('/gst', async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query as Record<string, string>;
  const scope = await buildScope(req);

  const where: Record<string, unknown> = { status: { notIn: ['DRAFT', 'CANCELLED'] }, ...scope };
  if (from) where.issueDate = { ...(where.issueDate as object ?? {}), gte: new Date(from) };
  if (to) {
    const toDate = new Date(to);
    toDate.setMonth(toDate.getMonth() + 1);
    where.issueDate = { ...(where.issueDate as object ?? {}), lt: toDate };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      issueDate: true,
      items: { select: { taxType: true, taxRate: true, quantity: true, unitRate: true, lineTotal: true } },
    },
    orderBy: { issueDate: 'asc' },
  });

  const byMonth: Record<string, { taxable: number; cgst: number; sgst: number; igst: number; invoiceCount: number }> = {};

  for (const inv of invoices) {
    const month = inv.issueDate.toISOString().slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, invoiceCount: 0 };
    byMonth[month].invoiceCount += 1;

    for (const item of (inv.items as InvoiceItemRow[])) {
      const base = item.quantity * item.unitRate;
      const tax = item.lineTotal - base;
      byMonth[month].taxable += base;
      if (item.taxType === 'IGST') {
        byMonth[month].igst += tax;
      } else {
        byMonth[month].cgst += tax / 2;
        byMonth[month].sgst += tax / 2;
      }
    }
  }

  const rows = Object.entries(byMonth).map(([month, data]) => ({
    month,
    ...data,
    totalTax: data.cgst + data.sgst + data.igst,
    grandTotal: data.taxable + data.cgst + data.sgst + data.igst,
  }));

  res.json(rows);
});

router.get('/ar-monthly', async (req: AuthRequest, res: Response) => {
  const { month, groupBy = 'client' } = req.query as Record<string, string>;
  const scope = await buildScope(req);

  const targetMonth = month ?? new Date().toISOString().slice(0, 7);
  const monthStart = new Date(targetMonth + '-01');
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  const now = new Date();

  const invoices = await prisma.invoice.findMany({
    where: {
      status: { notIn: ['DRAFT', 'CANCELLED'] },
      ...scope,
    },
    include: {
      client: { select: { id: true, name: true, podId: true, pod: { select: { id: true, name: true, accountDirectorId: true, accountDirector: { select: { id: true, name: true } } } } } },
      payments: true,
    },
  });

  type GroupEntry = {
    label: string;
    totalRaised: number;
    totalReceived: number;
    pendingThisMonth: number;
    pendingPrevMonths: number;
    closingAR: number;
  };

  const groups: Record<string, GroupEntry> = {};

  const getGroupKey = (inv: typeof invoices[0]): { key: string; label: string } => {
    if (groupBy === 'pod') {
      const pod = inv.client?.pod;
      return { key: pod?.id ?? 'unassigned', label: pod?.name ?? 'Unassigned POD' };
    }
    if (groupBy === 'ad') {
      const ad = inv.client?.pod?.accountDirector;
      return { key: ad?.id ?? 'unassigned', label: ad?.name ?? 'Unassigned AD' };
    }
    return { key: inv.client?.id ?? 'unknown', label: inv.client?.name ?? 'Unknown' };
  };

  for (const inv of invoices) {
    const { key, label } = getGroupKey(inv);
    if (!groups[key]) groups[key] = { label, totalRaised: 0, totalReceived: 0, pendingThisMonth: 0, pendingPrevMonths: 0, closingAR: 0 };
    const g = groups[key];

    const totalPaid = inv.payments.reduce((s: number, p: Payment) => s + p.amount, 0);
    const outstanding = Math.max(0, inv.total - totalPaid);
    const issueDate = new Date(inv.issueDate);
    const dueDate = new Date(inv.dueDate);

    if (issueDate >= monthStart && issueDate < monthEnd) g.totalRaised += inv.total;

    const paymentsThisMonth = inv.payments
      .filter(p => { const d = new Date(p.paymentDate); return d >= monthStart && d < monthEnd; })
      .reduce((s: number, p: Payment) => s + p.amount, 0);
    g.totalReceived += paymentsThisMonth;

    if (outstanding > 0) {
      g.closingAR += outstanding;
      if (dueDate >= monthStart && dueDate < monthEnd) {
        g.pendingThisMonth += outstanding;
      } else if (dueDate < monthStart && dueDate < now) {
        g.pendingPrevMonths += outstanding;
      }
    }
  }

  res.json({ month: targetMonth, groupBy, rows: Object.values(groups) });
});

export default router;
