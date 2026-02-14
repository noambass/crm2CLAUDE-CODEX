import React, { useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getHebrewErrorMessage } from '@/lib/errorMessages';

export default function IntegrationsTab() {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void loadConfig();
  }, [user?.id]);

  const loadConfig = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_configs')
        .select('config_data')
        .eq('owner_id', user.id)
        .eq('config_type', 'greeninvoice_api')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      setApiKey(data?.config_data?.api_key || '');
      setApiSecret(data?.config_data?.api_secret || '');
    } catch (error) {
      toast.error(getHebrewErrorMessage(error, 'שגיאה בטעינת הגדרות האינטגרציה.'));
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        owner_id: user.id,
        config_type: 'greeninvoice_api',
        config_data: {
          api_key: apiKey,
          api_secret: apiSecret,
        },
        is_active: true,
      };

      const { error } = await supabase
        .from('app_configs')
        .upsert([payload], { onConflict: 'owner_id,config_type' });

      if (error) throw error;
      toast.success('ההגדרות נשמרו בהצלחה');
    } catch (error) {
      toast.error(getHebrewErrorMessage(error, 'שגיאה בשמירת הגדרות האינטגרציה.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-14 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-lg">חשבונית ירוקה (GreenInvoice)</CardTitle>
              <CardDescription>חיבור למערכת חשבונית ירוקה להנפקת מסמכים מהירה.</CardDescription>
            </div>
            <a
              href="https://app.greeninvoice.co.il/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              ניהול מפתחות API
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="greeninvoice-api-key">מפתח API</Label>
            <Input
              id="greeninvoice-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="הזן את מפתח ה-API"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="greeninvoice-api-secret">סוד API</Label>
            <Input
              id="greeninvoice-api-secret"
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="הזן את סוד ה-API"
              dir="ltr"
            />
          </div>

          <Button onClick={saveConfig} disabled={saving || !apiKey || !apiSecret}>
            {saving ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Save className="ml-1 h-4 w-4" />}
            {saving ? 'שומר...' : 'שמור הגדרות'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/70 shadow-sm">
        <CardContent className="space-y-2 p-4 text-sm text-blue-900">
          <p className="font-semibold">איך זה עובד?</p>
          <ul className="list-inside list-disc space-y-1">
            <li>בסיום עבודה ניתן להפיק מסמך אוטומטי מחשבונית ירוקה.</li>
            <li>פרטי הלקוח והסכום נשלחים בצורה מובנית.</li>
            <li>ההגדרות נשמרות בחשבון שלך בלבד.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
