import React, { useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useUiPreferences } from '@/lib/ui/useUiPreferences';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Sun, Moon, Building2, Clock, Percent, Monitor } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_BUSINESS_SETTINGS = {
  business_name: '',
  vat_rate: 17,
  workday_start: '08:00',
  workday_end: '18:00',
};

export default function GeneralSettingsTab() {
  const { user } = useAuth();
  const { preferences, setPreference } = useUiPreferences();
  const [form, setForm] = useState(DEFAULT_BUSINESS_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('app_configs')
        .select('config_data')
        .eq('owner_id', user.id)
        .eq('config_type', 'business_settings')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data?.config_data) {
        setForm({ ...DEFAULT_BUSINESS_SETTINGS, ...data.config_data });
      }
    } catch (err) {
      console.error('Error loading business settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const vatNum = Number(form.vat_rate);
      const payload = {
        ...form,
        vat_rate: isNaN(vatNum) ? 17 : Math.max(0, Math.min(100, vatNum)),
      };
      const { error } = await supabase
        .from('app_configs')
        .upsert([{
          owner_id: user.id,
          config_type: 'business_settings',
          config_data: payload,
          is_active: true,
        }], { onConflict: 'owner_id,config_type' });
      if (error) throw error;
      setForm(payload);
      toast.success('ההגדרות נשמרו בהצלחה');
    } catch (err) {
      console.error('Error saving business settings:', err);
      toast.error('שגיאה בשמירת ההגדרות');
    } finally {
      setSaving(false);
    }
  };

  const isDark = preferences.themeMode === 'dark';
  const isCompact = preferences.densityMode === 'compact';

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Business Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            פרטי העסק
          </CardTitle>
          <CardDescription>מידע בסיסי על העסק שלך</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>שם העסק</Label>
            <Input
              value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              placeholder="לדוגמה: שירותי אינסטלציה בע״מ"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Percent className="w-4 h-4" />
              אחוז מע&quot;מ
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                value={form.vat_rate}
                onChange={(e) => setForm({ ...form, vat_rate: e.target.value })}
                className="w-28"
                dir="ltr"
              />
              <span className="text-slate-500 text-sm">%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Working Hours */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            שעות עבודה
          </CardTitle>
          <CardDescription>שעות פעילות ברירת מחדל לתזמון עבודות</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-6 flex-wrap">
            <div className="space-y-2">
              <Label>תחילת יום עבודה</Label>
              <Input
                type="time"
                value={form.workday_start}
                onChange={(e) => setForm({ ...form, workday_start: e.target.value })}
                className="w-36"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>סיום יום עבודה</Label>
              <Input
                type="time"
                value={form.workday_end}
                onChange={(e) => setForm({ ...form, workday_end: e.target.value })}
                className="w-36"
                dir="ltr"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Display Preferences */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            העדפות תצוגה
          </CardTitle>
          <CardDescription>התאם את מראה המערכת לפי העדפותיך</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Theme */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">ערכת נושא</p>
              <p className="text-sm text-slate-500">מצב בהיר או כהה</p>
            </div>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
              <button
                onClick={() => setPreference('themeMode', 'light')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                  !isDark
                    ? 'bg-slate-800 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Sun className="w-4 h-4" />
                בהיר
              </button>
              <button
                onClick={() => setPreference('themeMode', 'dark')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                  isDark
                    ? 'bg-slate-800 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Moon className="w-4 h-4" />
                כהה
              </button>
            </div>
          </div>

          {/* Density */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">צפיפות תצוגה</p>
              <p className="text-sm text-slate-500">כמות המידע המוצגת במסך</p>
            </div>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
              <button
                onClick={() => setPreference('densityMode', 'comfortable')}
                className={`px-3 py-2 text-sm transition-colors ${
                  !isCompact
                    ? 'bg-slate-800 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                מרווח
              </button>
              <button
                onClick={() => setPreference('densityMode', 'compact')}
                className={`px-3 py-2 text-sm transition-colors ${
                  isCompact
                    ? 'bg-slate-800 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                צפוף
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={saveSettings}
        disabled={saving}
        style={{ backgroundColor: '#00214d' }}
        className="hover:opacity-90"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />}
        שמור הגדרות
      </Button>
    </div>
  );
}
