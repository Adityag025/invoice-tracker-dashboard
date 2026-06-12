import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { logger } from './lib/logger.js';
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import projectRoutes from './routes/projects.js';
import invoiceRoutes from './routes/invoices.js';
import paymentRoutes from './routes/payments.js';
import estimateRoutes from './routes/estimates.js';
import creditNoteRoutes from './routes/credit-notes.js';
import reportRoutes from './routes/reports.js';
import attachmentRoutes from './routes/attachments.js';
import reminderRoutes from './routes/reminders.js';
import approvalRoutes from './routes/approval.js';
import paymentLinkRoutes from './routes/payment-links.js';
import webhookRoutes from './routes/webhooks.js';
import poExtractRoutes from './routes/po-extract.js';
import userRoutes from './routes/users.js';
import { escalateOverdueInvoices } from './jobs/overdueJob.js';
import { processReminders } from './jobs/reminderJob.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true }));
app.use(express.json());
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }) as any);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/invoices/:id/payments', paymentRoutes);
app.use('/api/v1/invoices/:id/attachments', attachmentRoutes);
app.use('/api/v1/invoices/:id/reminders', reminderRoutes);
app.use('/api/v1/invoices/:id/approval', approvalRoutes);
app.use('/api/v1/invoices/:id/payment-link', paymentLinkRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/api/v1/estimates', estimateRoutes);
app.use('/api/v1/po', poExtractRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/credit-notes', creditNoteRoutes);
app.use('/api/v1/reports', reportRoutes);

// Serve uploaded files
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`Backend running on port ${PORT}`);
  // Run overdue escalation at startup then every 6 hours
  escalateOverdueInvoices().catch(err => logger.error('Overdue job failed', { err }));
  setInterval(
    () => escalateOverdueInvoices().catch(err => logger.error('Overdue job failed', { err })),
    6 * 60 * 60 * 1000
  );
  // Reminder emails — run once at startup then hourly
  processReminders().catch(err => logger.error('Reminder job failed', { err }));
  setInterval(
    () => processReminders().catch(err => logger.error('Reminder job failed', { err })),
    60 * 60 * 1000
  );
});
