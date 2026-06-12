import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireApprover, AuthRequest } from '../middleware/authenticate.js';

const router = Router();
router.use(authenticate);

router.get('/', async (_req: AuthRequest, res: Response) => {
  const row = await prisma.systemSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', data: '{}' },
    update: {},
  });
  res.json(JSON.parse(row.data || '{}'));
});

router.put('/', requireApprover, async (req: AuthRequest, res: Response) => {
  const row = await prisma.systemSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', data: JSON.stringify(req.body) },
    update: { data: JSON.stringify(req.body) },
  });
  res.json(JSON.parse(row.data));
});

export default router;
