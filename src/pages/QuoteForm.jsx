import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { geocodeAddress } from '@/data/mapRepo';
import { getQuote, saveDraftQuote } from '@/data/quotesRepo';
import {
  isStrictIsraeliAddressFormat,
  isUsableJobCoords,
  normalizeAddressText,
  parseCoord,
} from '@/lib/geo/coordsPolicy';
import { buildTenMinuteTimeOptions, isTenMinuteSlot, toTenMinuteSlot } from '@/lib/time/timeSlots';
import { calculateGross, calculateVAT } from '@/utils/vat';
import { useIsMobile } from '@/lib/ui/useIsMobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import GooglePlacesInput from '@/components/shared/GooglePlacesInput';
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
import CreateNewClientDialog from '@/components/job/CreateNewClientDialog';
import { toast } from 'sonner';
import { getDetailedErrorReason } from '@/lib/errorMessages';

const EMPTY_LINE_ITEM = () => ({
  id: crypto.randomUUID(),
  description: 'שירות',
  quantity: 1,
  unit_price: 0,
});

const CLIENT_TYPE_LABELS = {
  private: 'פרטי',
  company: 'חברה',
  bath_company: 'חברת אמבטיות',
};

const TIME_OPTIONS_10_MIN = buildTenMinuteTimeOptions();

const FORM_STEPS = [
  { id: 'client', title: 'לקוח' },
  { id: 'details', title: 'פרטי הצעה' },
  { id: 'location', title: 'מיקום' },
  { id: 'services', title: 'שורות שירות' },
];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getFirstFailedStep(errors) {
  if (errors.account_id) return 0;
  if (errors.title || errors.scheduled_time) return 1;
  if (errors.address_text) return 2;
  if (errors.line_items || (Array.isArray(errors.lineItems) && errors.lineItems.some((line) => Object.keys(line || {}).length > 0))) {
    return 3;
  }
  return null;
}

function stepHasError(stepIndex, errors) {
  if (stepIndex === 0) return Boolean(errors.account_id);
  if (stepIndex === 1) return Boolean(errors.title || errors.scheduled_time);
  if (stepIndex === 2) return Boolean(errors.address_text);
  if (stepIndex === 3) return Boolean(errors.line_items || (Array.isArray(errors.lineItems) && errors.lineItems.some((line) => Object.keys(line || {}).length > 0)));
  return false;
}

