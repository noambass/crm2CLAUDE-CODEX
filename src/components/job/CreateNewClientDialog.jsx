import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import GooglePlacesInput from '@/components/shared/GooglePlacesInput';
import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';
import { getDetailedErrorReason } from '@/lib/errorMessages';
import { isStrictIsraeliAddressFormat, normalizeAddressText } from '@/lib/geo/coordsPolicy';

const CLIENT_TYPE_OPTIONS = [
  { value: 'private', label: 'לקוח פרטי' },
  { value: 'company', label: 'חברה' },
  { value: 'bath_company', label: 'חברת אמבטיות' },
];

export default function CreateNewClientDialog({ open, onOpenChange, onClientCreated }) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    account_name: '',
    full_name: '',
    phone: '',
    email: '',
    address_text: '',
    notes: '',
    client_type: 'private',
  });

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    const accountName = formData.account_name.trim() || formData.full_name.trim();
    const fullName = formData.full_name.trim() || accountName;
    const normalizedAddress = normalizeAddressText(formData.address_text);

    if (!accountName || !fullName) {
      toast.error('חובה להזין שם לקוח');
      return;
    }
    if (normalizedAddress && !isStrictIsraeliAddressFormat(normalizedAddress)) {
      toast.error('פורמט כתובת לא תקין. יש להזין: רחוב ומספר, עיר');
      return;
    }

    setSaving(true);
    try {
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .insert([{
          account_name: accountName,
          notes: formData.notes.trim() || null,
          client_type: formData.client_type || 'private',
        }])
        .select('id, account_name, client_type')
        .single();
      if (accountError) throw accountError;

      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .insert([{
          account_id: account.id,
          full_name: fullName,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          address_text: normalizedAddress || null,
          is_primary: true,
        }])
        .select('id, full_name, phone, email, address_text')
        .single();
      if (contactError) throw contactError;

      onClientCreated({
        id: account.id,
        account_name: account.account_name,
        client_type: account.client_type,
        primary_contact: {
          ...contact,
          address_text: normalizedAddress || null,
        },
      });

      setFormData({
        account_name: '',
        full_name: '',
        phone: '',
        email: '',
        address_text: '',
        notes: '',
        client_type: 'private',
      });

      onOpenChange(false);
      toast.success('הלקוח נוצר בהצלחה');
    } catch (error) {
      console.error('Error creating account/contact:', error);
      toast.error('שגיאה ביצירת לקוח', {
        description: getDetailedErrorReason(error, 'יצירת הלקוח נכשלה.'),
        duration: 9000,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">הוסף לקוח חדש</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-right">
          <div className="space-y-2">
            <Label htmlFor="account_name">שם לקוח / חברה *</Label>
            <Input
              id="account_name"
              value={formData.account_name}
              onChange={(e) => handleChange('account_name', e.target.value)}
              placeholder="שם הלקוח"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">איש קשר *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleChange('full_name', e.target.value)}
              placeholder="שם איש קשר"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">טלפון</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="050-0000000"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">אימייל</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="email@example.com"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address_text">כתובת</Label>
            <GooglePlacesInput
              id="address_text"
              value={formData.address_text}
              onChangeText={(text) => handleChange('address_text', text)}
              onPlaceSelected={({ addressText }) => handleChange('address_text', addressText)}
              placeholder="הרצל 10, אשדוד"
            />
            <p className="text-xs text-slate-500">פורמט חובה: רחוב ומספר, עיר</p>
          </div>

          <div className="space-y-2">
            <Label>סוג לקוח</Label>
            <Select value={formData.client_type} onValueChange={(value) => handleChange('client_type', value)}>
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
            <Label htmlFor="notes">הערות</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="הערות פנימיות"
            />
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button
            onClick={handleSubmit}
            disabled={saving || !(formData.account_name.trim() || formData.full_name.trim())}
            style={{ backgroundColor: '#00214d' }}
            className="hover:opacity-90"
          >
            {saving ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                יוצר...
              </>
            ) : (
              'צור לקוח'
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
