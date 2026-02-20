import { JOB_STATUS } from '@/lib/workflow/statusPolicy';

export function getNextAction(status) {
  if (status === JOB_STATUS.WAITING_SCHEDULE) {
    return {
      key: 'schedule',
      label: 'תזמן עבודה',
      tone: 'warning',
    };
  }

  if (status === JOB_STATUS.WAITING_EXECUTION) {
    return {
      key: 'mark_done',
      label: 'סמן כבוצע',
      tone: 'info',
    };
  }

  return null;
}
