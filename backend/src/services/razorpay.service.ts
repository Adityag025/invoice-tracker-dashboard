import Razorpay from 'razorpay';
import crypto from 'crypto';
import { logger } from '../lib/logger.js';

const AGENCY_NAME = process.env.AGENCY_NAME ?? 'Agency';

let rzp: Razorpay | null = null;

function getClient(): Razorpay {
  if (!rzp) {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not set');
    rzp = new Razorpay({ key_id, key_secret });
  }
  return rzp;
}

export function razorpayConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export interface PaymentLinkResult {
  linkId: string;
  shortUrl: string;
  status: string;
}

export async function createPaymentLink(params: {
  invoiceNumber: string;
  amount: number;           // in rupees
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  description?: string;
  expireBy?: Date;
}): Promise<PaymentLinkResult> {
  const client = getClient();

  const expireBy = params.expireBy ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const link = await (client.paymentLink as any).create({
    amount: Math.round(params.amount * 100), // paise
    currency: 'INR',
    description: params.description ?? `Payment for ${params.invoiceNumber} — ${AGENCY_NAME}`,
    customer: {
      name: params.clientName,
      email: params.clientEmail,
      contact: params.clientPhone ?? '',
    },
    notify: { sms: !!params.clientPhone, email: true },
    reminder_enable: true,
    expire_by: Math.floor(expireBy.getTime() / 1000),
    reference_id: params.invoiceNumber,
    notes: {
      invoice_number: params.invoiceNumber,
      agency: AGENCY_NAME,
    },
  });

  logger.info('Razorpay payment link created', { invoiceNumber: params.invoiceNumber, linkId: link.id });

  return {
    linkId: link.id as string,
    shortUrl: link.short_url as string,
    status: link.status as string,
  };
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('RAZORPAY_WEBHOOK_SECRET not set — skipping signature verification');
    return true;
  }
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
