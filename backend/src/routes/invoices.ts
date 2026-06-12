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
import { sendInvoiceEmail } from '../services/email.service.js';
import { requireMinRole } from '../middleware/authenticate.js';
import { upload } from '../middleware/upload.js';
import { storeFile } from '../services/storage.service.js';
import { getTempPoDir } from '../services/po-extract.service.js';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

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
  SENT: ['VIEWED', 'PAID', 'OVERDUE', 'CANCELLED', 'WRITTEN_OFF'],
  VIEWED: ['PAID', 'OVERDUE', 'CANCELLED', 'WRITTEN_OFF'],
  PART_PAID: ['PAID', 'OVERDUE', 'CANCELLED', 'WRITTEN_OFF'],
  OVERDUE: ['PAID', 'CANCELLED', 'WRITTEN_OFF'],
  PAID: [],
  CANCELLED: [],
  WRITTEN_OFF: [],
};

router.get('/', async (req: AuthRequest, res: Response) => {
  const { clientId, projectId, status, search, page = '1', limit = '20', sortBy = 'createdAt', order = 'desc' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: Record<string, unknown> = {};
  if (clientId) where.clientId = clientId;
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search } },
      { client: { name: { contains: search } } },
    ];
  }

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
  const { status, writeOffReason } = req.body;
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { client: { select: { contactEmail: true, name: true } } },
  });
  if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

  const allowed = STATUS_TRANSITIONS[invoice.status] ?? [];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: `Cannot transition from ${invoice.status} to ${status}` });
    return;
  }

  const metadata: Record<string, unknown> = { from: invoice.status, to: status };
  if (status === 'WRITTEN_OFF' && writeOffReason) metadata.writeOffReason = writeOffReason;

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const inv = await tx.invoice.update({ where: { id: req.params.id }, data: { status } });
    await tx.invoiceEvent.create({
      data: { invoiceId: inv.id, eventType: `STATUS_${status}`, actorId: req.user!.userId, metadata: JSON.stringify(metadata) },
    });
    return inv;
  });

  if (status === 'SENT' && invoice.client?.contactEmail) {
    sendInvoiceEmail({
      to: invoice.client.contactEmail,
      clientName: invoice.client.name,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.total,
      dueDate: invoice.dueDate,
      invoiceId: invoice.id,
    }).catch(err => logger.error('Invoice email failed', { err }));
  }

  logger.info('Invoice status updated', { invoiceId: updated.id, from: invoice.status, to: status });
  res.json(updated);
});

// PUT /:id — edit a DRAFT invoice
router.put('/:id', validate(createInvoiceSchema), async (req: AuthRequest, res: Response) => {
  const { issueDate, dueDate, notes, poNumber, items } = req.body;
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { client: true } });
  if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
  if (invoice.status !== 'DRAFT') { res.status(400).json({ error: 'Only DRAFT invoices can be edited' }); return; }

  const calcedItems = calcLineItems(items, invoice.client.stateCode);
  const { subtotal, taxTotal, total } = calcTotals(calcedItems);

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: req.params.id } });
    const inv = await tx.invoice.update({
      where: { id: req.params.id },
      data: {
        issueDate: new Date(issueDate),
        dueDate: new Date(dueDate),
        notes,
        poNumber,
        subtotal,
        taxTotal,
        total,
        items: {
          create: calcedItems.map(({ description, hsnSac, quantity, unitRate, taxRate, taxType, lineTotal }) => ({
            description, hsnSac, quantity, unitRate, taxRate, taxType, lineTotal,
          })),
        },
      },
      include: { items: true, client: true, project: true, events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { name: true } } } }, payments: true, purchaseOrders: true },
    });
    await tx.invoiceEvent.create({
      data: { invoiceId: inv.id, eventType: 'EDITED', actorId: req.user!.userId },
    });
    return inv;
  });

  res.json(updated);
});

