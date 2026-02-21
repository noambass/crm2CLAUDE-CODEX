export const STATUS_NEUTRAL_COLOR = '#64748b';

export const JOB_PRIORITY_PALETTE = Object.freeze({
  normal: { label: 'רגיל', color: '#64748b' },
  urgent: { label: 'דחוף', color: '#ef4444' },
});

export const CLIENT_STATUS_PALETTE = Object.freeze({
  lead: { label: 'ליד', color: '#f59e0b' },
  active: { label: 'פעיל', color: '#10b981' },
  inactive: { label: 'לא פעיל', color: '#94a3b8' },
});

export const CLIENT_TYPE_PALETTE = Object.freeze({
  private: { label: 'פרטי', color: '#14b8a6' },
  company: { label: 'חברה', color: '#6366f1' },
  bath_company: { label: 'חברת אמבטיות', color: '#0d9488' },
});

export const QUOTE_STATUS_PALETTE = Object.freeze({
  draft: { label: 'טיוטה', color: '#64748b' },
  sent: { label: 'נשלחה', color: '#8b5cf6' },
  approved: { label: 'אושרה', color: '#10b981' },
  rejected: { label: 'נדחתה', color: '#ef4444' },
});

export const JOB_WORKFLOW_STATUS_PALETTE = Object.freeze({
  waiting_schedule: { label: 'ממתין לתזמון', shortLabel: 'לתזמון', color: '#f59e0b' },
  waiting_execution: { label: 'מתוזמן', shortLabel: 'מתוזמן', color: '#0284c7' },
  done: { label: 'בוצע', shortLabel: 'בוצע', color: '#10b981' },
});

export const NEXT_ACTION_TONE_COLORS = Object.freeze({
  warning: '#d97706',
  info: '#0284c7',
  default: '#6366f1',
});

export function alphaHex(color, opacityHex = '20') {
  return `${color}${opacityHex}`;
}
