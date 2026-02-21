import React from 'react';
import { Badge } from '@/components/ui/badge';
import { getStatusPresentation } from '@/lib/workflow/statusPresentation';
import { getNextAction } from '@/lib/workflow/nextActionResolver';
import {
  CLIENT_STATUS_PALETTE,
  CLIENT_TYPE_PALETTE,
  JOB_PRIORITY_PALETTE,
  NEXT_ACTION_TONE_COLORS,
  QUOTE_STATUS_PALETTE,
  STATUS_NEUTRAL_COLOR,
  alphaHex,
} from '@/lib/ui/statusPalette';

function StyledBadge({ label, color, className = '' }) {
  return (
    <Badge
      variant="outline"
      style={{
        backgroundColor: alphaHex(color),
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

  const color = NEXT_ACTION_TONE_COLORS[action.tone] || NEXT_ACTION_TONE_COLORS.default;
  return <StyledBadge label={`פעולה הבאה: ${action.label}`} color={color} className="text-[11px]" />;
}

export function PriorityBadge({ priority }) {
  const normalized = String(priority || '').toLowerCase().trim();
  if (!normalized || normalized === 'normal') return null;

  const cfg = JOB_PRIORITY_PALETTE[normalized] || { label: priority, color: STATUS_NEUTRAL_COLOR };
  return <StyledBadge label={cfg.label} color={cfg.color} />;
}

export function ClientStatusBadge({ status }) {
  const cfg = CLIENT_STATUS_PALETTE[status] || { label: status, color: STATUS_NEUTRAL_COLOR };
  return <StyledBadge label={cfg.label} color={cfg.color} />;
}

export function ClientTypeBadge({ type }) {
  const cfg = CLIENT_TYPE_PALETTE[type] || CLIENT_TYPE_PALETTE.private;
  return <StyledBadge label={cfg.label} color={cfg.color} />;
}

export function QuoteStatusBadge({ status }) {
  const cfg = QUOTE_STATUS_PALETTE[status] || { label: status, color: STATUS_NEUTRAL_COLOR };
  return <StyledBadge label={cfg.label} color={cfg.color} />;
}

export function clearConfigCache() {
  // kept for backwards compatibility with settings modules
}
