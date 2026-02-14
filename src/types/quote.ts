export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected';

export interface QuoteItem {
  id: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  account_id: string;
  status: QuoteStatus;
  title: string | null;
  description: string | null;
  notes: string | null;
  address_text: string | null;
  arrival_notes: string | null;
  lat: number | null;
  lng: number | null;
  scheduled_start_at: string | null;
  total: number;
  converted_job_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteWithItems extends Quote {
  items: QuoteItem[];
}