export default function QuoteForm() {
  const navigate = useNavigate();
  const { id: routeQuoteId } = useParams();
  const queryClient = useQueryClient();
  const { user, isLoadingAuth } = useAuth();
  const isMobile = useIsMobile();

  const urlParams = new URLSearchParams(window.location.search);
  const quoteId = routeQuoteId || urlParams.get('id');
  const preselectedAccountId = urlParams.get('account_id') || urlParams.get('client_id') || '';
  const isEditing = Boolean(quoteId);

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountAddresses, setAccountAddresses] = useState({});
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false);
  const [createClientDialogOpen, setCreateClientDialogOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [addressAssist, setAddressAssist] = useState('');
  const [quoteCoordinates, setQuoteCoordinates] = useState({ lat: null, lng: null });
  const [addressEditedManually, setAddressEditedManually] = useState(false);

  const [formData, setFormData] = useState({
    account_id: preselectedAccountId,
    account_name: '',
    title: '',
    description: '',
    address_text: '',
    arrival_notes: '',
    scheduled_date: '',
    scheduled_time: '',
    notes: '',
  });
  const [lineItems, setLineItems] = useState([EMPTY_LINE_ITEM()]);

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    async function loadData() {
      if (!user) return;
      setLoading(true);

      try {
        const [accountsRes, contactsRes, quoteRes] = await Promise.all([
          supabase.from('accounts').select('id, account_name, client_type').order('created_at', { ascending: false }),
          supabase.from('contacts').select('account_id, address_text, is_primary, created_at').order('created_at', { ascending: true }),
          isEditing && quoteId
            ? getQuote(quoteId).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error }))
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (accountsRes.error) throw accountsRes.error;
        if (contactsRes.error) throw contactsRes.error;
        if (quoteRes.error) throw quoteRes.error;

        const allAccounts = accountsRes.data || [];
        setAccounts(allAccounts);

        const nextAccountAddresses = {};
        (contactsRes.data || []).forEach((contact) => {
          if (!contact.account_id || !contact.address_text) return;
          const normalizedContactAddress = normalizeAddressText(contact.address_text);
          if (!normalizedContactAddress) return;
          if (!nextAccountAddresses[contact.account_id] || contact.is_primary) {
            nextAccountAddresses[contact.account_id] = normalizedContactAddress;
          }
        });
        setAccountAddresses(nextAccountAddresses);

        if (isEditing && quoteId && quoteRes.data) {
          const quoteData = quoteRes.data;

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

          const relatedAccount = Array.isArray(quoteData.accounts) ? quoteData.accounts[0] : quoteData.accounts;
          const accountName = relatedAccount?.account_name
            || allAccounts.find((account) => account.id === quoteData.account_id)?.account_name
            || '';

          const scheduledDate = quoteData.scheduled_start_at ? new Date(quoteData.scheduled_start_at) : null;
          const fallbackTitle = String(quoteData.title || '').trim()
            || (Array.isArray(quoteData.quote_items) && quoteData.quote_items[0]?.description)
            || 'הצעת מחיר';

          setFormData((prev) => ({
            ...prev,
            account_id: quoteData.account_id || '',
            account_name: accountName,
            title: fallbackTitle,
            description: quoteData.description || '',
            address_text: quoteData.address_text || '',
            arrival_notes: quoteData.arrival_notes || '',
            scheduled_date: scheduledDate ? scheduledDate.toISOString().slice(0, 10) : '',
            scheduled_time: scheduledDate ? toTenMinuteSlot(scheduledDate.toISOString().slice(11, 16)) : '',
            notes: quoteData.notes || '',
          }));

          const parsedLat = parseCoord(quoteData.lat);
          const parsedLng = parseCoord(quoteData.lng);
          setQuoteCoordinates({
            lat: isUsableJobCoords(parsedLat, parsedLng) ? parsedLat : null,
            lng: isUsableJobCoords(parsedLat, parsedLng) ? parsedLng : null,
          });
          setAddressEditedManually(false);

          const items = Array.isArray(quoteData.quote_items) && quoteData.quote_items.length > 0
            ? quoteData.quote_items.map((item) => ({
              id: item.id || crypto.randomUUID(),
              description: item.description || 'שירות',
              quantity: toNumber(item.quantity) || 1,
              unit_price: toNumber(item.unit_price),
            }))
            : [EMPTY_LINE_ITEM()];

          setLineItems(items);
          return;
        }

        if (preselectedAccountId) {
          const selected = allAccounts.find((account) => account.id === preselectedAccountId);
          if (selected) {
            setFormData((prev) => ({
              ...prev,
              account_id: selected.id,
              account_name: selected.account_name || '',
              address_text: prev.address_text || nextAccountAddresses[selected.id] || '',
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
        if (mounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [user, quoteId, isEditing, preselectedAccountId, navigate]);

  function handleAddressTextChange(addressText, { isManual, autofixed } = {}) {
    setFormData((prev) => ({ ...prev, address_text: addressText }));
    if (isManual) {
      setAddressEditedManually(true);
      setQuoteCoordinates({ lat: null, lng: null });
    }
    if (autofixed) {
      setAddressAssist(`הכתובת תוקנה אוטומטית: ${addressText}`);
    } else if (isManual) {
      setAddressAssist('');
    }
    if (errors.address_text) {
      setErrors((prev) => ({ ...prev, address_text: null }));
    }
  }

  function handleAddressPlaceSelected({ addressText, lat, lng }) {
    setFormData((prev) => ({ ...prev, address_text: addressText || prev.address_text }));
    setAddressEditedManually(false);
    setAddressAssist('');
    const parsedLat = parseCoord(lat);
    const parsedLng = parseCoord(lng);
    setQuoteCoordinates({
      lat: isUsableJobCoords(parsedLat, parsedLng) ? parsedLat : null,
      lng: isUsableJobCoords(parsedLat, parsedLng) ? parsedLng : null,
    });
  }

  function handleAccountSelect(account) {
    const suggestedAddress = accountAddresses[account.id] || '';
    const shouldAutofillAddress = !formData.address_text || !addressEditedManually;

    setFormData((prev) => ({
      ...prev,
      account_id: account.id,
      account_name: account.account_name || '',
      address_text: shouldAutofillAddress ? suggestedAddress : prev.address_text,
    }));

    if (shouldAutofillAddress) {
      setQuoteCoordinates({ lat: null, lng: null });
      setAddressEditedManually(false);
    }

    setErrors((prev) => ({ ...prev, account_id: null }));
    setAccountPopoverOpen(false);
  }

  function handleClientCreated(newAccount) {
    const suggestedAddress = newAccount.primary_contact?.address_text || '';
    const shouldAutofillAddress = !formData.address_text || !addressEditedManually;

    setAccounts((prev) => [newAccount, ...prev]);
    setAccountAddresses((prev) => ({ ...prev, [newAccount.id]: suggestedAddress }));
    setFormData((prev) => ({
      ...prev,
      account_id: newAccount.id,
      account_name: newAccount.account_name,
      address_text: shouldAutofillAddress ? suggestedAddress : prev.address_text,
    }));

    if (shouldAutofillAddress) {
      setQuoteCoordinates({ lat: null, lng: null });
      setAddressEditedManually(false);
    }

    setErrors((prev) => ({ ...prev, account_id: null }));
    setCreateClientDialogOpen(false);
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

  const subtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + (toNumber(item.quantity) * toNumber(item.unit_price)), 0),
    [lineItems],
  );
  const vatAmount = calculateVAT(subtotal);
  const totalWithVat = calculateGross(subtotal);

  function buildValidationErrors() {
    const nextErrors = {};

    if (!formData.account_id) nextErrors.account_id = 'חובה לבחור לקוח';
    if (!formData.title.trim()) nextErrors.title = 'כותרת ההצעה היא שדה חובה';

    const normalizedAddress = normalizeAddressText(formData.address_text);
    if (normalizedAddress && !isStrictIsraeliAddressFormat(normalizedAddress)) {
      nextErrors.address_text = 'יש להזין כתובת בפורמט: רחוב ומספר, עיר';
    }

    if (formData.scheduled_time && !isTenMinuteSlot(formData.scheduled_time)) {
      nextErrors.scheduled_time = 'יש לבחור שעה בקפיצות של 10 דקות';
    }

    const lineErrors = [];
    let hasLineError = false;

    lineItems.forEach((item, index) => {
      const itemErrors = {};

      if (!item.description.trim()) {
        itemErrors.description = 'תיאור הוא שדה חובה';
        hasLineError = true;
      }

      if (toNumber(item.quantity) <= 0) {
        itemErrors.quantity = 'כמות חייבת להיות גדולה מ-0';
        hasLineError = true;
      }

      if (toNumber(item.unit_price) < 0) {
        itemErrors.unit_price = 'מחיר לא יכול להיות שלילי';
        hasLineError = true;
      }

      lineErrors[index] = itemErrors;
    });

    if (hasLineError) {
      nextErrors.lineItems = lineErrors;
      nextErrors.line_items = 'יש לתקן את שורות השירות לפני שמירה';
    }

    return nextErrors;
  }

  function validateCurrentStep(stepIndex) {
    const nextErrors = buildValidationErrors();
    setErrors(nextErrors);
    return !stepHasError(stepIndex, nextErrors);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!user) return;

    const validationErrors = buildValidationErrors();
    setErrors(validationErrors);
    const firstFailedStep = getFirstFailedStep(validationErrors);
    if (firstFailedStep != null) {
      if (isMobile) setActiveStep(firstFailedStep);
      return;
    }

    setSaving(true);
    try {
      const normalizedAddress = normalizeAddressText(formData.address_text);
      const hasAddress = Boolean(normalizedAddress);

      let nextLat = parseCoord(quoteCoordinates.lat);
      let nextLng = parseCoord(quoteCoordinates.lng);
      let shouldWarnMissingCoords = false;

      if (!hasAddress) {
        nextLat = null;
        nextLng = null;
      } else if (!isUsableJobCoords(nextLat, nextLng)) {
        try {
          const geo = await geocodeAddress(normalizedAddress);
          const parsedLat = parseCoord(geo?.lat);
          const parsedLng = parseCoord(geo?.lng);
          if (isUsableJobCoords(parsedLat, parsedLng)) {
            nextLat = parsedLat;
            nextLng = parsedLng;
          } else {
            nextLat = null;
            nextLng = null;
            shouldWarnMissingCoords = true;
          }
        } catch {
          nextLat = null;
          nextLng = null;
          shouldWarnMissingCoords = true;
        }
      }

      setQuoteCoordinates({
        lat: isUsableJobCoords(nextLat, nextLng) ? nextLat : null,
        lng: isUsableJobCoords(nextLat, nextLng) ? nextLng : null,
      });

      if (shouldWarnMissingCoords) {
        toast.warning('לא הצלחנו לאתר מיקום מדויק. ההצעה תישמר ללא קואורדינטות.');
      }

      const scheduledStartAt =
        formData.scheduled_date && formData.scheduled_time
          ? new Date(`${formData.scheduled_date}T${formData.scheduled_time}`).toISOString()
          : null;

      const quoteSavedId = await saveDraftQuote({
        quoteId: isEditing ? quoteId : undefined,
        accountId: formData.account_id,
        title: formData.title,
        description: formData.description,
        notes: formData.notes,
        addressText: normalizedAddress,
        arrivalNotes: formData.arrival_notes,
        lat: isUsableJobCoords(nextLat, nextLng) ? nextLat : null,
        lng: isUsableJobCoords(nextLat, nextLng) ? nextLng : null,
        scheduledStartAt,
        items: lineItems.map((item) => ({
          description: item.description.trim(),
          quantity: Math.max(1, toNumber(item.quantity)),
          unitPrice: Math.max(0, toNumber(item.unit_price)),
        })),
      });

      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('הצעת המחיר נשמרה בהצלחה');
      navigate(createPageUrl(`QuoteDetails?id=${quoteSavedId}`));
    } catch (error) {
      console.error('Error saving quote:', error);
      const migrationMissing = error?.code === '42703';
      toast.error('שגיאה בשמירת הצעת המחיר', {
        description: migrationMissing
          ? 'נדרש עדכון DB לשדות החדשים של הצעת מחיר. הרץ את המיגרציה האחרונה ונסה שוב.'
          : getDetailedErrorReason(error, 'שמירת הצעת המחיר נכשלה.'),
        duration: 9000,
      });
    } finally {
      setSaving(false);
    }
  }

  function handleNextStep() {
    if (activeStep >= FORM_STEPS.length - 1) return;
    if (!validateCurrentStep(activeStep)) return;
    setActiveStep((prev) => Math.min(prev + 1, FORM_STEPS.length - 1));
  }

  function handlePreviousStep() {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  }

  const isLastStep = activeStep === FORM_STEPS.length - 1;

  if (isLoadingAuth) return <LoadingSpinner />;
  if (!user) return null;
  if (loading) return <LoadingSpinner />;

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-6 p-4 pb-32 lg:p-8 lg:pb-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{isEditing ? 'עריכת טיוטת הצעה' : 'הצעת מחיר חדשה'}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">מבנה זהה לטופס עבודה עם התאמות להצעת מחיר</p>
        </div>
      </div>

      {isMobile ? (
        <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-20 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="grid grid-cols-4 gap-1">
            {FORM_STEPS.map((step, index) => {
              const isActive = index === activeStep;
              const isDone = index < activeStep;
              const hasError = stepHasError(index, errors);

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    if (index <= activeStep) setActiveStep(index);
                  }}
                  className={`rounded-xl px-2 py-2 text-[11px] font-medium transition ${
                    isActive
                      ? 'bg-[#00214d] text-white'
                      : isDone
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : hasError
                          ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {index + 1}. {step.title}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <form id="quote-form" onSubmit={handleSubmit} className="space-y-6">
        {!isMobile || activeStep === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">לקוח</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateClientDialogOpen(true)}>
                + לקוח חדש
              </Button>
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
                          <CommandItem key={account.id} onSelect={() => handleAccountSelect(account)} className="cursor-pointer">
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="font-medium">{account.account_name}</span>
                              <span className="text-xs text-slate-500">{CLIENT_TYPE_LABELS[account.client_type] || 'פרטי'}</span>
                            </div>
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
        ) : null}

        <CreateNewClientDialog
          open={createClientDialogOpen}
          onOpenChange={setCreateClientDialogOpen}
          onClientCreated={handleClientCreated}
        />

        {!isMobile || activeStep === 1 ? (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">פרטי הצעה ותזמון</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quote-title">כותרת *</Label>
                <Input
                  id="quote-title"
                  data-testid="quote-title"
                  value={formData.title}
                  onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title ? <p className="text-xs text-red-600">{errors.title}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="quote-description">תיאור</Label>
                <Textarea
                  id="quote-description"
                  data-testid="quote-description"
                  value={formData.description}
                  onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quote-scheduled-date">תאריך</Label>
                  <Input
                    id="quote-scheduled-date"
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(event) => setFormData((prev) => ({ ...prev, scheduled_date: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote-scheduled-time">שעה (24H, בקפיצות 10 דקות)</Label>
                  <select
                    id="quote-scheduled-time"
                    data-testid="quote-scheduled-time"
                    value={formData.scheduled_time}
                    onChange={(event) => setFormData((prev) => ({ ...prev, scheduled_time: event.target.value }))}
                    className={`h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 ${errors.scheduled_time ? 'border-red-500' : ''}`}
                  >
                    <option value="">בחר שעה...</option>
                    {TIME_OPTIONS_10_MIN.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                  {errors.scheduled_time ? <p className="text-xs text-red-600">{errors.scheduled_time}</p> : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quote-notes">הערות להצעה</Label>
                <Textarea
                  id="quote-notes"
                  data-testid="quote-notes"
                  value={formData.notes}
                  onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="הערות כלליות להצעת המחיר..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {!isMobile || activeStep === 2 ? (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">מיקום והערות הגעה</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quote-address">כתובת</Label>
                <GooglePlacesInput
                  id="quote-address"
                  data-testid="quote-address"
                  value={formData.address_text}
                  onChangeText={handleAddressTextChange}
                  onPlaceSelected={handleAddressPlaceSelected}
                  onAddressAutofix={({ normalized }) => setAddressAssist(`הכתובת תוקנה אוטומטית: ${normalized}`)}
                  placeholder="הרצל 10, אשדוד"
                  className={errors.address_text ? 'border-red-500' : ''}
                />
                <p className="text-xs text-slate-500 dark:text-slate-300">פורמט חובה: רחוב ומספר, עיר. לדוגמה: הרצל 10, אשדוד</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">פורמט מומלץ: רחוב ומספר, עיר. אפשר להקליד גם בלי פסיק והמערכת תתקן אוטומטית.</p>
                {addressAssist ? <p className="text-xs text-emerald-700 dark:text-emerald-300">{addressAssist}</p> : null}
                {errors.address_text ? <p className="text-xs text-red-600">{errors.address_text}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="quote-arrival-notes">הערות הגעה</Label>
                <Textarea
                  id="quote-arrival-notes"
                  data-testid="quote-arrival-notes"
                  value={formData.arrival_notes}
                  onChange={(event) => setFormData((prev) => ({ ...prev, arrival_notes: event.target.value }))}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {!isMobile || activeStep === 3 ? (
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
                const quantity = Math.max(1, toNumber(item.quantity));
                const unitPrice = Math.max(0, toNumber(item.unit_price));
                const lineTotal = quantity * unitPrice;
                const unitWithVat = calculateGross(unitPrice);
                const lineWithVat = calculateGross(lineTotal);

                return (
                  <div key={item.id} className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-300">שורה {index + 1}</span>
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
                        onChange={(event) => updateLineItem(item.id, 'description', event.target.value)}
                        placeholder="תיאור השירות"
                        className={lineErrors.description ? 'border-red-500' : ''}
                      />
                      {lineErrors.description ? <p className="text-xs text-red-600">{lineErrors.description}</p> : null}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>כמות</Label>
                        <Input
                          data-testid={`quote-line-quantity-${index}`}
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(event) => updateLineItem(item.id, 'quantity', event.target.value)}
                          className={lineErrors.quantity ? 'border-red-500' : ''}
                          dir="ltr"
                        />
                        {lineErrors.quantity ? <p className="text-xs text-red-600">{lineErrors.quantity}</p> : null}
                      </div>

                      <div className="space-y-2">
                        <Label>מחיר יחידה (לפני מע"מ)</Label>
                        <Input
                          data-testid={`quote-line-unit-price-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(event) => updateLineItem(item.id, 'unit_price', event.target.value)}
                          className={lineErrors.unit_price ? 'border-red-500' : ''}
                          dir="ltr"
                        />
                        {lineErrors.unit_price ? <p className="text-xs text-red-600">{lineErrors.unit_price}</p> : null}
                      </div>
                    </div>

                    <div className="grid gap-2 rounded-lg bg-white p-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300 sm:grid-cols-2" dir="ltr">
                      <div className="flex items-center justify-between">
                        <span>יחידה כולל מע"מ:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-100">₪{formatMoney(unitWithVat)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>סה"כ שורה כולל מע"מ:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-100">₪{formatMoney(lineWithVat)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {errors.line_items ? <p className="text-sm text-red-600">{errors.line_items}</p> : null}

              <div className="space-y-3 rounded-xl bg-[#00173f] p-4 text-white">
                <div className="flex items-center justify-between">
                  <span>סה"כ לפני מע"מ</span>
                  <span data-testid="quote-total" dir="ltr">₪{formatMoney(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>מע"מ (18%)</span>
                  <span dir="ltr">₪{formatMoney(vatAmount)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/20 pt-3 text-lg font-bold">
                  <span>סה"כ כולל מע"מ</span>
                  <span dir="ltr">₪{formatMoney(totalWithVat)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {!isMobile ? (
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
        ) : null}
      </form>

      {isMobile ? (
        <div
          className="fixed inset-x-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
          style={{
            bottom: 'calc(4.7rem + env(safe-area-inset-bottom))',
            paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
          }}
        >
          <div className="mx-auto flex max-w-md items-center gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={handlePreviousStep} disabled={activeStep === 0 || saving}>
              הקודם
            </Button>

            {isLastStep ? (
              <Button
                data-testid="quote-save-button"
                type="submit"
                form="quote-form"
                disabled={saving}
                className="flex-1 bg-[#00214d] text-white hover:bg-[#00214d]/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    שומר...
                  </>
                ) : (
                  <>
                    <Save className="ml-2 h-4 w-4" />
                    שמור
                  </>
                )}
              </Button>
            ) : (
              <Button type="button" className="flex-1 bg-[#00214d] text-white hover:bg-[#00214d]/90" onClick={handleNextStep} disabled={saving}>
                הבא
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

