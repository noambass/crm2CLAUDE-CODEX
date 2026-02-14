export interface ScheduledBlock {
  jobId: string;
  title: string;
  status: string;
  startAt: string;
  estimatedDurationMinutes: number;
  assignedTo?: string | null;
}

export interface ScheduleConflict {
  type: 'overlap';
  jobId: string;
  conflictingWithJobId: string;
  message: string;
}
