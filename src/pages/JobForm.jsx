import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronUp, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { geocodeAddress } from '@/data/mapRepo';
import {
  isStrictIsraeliAddressFormat,
  isUsableJobCoords,
  normalizeAddressText,
  parseCoord,
} from '@/lib/geo/coordsPolicy';
import { getStatusForScheduling } from '@/lib/jobs/schedulingStatus';
import { calculateGross, calculateVAT } from '@/utils/vat';
import { buildTenMinuteTimeOptions, isTenMinuteSlot, toTenMinuteSlot } from '@/lib/time/timeSlots';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const EMPTY_LINE = () => ({
  id: crypto.randomUUID(),
  description: 'שירות',
  quantity: 1,
  unit_price: 0,
});

const EMPTY_CONTACT = () => ({
  id: crypto.randomUUID(),
  full_name: '',
  phone: '',
  notes: '',
});

const CLIENT_TYPE_LABELS = {
  private: 'פרטי',
  company: 'חברה',
  bath_company: 'חברת אמבטיות',
};

const TIME_OPTIONS_10_MIN = buildTenMinuteTimeOptions();

const FORM_STEPS = [
  { id: 'client', title: 'לקוח ואנשי קשר' },
  { id: 'details', title: 'פרטי עבודה ותזמון' },
  { id: 'location', title: 'מיקום והערות הגעה' },
  { id: 'services', title: 'שורות שירות וסיכום' },
];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeContactFromDb(contact) {
  return {
    id: contact.id || crypto.randomUUID(),
    full_name: contact.full_name || '',
    phone: contact.phone || '',
    notes: contact.relation === 'primary' ? '' : (contact.relation || ''),
  };
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
  if (errors.line_items) return 3;
  return null;
}

function stepHasError(stepIndex, errors) {
  if (stepIndex === 0) return Boolean(errors.account_id);
  if (stepIndex === 1) return Boolean(errors.title || errors.scheduled_time);
  if (stepIndex === 2) return Boolean(errors.address_text);
  if (stepIndex === 3) return Boolean(errors.line_items);
  return false;
}

