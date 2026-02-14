import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Loader2, Save } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { createClient, getClientProfile, updateClient } from '@/data/clientsRepo';
import { toast } from 'sonner';
import { getDetailedErrorReason } from '@/lib/errorMessages';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import GooglePlacesInput from '@/components/shared/GooglePlacesInput';
import { isStrictIsraeliAddressFormat, normalizeAddressText } from '@/lib/geo/coordsPolicy';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

const STATUS_OPTIONS = [
  { value: 'lead', label: 'ליד' },
  { value: 'active', label: 'פעיל' },
  { value: 'inactive', label: 'לא פעיל' },
];

const CLIENT_TYPE_OPTIONS = [
  { value: 'private', label: 'לקוח פרטי' },
  { value: 'company', label: 'חברה' },
  { value: 'bath_company', label: 'חברת אמבטיות' },
];

export default function ClientForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: routeAccountId } = useParams();
  const { user, isLoadingAuth } = useAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const accountId = routeAccountId || urlParams.get('id');
  const isEditing = Boolean(accountId);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [addressAssist, setAddressAssist] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    addressText: '',
    internalNotes: '',
    status: 'active',
    clientType: 'private',
  });

  useEffect(() => {
    if (!user || !isEditing || !accountId) return;

    let mounted = true;

    async function loadProfile() {
      try {
        const profile = await getClientProfile(accountId);
        if (!mounted) return;

        setFormData({
          fullName: profile.primaryContact?.full_name || profile.account.account_name || '',
          phone: profile.primaryContact?.phone || '',
          email: profile.primaryContact?.email || '',
          addressText: profile.primaryContact?.address_text || '',
          internalNotes: profile.account.notes || '',
          status: profile.account.status || 'active',
          clientType: profile.account.client_type || 'private',
        });
      } catch (error) {
        console.error('Error loading account profile:', error);
        toast.error('שגיאה בטעינת לקוח', {
          description: getDetailedErrorReason(error, 'טעינת נתוני הלקוח נכשלה.'),
          duration: 9000,
        });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [user, isEditing, accountId]);

  function validate() {
    const nextErrors = {};
    if (!formData.fullName.trim()) {
      nextErrors.fullName = 'שם מלא הוא שדה חובה';
    }
    const normalizedAddress = normalizeAddressText(formData.addressText);
    if (normalizedAddress && !isStrictIsraeliAddressFormat(normalizedAddress)) {
      nextErrors.addressText = 'יש להזין בפורמט: רחוב ומספר, עיר';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleAddressChange(text, meta = {}) {
    setFormData((prev) => ({ ...prev, addressText: text }));
    if (meta?.autofixed) {
      setAddressAssist(`הכתובת תוקנה אוטומטית: ${text}`);
    } else if (meta?.isManual) {
      setAddressAssist('');
    }
    if (errors.addressText) {
      setErrors((prev) => ({ ...prev, addressText: null }));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!user) return;
    if (!validate()) return;

    setSaving(true);

    try {
      const payload = {
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        addressText: normalizeAddressText(formData.addressText),
        internalNotes: formData.internalNotes.trim(),
        status: formData.status,
        clientType: formData.clientType,
      };

      if (isEditing && accountId) {
        await updateClient(accountId, payload);
        toast.success('הלקוח עודכן בהצלחה');
      } else {
        await createClient(payload);
        toast.success('הלקוח נוצר בהצלחה');
      }

      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      navigate(createPageUrl('Clients'));
    } catch (error) {
      console.error('Error saving client:', error);
      toast.error('שגיאה בשמירת לקוח', {
        description: getDetailedErrorReason(error, 'שמירת הלקוח נכשלה.'),
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
    <div dir="rtl" className="mx-auto max-w-3xl space-y-6 p-4 lg:p-8">
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{isEditing ? 'עריכת לקוח' : 'לקוח חדש'}</h1>
          <p className="mt-1 text-slate-500">{isEditing ? 'עדכון פרטי לקוח' : 'יצירת לקוח חדש במערכת'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">פרטים בסיסיים</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">שם לקוח *</Label>
              <Input
                id="fullName"
                data-testid="client-full-name"
                value={formData.fullName}
                onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                placeholder="שם הלקוח"
                className={errors.fullName ? 'border-red-500' : ''}
              />
              {errors.fullName ? <p className="text-xs text-red-600">{errors.fullName}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">טלפון</Label>
                <Input
                  id="phone"
                  data-testid="client-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="050-0000000"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">אימייל</Label>
                <Input
                  id="email"
                  data-testid="client-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="addressText">כתובת</Label>
              <GooglePlacesInput
                id="addressText"
                data-testid="client-address"
                value={formData.addressText}
                onChangeText={handleAddressChange}
                onPlaceSelected={({ addressText }) => handleAddressChange(addressText, { isManual: false })}
                onAddressAutofix={({ normalized }) => setAddressAssist(`הכתובת תוקנה אוטומטית: ${normalized}`)}
                placeholder="הרצל 10, אשדוד"
                className={errors.addressText ? 'border-red-500' : ''}
              />
              <p className="text-xs text-slate-500">פורמט מומלץ: רחוב ומספר, עיר. אפשר להקליד גם בלי פסיק והמערכת תתקן.</p>
              {addressAssist ? <p className="text-xs text-emerald-700">{addressAssist}</p> : null}
              {errors.addressText ? <p className="text-xs text-red-600">{errors.addressText}</p> : null}
            </div>

            <div className="space-y-2">
              <Label>סוג לקוח</Label>
              <Select value={formData.clientType} onValueChange={(value) => setFormData((prev) => ({ ...prev, clientType: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>סטטוס לקוח</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">הערות</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="internalNotes">הערות פנימיות</Label>
              <Textarea
                id="internalNotes"
                data-testid="client-notes"
                value={formData.internalNotes}
                onChange={(e) => setFormData((prev) => ({ ...prev, internalNotes: e.target.value }))}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pt-2">
          <Button
            data-testid="client-save-button"
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
                {isEditing ? 'שמור שינויים' : 'צור לקוח'}
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
