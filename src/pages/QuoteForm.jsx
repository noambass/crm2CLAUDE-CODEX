import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, Loader2, Plus, Save, Search, Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { toast } from 'sonner';
import { getDetailedErrorReason } from '@/lib/errorMessages';
import { getQuote, saveDraftQuote } from '@/data/quotesRepo';

const EMPTY_LINE_ITEM = () => ({
  id: crypto.randomUUID(),
  description: '',
  quantity: 1,
  unit_price: 0,
});

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function QuoteForm() {
  const navigate = useNavigate();
  const { id: routeQuoteId } = useParams();
  const queryClient = useQueryClient();
  const { user, isLoadingAuth } = useAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const quoteId = routeQuoteId || urlParams.get('id');
  const preselectedAccountId = urlParams.get('account_id') || urlParams.get('client_id') || '';
  const isEditing = Boolean(quoteId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    account_id: preselectedAccountId,
    account_name: '',
    notes: '',
  });
  const [lineItems, setLineItems] = useState([EMPTY_LINE_ITEM()]);

  useEffect(() => {
    if (!user) return;
    void loadData();
  }, [user, quoteId]);

  async function loadData() {
    if (!user) return;
    setLoading(true);

    try {
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('id, account_name')
        .order('created_at', { ascending: false });
      if (accountsError) throw accountsError;

      const allAccounts = accountsData || [];
      setAccounts(allAccounts);

      if (isEditing && quoteId) {
        const quoteData = await getQuote(quoteId);

        if (quoteData.status !== 'draft') {
          toast.error('ניתן לערוך רק הצעות במצב טיוטה');
          navigate(createPageUrl(`QuoteDetails?id=${quoteId}`));
          return;
        }

        if (quoteData.converted_job_id) {
          toast.error('לא ניתן לערוך הצעה שהומרה לעבודה');
          navigate(createPageUrl(`QuoteDetails?id=${quoteId}`));
          return;
        }

        const relatedAccount = Array.isArray(quoteData.accounts)
          ? quoteData.accounts[0]
          : quoteData.accounts;
        const accountName = relatedAccount?.account_name
          || allAccounts.find((account) => account.id === quoteData.account_id)?.account_name
          || '';

        setFormData({
          account_id: quoteData.account_id || '',
          account_name: accountName,
          notes: quoteData.notes || '',
        });

        const items = Array.isArray(quoteData.quote_items) && quoteData.quote_items.length > 0
          ? quoteData.quote_items.map((item) => ({
            id: item.id || crypto.randomUUID(),
            description: item.description || '',
            quantity: asNumber(item.quantity) || 1,
            unit_price: asNumber(item.unit_price),
          }))
          : [EMPTY_LINE_ITEM()];

        setLineItems(items);
        return;
      }

      if (preselectedAccountId) {
        const preselected = allAccounts.find((account) => account.id === preselectedAccountId);
        if (preselected) {
          setFormData((prev) => ({
            ...prev,
            account_id: preselected.id,
            account_name: preselected.account_name || '',
          }));
        }
      }
    } catch (error) {
      console.error('Error loading quote form data:', error);
      toast.error('שגיאה בטעינת נתונים', {
        description: getDetailedErrorReason(error, 'טעינת נתוני הצעת המחיר נכשלה.'),
        duration: 7000,
      });
    } finally {
      setLoading(false);
    }
  }

  function handleAccountSelect(account) {
    setFormData((prev) => ({
      ...prev,
      account_id: account.id,
      account_name: account.account_name || '',
    }));
    setErrors((prev) => ({ ...prev, account_id: null }));
    setAccountPopoverOpen(false);
  }

  function updateLineItem(id, field, value) {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, EMPTY_LINE_ITEM()]);
  }

  function removeLineItem(id) {
    if (lineItems.length <= 1) {
      toast.error('חובה להוסיף לפחות שורה אחת להצעה');
      return;
    }
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function getLineTotal(item) {
    return asNumber(item.quantity) * asNumber(item.unit_price);
  }

  const subtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + getLineTotal(item), 0),
    [lineItems],
  );
  const vatAmount = subtotal * 0.18;
  const totalWithVat = subtotal + vatAmount;

  function validate() {
    const nextErrors = {};

    if (!formData.account_id) {
      nextErrors.account_id = 'חובה לבחור לקוח';
    }

    const lineErrors = [];
    let hasLineError = false;

    lineItems.forEach((item, index) => {
      const itemErrors = {};

      if (!item.description.trim()) {
        itemErrors.description = 'תיאור הוא שדה חובה';
        hasLineError = true;
      }

      if (asNumber(item.quantity) <= 0) {
        itemErrors.quantity = 'כמות חייבת להיות גדולה מ-0';
        hasLineError = true;
      }

      if (asNumber(item.unit_price) < 0) {
        itemErrors.unit_price = 'מחיר לא יכול להיות שלילי';
        hasLineError = true;
      }

      lineErrors[index] = itemErrors;
    });

    if (hasLineError) {
      nextErrors.lineItems = lineErrors;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const quoteSavedId = await saveDraftQuote({
        quoteId: isEditing ? quoteId : undefined,
        accountId: formData.account_id,
        notes: formData.notes,
        items: lineItems.map((item) => ({
          description: item.description.trim(),
          quantity: asNumber(item.quantity),
          unitPrice: asNumber(item.unit_price),
        })),
      });

      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('הצעת המחיר נשמרה בהצלחה');
      navigate(createPageUrl(`QuoteDetails?id=${quoteSavedId}`));
    } catch (error) {
      console.error('Error saving quote:', error);
      toast.error('שגיאה בשמירת הצעת המחיר', {
        description: getDetailedErrorReason(error, 'שמירת הצעת המחיר נכשלה.'),
        duration: 9000,
      });
    } finally {
      setSaving(false);
    }
  }

  if (isLoadingAuth) return <LoadingSpinner />;
  if (!user) return null;
  if (loading) return <LoadingSpinner />;

  return (
    <div dir="rtl" className="mx-auto max-w-3xl p-4 lg:p-8">
      <div className="mb-8 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="rounded-full"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isEditing ? 'עריכת טיוטת הצעה' : 'הצעת מחיר חדשה'}
          </h1>
          <p className="mt-1 text-slate-500">
            {isEditing ? 'עדכן את פרטי ההצעה' : 'צור הצעת מחיר חדשה'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">לקוח *</CardTitle>
          </CardHeader>
          <CardContent>
            <Popover open={accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  data-testid="quote-account-trigger"
                  variant="outline"
                  role="combobox"
                  className={`h-auto w-full justify-between py-3 ${errors.account_id ? 'border-red-500' : ''}`}
                >
                  {formData.account_name ? (
                    <div className="text-right">
                      <p className="font-medium">{formData.account_name}</p>
                    </div>
                  ) : (
                    <span className="text-slate-500">בחר לקוח...</span>
                  )}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command dir="rtl">
                  <CommandInput placeholder="חפש לקוח..." />
                  <CommandList>
                    <CommandEmpty>לא נמצאו לקוחות</CommandEmpty>
                    <CommandGroup>
                      {accounts.map((account) => (
                        <CommandItem
                          key={account.id}
                          onSelect={() => handleAccountSelect(account)}
                          className="cursor-pointer"
                        >
                          <p className="font-medium">{account.account_name}</p>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {errors.account_id ? (
              <p className="mt-1 text-sm text-red-600">{errors.account_id}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">הערות להצעה</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              data-testid="quote-notes"
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="הערות כלליות להצעת המחיר..."
              rows={3}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">שורות שירות</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="ml-1 h-4 w-4" />
              הוסף שורה
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {lineItems.map((item, index) => {
              const lineErrors = errors.lineItems?.[index] || {};
              return (
                <div key={item.id} className="relative space-y-3 rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">שורה {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => removeLineItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>תיאור *</Label>
                    <Input
                      data-testid={`quote-line-description-${index}`}
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      placeholder="תיאור השירות"
                      className={lineErrors.description ? 'border-red-500' : ''}
                    />
                    {lineErrors.description ? (
                      <p className="text-xs text-red-600">{lineErrors.description}</p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>כמות</Label>
                      <Input
                        data-testid={`quote-line-quantity-${index}`}
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                        className={lineErrors.quantity ? 'border-red-500' : ''}
                        dir="ltr"
                      />
                      {lineErrors.quantity ? (
                        <p className="text-xs text-red-600">{lineErrors.quantity}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label>מחיר יחידה</Label>
                      <Input
                        data-testid={`quote-line-unit-price-${index}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateLineItem(item.id, 'unit_price', e.target.value)}
                        className={lineErrors.unit_price ? 'border-red-500' : ''}
                        dir="ltr"
                      />
                      {lineErrors.unit_price ? (
                        <p className="text-xs text-red-600">{lineErrors.unit_price}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label>סה"כ שורה</Label>
                      <div className="flex h-10 items-center rounded-md border bg-white px-3 font-medium text-slate-700" dir="ltr">
                        ₪{getLineTotal(item).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="space-y-3 rounded-xl bg-slate-800 p-4 text-white">
              <div className="flex items-center justify-between">
                <span className="text-sm">סכום לפני מע"מ:</span>
                <span data-testid="quote-total" className="font-medium" dir="ltr">
                  ₪{subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">מע"מ (18%):</span>
                <span className="font-medium" dir="ltr">
                  ₪{vatAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/20 pt-3">
                <span className="text-lg font-bold">סה"כ הצעה:</span>
                <span className="text-2xl font-bold" dir="ltr">
                  ₪{totalWithVat.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pt-4">
          <Button
            data-testid="quote-save-button"
            type="submit"
            disabled={saving}
            style={{ backgroundColor: '#00214d' }}
            className="flex-1 hover:opacity-90"
          >
            {saving ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                שומר...
              </>
            ) : (
              <>
                <Save className="ml-2 h-4 w-4" />
                {isEditing ? 'שמור שינויים' : 'שמור טיוטה'}
              </>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            ביטול
          </Button>
        </div>
      </form>
    </div>
  );
}
