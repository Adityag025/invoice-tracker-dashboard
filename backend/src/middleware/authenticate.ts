import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';

export interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

// Hierarchy: higher number = more authority
export const ROLE_LEVEL: Record<string, number> = {
  SUB_MANAGER:       1,
  ACCOUNT_MANAGER:   2,
  POD_HEAD:          3,
  ACCOUNT_DIRECTOR:  4,
  CEO:               5,
};

export const ALL_ROLES = Object.keys(ROLE_LEVEL) as string[];

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }
  try {
    req.user = verifyAccessToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Require the user's role level to be >= the given role
export const requireMinRole = (minRole: string) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const userLevel = ROLE_LEVEL[req.user?.role ?? ''] ?? 0;
    const minLevel  = ROLE_LEVEL[minRole] ?? 99;
    if (userLevel < minLevel) {
      res.status(403).json({ error: `Requires ${minRole} or above` });
      return;
    }
    next();
  };

// Backward compat: routes that previously used requireAdmin now require POD_HEAD+
export const requireAdmin = requireMinRole('POD_HEAD');

// Approval actions (approve/reject invoice) require ACCOUNT_DIRECTOR+
export const requireApprover = requireMinRole('ACCOUNT_DIRECTOR');
