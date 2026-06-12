import { Router, Response, Request } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { authenticate, AuthRequest } from '../middleware/authenticate.js';
import { extractPOFromFile, getTempPoDir } from '../services/po-extract.service.js';
import { logger } from '../lib/logger.js';

const router = Router();
router.use(authenticate);

const tmpStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, getTempPoDir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const id = crypto.randomBytes(16).toString('hex');
    cb(null, `${id}${ext}`);
  },
});

const tmpUpload = multer({
  storage: tmpStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fileFilter: (_req: any, file, cb) => {
    const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']);
    allowed.has(file.mimetype) ? cb(null, true) : cb(new Error('Only PDF and images supported for extraction'));
  },
});

// POST /api/v1/po/extract
// Accepts a file, extracts PO fields using Claude, stores file temporarily.
// Returns { tempFileId, mimeType, originalName, fields }
router.post(
  '/extract',
  (req: Request, res: Response, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tmpUpload.single('file')(req as any, res as any, (err) => {
      if (err) { res.status(400).json({ error: (err as Error).message }); return; }
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(400).json({ error: 'ANTHROPIC_API_KEY not configured — please add it to .env' });
      return;
    }

    try {
      const fields = await extractPOFromFile(req.file.path, req.file.mimetype);
      logger.info('PO extracted', { tempFile: req.file.filename, confidence: fields.confidence });

      res.json({
        tempFileId: req.file.filename,
        mimeType: req.file.mimetype,
        originalName: req.file.originalname,
        fields,
      });
    } catch (err) {
      logger.error('PO extraction failed', { error: (err as Error).message });
      res.status(500).json({ error: 'Extraction failed: ' + (err as Error).message });
    }
  }
);

export default router;
