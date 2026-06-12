import { prisma } from '../lib/prisma.js';

const AGENCY_PREFIX = process.env.AGENCY_PREFIX ?? 'INV';

const getFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  return `${String(startYear).slice(2)}${String(startYear + 1).slice(2)}`;
};

export const generateInvoiceNumber = async (): Promise<string> => {
  const fy = getFinancialYear();
  const prefix = `${AGENCY_PREFIX}/${fy}/`;
  const last = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
  });
  const seq = last ? parseInt(last.invoiceNumber.split('/')[2], 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
};

export const generateEstimateNumber = async (revision?: boolean): Promise<string> => {
  const fy = getFinancialYear();
  const prefix = `EST/${fy}/`;
  const last = await prisma.estimate.findFirst({
    where: { estimateNumber: { startsWith: prefix } },
    orderBy: { estimateNumber: 'desc' },
  });
  const seq = last ? parseInt(last.estimateNumber.split('/')[2], 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
};

export const generateCreditNoteNumber = async (): Promise<string> => {
  const fy = getFinancialYear();
  const prefix = `CN/${fy}/`;
  const last = await prisma.creditNote.findFirst({
    where: { cnNumber: { startsWith: prefix } },
    orderBy: { cnNumber: 'desc' },
  });
  const seq = last ? parseInt(last.cnNumber.split('/')[2], 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
};
