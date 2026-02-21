import React, { useEffect, useState } from 'react';
import { Loader2, FileText, AlertCircle, CheckCircle2, Send } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import {
  getToken,
  createDocument,
  DOC_TYPES,
  DOC_TYPE_LABELS,
} from '@/lib/greeninvoice/client';
import { createInvoiceRecord, updateInvoiceWithGreenInvoiceData } from '@/data/invoicesRepo';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

function formatMoney(value) {
  return Number(value || 0).toLocaleString('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const AVAILABLE_DOC_TYPES = [
  { value: DOC_TYPES.TAX_INVOICE, label: DOC_TYPE_LABELS[DOC_TYPES.TAX_INVOICE] },
  { value: DOC_TYPES.TAX_INVOICE_RECEIPT, label: DOC_TYPE_LABELS[DOC_TYPES.TAX_INVOICE_RECEIPT] },
  { value: DOC_TYPES.RECEIPT, label: DOC_TYPE_LABELS[DOC_TYPES.RECEIPT] },
  { value: DOC_TYPES.PRICE_QUOTE, label: DOC_TYPE_LABELS[DOC_TYPES.PRICE_QUOTE] },
  { value: DOC_TYPES.TRANSACTION_INVOICE, label: DOC_TYPE_LABELS[DOC_TYPES.TRANSACTION_INVOICE] },
];

export default function GenerateInvoiceDialog({ open, onOpenChange, job, accountName, onInvoiceCreated }) {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(null); // null = loading, true/false
  const [clientContact, setClientContact] = useState(null);
  const [selectedDocType, setSelectedDocType] = useState(DOC_TYPES.TAX_INVOICE);
  const [createAsDraft, setCreateAsDraft] = useState(true);

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
    // Reset state when dialog opens
    setSelectedDocType(DOC_TYPES.TAX_INVOICE);
    setCreateAsDraft(true);
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

    if (lineItems.length === 0) {
      toast.error('לא ניתן להפיק מסמך ללא שורות שירות', {
        description: 'יש להוסיף לפחות שורת שירות אחת לפני הפקת מסמך.',
      });
      return;
    }

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
        docType: selectedDocType,
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

      // 4. Create document on GreenInvoice
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
        giDoc = await createDocument(token, {
          docType: selectedDocType,
          draft: createAsDraft,
          client: {
            name: clientName,
            emails: clientEmails,
            phone: clientPhone,
            add: true,
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
        throw new Error(`שגיאה ביצירת מסמך בחשבונית ירוקה: ${err.message}`);
      }

      // 5. Update local invoice record with GreenInvoice data
      const docUrl = giDoc.url
        || (giDoc.id ? `https://app.greeninvoice.co.il/documents/${giDoc.id}` : '');

      const localStatus = createAsDraft ? 'draft' : 'open';

      await updateInvoiceWithGreenInvoiceData(invoiceRecord.id, {
        docId: giDoc.id || '',
        docNumber: giDoc.number || giDoc.documentNumber || '',
        docUrl,
        status: localStatus,
      });

      const docTypeLabel = DOC_TYPE_LABELS[selectedDocType] || 'מסמך';
      const statusLabel = createAsDraft ? 'כטיוטה' : 'כמסמך סופי';

      toast.success(`${docTypeLabel} נוצר/ה ${statusLabel} בהצלחה`, {
        description: giDoc.number
          ? `מספר מסמך: ${giDoc.number}`
          : `המסמך נוצר ${statusLabel} בחשבונית ירוקה.`,
      });

      if (docUrl) {
        window.open(docUrl, '_blank', 'noopener,noreferrer');
      }

      onInvoiceCreated?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Invoice generation error:', err);
      toast.error(err.message || 'שגיאה בהפקת מסמך');
    } finally {
      setGenerating(false);
    }
  }

  const docTypeLabel = DOC_TYPE_LABELS[selectedDocType] || 'מסמך';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            הפקת מסמך – חשבונית ירוקה
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {apiConfigured === false && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">חשבונית ירוקה לא מוגדרת</p>
                <p className="mt-1 text-xs">
                  יש להגדיר מפתח API וסוד בהגדרות → אינטגרציות לפני הפקת מסמך.
                </p>
              </div>
            </div>
          )}

          {lineItems.length === 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">אין שורות שירות</p>
                <p className="mt-1 text-xs">
                  יש להוסיף לפחות שורת שירות אחת לעבודה לפני הפקת מסמך.
                </p>
              </div>
            </div>
          )}

          {/* Document Type Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">סוג מסמך</Label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_DOC_TYPES.map((dt) => (
                <button
                  key={dt.value}
                  type="button"
                  onClick={() => setSelectedDocType(dt.value)}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                    selectedDocType === dt.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500 dark:border-emerald-400 dark:bg-emerald-950/30 dark:text-emerald-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {dt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Draft / Final Toggle */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">סטטוס יצירה</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreateAsDraft(true)}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                  createAsDraft
                    ? 'border-amber-500 bg-amber-50 text-amber-700 ring-1 ring-amber-500 dark:border-amber-400 dark:bg-amber-950/30 dark:text-amber-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                <FileText className="h-4 w-4" />
                טיוטה
              </button>
              <button
                type="button"
                onClick={() => setCreateAsDraft(false)}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                  !createAsDraft
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500 dark:border-emerald-400 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                <Send className="h-4 w-4" />
                סופי (הנפקה)
              </button>
            </div>
            {!createAsDraft && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                מסמך סופי יקבל מספר רשמי ולא ניתן יהיה לערוך או למחוק אותו.
              </p>
            )}
          </div>

          {/* Document Details */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/70">
            <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">פרטי מסמך</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">סוג מסמך</span>
                <span className="font-medium">{docTypeLabel} ({selectedDocType})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">סטטוס</span>
                <span className={`font-medium ${createAsDraft ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {createAsDraft ? 'טיוטה' : 'סופי'}
                </span>
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

          {/* Line Items Preview */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/70">
            <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              שורות שירות ({lineItems.length})
            </p>
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
                        {item.description || 'שירות'} x {qty}
                      </span>
                      <span className="font-medium" dir="ltr">₪{formatMoney(qty * price)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/90 to-primary p-4 text-white">
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

          {/* Info banner */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            {createAsDraft ? (
              <>
                <p>המסמך ייווצר כ<strong>טיוטה</strong> בחשבונית ירוקה ולא יישלח ללקוח.</p>
                <p className="mt-1">ניתן לסגור ולשלוח את המסמך מאוחר יותר מדף העבודה.</p>
              </>
            ) : (
              <>
                <p>המסמך ייווצר כ<strong>מסמך סופי</strong> ויקבל מספר רשמי.</p>
                <p className="mt-1">לא ניתן יהיה לערוך או למחוק את המסמך לאחר יצירתו.</p>
              </>
            )}
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
            className={createAsDraft
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }
          >
            {generating ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                מפיק מסמך...
              </>
            ) : createAsDraft ? (
              <>
                <FileText className="ml-2 h-4 w-4" />
                צור טיוטה
              </>
            ) : (
              <>
                <CheckCircle2 className="ml-2 h-4 w-4" />
                הפק {docTypeLabel}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
