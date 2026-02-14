export const JOB_STATUS = Object.freeze({
  QUOTE: 'quote',
  WAITING_SCHEDULE: 'waiting_schedule',
  WAITING_EXECUTION: 'waiting_execution',
  DONE: 'done',
} as const);

export const QUOTE_STATUS = Object.freeze({
  DRAFT: 'draft',
  SENT: 'sent',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const);

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];
export type QuoteStatus = (typeof QUOTE_STATUS)[keyof typeof QUOTE_STATUS];

export const JOB_ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]> = Object.freeze({
  [JOB_STATUS.QUOTE]: [JOB_STATUS.WAITING_SCHEDULE],
  [JOB_STATUS.WAITING_SCHEDULE]: [JOB_STATUS.WAITING_EXECUTION, JOB_STATUS.QUOTE],
  [JOB_STATUS.WAITING_EXECUTION]: [JOB_STATUS.DONE, JOB_STATUS.WAITING_SCHEDULE],
  [JOB_STATUS.DONE]: [JOB_STATUS.DONE],
});

export const QUOTE_ALLOWED_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = Object.freeze({
  [QUOTE_STATUS.DRAFT]: [QUOTE_STATUS.SENT, QUOTE_STATUS.APPROVED, QUOTE_STATUS.REJECTED],
  [QUOTE_STATUS.SENT]: [QUOTE_STATUS.APPROVED, QUOTE_STATUS.REJECTED, QUOTE_STATUS.DRAFT],
  [QUOTE_STATUS.APPROVED]: [QUOTE_STATUS.APPROVED],
  [QUOTE_STATUS.REJECTED]: [QUOTE_STATUS.REJECTED, QUOTE_STATUS.DRAFT],
});

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && Object.values(JOB_STATUS).includes(value as JobStatus);
}

export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return typeof value === 'string' && Object.values(QUOTE_STATUS).includes(value as QuoteStatus);
}

export function canTransitionJobStatus(fromStatus: unknown, toStatus: unknown): boolean {
  if (!isJobStatus(fromStatus) || !isJobStatus(toStatus)) return false;
  return JOB_ALLOWED_TRANSITIONS[fromStatus].includes(toStatus);
}

export function canTransitionQuoteStatus(fromStatus: unknown, toStatus: unknown): boolean {
  if (!isQuoteStatus(fromStatus) || !isQuoteStatus(toStatus)) return false;
  return QUOTE_ALLOWED_TRANSITIONS[fromStatus].includes(toStatus);
}

export function getStatusForScheduling(currentStatus: unknown): JobStatus {
  if (currentStatus === JOB_STATUS.DONE) return JOB_STATUS.DONE;
  if (currentStatus === JOB_STATUS.QUOTE) return JOB_STATUS.WAITING_SCHEDULE;
  if (currentStatus === JOB_STATUS.WAITING_SCHEDULE) return JOB_STATUS.WAITING_EXECUTION;
  if (currentStatus === JOB_STATUS.WAITING_EXECUTION) return JOB_STATUS.WAITING_EXECUTION;
  return JOB_STATUS.WAITING_SCHEDULE;
}

