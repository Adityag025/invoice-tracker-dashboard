export type UserRole = 'ADMIN' | 'MANAGER';
export type ProjectType = 'RETAINER' | 'ONE_OFF';
export type TaxType = 'CGST_SGST' | 'IGST';
export type PaymentMethod = 'NEFT' | 'RTGS' | 'UPI' | 'CHEQUE' | 'CASH';

export type InvoiceStatus =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'READY_TO_SEND'
  | 'SENT' | 'VIEWED' | 'PART_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type EstimateStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'EXPIRED' | 'CONVERTED';
export type CreditNoteType = 'FULL' | 'PARTIAL';
export type CreditNoteStatus = 'DRAFT' | 'ISSUED' | 'SETTLED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Client {
  id: string;
  name: string;
  gstin?: string;
  stateCode: string;
  billingTerms: string;
  creditLimit?: number;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  clientId: string;
  client?: { name: string };
  name: string;
  type: ProjectType;
  budget?: number;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  hsnSac?: string;
  quantity: number;
  unitRate: number;
  taxRate: number;
  taxType: TaxType;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  client?: { name: string };
  projectId?: string;
  project?: { name: string };
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  notes?: string;
  poNumber?: string;
  items?: InvoiceItem[];
  payments?: Payment[];
  events?: InvoiceEvent[];
  createdAt: string;
}

export interface InvoiceEvent {
  id: string;
  eventType: string;
  actor?: { name: string };
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  recordedBy?: { name: string };
  createdAt: string;
}

export interface Estimate {
  id: string;
  estimateNumber: string;
  clientId: string;
  client?: { name: string };
  projectId?: string;
  project?: { name: string };
  status: EstimateStatus;
  validUntil?: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  notes?: string;
  items?: InvoiceItem[];
  createdAt: string;
}

export interface CreditNote {
  id: string;
  cnNumber: string;
  invoiceId: string;
  type: CreditNoteType;
  reason: string;
  amount: number;
  status: CreditNoteStatus;
  refundAmount?: number;
  refundDate?: string;
  replacementInvoiceId?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
