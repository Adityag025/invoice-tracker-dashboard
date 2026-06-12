import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { validateGstin } from '../services/gst.service.js';

const router = Router();
router.use(authenticate);

const clientSchema = z.object({
  name: z.string().min(1),
  gstin: z.string().optional().refine(g => !g || validateGstin(g), 'Invalid GSTIN'),
  stateCode: z.string().length(2),
  billingTerms: z.string().default('NET_30'),
  creditLimit: z.number().optional(),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const { search, page = '1', limit = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = search
    ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { contactEmail: { contains: search, mode: 'insensitive' as const } }] }
    : {};
  const [clients, total] = await Promise.all([
    prisma.client.findMany({ where, skip, take: parseInt(limit), orderBy: { name: 'asc' } }),
    prisma.client.count({ where }),
  ]);
  res.json({ clients, total, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/', validate(clientSchema), async (req: AuthRequest, res: Response) => {
  const client = await prisma.client.create({ data: req.body });
  res.status(201).json(client);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { invoices: true, projects: true } } },
  });
  if (!client) { res.status(404).json({ error: 'Client not found' }); return; }
  res.json(client);
});

router.put('/:id', validate(clientSchema), async (req: AuthRequest, res: Response) => {
  const client = await prisma.client.update({ where: { id: req.params.id }, data: req.body });
  res.json(client);
});

export default router;
