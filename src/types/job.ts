export type JobStatus = 'quote' | 'waiting_schedule' | 'waiting_execution' | 'done';
export type JobPriority = 'normal' | 'urgent';

export interface JobLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
}

export interface Job {
  id: string;
  account_id: string;
  quote_id: string | null;
  title: string;
  description: string | null;
  status: JobStatus;
  priority: JobPriority;
  address_text: string | null;
  arrival_notes: string | null;
  lat: number | null;
  lng: number | null;
  scheduled_start_at: string | null;
  estimated_duration_minutes: number;
  line_items: JobLineItem[];
  created_at: string;
  updated_at: string;
}
