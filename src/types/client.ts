export interface Contact {
  id: string;
  account_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address_text: string | null;
  notes: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  account_name: string;
  client_type: 'private' | 'company' | 'bath_company';
  status: 'lead' | 'active' | 'inactive';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientProfile {
  account: Account;
  primaryContact: Contact | null;
  contacts: Contact[];
}
