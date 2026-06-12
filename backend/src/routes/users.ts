import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireMinRole, ROLE_LEVEL, AuthRequest } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);
router.use(requireMinRole('ACCOUNT_MANAGER')); // minimum to access any user endpoint

// Roles a given actor is allowed to create/manage (strictly lower level)
function manageableRoles(actorRole: string): string[] {
  const actorLevel = ROLE_LEVEL[actorRole] ?? 0;
  return Object.entries(ROLE_LEVEL)
    .filter(([, level]) => level < actorLevel)
    .map(([role]) => role);
}

// GET /api/v1/users
router.get('/', async (req: AuthRequest, res: Response) => {
  const actorRole  = req.user!.role;
  const actorLevel = ROLE_LEVEL[actorRole] ?? 0;

  // CEO and ACCOUNT_DIRECTOR see everyone; others see only lower roles
  const where =
    actorLevel >= ROLE_LEVEL['ACCOUNT_DIRECTOR']
      ? {}
      : { role: { in: manageableRoles(actorRole) } };

  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

const createSchema = z.object({
  name:     z.string().min(1),
  email:    z.string().email(),
  password: z.string().min(8),
  role:     z.string(),
});

// POST /api/v1/users
router.post('/', validate(createSchema), async (req: AuthRequest, res: Response) => {
  const { name, email, password, role } = req.body as z.infer<typeof createSchema>;
  const actorRole  = req.user!.role;
  const allowed    = manageableRoles(actorRole);

  if (!allowed.includes(role)) {
    res.status(403).json({ error: `Your role (${actorRole}) cannot create users with role ${role}` });
    return;
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) { res.status(409).json({ error: 'Email already registered' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  res.status(201).json(user);
});

const updateSchema = z.object({
  name:     z.string().min(1).optional(),
  email:    z.string().email().optional(),
  password: z.string().min(8).optional(),
  role:     z.string().optional(),
});

// PATCH /api/v1/users/:id
router.patch('/:id', validate(updateSchema), async (req: AuthRequest, res: Response) => {
  const actorRole  = req.user!.role;
  const actorLevel = ROLE_LEVEL[actorRole] ?? 0;

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) { res.status(404).json({ error: 'User not found' }); return; }

  // Cannot edit someone at the same or higher level (except editing yourself)
  if (target.id !== req.user!.userId && (ROLE_LEVEL[target.role] ?? 0) >= actorLevel) {
    res.status(403).json({ error: 'Cannot edit a user at or above your role level' });
    return;
  }

  const { name, email, password, role } = req.body as z.infer<typeof updateSchema>;

  // If changing role, the new role must also be lower than actor's level
  if (role && (ROLE_LEVEL[role] ?? 0) >= actorLevel) {
    res.status(403).json({ error: `Cannot assign role ${role} — it is at or above your level` });
    return;
  }

  const data: Record<string, unknown> = {};
  if (name)  data.name  = name;
  if (email) data.email = email;
  if (role)  data.role  = role;
  if (password) data.passwordHash = await bcrypt.hash(password, 12);

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  res.json(updated);
});

// DELETE /api/v1/users/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const actorRole  = req.user!.role;
  const actorLevel = ROLE_LEVEL[actorRole] ?? 0;

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) { res.status(404).json({ error: 'User not found' }); return; }

  if (target.id === req.user!.userId) {
    res.status(400).json({ error: 'Cannot delete your own account' });
    return;
  }
  if ((ROLE_LEVEL[target.role] ?? 0) >= actorLevel) {
    res.status(403).json({ error: 'Cannot delete a user at or above your role level' });
    return;
  }

  await prisma.user.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
