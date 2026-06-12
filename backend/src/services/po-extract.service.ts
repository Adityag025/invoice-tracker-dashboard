import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { logger } from '../lib/logger.js';

export interface ExtractedPO {
  poNumber: string | null;
  poDate: string | null;       // ISO date string YYYY-MM-DD
  poValue: number | null;
  vendorName: string | null;
  confidence: 'high' | 'low';
}

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function getMediaType(mimeType: string): 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | null {
  if (mimeType === 'application/pdf') return 'application/pdf';
  if (SUPPORTED_IMAGE_TYPES.has(mimeType)) return mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  return null;
}

export async function extractPOFromFile(filePath: string, mimeType: string): Promise<ExtractedPO> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const mediaType = getMediaType(mimeType);
  if (!mediaType) {
    throw new Error(`Unsupported file type for extraction: ${mimeType}`);
  }

  const fileData = fs.readFileSync(filePath);
  const base64Data = fileData.toString('base64');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const sourceType = mediaType === 'application/pdf' ? 'base64' : 'base64';

  const contentBlock = mediaType === 'application/pdf'
    ? {
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64Data },
      }
    : {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64Data },
      };

  // suppress unused variable warning
  void sourceType;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          contentBlock,
          {
            type: 'text',
            text: `You are a data extraction assistant. Extract the following fields from this Purchase Order document and return ONLY a valid JSON object with no markdown, no explanation.

Fields to extract:
- poNumber: The PO number / purchase order number / order reference (string or null)
- poDate: The date on the PO in ISO format YYYY-MM-DD (string or null)
- poValue: The total order value as a plain number without currency symbols or commas (number or null)
- vendorName: The vendor / supplier / seller name this PO is addressed to (string or null)
- confidence: "high" if you found at least poNumber and poValue clearly, "low" otherwise

Return only JSON. Example: {"poNumber":"PO-2024-001","poDate":"2024-03-15","poValue":125000,"vendorName":"Acme Agency Pvt Ltd","confidence":"high"}`,
          },
        ],
      },
    ],
  });

  const raw = (response.content[0] as { type: string; text: string }).text.trim();
  logger.info('PO extraction raw response', { raw: raw.slice(0, 200) });

  // Strip any accidental markdown fences
  const jsonStr = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

  try {
    const parsed = JSON.parse(jsonStr) as ExtractedPO;
    return {
      poNumber: parsed.poNumber ?? null,
      poDate: parsed.poDate ?? null,
      poValue: typeof parsed.poValue === 'number' ? parsed.poValue : null,
      vendorName: parsed.vendorName ?? null,
      confidence: parsed.confidence === 'high' ? 'high' : 'low',
    };
  } catch {
    logger.warn('PO extraction: JSON parse failed', { raw });
    return { poNumber: null, poDate: null, poValue: null, vendorName: null, confidence: 'low' };
  }
}

export function getTempPoDir(): string {
  return path.resolve(process.cwd(), 'uploads', 'po-tmp');
}
