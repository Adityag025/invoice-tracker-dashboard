import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest, ROLE_LEVEL } from '../middleware/authenticate.js';

const router = Router();
router.use(authenticate);

router.get('/counts', async (req: AuthRequest, res: Response) => {
  const now = new Date();
  const role = req.user?.role ?? '';

  const [overdueStatus, overdueActual, pendingApproval] = await Promise.all([
    prisma.invoice.count({ where: { status: 'OVERDUE' } }),
    prisma.invoice.count({
      where: {
        status: { in: ['SENT', 'VIEWED', 'PART_PAID'] },
        dueDate: { lt: now },
      },
    }),
    (ROLE_LEVEL[role] ?? 0) >= ROLE_LEVEL['ACCOUNT_DIRECTOR']
      ? prisma.invoice.count({ where: { status: 'PENDING_APPROVAL' } })
      : Promise.resolve(0),
  ]);

  res.json({
    overdueCount: overdueStatus + overdueActual,
    pendingApprovalCount: pendingApproval,
  });
});

export default router;
