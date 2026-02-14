// Job status flow used across forms and details screens.
// Official statuses from CRM v1:
// quote -> waiting_schedule -> waiting_execution -> done
export const JOB_STATUSES = {
  QUOTE: 'quote',
  WAITING_SCHEDULE: 'waiting_schedule',
  WAITING_EXECUTION: 'waiting_execution',
  DONE: 'done',
};

export const STATUS_CONFIG = {
  [JOB_STATUSES.QUOTE]: {
    value: JOB_STATUSES.QUOTE,
    label: 'הצעת מחיר',
    color: '#6366f1',
  },
  [JOB_STATUSES.WAITING_SCHEDULE]: {
    value: JOB_STATUSES.WAITING_SCHEDULE,
    label: 'ממתין לתזמון',
    color: '#f59e0b',
  },
  [JOB_STATUSES.WAITING_EXECUTION]: {
    value: JOB_STATUSES.WAITING_EXECUTION,
    label: 'ממתין לביצוע',
    color: '#3b82f6',
  },
  [JOB_STATUSES.DONE]: {
    value: JOB_STATUSES.DONE,
    label: 'בוצע',
    color: '#10b981',
  },
};

export const ALLOWED_TRANSITIONS = {
  [JOB_STATUSES.QUOTE]: [JOB_STATUSES.WAITING_SCHEDULE],
  [JOB_STATUSES.WAITING_SCHEDULE]: [JOB_STATUSES.WAITING_EXECUTION],
  [JOB_STATUSES.WAITING_EXECUTION]: [JOB_STATUSES.DONE],
  [JOB_STATUSES.DONE]: [],
};

export const canTransitionStatus = (currentStatus, nextStatus) => {
  return ALLOWED_TRANSITIONS[currentStatus]?.includes(nextStatus) || false;
};

export const getNextAllowedStatuses = (currentStatus) => {
  return ALLOWED_TRANSITIONS[currentStatus] || [];
};
