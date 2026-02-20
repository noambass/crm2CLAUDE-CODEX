import {
  JOB_STATUS,
  JOB_ALLOWED_TRANSITIONS,
  canTransitionJobStatus,
} from '@/lib/workflow/statusPolicy';
import { STATUS_PRESENTATION_MAP } from '@/lib/workflow/statusPresentation';

// Backward-compatible exports for pages importing this module.
export const JOB_STATUSES = JOB_STATUS;

export const STATUS_CONFIG = {
  [JOB_STATUS.WAITING_SCHEDULE]: {
    value: JOB_STATUS.WAITING_SCHEDULE,
    label: STATUS_PRESENTATION_MAP[JOB_STATUS.WAITING_SCHEDULE].label,
    color: STATUS_PRESENTATION_MAP[JOB_STATUS.WAITING_SCHEDULE].color,
  },
  [JOB_STATUS.WAITING_EXECUTION]: {
    value: JOB_STATUS.WAITING_EXECUTION,
    label: STATUS_PRESENTATION_MAP[JOB_STATUS.WAITING_EXECUTION].label,
    color: STATUS_PRESENTATION_MAP[JOB_STATUS.WAITING_EXECUTION].color,
  },
  [JOB_STATUS.DONE]: {
    value: JOB_STATUS.DONE,
    label: STATUS_PRESENTATION_MAP[JOB_STATUS.DONE].label,
    color: STATUS_PRESENTATION_MAP[JOB_STATUS.DONE].color,
  },
};

export const ALLOWED_TRANSITIONS = JOB_ALLOWED_TRANSITIONS;

export const canTransitionStatus = (currentStatus, nextStatus) => {
  return canTransitionJobStatus(currentStatus, nextStatus);
};

export const getNextAllowedStatuses = (currentStatus) => {
  return JOB_ALLOWED_TRANSITIONS[currentStatus] || [];
};