// POST /:id/purchase-order — attach PO document
router.post(
  '/:id/purchase-order',
  (req: Request, res: Response, next) => {
    if (req.body?.tempFileId) { next(); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    upload.single('file')(req as any, res as any, (err) => {
      if (err) { res.status(400).json({ error: (err as Error).message }); return; }
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    const { z: zod } = await import('zod');
    const poSchema = zod.object({
      poNumber: zod.string().min(1),
      poDate: zod.string(),
      poValue: zod.coerce.number().positive(),
      tempFileId: zod.string().optional(),
    });
    const parsed = poSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Validation failed', issues: parsed.error.flatten() }); return; }

    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

    let documentUrl: string | undefined;
    if (parsed.data.tempFileId) {
      const tmpPath = path.join(getTempPoDir(), parsed.data.tempFileId);
      if (fs.existsSync(tmpPath)) {
        const ext = path.extname(parsed.data.tempFileId);
        const permName = parsed.data.tempFileId.replace(ext, `-po${ext}`);
        const permPath = path.resolve(process.cwd(), 'uploads', permName);
        fs.renameSync(tmpPath, permPath);
        documentUrl = `/uploads/${permName}`;
      }
    } else if ((req as AuthRequest & { file?: Express.Multer.File }).file) {
      const stored = await storeFile((req as AuthRequest & { file: Express.Multer.File }).file);
      documentUrl = stored.url;
    }

    const po = await prisma.purchaseOrder.create({
      data: {
        invoiceId: req.params.id,
        poNumber: parsed.data.poNumber,
        poDate: new Date(parsed.data.poDate),
        poValue: parsed.data.poValue,
        documentUrl,
      },
    });
    res.status(201).json(po);
  }
);

// POST /from-project/:projectId — generate recurring invoice from RETAINER project
router.post('/from-project/:projectId', requireMinRole('ACCOUNT_MANAGER'), async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.projectId },
    include: { client: true },
  });
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  if (project.type !== 'RETAINER') { res.status(400).json({ error: 'Only RETAINER projects support recurring invoices' }); return; }

  const lastInvoice = await prisma.invoice.findFirst({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });

  const billingDays = project.client.billingTerms === 'NET_15' ? 15 : project.client.billingTerms === 'NET_45' ? 45 : project.client.billingTerms === 'NET_60' ? 60 : 30;
  const issueDate = new Date();
  const dueDate = new Date(issueDate.getTime() + billingDays * 86400000);
  const invoiceNumber = await generateInvoiceNumber();

  const items = lastInvoice?.items.map(({ description, hsnSac, quantity, unitRate, taxRate, taxType, lineTotal }) => ({
    description, hsnSac, quantity, unitRate, taxRate, taxType, lineTotal,
  })) ?? [{ description: `Retainer — ${project.name}`, hsnSac: null, quantity: 1, unitRate: 0, taxRate: 18, taxType: 'CGST_SGST', lineTotal: 0 }];

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitRate, 0);
  const taxTotal = items.reduce((s, i) => s + i.quantity * i.unitRate * i.taxRate / 100, 0);
  const total = subtotal + taxTotal;

  const invoice = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const inv = await tx.invoice.create({
      data: {
        invoiceNumber,
        clientId: project.clientId,
        projectId: project.id,
        issueDate,
        dueDate,
        subtotal,
        taxTotal,
        total,
        notes: `Monthly retainer — ${issueDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`,
        createdById: req.user!.userId,
        items: { create: items },
      },
      include: { items: true, client: { select: { name: true } } },
    });
    await tx.invoiceEvent.create({
      data: { invoiceId: inv.id, eventType: 'CREATED', actorId: req.user!.userId, metadata: JSON.stringify({ source: 'RECURRING', projectId: project.id }) },
    });
    return inv;
  });

  res.status(201).json(invoice);
});

router.post('/bulk-remind', async (req: AuthRequest, res: Response) => {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'ids required' }); return; }

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: ids }, status: { in: ['SENT', 'VIEWED', 'PART_PAID', 'OVERDUE'] } },
    include: { client: { select: { name: true, contactEmail: true } } },
  });

  await prisma.reminderLog.createMany({
    data: invoices.map(inv => ({
      invoiceId: inv.id,
      reminderType: 'MANUAL_BULK',
      sentAt: new Date(),
      emailTo: inv.client.contactEmail,
      status: 'QUEUED',
    })),
  });

  res.json({ sent: invoices.length, skipped: ids.length - invoices.length });
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
