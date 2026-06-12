import { Router, Response, Request } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';
import { storeFile } from '../services/storage.service.js';
import { getTempPoDir } from '../services/po-extract.service.js';
import { calcLineItems, calcTotals } from '../services/gst.service.js';
import { generateEstimateNumber, generateInvoiceNumber } from '../services/invoice-number.service.js';

const router = Router();
router.use(authenticate);

const lineItemSchema = z.object({
  description: z.string().min(1),
  hsnSac: z.string().optional(),
  quantity: z.number().positive(),
  unitRate: z.number().positive(),
  taxRate: z.number().min(0).max(100),
});

const estimateSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().optional(),
  validUntil: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).min(1),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const { clientId, status, search, page = '1', limit = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: Record<string, unknown> = {};
  if (clientId) where.clientId = clientId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { estimateNumber: { contains: search } },
      { client: { name: { contains: search } } },
    ];
  }

  const [estimates, total] = await Promise.all([
    prisma.estimate.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { name: true } }, project: { select: { name: true } } },
    }),
    prisma.estimate.count({ where }),
  ]);
  res.json({ estimates, total });
});

router.post('/', validate(estimateSchema), async (req: AuthRequest, res: Response) => {
  const { clientId, projectId, validUntil, notes, items } = req.body;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) { res.status(404).json({ error: 'Client not found' }); return; }

  const calcedItems = calcLineItems(items, client.stateCode);
  const { subtotal, taxTotal, total } = calcTotals(calcedItems);
  const estimateNumber = await generateEstimateNumber();

  const estimate = await prisma.estimate.create({
    data: {
      estimateNumber,
      clientId,
      projectId,
      validUntil: validUntil ? new Date(validUntil) : null,
      subtotal,
      taxTotal,
      total,
      notes,
      createdById: req.user!.userId,
      items: {
        create: calcedItems.map(({ description, hsnSac, quantity, unitRate, taxRate, taxType, lineTotal }) => ({
          description, hsnSac, quantity, unitRate, taxRate, taxType, lineTotal,
        })),
      },
    },
    include: { items: true },
  });
  res.status(201).json(estimate);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const estimate = await prisma.estimate.findUnique({
    where: { id: req.params.id },
    include: { items: true, client: true, project: true, purchaseOrders: true, revisions: true },
  });
  if (!estimate) { res.status(404).json({ error: 'Estimate not found' }); return; }
  res.json(estimate);
});

router.post('/:id/convert', async (req: AuthRequest, res: Response) => {
  const estimate = await prisma.estimate.findUnique({
    where: { id: req.params.id },
    include: { items: true, client: true, purchaseOrders: true },
  });
  if (!estimate) { res.status(404).json({ error: 'Estimate not found' }); return; }
  if (estimate.status !== 'APPROVED') { res.status(400).json({ error: 'Only approved estimates can be converted' }); return; }

  const invoiceNumber = await generateInvoiceNumber();
  const latestPO = estimate.purchaseOrders[estimate.purchaseOrders.length - 1];

  const rawItems = req.body.items as Array<{ description: string; hsnSac?: string; quantity: number; unitRate: number; taxRate: number }> | undefined;

  type ItemToCreate = { description: string; hsnSac?: string | null; quantity: number; unitRate: number; taxRate: number; taxType: string; lineTotal: number };
  let lineItems: ItemToCreate[];
  let subtotal: number, taxTotal: number, total: number;

  if (rawItems && rawItems.length > 0) {
    const calced = calcLineItems(rawItems, estimate.client.stateCode);
    ({ subtotal, taxTotal, total } = calcTotals(calced));
    lineItems = calced;
  } else {
    lineItems = estimate.items.map(({ description, hsnSac, quantity, unitRate, taxRate, taxType, lineTotal }) => ({ description, hsnSac, quantity, unitRate, taxRate, taxType, lineTotal }));
    ({ subtotal, taxTotal, total } = { subtotal: estimate.subtotal, taxTotal: estimate.taxTotal, total: estimate.total });
  }

  const invoice = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const inv = await tx.invoice.create({
      data: {
        invoiceNumber,
        clientId: estimate.clientId,
        projectId: estimate.projectId,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal,
        taxTotal,
        total,
        poNumber: latestPO?.poNumber,
        createdById: req.user!.userId,
        items: {
          create: lineItems.map(({ description, hsnSac, quantity, unitRate, taxRate, taxType, lineTotal }) => ({
            description, hsnSac, quantity, unitRate, taxRate, taxType, lineTotal,
          })),
        },
      },
    });
    await tx.estimate.update({ where: { id: req.params.id }, data: { status: 'CONVERTED' } });
    await tx.invoiceEvent.create({
      data: { invoiceId: inv.id, eventType: 'CONVERTED_FROM_ESTIMATE', actorId: req.user!.userId, metadata: JSON.stringify({ estimateId: req.params.id }) },
    });
    return inv;
  });

  res.status(201).json(invoice);
});

router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const allowed = ['DRAFT', 'SENT', 'APPROVED', 'EXPIRED', 'CONVERTED'];
  if (!allowed.includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }
  const estimate = await prisma.estimate.update({ where: { id: req.params.id }, data: { status } });
  res.json(estimate);
});

// POST /api/v1/estimates/:id/purchase-order — attach PO document
// Accepts either a new file upload OR a tempFileId from /po/extract
router.post(
  '/:id/purchase-order',
  (req: Request, res: Response, next) => {
    // Skip multer if the client is using a tempFileId from extraction
    if (req.body?.tempFileId) { next(); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    upload.single('file')(req as any, res as any, (err) => {
      if (err) { res.status(400).json({ error: (err as Error).message }); return; }
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    const poSchema = z.object({
      poNumber: z.string().min(1),
      poDate: z.string(),
      poValue: z.coerce.number().positive(),
      tempFileId: z.string().optional(),
    });
    const parsed = poSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Validation failed', issues: parsed.error.flatten() }); return; }

    const estimate = await prisma.estimate.findUnique({ where: { id: req.params.id } });
    if (!estimate) { res.status(404).json({ error: 'Estimate not found' }); return; }

    let documentUrl: string | undefined;

    if (parsed.data.tempFileId) {
      // Move temp file to permanent uploads dir
      const tmpPath = path.join(getTempPoDir(), parsed.data.tempFileId);
      if (fs.existsSync(tmpPath)) {
        const ext = path.extname(parsed.data.tempFileId);
        const permName = parsed.data.tempFileId.replace(ext, `-po${ext}`);
        const permPath = path.resolve(process.cwd(), 'uploads', permName);
        fs.renameSync(tmpPath, permPath);
        documentUrl = `/uploads/${permName}`;
      }
    } else if (req.file) {
      const stored = await storeFile(req.file);
      documentUrl = stored.url;
    }

    const po = await prisma.purchaseOrder.create({
      data: {
        estimateId: req.params.id,
        poNumber: parsed.data.poNumber,
        poDate: new Date(parsed.data.poDate),
        poValue: parsed.data.poValue,
        documentUrl,
      },
    });
    res.status(201).json(po);
  }
);

export default router;
