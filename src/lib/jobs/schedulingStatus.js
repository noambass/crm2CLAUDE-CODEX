import {
  JOB_STATUS as WORKFLOW_JOB_STATUS,
  getStatusForScheduling as getStatusForSchedulingByPolicy,
} from '@/lib/workflow/statusPolicy';

// Backward-compatible wrapper used by existing modules.
export const JOB_STATUS = WORKFLOW_JOB_STATUS;

export function getStatusForScheduling(currentStatus) {
  return getStatusForSchedulingByPolicy(currentStatus);
}
