import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Save, Search, Plus, Trash2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import CreateNewClientDialog from '@/components/job/CreateNewClientDialog';
import { toast } from 'sonner';
import { getDetailedErrorReason } from '@/lib/errorMessages';

const JOB_STATUS_OPTIONS = [
  { value: 'quote', label: 'הצעת מחיר' },
  { value: 'waiting_schedule', label: 'ממתין לתזמון' },
  { value: 'waiting_execution', label: 'ממתין לביצוע' },
  { value: 'done', label: 'בוצע' },
];

const EMPTY_LINE = () => ({
  id: crypto.randomUUID(),
  description: 'שירות',
  quantity: 1,
  unit_price: 0,
});

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function JobForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoadingAuth } = useAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('id');
  const preselectedAccountId = urlParams.get('account_id') || urlParams.get('client_id') || '';
  const isEditing = Boolean(jobId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false);
  const [createClientDialogOpen, setCreateClientDialogOpen] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    account_id: preselectedAccountId,
    account_name: '',
    title: '',
    description: '',
    status: 'waiting_schedule',
    priority: 'normal',
    assigned_to: 'owner',
    address_text: '',
    arrival_notes: '',
    scheduled_date: '',
    scheduled_time: '',
    warranty_mode: 'with_warranty',
    warranty_explanation: '',
    contact_full_name: '',
    contact_phone: '',
  });

  const [lineItems, setLineItems] = useState([EMPTY_LINE()]);

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    async function loadData() {
      try {
        const [accountsRes, jobRes] = await Promise.all([
          supabase.from('accounts').select('id, account_name').order('created_at', { ascending: false }),
          isEditing
            ? supabase.from('jobs').select('*').eq('id', jobId).single()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (accountsRes.error) throw accountsRes.error;
        if (jobRes.error) throw jobRes.error;

        const accountRows = accountsRes.data || [];
        if (!mounted) return;
        setAccounts(accountRows);

        if (isEditing && jobRes.data) {
          const job = jobRes.data;
          const lineItemsFromDb = Array.isArray(job.line_items) && job.line_items.length > 0
            ? job.line_items.map((item) => ({
                id: item.id || crypto.randomUUID(),
                description: item.description || 'שירות',
                quantity: toNumber(item.quantity) || 1,
                unit_price: toNumber(item.unit_price),
              }))
            : [EMPTY_LINE()];

          const selectedAccount = accountRows.find((acc) => acc.id === job.account_id);
          const scheduledDate = job.scheduled_start_at ? new Date(job.scheduled_start_at) : null;

          setLineItems(lineItemsFromDb);
          setFormData((prev) => ({
            ...prev,
            account_id: job.account_id || '',
            account_name: selectedAccount?.account_name || '',
            title: job.title || '',
            description: job.description || '',
            status: job.status || 'waiting_schedule',
            priority: job.priority || 'normal',
            assigned_to: job.assigned_to || 'owner',
            address_text: job.address_text || '',
            arrival_notes: job.arrival_notes || '',
            scheduled_date: scheduledDate ? scheduledDate.toISOString().slice(0, 10) : '',
            scheduled_time: scheduledDate ? scheduledDate.toISOString().slice(11, 16) : '',
          }));

          const { data: contactsData, error: contactsError } = await supabase
            .from('job_contacts')
            .select('full_name, phone')
            .eq('job_id', job.id)
            .order('sort_order', { ascending: true })
            .limit(1);
          if (contactsError) throw contactsError;

          if (contactsData?.[0]) {
            setFormData((prev) => ({
              ...prev,
              contact_full_name: contactsData[0].full_name || '',
              contact_phone: contactsData[0].phone || '',
            }));
          }
        } else if (preselectedAccountId) {
          const selected = accountRows.find((acc) => acc.id === preselectedAccountId);
          if (selected) {
            setFormData((prev) => ({ ...prev, account_name: selected.account_name }));
          }
        }
      } catch (error) {
        console.error('Error loading JobForm data:', error);
        toast.error('שגיאה בטעינת נתונים', {
          description: getDetailedErrorReason(error, 'טעינת נתוני העבודה נכשלה.'),
          duration: 9000,
        });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [user, isEditing, jobId, preselectedAccountId]);

  const subtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unit_price), 0),
    [lineItems],
  );

  function handleAccountSelect(account) {
    setFormData((prev) => ({
      ...prev,
      account_id: account.id,
      account_name: account.account_name,
    }));
    setErrors((prev) => ({ ...prev, account_id: null }));
    setAccountPopoverOpen(false);
  }

  function handleClientCreated(newAccount) {
    setAccounts((prev) => [newAccount, ...prev]);
    setFormData((prev) => ({
      ...prev,
      account_id: newAccount.id,
      account_name: newAccount.account_name,
      contact_full_name: newAccount.primary_contact?.full_name || prev.contact_full_name,
      contact_phone: newAccount.primary_contact?.phone || prev.contact_phone,
    }));
    setErrors((prev) => ({ ...prev, account_id: null }));
  }

  function updateLineItem(id, field, value) {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, EMPTY_LINE()]);
  }

  function removeLineItem(id) {
    if (lineItems.length <= 1) {
      toast.error('חובה לפחות שורת שירות אחת');
      return;
    }
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function validate() {
    const next = {};

    if (!formData.account_id) next.account_id = 'יש לבחור לקוח';
    if (!formData.title.trim()) next.title = 'כותרת עבודה היא שדה חובה';

    if (formData.warranty_mode === 'no_warranty' && !formData.warranty_explanation.trim()) {
      next.warranty_explanation = 'חובה להזין הסבר ללא אחריות';
    }

    const validLines = lineItems.filter((line) => line.description.trim() && toNumber(line.quantity) > 0 && toNumber(line.unit_price) >= 0);
    if (validLines.length === 0) next.line_items = 'חובה לפחות שורת שירות אחת תקינה';

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!user) return;
    if (!validate()) {
      if (formData.warranty_mode === 'no_warranty' && !formData.warranty_explanation.trim()) {
        toast.error('חובה להזין הסבר ללא אחריות');
      }
      return;
    }

    setSaving(true);

    try {
      const baseLines = lineItems
        .filter((line) => line.description.trim())
        .map((line) => {
          const quantity = Math.max(1, toNumber(line.quantity));
          const unitPrice = Math.max(0, toNumber(line.unit_price));
          return {
            id: line.id,
            description: line.description.trim(),
            quantity,
            unit_price: unitPrice,
            line_total: quantity * unitPrice,
          };
        });

      let finalLines = baseLines;
      const agreedAmount = toNumber(formData.agreed_amount);
      if (agreedAmount > 0) {
        finalLines = [{
          id: baseLines[0]?.id || crypto.randomUUID(),
          description: baseLines[0]?.description || formData.title.trim() || 'שירות',
          quantity: 1,
          unit_price: agreedAmount,
          line_total: agreedAmount,
        }];
      }

      const scheduledStartAt =
        formData.scheduled_date && formData.scheduled_time
          ? new Date(`${formData.scheduled_date}T${formData.scheduled_time}`).toISOString()
          : null;

      const status = scheduledStartAt && ['quote', 'waiting_schedule'].includes(formData.status)
        ? 'waiting_execution'
        : formData.status;

      const payload = {
        account_id: formData.account_id,
        assigned_to: formData.assigned_to || 'owner',
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        status,
        priority: formData.priority,
        address_text: formData.address_text.trim() || null,
        arrival_notes: formData.arrival_notes.trim() || null,
        scheduled_start_at: scheduledStartAt,
        line_items: finalLines,
      };

      let savedId = jobId;

      if (isEditing && jobId) {
        const { error } = await supabase.from('jobs').update(payload).eq('id', jobId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('jobs').insert([payload]).select('id').single();
        if (error) throw error;
        savedId = data.id;
      }

      const { error: deleteContactsError } = await supabase.from('job_contacts').delete().eq('job_id', savedId);
      if (deleteContactsError) throw deleteContactsError;

      if (formData.contact_full_name.trim()) {
        const { error: insertContactError } = await supabase.from('job_contacts').insert([{
          job_id: savedId,
          account_id: formData.account_id,
          full_name: formData.contact_full_name.trim(),
          phone: formData.contact_phone.trim() || null,
          relation: 'primary',
          sort_order: 0,
        }]);
        if (insertContactError) throw insertContactError;
      }

      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success(isEditing ? 'העבודה עודכנה בהצלחה' : 'העבודה נוצרה בהצלחה');
      navigate(createPageUrl(`JobDetails?id=${savedId}`));
    } catch (error) {
      console.error('Error saving job:', error);
      toast.error('שגיאה בשמירת עבודה', {
        description: getDetailedErrorReason(error, 'שמירת העבודה נכשלה.'),
        duration: 9000,
      });
    } finally {
      setSaving(false);
    }
  }

  if (isLoadingAuth || loading) return <LoadingSpinner />;
  if (!user) return null;

  return (
    <div dir="rtl" className="mx-auto max-w-3xl space-y-6 p-4 lg:p-8">
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{isEditing ? 'עריכת עבודה' : 'עבודה חדשה'}</h1>
          <p className="mt-1 text-slate-500">ניהול עבודה במודל CRM v1</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">לקוח *</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateClientDialogOpen(true)}>
              + לקוח חדש
            </Button>
          </CardHeader>
          <CardContent>
            <Popover open={accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  data-testid="job-account-trigger"
                  variant="outline"
                  role="combobox"
                  className={`h-auto w-full justify-between py-3 ${errors.account_id ? 'border-red-500' : ''}`}
                >
                  {formData.account_name ? <span>{formData.account_name}</span> : <span className="text-slate-500">בחר לקוח...</span>}
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
                        <CommandItem key={account.id} onSelect={() => handleAccountSelect(account)}>
                          {account.account_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.account_id ? <p className="mt-1 text-sm text-red-600">{errors.account_id}</p> : null}
          </CardContent>
        </Card>

        <CreateNewClientDialog
          open={createClientDialogOpen}
          onOpenChange={setCreateClientDialogOpen}
          onClientCreated={handleClientCreated}
        />

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">פרטי עבודה</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>כותרת *</Label>
              <Input
                data-testid="job-title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className={errors.title ? 'border-red-500' : ''}
              />
              {errors.title ? <p className="text-xs text-red-600">{errors.title}</p> : null}
            </div>

            <div className="space-y-2">
              <Label>תיאור</Label>
              <Textarea
                data-testid="job-description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>מבצע</Label>
                <Input
                  data-testid="job-assigned-to"
                  value={formData.assigned_to}
                  onChange={(e) => setFormData((prev) => ({ ...prev, assigned_to: e.target.value }))}
                  placeholder="owner"
                />
              </div>

              <div className="space-y-2">
                <Label>סטטוס</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>כתובת</Label>
              <Input
                data-testid="job-address"
                value={formData.address_text}
                onChange={(e) => setFormData((prev) => ({ ...prev, address_text: e.target.value }))}
                placeholder="רחוב, עיר"
              />
            </div>

            <div className="space-y-2">
              <Label>הערות הגעה</Label>
              <Textarea
                value={formData.arrival_notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, arrival_notes: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>תאריך</Label>
                <Input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, scheduled_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>שעה</Label>
                <Input
                  type="time"
                  value={formData.scheduled_time}
                  onChange={(e) => setFormData((prev) => ({ ...prev, scheduled_time: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">אחריות</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>מצב אחריות</Label>
              <Select
                value={formData.warranty_mode}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, warranty_mode: value }))}
              >
                <SelectTrigger data-testid="job-warranty-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="with_warranty">עם אחריות</SelectItem>
                  <SelectItem value="no_warranty">אין אחריות</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.warranty_mode === 'no_warranty' ? (
              <div className="space-y-2">
                <Label>הסבר ללא אחריות</Label>
                <Textarea
                  data-testid="job-warranty-explanation"
                  value={formData.warranty_explanation}
                  onChange={(e) => setFormData((prev) => ({ ...prev, warranty_explanation: e.target.value }))}
                  className={errors.warranty_explanation ? 'border-red-500' : ''}
                />
                {errors.warranty_explanation ? (
                  <p className="text-xs text-red-600">{errors.warranty_explanation}</p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">שורות שירות</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="ml-1 h-4 w-4" /> הוסף שורה
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>סכום מוסכם (מהיר)</Label>
              <Input
                data-testid="job-agreed-amount"
                type="number"
                min="0"
                step="0.01"
                value={toNumber(formData.agreed_amount) || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, agreed_amount: e.target.value }))}
                dir="ltr"
              />
            </div>

            {lineItems.map((item, index) => (
              <div key={item.id} className="space-y-3 rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">שורה {index + 1}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLineItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={item.description}
                  onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                  placeholder="תיאור שירות"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                    dir="ltr"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateLineItem(item.id, 'unit_price', e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>
            ))}

            {errors.line_items ? <p className="text-sm text-red-600">{errors.line_items}</p> : null}

            <div className="rounded-xl bg-slate-800 p-4 text-white">
              <div className="flex items-center justify-between">
                <span>סה"כ לפני מע"מ</span>
                <span dir="ltr">₪{subtotal.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">איש קשר לעבודה</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>שם</Label>
              <Input
                value={formData.contact_full_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, contact_full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>טלפון</Label>
              <Input
                value={formData.contact_phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, contact_phone: e.target.value }))}
                dir="ltr"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pt-2">
          <Button
            data-testid="job-save-button"
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
                {isEditing ? 'שמור שינויים' : 'צור עבודה'}
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
