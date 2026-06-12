import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { validateGstin } from '../services/gst.service.js';
import { generateClientStatementPdf } from '../services/pdf.service.js';

const router = Router();
router.use(authenticate);

const clientSchema = z.object({
  name: z.string().min(1),
  gstin: z.string().optional().refine(g => !g || validateGstin(g), 'Invalid GSTIN'),
  stateCode: z.string().length(2),
  billingTerms: z.string().default('NET_30'),
  creditLimit: z.number().optional(),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  podId: z.string().optional().nullable(),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const { search, page = '1', limit = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = search
    ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { contactEmail: { contains: search, mode: 'insensitive' as const } }] }
    : {};
  const [clients, total] = await Promise.all([
    prisma.client.findMany({ where, skip, take: parseInt(limit), orderBy: { name: 'asc' }, include: { pod: { select: { id: true, name: true } } } }),
    prisma.client.count({ where }),
  ]);
  res.json({ clients, total, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/', validate(clientSchema), async (req: AuthRequest, res: Response) => {
  const client = await prisma.client.create({ data: req.body });
  res.status(201).json(client);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { invoices: true, projects: true } } },
  });
  if (!client) { res.status(404).json({ error: 'Client not found' }); return; }
  res.json(client);
});

router.put('/:id', validate(clientSchema), async (req: AuthRequest, res: Response) => {
  const client = await prisma.client.update({ where: { id: req.params.id }, data: req.body });
  res.json(client);
});

// GET /clients/:id/statement — JSON ledger
router.get('/:id/statement', async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query as Record<string, string>;
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) { res.status(404).json({ error: 'Client not found' }); return; }

  const where: Record<string, unknown> = { clientId: req.params.id };
  if (from || to) {
    where.issueDate = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: { payments: { orderBy: { paymentDate: 'asc' } } },
    orderBy: { issueDate: 'asc' },
  });

  let balance = 0;
  const lines = invoices.flatMap(inv => {
    const rows: object[] = [];
    balance += inv.total;
    rows.push({ date: inv.issueDate, type: 'INVOICE', description: `Invoice ${inv.invoiceNumber}`, debit: inv.total, credit: 0, balance, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, status: inv.status });
    for (const pay of inv.payments) {
      balance -= pay.amount;
      rows.push({ date: pay.paymentDate, type: 'PAYMENT', description: `Payment — ${pay.method}`, debit: 0, credit: pay.amount, balance, invoiceId: inv.id });
    }
    return rows;
  });

  res.json({ client, lines, closingBalance: balance });
});

// GET /clients/:id/statement.pdf
router.get('/:id/statement.pdf', async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query as Record<string, string>;
  try {
    const pdf = await generateClientStatementPdf(
      req.params.id,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="statement-${req.params.id}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
