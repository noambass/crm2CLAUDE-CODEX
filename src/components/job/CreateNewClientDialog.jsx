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
import { Loader2 } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';
import { getDetailedErrorReason } from '@/lib/errorMessages';

export default function CreateNewClientDialog({ open, onOpenChange, onClientCreated }) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    account_name: '',
    full_name: '',
    phone: '',
    email: '',
    address_text: '',
    notes: '',
  });

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    const accountName = formData.account_name.trim() || formData.full_name.trim();
    const fullName = formData.full_name.trim() || accountName;

    if (!accountName || !fullName) {
      toast.error('חובה להזין שם לקוח');
      return;
    }

    setSaving(true);
    try {
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .insert([{
          account_name: accountName,
          notes: formData.notes.trim() || null,
        }])
        .select('id, account_name')
        .single();
      if (accountError) throw accountError;

      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .insert([{
          account_id: account.id,
          full_name: fullName,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          address_text: formData.address_text.trim() || null,
          is_primary: true,
        }])
        .select('id, full_name, phone, email, address_text')
        .single();
      if (contactError) throw contactError;

      onClientCreated({
        id: account.id,
        account_name: account.account_name,
        primary_contact: contact,
      });

      setFormData({
        account_name: '',
        full_name: '',
        phone: '',
        email: '',
        address_text: '',
        notes: '',
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
            <Input
              id="address_text"
              value={formData.address_text}
              onChange={(e) => handleChange('address_text', e.target.value)}
              placeholder="רחוב, עיר"
            />
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
