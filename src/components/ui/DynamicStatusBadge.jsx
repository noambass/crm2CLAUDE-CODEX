import React from 'react';
import { Badge } from '@/components/ui/badge';
import { getStatusPresentation } from '@/lib/workflow/statusPresentation';
import { getNextAction } from '@/lib/workflow/nextActionResolver';

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

function StyledBadge({ label, color, className = '' }) {
  return (
    <Badge
      variant="outline"
      style={{
        backgroundColor: `${color}20`,
        color,
        borderColor: color,
      }}
      className={`font-medium ${className}`.trim()}
    >
      {label}
    </Badge>
  );
}

export function JobStatusBadge({ status }) {
  const normalized = String(status || '').toLowerCase().trim();
  if (!normalized) return null;
  const cfg = getStatusPresentation(normalized);
  return <StyledBadge label={cfg.label} color={cfg.color} />;
}

export function NextActionBadge({ status }) {
  const action = getNextAction(status);
  if (!action) return null;

  const color =
    action.tone === 'warning'
      ? '#d97706'
      : action.tone === 'info'
      ? '#0284c7'
      : '#6366f1';

  return <StyledBadge label={`פעולה הבאה: ${action.label}`} color={color} className="text-[11px]" />;
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
      : type === 'bath_company'
      ? { label: 'חברת אמבטיות', color: '#0d9488' }
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
