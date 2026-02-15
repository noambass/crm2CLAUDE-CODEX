import React, { useEffect, useState } from 'react';
import { Loader2, FileText, ExternalLink, AlertCircle } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { getToken, createDraftTaxInvoice, DOC_TYPES } from '@/lib/greeninvoice/client';
import { createInvoiceRecord, updateInvoiceWithGreenInvoiceData } from '@/data/invoicesRepo';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function formatMoney(value) {
  return Number(value || 0).toLocaleString('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function GenerateInvoiceDialog({ open, onOpenChange, job, accountName, onInvoiceCreated }) {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(null); // null = loading, true/false
  const [clientContact, setClientContact] = useState(null);

  const lineItems = Array.isArray(job?.line_items) ? job.line_items : [];
  const subtotal = lineItems.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
  }, 0);
  const vatAmount = subtotal * 0.18;
  const grandTotal = subtotal + vatAmount;

  useEffect(() => {
    if (!open || !user) return;
    checkApiConfig();
    loadClientContact();
  }, [open, user?.id]);

  async function checkApiConfig() {
    try {
      const { data } = await supabase
        .from('app_configs')
        .select('config_data')
        .eq('owner_id', user.id)
        .eq('config_type', 'greeninvoice_api')
        .limit(1)
        .maybeSingle();

      const hasConfig = Boolean(data?.config_data?.api_key && data?.config_data?.api_secret);
      setApiConfigured(hasConfig);
    } catch {
      setApiConfigured(false);
    }
  }

  async function loadClientContact() {
    if (!job?.account_id) return;
    try {
      const { data } = await supabase
        .from('contacts')
        .select('full_name, phone, email')
        .eq('account_id', job.account_id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      setClientContact(data || null);
    } catch {
      setClientContact(null);
    }
  }

  async function handleGenerate() {
    if (!user || !job) return;
    setGenerating(true);

    try {
      // 1. Get API credentials
      const { data: configData } = await supabase
        .from('app_configs')
        .select('config_data')
        .eq('owner_id', user.id)
        .eq('config_type', 'greeninvoice_api')
        .limit(1)
        .maybeSingle();

      const apiKey = configData?.config_data?.api_key;
      const apiSecret = configData?.config_data?.api_secret;

      if (!apiKey || !apiSecret) {
        toast.error('לא הוגדרו פרטי חיבור לחשבונית ירוקה', {
          description: 'יש להגדיר מפתח API וסוד בהגדרות → אינטגרציות.',
        });
        return;
      }

      // 2. Create local invoice record (status: pending)
      const invoiceRecord = await createInvoiceRecord({
        jobId: job.id,
        accountId: job.account_id,
        docType: DOC_TYPES.TAX_INVOICE,
        total: subtotal,
        vatAmount,
        grandTotal,
      });

      // 3. Get GreenInvoice auth token
      let token;
      try {
        token = await getToken(apiKey, apiSecret);
      } catch (err) {
        await updateInvoiceWithGreenInvoiceData(invoiceRecord.id, {
          status: 'error',
          errorMessage: `Auth failed: ${err.message}`,
        });
        throw new Error('שגיאה בהתחברות לחשבונית ירוקה. בדוק את מפתח ה-API והסוד.');
      }

      // 4. Create draft tax invoice on GreenInvoice
      const clientName = accountName || clientContact?.full_name || 'לקוח';
      const clientEmails = clientContact?.email ? [clientContact.email] : [];
      const clientPhone = clientContact?.phone || '';

      const incomeItems = lineItems.map((item) => ({
        description: item.description || 'שירות',
        quantity: Number(item.quantity) || 1,
        price: Number(item.unit_price) || 0,
        currency: 'ILS',
        vatType: 0,
      }));

      let giDoc;
      try {
        giDoc = await createDraftTaxInvoice(token, {
          client: {
            name: clientName,
            emails: clientEmails,
            phone: clientPhone,
            add: true, // auto-sync client to GreenInvoice
          },
          income: incomeItems,
          description: `עבודה: ${job.title || ''}`.trim(),
          currency: 'ILS',
          lang: 'he',
        });
      } catch (err) {
        await updateInvoiceWithGreenInvoiceData(invoiceRecord.id, {
          status: 'error',
          errorMessage: `Create doc failed: ${err.message}`,
        });
        throw new Error('שגיאה ביצירת חשבונית בחשבונית ירוקה. נסה שוב.');
      }

      // 5. Update local invoice record with GreenInvoice data
      const docUrl = giDoc.url
        || (giDoc.id ? `https://app.greeninvoice.co.il/documents/${giDoc.id}` : '');

      await updateInvoiceWithGreenInvoiceData(invoiceRecord.id, {
        docId: giDoc.id || '',
        docNumber: giDoc.number || giDoc.documentNumber || '',
        docUrl,
        status: 'draft',
      });

      toast.success('חשבונית מס טיוטה נוצרה בהצלחה', {
        description: giDoc.number ? `מספר מסמך: ${giDoc.number}` : 'המסמך נוצר כטיוטה בחשבונית ירוקה.',
      });

      if (docUrl) {
        window.open(docUrl, '_blank', 'noopener,noreferrer');
      }

      onInvoiceCreated?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Invoice generation error:', err);
      toast.error(err.message || 'שגיאה בהפקת חשבונית');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            הפקת חשבונית מס (טיוטה)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {apiConfigured === false && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">חשבונית ירוקה לא מוגדרת</p>
                <p className="mt-1 text-xs">
                  יש להגדיר מפתח API וסוד בהגדרות → אינטגרציות לפני הפקת חשבונית.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/70">
            <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">פרטי מסמך</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">סוג מסמך</span>
                <span className="font-medium">חשבונית מס (305)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">סטטוס</span>
                <span className="font-medium text-amber-600">טיוטה</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">לקוח</span>
                <span className="font-medium">{accountName || 'ללא לקוח'}</span>
              </div>
              {clientContact?.email && (
                <div className="flex justify-between">
                  <span className="text-slate-500">אימייל</span>
                  <span className="font-medium" dir="ltr">{clientContact.email}</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/70">
            <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">שורות שירות</p>
            {lineItems.length === 0 ? (
              <p className="text-sm text-slate-400">אין שורות שירות</p>
            ) : (
              <div className="space-y-1 text-sm">
                {lineItems.map((item, idx) => {
                  const qty = Number(item.quantity) || 0;
                  const price = Number(item.unit_price) || 0;
                  return (
                    <div key={item.id || idx} className="flex justify-between">
                      <span className="truncate text-slate-600 dark:text-slate-300">
                        {item.description || 'שירות'} × {qty}
                      </span>
                      <span className="font-medium" dir="ltr">₪{formatMoney(qty * price)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#00214d]/20 bg-gradient-to-br from-[#001335] to-[#00214d] p-4 text-white">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-blue-100">לפני מע"מ</p>
                <p className="mt-1 text-sm font-semibold" dir="ltr">₪{formatMoney(subtotal)}</p>
              </div>
              <div>
                <p className="text-xs text-blue-100">מע"מ (18%)</p>
                <p className="mt-1 text-sm font-semibold" dir="ltr">₪{formatMoney(vatAmount)}</p>
              </div>
              <div className="rounded-lg bg-white/15 px-2 py-1">
                <p className="text-xs text-blue-100">סה"כ</p>
                <p className="mt-1 text-base font-bold" dir="ltr">₪{formatMoney(grandTotal)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <p>המסמך ייווצר כ<strong>טיוטה</strong> בחשבונית ירוקה ולא יישלח ללקוח.</p>
            <p className="mt-1">הלקוח יסונכרן אוטומטית לחשבונית ירוקה.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            ביטול
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generating || apiConfigured === false || lineItems.length === 0}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {generating ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                מפיק חשבונית...
              </>
            ) : (
              <>
                <FileText className="ml-2 h-4 w-4" />
                הפק חשבונית מס טיוטה
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
