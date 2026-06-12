import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/authenticate.js';
import { sendManualReminder } from '../jobs/reminderJob.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

// GET /api/v1/invoices/:id/reminders
router.get('/', async (req: AuthRequest, res: Response) => {
  const logs = await prisma.reminderLog.findMany({
    where: { invoiceId: req.params.id },
    orderBy: { sentAt: 'desc' },
  });
  res.json(logs);
});

// POST /api/v1/invoices/:id/reminders/send — manual trigger
router.post('/send', async (req: AuthRequest, res: Response) => {
  const result = await sendManualReminder(req.params.id, req.user!.userId);
  if (!result.sent) {
    res.status(400).json({ error: result.reason });
    return;
  }
  res.json({ success: true });
});

export default router;
