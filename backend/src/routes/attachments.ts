import { Router, Response, Request } from 'express';
import { z } from 'zod';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/authenticate.js';
import { upload } from '../middleware/upload.js';
import { storeFile, deleteLocalFile } from '../services/storage.service.js';
import { logger } from '../lib/logger.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

// POST /api/v1/invoices/:id/attachments
router.post(
  '/',
  (req: Request, res: Response, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    upload.single('file')(req as any, res as any, (err) => {
      if (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const file = req.file;
    if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

    try {
      const stored = await storeFile(file);
      const attachment = await prisma.invoiceAttachment.create({
        data: {
          invoiceId: id,
          fileName: stored.fileName,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          storageType: stored.storageType,
          url: stored.url,
          uploadedById: req.user!.userId,
        },
        include: { uploadedBy: { select: { name: true } } },
      });
      await prisma.invoiceEvent.create({
        data: {
          invoiceId: id,
          eventType: 'FILE_ATTACHED',
          actorId: req.user!.userId,
          metadata: JSON.stringify({ fileName: file.originalname, size: file.size }),
        },
      });
      res.status(201).json(attachment);
    } catch (err) {
      logger.error('Attachment upload failed', { err });
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

// GET /api/v1/invoices/:id/attachments
router.get('/', async (req: AuthRequest, res: Response) => {
  const attachments = await prisma.invoiceAttachment.findMany({
    where: { invoiceId: req.params.id },
    orderBy: { createdAt: 'desc' },
    include: { uploadedBy: { select: { name: true } } },
  });
  res.json(attachments);
});

// DELETE /api/v1/invoices/:id/attachments/:attachmentId
router.delete('/:attachmentId', async (req: AuthRequest, res: Response) => {
  const attachment = await prisma.invoiceAttachment.findUnique({
    where: { id: req.params.attachmentId },
  });
  if (!attachment) { res.status(404).json({ error: 'Attachment not found' }); return; }

  if (attachment.storageType === 'local') {
    deleteLocalFile(attachment.fileName);
  }
  await prisma.invoiceAttachment.delete({ where: { id: req.params.attachmentId } });
  res.json({ success: true });
});

export default router;
