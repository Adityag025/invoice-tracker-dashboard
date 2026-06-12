import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest, requireMinRole } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

const podSchema = z.object({
  name: z.string().min(1),
  podHeadId: z.string().optional().nullable(),
  accountDirectorId: z.string().optional().nullable(),
});

router.get('/', async (_req: AuthRequest, res: Response) => {
  const pods = await prisma.pod.findMany({
    where: { active: true },
    include: {
      podHead: { select: { id: true, name: true, email: true } },
      accountDirector: { select: { id: true, name: true, email: true } },
      _count: { select: { clients: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(pods);
});

router.post('/', requireMinRole('ACCOUNT_DIRECTOR'), validate(podSchema), async (req: AuthRequest, res: Response) => {
  const { name, podHeadId, accountDirectorId } = req.body;
  const pod = await prisma.pod.create({
    data: { name, podHeadId: podHeadId || null, accountDirectorId: accountDirectorId || null },
    include: {
      podHead: { select: { id: true, name: true } },
      accountDirector: { select: { id: true, name: true } },
    },
  });
  res.status(201).json(pod);
});

router.patch('/:id', requireMinRole('ACCOUNT_DIRECTOR'), validate(podSchema.partial()), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const pod = await prisma.pod.findUnique({ where: { id } });
  if (!pod) { res.status(404).json({ error: 'Pod not found' }); return; }

  const updated = await prisma.pod.update({
    where: { id },
    data: req.body,
    include: {
      podHead: { select: { id: true, name: true } },
      accountDirector: { select: { id: true, name: true } },
    },
  });
  res.json(updated);
});

router.delete('/:id', requireMinRole('ACCOUNT_DIRECTOR'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const pod = await prisma.pod.findUnique({ where: { id } });
  if (!pod) { res.status(404).json({ error: 'Pod not found' }); return; }

  await prisma.pod.update({ where: { id }, data: { active: false } });
  res.json({ success: true });
});

export default router;
