import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { logger } from './lib/logger.js';
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import projectRoutes from './routes/projects.js';
import invoiceRoutes from './routes/invoices.js';
import paymentRoutes from './routes/payments.js';
import estimateRoutes from './routes/estimates.js';
import creditNoteRoutes from './routes/credit-notes.js';
import reportRoutes from './routes/reports.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/invoices/:id/payments', paymentRoutes);
app.use('/api/v1/estimates', estimateRoutes);
app.use('/api/v1/credit-notes', creditNoteRoutes);
app.use('/api/v1/reports', reportRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => logger.info(`Backend running on port ${PORT}`));
