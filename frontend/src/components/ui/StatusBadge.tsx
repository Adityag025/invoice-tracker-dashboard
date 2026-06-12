import { clsx } from 'clsx';
import type { InvoiceStatus, EstimateStatus } from '../../types';

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  DRAFT:            { badge: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400' },
  PENDING_APPROVAL: { badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  READY_TO_SEND:    { badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  SENT:             { badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  VIEWED:           { badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  PART_PAID:        { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
  PAID:             { badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500' },
  OVERDUE:          { badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500' },
  CANCELLED:        { badge: 'bg-gray-100 text-gray-400',     dot: 'bg-gray-300' },
  APPROVED:         { badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500' },
  EXPIRED:          { badge: 'bg-red-100 text-red-600',       dot: 'bg-red-400' },
  CONVERTED:        { badge: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-500' },
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', PENDING_APPROVAL: 'Pending Approval', READY_TO_SEND: 'Ready to Send',
  SENT: 'Sent', VIEWED: 'Viewed', PART_PAID: 'Part Paid', PAID: 'Paid',
  OVERDUE: 'Overdue', CANCELLED: 'Cancelled', APPROVED: 'Approved',
  EXPIRED: 'Expired', CONVERTED: 'Converted',
};

interface Props { status: InvoiceStatus | EstimateStatus | string }

export const StatusBadge = ({ status }: Props) => {
  const s = STATUS_STYLES[status] ?? { badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
  return (
    <span className={clsx('badge', s.badge)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', s.dot)} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
};
