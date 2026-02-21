import { JOB_STATUS } from '@/lib/workflow/statusPolicy';
import { JOB_WORKFLOW_STATUS_PALETTE, STATUS_NEUTRAL_COLOR } from '@/lib/ui/statusPalette';

export const STATUS_PRESENTATION_MAP = Object.freeze({
  [JOB_STATUS.WAITING_SCHEDULE]: {
    ...JOB_WORKFLOW_STATUS_PALETTE.waiting_schedule,
  },
  [JOB_STATUS.WAITING_EXECUTION]: {
    ...JOB_WORKFLOW_STATUS_PALETTE.waiting_execution,
  },
  [JOB_STATUS.DONE]: {
    ...JOB_WORKFLOW_STATUS_PALETTE.done,
  },
});

export function getStatusPresentation(status) {
  return STATUS_PRESENTATION_MAP[status] || {
    label: status || 'לא ידוע',
    shortLabel: status || 'לא ידוע',
    color: STATUS_NEUTRAL_COLOR,
  };
}
