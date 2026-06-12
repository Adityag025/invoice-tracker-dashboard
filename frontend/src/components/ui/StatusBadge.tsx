import { clsx } from 'clsx';
import type { InvoiceStatus, EstimateStatus } from '../../types';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  READY_TO_SEND: 'bg-blue-100 text-blue-700',
  SENT: 'bg-indigo-100 text-indigo-700',
  VIEWED: 'bg-violet-100 text-violet-700',
  PART_PAID: 'bg-orange-100 text-orange-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500 line-through',
  APPROVED: 'bg-green-100 text-green-700',
  EXPIRED: 'bg-red-100 text-red-700',
  CONVERTED: 'bg-teal-100 text-teal-700',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  READY_TO_SEND: 'Ready to Send',
  SENT: 'Sent',
  VIEWED: 'Viewed',
  PART_PAID: 'Part Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
  APPROVED: 'Approved',
  EXPIRED: 'Expired',
  CONVERTED: 'Converted',
};

interface Props {
  status: InvoiceStatus | EstimateStatus | string;
}

export const StatusBadge = ({ status }: Props) => (
  <span className={clsx('badge', STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600')}>
    {STATUS_LABELS[status] ?? status}
  </span>
);
