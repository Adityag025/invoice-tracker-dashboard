import { Router, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { calcLineItems, calcTotals } from '../services/gst.service.js';
import { generateInvoiceNumber } from '../services/invoice-number.service.js';
import { logger } from '../lib/logger.js';
import { generateInvoicePdf } from '../services/pdf.service.js';

const router = Router();
router.use(authenticate);

const lineItemSchema = z.object({
  description: z.string().min(1),
  hsnSac: z.string().optional(),
  quantity: z.number().positive(),
  unitRate: z.number().positive(),
  taxRate: z.number().min(0).max(100),
});

const createInvoiceSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().optional(),
  issueDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  notes: z.string().optional(),
  poNumber: z.string().optional(),
  items: z.array(lineItemSchema).min(1),
});

const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING_APPROVAL', 'READY_TO_SEND', 'SENT'],
  PENDING_APPROVAL: ['READY_TO_SEND', 'DRAFT'],
  READY_TO_SEND: ['SENT'],
  SENT: ['VIEWED', 'PAID', 'OVERDUE', 'CANCELLED'],
  VIEWED: ['PAID', 'OVERDUE', 'CANCELLED'],
  PART_PAID: ['PAID', 'OVERDUE', 'CANCELLED'],
  OVERDUE: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};

router.get('/', async (req: AuthRequest, res: Response) => {
  const { clientId, projectId, status, page = '1', limit = '20', sortBy = 'createdAt', order = 'desc' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: Record<string, unknown> = {};
  if (clientId) where.clientId = clientId;
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { [sortBy]: order },
      include: {
        client: { select: { name: true } },
        project: { select: { name: true } },
        _count: { select: { payments: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);
  res.json({ invoices, total, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/', validate(createInvoiceSchema), async (req: AuthRequest, res: Response) => {
  const { clientId, projectId, issueDate, dueDate, notes, poNumber, items } = req.body;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) { res.status(404).json({ error: 'Client not found' }); return; }

  const calcedItems = calcLineItems(items, client.stateCode);
  const { subtotal, taxTotal, total } = calcTotals(calcedItems);
  const invoiceNumber = await generateInvoiceNumber();

  const invoice = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const inv = await tx.invoice.create({
      data: {
        invoiceNumber,
        clientId,
        projectId,
        issueDate: new Date(issueDate),
        dueDate: new Date(dueDate),
        subtotal,
        taxTotal,
        total,
        notes,
        poNumber,
        createdById: req.user!.userId,
        items: {
          create: calcedItems.map(({ description, hsnSac, quantity, unitRate, taxRate, taxType, lineTotal }) => ({
            description, hsnSac, quantity, unitRate, taxRate, taxType, lineTotal,
          })),
        },
      },
      include: { items: true, client: { select: { name: true } } },
    });
    await tx.invoiceEvent.create({
      data: { invoiceId: inv.id, eventType: 'CREATED', actorId: req.user!.userId },
    });
    return inv;
  });

  res.status(201).json(invoice);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      items: true,
      client: true,
      project: true,
      events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { name: true } } } },
      payments: true,
      creditNotes: true,
      purchaseOrders: true,
    },
  });
  if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
  res.json(invoice);
});

router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

  const allowed = STATUS_TRANSITIONS[invoice.status] ?? [];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: `Cannot transition from ${invoice.status} to ${status}` });
    return;
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const inv = await tx.invoice.update({ where: { id: req.params.id }, data: { status } });
    await tx.invoiceEvent.create({
      data: { invoiceId: inv.id, eventType: `STATUS_${status}`, actorId: req.user!.userId, metadata: { from: invoice.status, to: status } },
    });
    return inv;
  });

  logger.info('Invoice status updated', { invoiceId: updated.id, from: invoice.status, to: status });
  res.json(updated);
});

router.get('/:id/pdf', async (req: AuthRequest, res: Response) => {
  try {
    const pdf = await generateInvoicePdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.id}.pdf"`);
    res.send(pdf);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'PDF generation failed';
    logger.error('PDF route error', { id: req.params.id, err: msg });
    res.status(500).json({ error: msg });
  }
});

export default router;
