-- Add 'role' column to contacts table.
-- Stores free-text role/position description for a contact (e.g. 'מנהל החזקה', 'שירות לקוחות').

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS role text;

NOTIFY pgrst, 'reload schema';
