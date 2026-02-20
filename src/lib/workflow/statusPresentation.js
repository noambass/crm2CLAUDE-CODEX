import { JOB_STATUS } from '@/lib/workflow/statusPolicy';

export const STATUS_PRESENTATION_MAP = Object.freeze({
  [JOB_STATUS.WAITING_SCHEDULE]: {
    label: 'ממתין לתזמון',
    shortLabel: 'לתזמון',
    color: '#f59e0b',
  },
  [JOB_STATUS.WAITING_EXECUTION]: {
    label: 'מתוזמן',
    shortLabel: 'מתוזמן',
    color: '#0284c7',
  },
  [JOB_STATUS.DONE]: {
    label: 'בוצע',
    shortLabel: 'בוצע',
    color: '#10b981',
  },
});

export function getStatusPresentation(status) {
  return STATUS_PRESENTATION_MAP[status] || {
    label: status || 'לא ידוע',
    shortLabel: status || 'לא ידוע',
    color: '#64748b',
  };
}
