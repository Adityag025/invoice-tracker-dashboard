import { Router, Response } from 'express';
import { z } from 'zod';
import { Prisma, Payment } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

const paymentSchema = z.object({
  amount: z.number().positive(),
  tdsAmount: z.number().min(0).optional().default(0),
  tdsCertNumber: z.string().optional(),
  paymentDate: z.string().datetime(),
  method: z.enum(['NEFT', 'RTGS', 'UPI', 'CHEQUE', 'CASH']),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

router.post('/', validate(paymentSchema), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { payments: true },
  });
  if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
  if (invoice.status === 'CANCELLED') { res.status(400).json({ error: 'Cannot record payment on cancelled invoice' }); return; }

  const { amount, tdsAmount = 0, tdsCertNumber, paymentDate, method, referenceNumber, notes } = req.body;
  const totalPaid = invoice.payments.reduce((s: number, p: Payment) => s + p.amount + (p.tdsAmount ?? 0), 0) + amount + (tdsAmount ?? 0);
  const newStatus = totalPaid >= invoice.total ? 'PAID' : 'PART_PAID';

  const payment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const p = await tx.payment.create({
      data: { invoiceId: id, amount, tdsAmount, tdsCertNumber, paymentDate: new Date(paymentDate), method, referenceNumber, notes, recordedById: req.user!.userId },
    });
    await tx.invoice.update({ where: { id }, data: { status: newStatus } });
    await tx.invoiceEvent.create({
      data: { invoiceId: id, eventType: 'PAYMENT_RECORDED', actorId: req.user!.userId, metadata: JSON.stringify({ amount, method, newStatus }) },
    });
    return p;
  });

  res.status(201).json(payment);
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const payments = await prisma.payment.findMany({
    where: { invoiceId: req.params.id },
    orderBy: { paymentDate: 'desc' },
    include: { recordedBy: { select: { name: true } } },
  });
  res.json(payments);
});

export default router;
