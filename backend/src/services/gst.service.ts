const AGENCY_STATE_CODE = process.env.AGENCY_STATE_CODE ?? '27';

export type TaxType = 'CGST_SGST' | 'IGST';

export interface LineItemInput {
  description: string;
  hsnSac?: string;
  quantity: number;
  unitRate: number;
  taxRate: number;
}

export interface LineItemCalc extends LineItemInput {
  taxType: TaxType;
  lineTotal: number;
  taxAmount: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
}

export const calcLineItems = (items: LineItemInput[], clientStateCode: string): LineItemCalc[] => {
  const isInterState = clientStateCode !== AGENCY_STATE_CODE;
  return items.map(item => {
    const base = item.quantity * item.unitRate;
    const taxAmount = (base * item.taxRate) / 100;
    const lineTotal = base + taxAmount;
    const taxType: TaxType = isInterState ? 'IGST' : 'CGST_SGST';
    return {
      ...item,
      taxType,
      lineTotal,
      taxAmount,
      ...(taxType === 'CGST_SGST' ? { cgst: taxAmount / 2, sgst: taxAmount / 2 } : { igst: taxAmount }),
    };
  });
};

export const calcTotals = (items: LineItemCalc[]) => ({
  subtotal: items.reduce((s, i) => s + i.quantity * i.unitRate, 0),
  taxTotal: items.reduce((s, i) => s + i.taxAmount, 0),
  total: items.reduce((s, i) => s + i.lineTotal, 0),
});

export const validateGstin = (gstin: string): boolean => {
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return regex.test(gstin);
};
