import React from 'react';
import { Badge } from '@/components/ui/badge';

const defaultJobStatuses = {
  quote: { label: 'הצעת מחיר', color: '#6366f1' },
  waiting_schedule: { label: 'ממתין לתזמון', color: '#f59e0b' },
  waiting_execution: { label: 'ממתין לביצוע', color: '#3b82f6' },
  done: { label: 'בוצע', color: '#10b981' },
};

const defaultJobPriorities = {
  normal: { label: 'רגיל', color: '#64748b' },
  urgent: { label: 'דחוף', color: '#ef4444' },
  high: { label: 'גבוה', color: '#f97316' },
  medium: { label: 'בינוני', color: '#3b82f6' },
  low: { label: 'נמוך', color: '#64748b' },
};

const defaultClientStatuses = {
  active: { label: 'פעיל', color: '#10b981' },
  inactive: { label: 'לא פעיל', color: '#64748b' },
};

const defaultQuoteStatuses = {
  draft: { label: 'טיוטה', color: '#64748b' },
  sent: { label: 'נשלחה', color: '#8b5cf6' },
  approved: { label: 'אושרה', color: '#10b981' },
  rejected: { label: 'נדחתה', color: '#ef4444' },
};

function StyledBadge({ label, color }) {
  return (
    <Badge
      variant="outline"
      style={{
        backgroundColor: `${color}20`,
        color,
        borderColor: color,
      }}
      className="font-medium"
    >
      {label}
    </Badge>
  );
}

export function JobStatusBadge({ status }) {
  const cfg = defaultJobStatuses[status] || { label: status, color: '#64748b' };
  return <StyledBadge label={cfg.label} color={cfg.color} />;
}

export function PriorityBadge({ priority }) {
  const normalized = String(priority || '').toLowerCase().trim();
  if (!normalized || normalized === 'normal') return null;

  const cfg = defaultJobPriorities[normalized] || { label: priority, color: '#64748b' };
  return <StyledBadge label={cfg.label} color={cfg.color} />;
}

export function ClientStatusBadge({ status }) {
  const cfg = defaultClientStatuses[status] || { label: status, color: '#64748b' };
  return <StyledBadge label={cfg.label} color={cfg.color} />;
}

export function ClientTypeBadge({ type }) {
  const cfg =
    type === 'company'
      ? { label: 'חברה', color: '#6366f1' }
      : type === 'customer_service'
      ? { label: 'שירות לקוחות', color: '#a855f7' }
      : { label: 'פרטי', color: '#14b8a6' };

  return <StyledBadge label={cfg.label} color={cfg.color} />;
}

export function QuoteStatusBadge({ status }) {
  const cfg = defaultQuoteStatuses[status] || { label: status, color: '#64748b' };
  return <StyledBadge label={cfg.label} color={cfg.color} />;
}

export function clearConfigCache() {
  // kept for backwards compatibility with settings modules
}
