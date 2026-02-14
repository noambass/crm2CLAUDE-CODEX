import { JOB_STATUS } from '@/lib/workflow/statusPolicy';

export function getNextAction(status) {
  if (status === JOB_STATUS.QUOTE) {
    return {
      key: 'promote_to_job',
      label: 'המר להצעה לעבודה',
      tone: 'neutral',
    };
  }

  if (status === JOB_STATUS.WAITING_SCHEDULE) {
    return {
      key: 'schedule',
      label: 'תזמן עבודה',
      tone: 'warning',
    };
  }

  if (status === JOB_STATUS.WAITING_EXECUTION) {
    return {
      key: 'open_job',
      label: 'פתח לביצוע',
      tone: 'info',
    };
  }

  return null;
}
