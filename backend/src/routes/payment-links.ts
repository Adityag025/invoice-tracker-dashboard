import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/authenticate.js';
import { createPaymentLink, razorpayConfigured } from '../services/razorpay.service.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

// POST /api/v1/invoices/:id/payment-link
router.post('/', async (req: AuthRequest, res: Response) => {
  if (!razorpayConfigured()) {
    res.status(400).json({ error: 'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' });
    return;
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      client: { select: { name: true, contactEmail: true, contactPhone: true } },
      payments: { select: { amount: true } },
    },
  });
  if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
  if (['PAID', 'CANCELLED'].includes(invoice.status)) {
    res.status(400).json({ error: 'Cannot create payment link for a paid or cancelled invoice' });
    return;
  }

  const paidSoFar = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const balance = invoice.total - paidSoFar;
  if (balance <= 0) {
    res.status(400).json({ error: 'Invoice is already fully paid' });
    return;
  }

  const result = await createPaymentLink({
    invoiceNumber: invoice.invoiceNumber,
    amount: balance,
    clientName: invoice.client.name,
    clientEmail: invoice.client.contactEmail,
    clientPhone: invoice.client.contactPhone ?? undefined,
  });

  const updated = await prisma.invoice.update({
    where: { id: req.params.id },
    data: {
      razorpayLinkId: result.linkId,
      razorpayLinkUrl: result.shortUrl,
      razorpayLinkStatus: result.status,
    },
  });

  await prisma.invoiceEvent.create({
    data: {
      invoiceId: invoice.id,
      eventType: 'PAYMENT_LINK_CREATED',
      actorId: req.user!.userId,
      metadata: JSON.stringify({ linkId: result.linkId, shortUrl: result.shortUrl, amount: balance }),
    },
  });

  res.json({ linkId: result.linkId, shortUrl: result.shortUrl, status: result.status, amount: balance, invoice: updated });
});

export default router;
