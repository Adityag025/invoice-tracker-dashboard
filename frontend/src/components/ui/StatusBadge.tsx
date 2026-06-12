import { clsx } from 'clsx';
import type { InvoiceStatus, EstimateStatus } from '../../types';

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  DRAFT:            { badge: 'bg-[#74777f]/10 text-[#43474e]',       dot: 'bg-[#74777f]' },
  PENDING_APPROVAL: { badge: 'bg-amber-500/10 text-amber-700',        dot: 'bg-amber-500' },
  READY_TO_SEND:    { badge: 'bg-violet-500/10 text-violet-700',      dot: 'bg-violet-500' },
  SENT:             { badge: 'bg-[#0b61a1]/10 text-[#0b61a1]',       dot: 'bg-[#0b61a1]' },
  VIEWED:           { badge: 'bg-indigo-500/10 text-indigo-700',      dot: 'bg-indigo-500' },
  PART_PAID:        { badge: 'bg-orange-500/10 text-orange-700',      dot: 'bg-orange-500' },
  PAID:             { badge: 'bg-green-500/10 text-green-700',        dot: 'bg-green-500' },
  OVERDUE:          { badge: 'bg-[#ba1a1a]/10 text-[#ba1a1a]',       dot: 'bg-[#ba1a1a]' },
  CANCELLED:        { badge: 'bg-[#74777f]/10 text-[#74777f]',       dot: 'bg-[#74777f]' },
  WRITTEN_OFF:      { badge: 'bg-[#43474e]/10 text-[#43474e]',       dot: 'bg-[#43474e]' },
  APPROVED:         { badge: 'bg-green-500/10 text-green-700',        dot: 'bg-green-500' },
  EXPIRED:          { badge: 'bg-[#ba1a1a]/10 text-[#ba1a1a]',       dot: 'bg-[#ba1a1a]' },
  CONVERTED:        { badge: 'bg-teal-500/10 text-teal-700',          dot: 'bg-teal-500' },
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', PENDING_APPROVAL: 'Pending Approval', READY_TO_SEND: 'Ready to Send',
  SENT: 'Sent', VIEWED: 'Viewed', PART_PAID: 'Part Paid', PAID: 'Paid',
  OVERDUE: 'Overdue', CANCELLED: 'Cancelled', WRITTEN_OFF: 'Written Off', APPROVED: 'Approved',
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