export default function JobForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoadingAuth } = useAuth();
  const isMobile = useIsMobile();

  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('id');
  const preselectedAccountId = urlParams.get('account_id') || urlParams.get('client_id') || '';
  const isEditing = Boolean(jobId);

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountAddresses, setAccountAddresses] = useState({});
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false);
  const [createClientDialogOpen, setCreateClientDialogOpen] = useState(false);
  const [additionalContactsOpen, setAdditionalContactsOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [addressAssist, setAddressAssist] = useState('');
  const [jobCoordinates, setJobCoordinates] = useState({ lat: null, lng: null });
  const [addressEditedManually, setAddressEditedManually] = useState(false);

  const [formData, setFormData] = useState({
    account_id: preselectedAccountId,
    account_name: '',
    title: '',
    description: '',
    priority: 'normal',
    address_text: '',
    arrival_notes: '',
    scheduled_date: '',
    scheduled_time: '',
  });

  const [persistedStatus, setPersistedStatus] = useState('waiting_schedule');
  const [lineItems, setLineItems] = useState([EMPTY_LINE()]);
  const [jobContacts, setJobContacts] = useState([EMPTY_CONTACT()]);

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    async function loadData() {
      try {
        const [accountsRes, contactsRes, jobRes] = await Promise.all([
          supabase.from('accounts').select('id, account_name, client_type').order('created_at', { ascending: false }),
          supabase.from('contacts').select('account_id, address_text, is_primary, created_at').order('created_at', { ascending: true }),
          isEditing
            ? supabase.from('jobs').select('*').eq('id', jobId).single()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (accountsRes.error) throw accountsRes.error;
        if (contactsRes.error) throw contactsRes.error;
        if (jobRes.error) throw jobRes.error;

        const accountRows = accountsRes.data || [];
        const contactsRows = contactsRes.data || [];
        const nextAccountAddresses = {};

        contactsRows.forEach((contact) => {
          if (!contact.account_id || !contact.address_text) return;
          const normalizedContactAddress = normalizeAddressText(contact.address_text);
          if (!normalizedContactAddress) return;
          if (!nextAccountAddresses[contact.account_id] || contact.is_primary) {
            nextAccountAddresses[contact.account_id] = normalizedContactAddress;
          }
        });

        if (!mounted) return;

        setAccounts(accountRows);
        setAccountAddresses(nextAccountAddresses);

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
            priority: job.priority || 'normal',
            address_text: job.address_text || '',
            arrival_notes: job.arrival_notes || '',
            scheduled_date: scheduledDate ? scheduledDate.toISOString().slice(0, 10) : '',
            scheduled_time: scheduledDate ? toTenMinuteSlot(scheduledDate.toISOString().slice(11, 16)) : '',
          }));

          setPersistedStatus(job.status || 'waiting_schedule');
          const parsedLat = parseCoord(job.lat);
          const parsedLng = parseCoord(job.lng);
          setJobCoordinates({
            lat: isUsableJobCoords(parsedLat, parsedLng) ? parsedLat : null,
            lng: isUsableJobCoords(parsedLat, parsedLng) ? parsedLng : null,
          });
          setAddressEditedManually(false);

          const { data: contactsData, error: contactsError } = await supabase
            .from('job_contacts')
            .select('id, full_name, phone, relation, sort_order')
            .eq('job_id', job.id)
            .order('sort_order', { ascending: true });
          if (contactsError) throw contactsError;

          if (contactsData?.length) {
            setJobContacts(contactsData.map(normalizeContactFromDb));
            setAdditionalContactsOpen(true);
          } else {
            setJobContacts([EMPTY_CONTACT()]);
            setAdditionalContactsOpen(false);
          }
        } else if (preselectedAccountId) {
          const selected = accountRows.find((acc) => acc.id === preselectedAccountId);
          if (selected) {
            setFormData((prev) => ({
              ...prev,
              account_id: selected.id,
              account_name: selected.account_name,
              address_text: prev.address_text || nextAccountAddresses[selected.id] || '',
            }));
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
  const vatAmount = calculateVAT(subtotal);
  const totalWithVat = calculateGross(subtotal);

  function buildValidationErrors() {
    const next = {};

    if (!formData.account_id) next.account_id = 'יש לבחור לקוח';
    if (!formData.title.trim()) next.title = 'כותרת עבודה היא שדה חובה';

    const normalizedAddress = normalizeAddressText(formData.address_text);
    if (normalizedAddress && !isStrictIsraeliAddressFormat(normalizedAddress)) {
      next.address_text = 'יש להזין כתובת בפורמט: רחוב ומספר, עיר';
    }

    const validLines = lineItems.filter((line) => line.description.trim() && toNumber(line.quantity) > 0 && toNumber(line.unit_price) >= 0);
    if (formData.scheduled_time && !isTenMinuteSlot(formData.scheduled_time)) {
      next.scheduled_time = 'יש לבחור שעה בקפיצות של 10 דקות';
    }
    if (validLines.length === 0) {
      next.line_items = 'חובה לפחות שורת שירות אחת תקינה';
    }

    return next;
  }

  function validateCurrentStep(stepIndex) {
    const nextErrors = buildValidationErrors();
    setErrors(nextErrors);
    return !stepHasError(stepIndex, nextErrors);
  }

  function handleAddressTextChange(addressText, { isManual, autofixed } = {}) {
    setFormData((prev) => ({ ...prev, address_text: addressText }));
    if (isManual) {
      setAddressEditedManually(true);
      setJobCoordinates({ lat: null, lng: null });
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
    setJobCoordinates({
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
      account_name: account.account_name,
      address_text: shouldAutofillAddress ? suggestedAddress : prev.address_text,
    }));

    if (shouldAutofillAddress) {
      setJobCoordinates({ lat: null, lng: null });
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
      setJobCoordinates({ lat: null, lng: null });
      setAddressEditedManually(false);
    }

    setErrors((prev) => ({ ...prev, account_id: null }));
    setCreateClientDialogOpen(false);
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

  function updateJobContact(id, field, value) {
    setJobContacts((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function addJobContact() {
    setJobContacts((prev) => [...prev, EMPTY_CONTACT()]);
  }

  function removeJobContact(id) {
    if (jobContacts.length <= 1) {
      setJobContacts([EMPTY_CONTACT()]);
      return;
    }
    setJobContacts((prev) => prev.filter((item) => item.id !== id));
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
      const finalLines = lineItems
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

      const scheduledStartAt =
        formData.scheduled_date && formData.scheduled_time
          ? new Date(`${formData.scheduled_date}T${formData.scheduled_time}`).toISOString()
          : null;

      let nextLat = parseCoord(jobCoordinates.lat);
      let nextLng = parseCoord(jobCoordinates.lng);
      const trimmedAddress = normalizeAddressText(formData.address_text);
      const hasAddress = Boolean(trimmedAddress);
      let shouldWarnMissingCoords = false;

      if (!hasAddress) {
        nextLat = null;
        nextLng = null;
      } else if (!isUsableJobCoords(nextLat, nextLng)) {
        try {
          const geo = await geocodeAddress(trimmedAddress);
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

      setJobCoordinates({
        lat: isUsableJobCoords(nextLat, nextLng) ? nextLat : null,
        lng: isUsableJobCoords(nextLat, nextLng) ? nextLng : null,
      });

      if (shouldWarnMissingCoords) {
        toast.warning('לא הצלחנו לאתר מיקום מדויק. העבודה תישמר ללא סימון במפה.');
      }

      let nextStatus = isEditing ? persistedStatus : 'waiting_schedule';
      if (scheduledStartAt) {
        nextStatus = getStatusForScheduling(nextStatus);
      }

      const payload = {
        account_id: formData.account_id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        status: nextStatus,
        priority: formData.priority,
        address_text: trimmedAddress || null,
        arrival_notes: formData.arrival_notes.trim() || null,
        lat: isUsableJobCoords(nextLat, nextLng) ? nextLat : null,
        lng: isUsableJobCoords(nextLat, nextLng) ? nextLng : null,
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

      const normalizedContacts = jobContacts
        .map((contact) => ({
          full_name: String(contact.full_name || '').trim(),
          phone: String(contact.phone || '').trim(),
          notes: String(contact.notes || '').trim(),
        }))
        .filter((contact) => contact.full_name);

      if (normalizedContacts.length > 0) {
        const rows = normalizedContacts.map((contact, index) => ({
          job_id: savedId,
          account_id: formData.account_id,
          full_name: contact.full_name,
          phone: contact.phone || null,
          relation: contact.notes || null,
          sort_order: index,
        }));
        const { error: insertContactError } = await supabase.from('job_contacts').insert(rows);
        if (insertContactError) throw insertContactError;
      }

      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['map'] });

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

  function handleNextStep() {
    if (activeStep >= FORM_STEPS.length - 1) return;
    if (!validateCurrentStep(activeStep)) return;
    setActiveStep((prev) => Math.min(prev + 1, FORM_STEPS.length - 1));
  }

  function handlePreviousStep() {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  }

  const isLastStep = activeStep === FORM_STEPS.length - 1;

  if (isLoadingAuth || loading) return <LoadingSpinner />;
  if (!user) return null;

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-6 p-4 pb-32 lg:p-8 lg:pb-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{isEditing ? 'עריכת עבודה' : 'עבודה חדשה'}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            יצירת עבודה מהירה עם תזמון, מיקום ושורות שירות
          </p>
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

      <form id="job-form" onSubmit={handleSubmit} className="space-y-6">
        {!isMobile || activeStep === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">לקוח</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateClientDialogOpen(true)}>
                + לקוח חדש
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <Popover open={accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    data-testid="job-account-trigger"
                    variant="outline"
                    role="combobox"
                    className={`h-auto w-full justify-between py-3 ${errors.account_id ? 'border-red-500' : ''}`}
                  >
                    {formData.account_name ? (
                      <span>{formData.account_name}</span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-300">בחר לקוח...</span>
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
                          <CommandItem key={account.id} onSelect={() => handleAccountSelect(account)}>
                            <div className="flex w-full items-center justify-between gap-2">
                              <span>{account.account_name}</span>
                              <span className="text-xs text-slate-500">{CLIENT_TYPE_LABELS[account.client_type] || 'פרטי'}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.account_id ? <p className="text-sm text-red-600">{errors.account_id}</p> : null}

              <Collapsible open={additionalContactsOpen} onOpenChange={setAdditionalContactsOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between">
                    <span>אנשי קשר נוספים</span>
                    {additionalContactsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-4">
                  {jobContacts.map((contact, index) => (
                    <div key={contact.id} className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">איש קשר {index + 1}</p>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeJobContact(contact.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        value={contact.full_name}
                        onChange={(event) => updateJobContact(contact.id, 'full_name', event.target.value)}
                        placeholder="שם"
                      />
                      <Input
                        value={contact.phone}
                        onChange={(event) => updateJobContact(contact.id, 'phone', event.target.value)}
                        placeholder="טלפון"
                        dir="ltr"
                      />
                      <Textarea
                        value={contact.notes}
                        onChange={(event) => updateJobContact(contact.id, 'notes', event.target.value)}
                        placeholder="הערות"
                        rows={2}
                      />
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={addJobContact}>
                    <Plus className="ml-1 h-4 w-4" /> הוסף איש קשר
                  </Button>
                </CollapsibleContent>
              </Collapsible>
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
              <CardTitle className="text-lg">פרטי עבודה ותזמון</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="job-title">כותרת *</Label>
                <Input
                  id="job-title"
                  data-testid="job-title"
                  value={formData.title}
                  onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title ? <p className="text-xs text-red-600">{errors.title}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-description">תיאור</Label>
                <Textarea
                  id="job-description"
                  data-testid="job-description"
                  value={formData.description}
                  onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="job-scheduled-date">תאריך</Label>
                  <Input
                    id="job-scheduled-date"
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(event) => setFormData((prev) => ({ ...prev, scheduled_date: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-scheduled-time">שעה (24H, בקפיצות 10 דקות)</Label>
                  <select
                    id="job-scheduled-time"
                    data-testid="job-scheduled-time"
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
                <Label htmlFor="job-address">כתובת</Label>
                <GooglePlacesInput
                  id="job-address"
                  data-testid="job-address"
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
                <Label htmlFor="job-arrival-notes">הערות הגעה</Label>
                <Textarea
                  id="job-arrival-notes"
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
                <Plus className="ml-1 h-4 w-4" /> הוסף שורה
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {lineItems.map((item, index) => {
                const quantity = Math.max(1, toNumber(item.quantity));
                const unitPrice = Math.max(0, toNumber(item.unit_price));
                const lineTotal = quantity * unitPrice;
                const unitWithVat = calculateGross(unitPrice);
                const lineWithVat = calculateGross(lineTotal);

                return (
                  <div key={item.id} className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-300">שורה {index + 1}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLineItem(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <Input
                      value={item.description}
                      onChange={(event) => updateLineItem(item.id, 'description', event.target.value)}
                      placeholder="תיאור שירות"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>כמות</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(event) => updateLineItem(item.id, 'quantity', event.target.value)}
                          dir="ltr"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>מחיר יחידה (לפני מע"מ)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(event) => updateLineItem(item.id, 'unit_price', event.target.value)}
                          dir="ltr"
                        />
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
                  <span dir="ltr">₪{formatMoney(subtotal)}</span>
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
                data-testid="job-save-button"
                type="submit"
                form="job-form"
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
                    {isEditing ? 'שמור' : 'צור'}
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

