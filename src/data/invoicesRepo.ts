import { supabase } from '@/api/supabaseClient';

export async function listInvoicesByJob(jobId: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getLatestInvoiceForJob(jobId: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createInvoiceRecord(input: {
  jobId: string;
  accountId: string;
  docType: number;
  total: number;
  vatAmount: number;
  grandTotal: number;
}) {
  const { data, error } = await supabase
    .from('invoices')
    .insert([
      {
        job_id: input.jobId,
        account_id: input.accountId,
        doc_type: input.docType,
        status: 'pending',
        total: input.total,
        vat_amount: input.vatAmount,
        grand_total: input.grandTotal,
        currency: 'ILS',
      },
    ])
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateInvoiceWithGreenInvoiceData(
  invoiceId: string,
  giData: {
    docId?: string;
    docNumber?: string;
    docUrl?: string;
    status: string;
    errorMessage?: string;
  }
) {
  const patch: Record<string, unknown> = { status: giData.status };
  if (giData.docId) patch.greeninvoice_doc_id = giData.docId;
  if (giData.docNumber) patch.greeninvoice_doc_number = giData.docNumber;
  if (giData.docUrl) patch.greeninvoice_doc_url = giData.docUrl;
  if (giData.errorMessage) patch.error_message = giData.errorMessage;

  const { data, error } = await supabase
    .from('invoices')
    .update(patch)
    .eq('id', invoiceId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
