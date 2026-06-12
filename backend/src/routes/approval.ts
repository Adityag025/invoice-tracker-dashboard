import { Router, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireApprover, AuthRequest } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { sendReminderEmail } from '../services/email.service.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

// POST /api/v1/invoices/:id/submit-for-approval
router.post('/submit', async (req: AuthRequest, res: Response) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
  if (invoice.status !== 'DRAFT') {
    res.status(400).json({ error: 'Only DRAFT invoices can be submitted for approval' });
    return;
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const inv = await tx.invoice.update({
      where: { id: req.params.id },
      data: { status: 'PENDING_APPROVAL' },
    });
    await tx.invoiceEvent.create({
      data: {
        invoiceId: inv.id,
        eventType: 'SUBMITTED_FOR_APPROVAL',
        actorId: req.user!.userId,
        metadata: JSON.stringify({ submittedBy: req.user!.userId }),
      },
    });
    return inv;
  });

  // Notify all approvers (ACCOUNT_DIRECTOR and above)
  const admins = await prisma.user.findMany({ where: { role: { in: ['CEO', 'ACCOUNT_DIRECTOR'] } } });
  for (const admin of admins) {
    try {
      await sendReminderEmail({
        to: admin.email,
        clientName: admin.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.total,
        dueDate: invoice.dueDate,
        reminderType: 'PENDING_APPROVAL',
        invoiceId: invoice.id,
      });
    } catch { /* non-critical */ }
  }

  res.json(updated);
});

// POST /api/v1/invoices/:id/approve  (ADMIN only)
router.post('/approve', requireApprover, async (req: AuthRequest, res: Response) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
  if (invoice.status !== 'PENDING_APPROVAL') {
    res.status(400).json({ error: 'Invoice is not pending approval' });
    return;
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const inv = await tx.invoice.update({
      where: { id: req.params.id },
      data: { status: 'READY_TO_SEND' },
    });
    await tx.invoiceEvent.create({
      data: {
        invoiceId: inv.id,
        eventType: 'APPROVED',
        actorId: req.user!.userId,
      },
    });
    return inv;
  });

  // Notify creator
  try {
    await sendReminderEmail({
      to: invoice.createdBy.email,
      clientName: invoice.createdBy.name,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.total,
      dueDate: invoice.dueDate,
      reminderType: 'APPROVED',
      invoiceId: invoice.id,
    });
  } catch { /* non-critical */ }

  res.json(updated);
});

// POST /api/v1/invoices/:id/reject  (ADMIN only)
router.post('/reject', requireApprover, validate(z.object({ reason: z.string().min(1) })), async (req: AuthRequest, res: Response) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
  if (invoice.status !== 'PENDING_APPROVAL') {
    res.status(400).json({ error: 'Invoice is not pending approval' });
    return;
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const inv = await tx.invoice.update({
      where: { id: req.params.id },
      data: { status: 'DRAFT' },
    });
    await tx.invoiceEvent.create({
      data: {
        invoiceId: inv.id,
        eventType: 'REJECTED',
        actorId: req.user!.userId,
        metadata: JSON.stringify({ reason: req.body.reason }),
      },
    });
    return inv;
  });

  // Notify creator
  try {
    await sendReminderEmail({
      to: invoice.createdBy.email,
      clientName: invoice.createdBy.name,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.total,
      dueDate: invoice.dueDate,
      reminderType: 'REJECTED',
      invoiceId: invoice.id,
    });
  } catch { /* non-critical */ }

  res.json(updated);
});

export default router;
