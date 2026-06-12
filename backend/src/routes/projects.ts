import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

const projectSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['RETAINER', 'ONE_OFF']).default('ONE_OFF'),
  budget: z.number().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const { clientId, search, page = '1', limit = '50' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: Record<string, unknown> = clientId ? { clientId } : {};
  if (search) where.name = { contains: search };
  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.project.count({ where }),
  ]);
  res.json({ projects, total });
});

router.post('/', validate(projectSchema), async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.create({
    data: req.body,
    include: { client: { select: { name: true } } },
  });
  res.status(201).json(project);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      client: true,
      invoices: {
        orderBy: { issueDate: 'desc' },
        select: { id: true, invoiceNumber: true, status: true, issueDate: true, dueDate: true, total: true },
      },
    },
  });
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  res.json(project);
});

export default router;
