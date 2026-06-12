import { Router, Request, Response } from 'express';
import { Prisma, Payment } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { verifyWebhookSignature } from '../services/razorpay.service.js';
import { logger } from '../lib/logger.js';

const router = Router();

// POST /webhooks/razorpay — no auth, raw body needed
router.post('/razorpay', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string | undefined;
  const rawBody = JSON.stringify(req.body);

  if (signature && !verifyWebhookSignature(rawBody, signature)) {
    logger.warn('Razorpay webhook signature mismatch');
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  const event = req.body?.event as string;
  logger.info('Razorpay webhook received', { event });

  // payment_link.paid — client paid via payment link
  if (event === 'payment_link.paid') {
    const payload = req.body?.payload?.payment_link?.entity;
    const paymentEntity = req.body?.payload?.payment?.entity;
    if (!payload || !paymentEntity) { res.json({ received: true }); return; }

    const referenceId: string = payload.reference_id ?? '';
    const amountPaise: number = paymentEntity.amount ?? 0;
    const amountRupees = amountPaise / 100;
    const method: string = (paymentEntity.method as string ?? 'UPI').toUpperCase();
    const paymentId: string = paymentEntity.id ?? '';

    // Find invoice by payment link ID or reference_id (invoiceNumber)
    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [
          { razorpayLinkId: payload.id },
          { invoiceNumber: referenceId },
        ],
      },
      include: { payments: true },
    });

    if (!invoice) {
      logger.warn('Webhook: invoice not found', { referenceId, linkId: payload.id });
      res.json({ received: true });
      return;
    }

    // Idempotency: skip if payment already recorded with this reference
    const alreadyRecorded = invoice.payments.some((p: Payment) => p.referenceNumber === paymentId);
    if (alreadyRecorded) { res.json({ received: true }); return; }

    const totalPaid = invoice.payments.reduce((s: number, p: Payment) => s + p.amount, 0) + amountRupees;
    const newStatus = totalPaid >= invoice.total ? 'PAID' : 'PART_PAID';

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Find a system user to record as (use first admin)
      const admin = await tx.user.findFirst({ where: { role: 'ADMIN' } });
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: amountRupees,
          paymentDate: new Date(),
          method: method.slice(0, 10),
          referenceNumber: paymentId,
          notes: 'Auto-recorded via Razorpay webhook',
          recordedById: admin!.id,
        },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: newStatus, razorpayLinkStatus: 'paid' },
      });
      await tx.invoiceEvent.create({
        data: {
          invoiceId: invoice.id,
          eventType: 'PAYMENT_RECORDED',
          metadata: JSON.stringify({ amount: amountRupees, method, paymentId, source: 'razorpay_webhook', newStatus }),
        },
      });
    });

    logger.info('Webhook: payment auto-recorded', { invoiceId: invoice.id, amount: amountRupees, newStatus });
  }

  res.json({ received: true });
});

export default router;
