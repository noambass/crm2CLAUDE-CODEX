import {
  JOB_STATUS,
  JOB_ALLOWED_TRANSITIONS,
  canTransitionJobStatus,
} from '@/lib/workflow/statusPolicy';

// Backward-compatible exports for pages importing this module.
export const JOB_STATUSES = JOB_STATUS;

export const STATUS_CONFIG = {
  [JOB_STATUS.QUOTE]: {
    value: JOB_STATUS.QUOTE,
    label: 'הצעת מחיר',
    color: '#6366f1',
  },
  [JOB_STATUS.WAITING_SCHEDULE]: {
    value: JOB_STATUS.WAITING_SCHEDULE,
    label: 'ממתין לתזמון',
    color: '#f59e0b',
  },
  [JOB_STATUS.WAITING_EXECUTION]: {
    value: JOB_STATUS.WAITING_EXECUTION,
    label: 'ממתין לביצוע',
    color: '#3b82f6',
  },
  [JOB_STATUS.DONE]: {
    value: JOB_STATUS.DONE,
    label: 'בוצע',
    color: '#10b981',
  },
};

export const ALLOWED_TRANSITIONS = JOB_ALLOWED_TRANSITIONS;

export const canTransitionStatus = (currentStatus, nextStatus) => {
  return canTransitionJobStatus(currentStatus, nextStatus);
};

export const getNextAllowedStatuses = (currentStatus) => {
  return JOB_ALLOWED_TRANSITIONS[currentStatus] || [];
};

