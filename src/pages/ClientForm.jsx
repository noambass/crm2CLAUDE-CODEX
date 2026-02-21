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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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

const EMPTY_FORM = {
  clientType: 'private',
  companyName: '',
  fullName: '',
  role: '',
  phone: '',
  email: '',
  addressText: '',
  internalNotes: '',
  status: 'active',
};

function normalizeAccountStatus(value) {
  return value === 'lead' || value === 'active' || value === 'inactive' ? value : null;
}

export default function ClientForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: routeAccountId } = useParams();
  const { user, isLoadingAuth } = useAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const accountId = routeAccountId || urlParams.get('id');
  const isEditing = Boolean(accountId);
  const statusFromQuery = normalizeAccountStatus(urlParams.get('status'));

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState(() => ({
    ...EMPTY_FORM,
    status: statusFromQuery || EMPTY_FORM.status,
  }));

  const isCompanyType = formData.clientType === 'company' || formData.clientType === 'bath_company';

  useEffect(() => {
    if (!user || !isEditing || !accountId) return;

    let mounted = true;

    async function loadProfile() {
      try {
        const profile = await getClientProfile(accountId);
        if (!mounted) return;

        const clientType = profile.account.client_type || 'private';
        const isCompany = clientType === 'company' || clientType === 'bath_company';

        setFormData({
          clientType,
          companyName: isCompany ? (profile.account.account_name || '') : '',
          fullName: profile.primaryContact?.full_name || (!isCompany ? profile.account.account_name : '') || '',
          role: profile.primaryContact?.role || '',
          phone: profile.primaryContact?.phone || '',
          email: profile.primaryContact?.email || '',
          addressText: profile.primaryContact?.address_text || '',
          internalNotes: profile.account.notes || '',
          status: profile.account.status || 'active',
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

  function set(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  }

  function handleTabChange(value) {
    setFormData((prev) => ({ ...prev, clientType: value }));
    setErrors({});
  }

  function validate() {
    const nextErrors = {};
    if (isCompanyType) {
      if (!formData.companyName.trim()) nextErrors.companyName = 'שם חברה הוא שדה חובה';
    } else {
      if (!formData.fullName.trim()) nextErrors.fullName = 'שם מלא הוא שדה חובה';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!user) return;
    if (!validate()) return;

    setSaving(true);

    try {
      const payload = {
        clientType: formData.clientType,
        companyName: formData.companyName.trim(),
        fullName: formData.fullName.trim(),
        role: formData.role.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        addressText: formData.addressText.trim(),
        internalNotes: formData.internalNotes.trim(),
        status: formData.status,
      };

      if (isEditing && accountId) {
        await updateClient(accountId, payload);
        toast.success('הלקוח עודכן בהצלחה');
      } else {
        await createClient(payload);
        toast.success('הלקוח נוצר בהצלחה');
      }

      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      navigate(createPageUrl(payload.status === 'lead' ? 'Leads' : 'Clients'));
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
    <div dir="rtl" className="mx-auto max-w-2xl space-y-6 p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{isEditing ? 'עריכת לקוח' : 'לקוח חדש'}</h1>
          <p className="mt-1 text-slate-500">{isEditing ? 'עדכון פרטי לקוח' : 'יצירת לקוח חדש במערכת'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type tabs */}
        <Tabs value={formData.clientType} onValueChange={handleTabChange}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="private">לקוח פרטי</TabsTrigger>
            <TabsTrigger value="company">חברה</TabsTrigger>
            <TabsTrigger value="bath_company">חברת אמבטיות</TabsTrigger>
          </TabsList>

          {/* ─── PRIVATE ─── */}
          <TabsContent value="private" className="mt-6 space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">פרטי לקוח</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName-private">שם מלא *</Label>
                  <Input
                    id="fullName-private"
                    data-testid="client-full-name"
                    value={formData.fullName}
                    onChange={(e) => set('fullName', e.target.value)}
                    placeholder="ישראל ישראלי"
                    className={errors.fullName ? 'border-red-500' : ''}
                  />
                  {errors.fullName ? <p className="text-xs text-red-600">{errors.fullName}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone-private">טלפון</Label>
                  <Input
                    id="phone-private"
                    data-testid="client-phone"
                    value={formData.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="050-0000000"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address-private">כתובת</Label>
                  <Input
                    id="address-private"
                    value={formData.addressText}
                    onChange={(e) => set('addressText', e.target.value)}
                    placeholder="הרצל 10, אשדוד"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── COMPANY ─── */}
          <TabsContent value="company" className="mt-6 space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">פרטי חברה</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName-company">שם חברה *</Label>
                  <Input
                    id="companyName-company"
                    value={formData.companyName}
                    onChange={(e) => set('companyName', e.target.value)}
                    placeholder="שם החברה"
                    className={errors.companyName ? 'border-red-500' : ''}
                  />
                  {errors.companyName ? <p className="text-xs text-red-600">{errors.companyName}</p> : null}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">איש קשר ראשי</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName-company">שם</Label>
                    <Input
                      id="fullName-company"
                      value={formData.fullName}
                      onChange={(e) => set('fullName', e.target.value)}
                      placeholder="שם איש הקשר"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role-company">תפקיד</Label>
                    <Input
                      id="role-company"
                      value={formData.role}
                      onChange={(e) => set('role', e.target.value)}
                      placeholder="מנהל החזקה..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone-company">טלפון</Label>
                  <Input
                    id="phone-company"
                    value={formData.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="050-0000000"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address-company">כתובת</Label>
                  <Input
                    id="address-company"
                    value={formData.addressText}
                    onChange={(e) => set('addressText', e.target.value)}
                    placeholder="הרצל 10, אשדוד"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── BATH COMPANY ─── */}
          <TabsContent value="bath_company" className="mt-6 space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">פרטי חברת אמבטיות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName-bath">שם חברה *</Label>
                  <Input
                    id="companyName-bath"
                    value={formData.companyName}
                    onChange={(e) => set('companyName', e.target.value)}
                    placeholder="שם חברת האמבטיות"
                    className={errors.companyName ? 'border-red-500' : ''}
                  />
                  {errors.companyName ? <p className="text-xs text-red-600">{errors.companyName}</p> : null}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">איש קשר ראשי</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName-bath">שם</Label>
                    <Input
                      id="fullName-bath"
                      value={formData.fullName}
                      onChange={(e) => set('fullName', e.target.value)}
                      placeholder="שם איש הקשר"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role-bath">תפקיד</Label>
                    <Input
                      id="role-bath"
                      value={formData.role}
                      onChange={(e) => set('role', e.target.value)}
                      placeholder="שירות לקוחות..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone-bath">טלפון</Label>
                  <Input
                    id="phone-bath"
                    value={formData.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="050-0000000"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address-bath">כתובת</Label>
                  <Input
                    id="address-bath"
                    value={formData.addressText}
                    onChange={(e) => set('addressText', e.target.value)}
                    placeholder="הרצל 10, אשדוד"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ─── Common: status + notes ─── */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">הגדרות</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>סטטוס לקוח</Label>
              <Select value={formData.status} onValueChange={(v) => set('status', v)}>
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

            <div className="space-y-2">
              <Label htmlFor="internalNotes">הערות פנימיות</Label>
              <Textarea
                id="internalNotes"
                data-testid="client-notes"
                value={formData.internalNotes}
                onChange={(e) => set('internalNotes', e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
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
