import { Router, Response } from 'express';
import { z } from 'zod';
import { Prisma, Payment } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { generateCreditNoteNumber } from '../services/invoice-number.service.js';

const router = Router();
router.use(authenticate);

const creditNoteSchema = z.object({
  invoiceId: z.string().min(1),
  type: z.enum(['FULL', 'PARTIAL']),
  reason: z.string().min(1),
  amount: z.number().positive(),
});

router.post('/', validate(creditNoteSchema), async (req: AuthRequest, res: Response) => {
  const { invoiceId, type, reason, amount } = req.body;
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
  if (invoice.status === 'CANCELLED') { res.status(400).json({ error: 'Invoice already cancelled' }); return; }

  const totalPaid = invoice.payments.reduce((s: number, p: Payment) => s + p.amount, 0);
  const cnNumber = await generateCreditNoteNumber();

  const creditNote = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const cn = await tx.creditNote.create({
      data: { cnNumber, invoiceId, type, reason, amount, issuedById: req.user!.userId },
    });
    if (type === 'FULL') {
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: 'CANCELLED' } });
      if (totalPaid > 0) {
        await tx.clientCredit.create({
          data: { clientId: invoice.clientId, creditNoteId: cn.id, amount: totalPaid, remainingAmount: totalPaid },
        });
      }
    }
    await tx.invoiceEvent.create({
      data: { invoiceId, eventType: 'CREDIT_NOTE_RAISED', actorId: req.user!.userId, metadata: JSON.stringify({ cnNumber, amount }) },
    });
    return cn;
  });

  res.status(201).json(creditNote);
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const creditNotes = await prisma.creditNote.findMany({
    orderBy: { createdAt: 'desc' },
    include: { originalInvoice: { select: { invoiceNumber: true, clientId: true } }, issuedBy: { select: { name: true } } },
  });
  res.json(creditNotes);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const cn = await prisma.creditNote.findUnique({
    where: { id: req.params.id },
    include: { originalInvoice: true, replacementInvoice: true, clientCredits: true },
  });
  if (!cn) { res.status(404).json({ error: 'Credit note not found' }); return; }
  res.json(cn);
});

export default router;
