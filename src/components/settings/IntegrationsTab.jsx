import React, { useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { testConnection } from '@/lib/greeninvoice/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, Loader2, Save, Wifi, WifiOff, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getHebrewErrorMessage } from '@/lib/errorMessages';

export default function IntegrationsTab() {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionResult, setConnectionResult] = useState(null); // { success, message }

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
    setConnectionResult(null);
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

  const handleTestConnection = async () => {
    if (!apiKey || !apiSecret) {
      toast.error('יש להזין מפתח API וסוד לפני בדיקת חיבור');
      return;
    }
    setTesting(true);
    setConnectionResult(null);
    try {
      const result = await testConnection(apiKey, apiSecret);
      setConnectionResult(result);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      const failResult = { success: false, message: err.message || 'שגיאת חיבור' };
      setConnectionResult(failResult);
      toast.error(failResult.message);
    } finally {
      setTesting(false);
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
              onChange={(e) => {
                setApiKey(e.target.value);
                setConnectionResult(null);
              }}
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
              onChange={(e) => {
                setApiSecret(e.target.value);
                setConnectionResult(null);
              }}
              placeholder="הזן את סוד ה-API"
              dir="ltr"
            />
          </div>

          {/* Connection test result */}
          {connectionResult && (
            <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
              connectionResult.success
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200'
            }`}>
              {connectionResult.success ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 flex-shrink-0" />
              )}
              <span>{connectionResult.message}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveConfig} disabled={saving || !apiKey || !apiSecret}>
              {saving ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Save className="ml-1 h-4 w-4" />}
              {saving ? 'שומר...' : 'שמור הגדרות'}
            </Button>

            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !apiKey || !apiSecret}
            >
              {testing ? (
                <Loader2 className="ml-1 h-4 w-4 animate-spin" />
              ) : connectionResult?.success ? (
                <Wifi className="ml-1 h-4 w-4 text-emerald-600" />
              ) : (
                <WifiOff className="ml-1 h-4 w-4" />
              )}
              {testing ? 'בודק חיבור...' : 'בדוק חיבור'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/70 shadow-sm">
        <CardContent className="space-y-2 p-4 text-sm text-blue-900">
          <p className="font-semibold">איך זה עובד?</p>
          <ul className="list-inside list-disc space-y-1">
            <li>בסיום עבודה ניתן להפיק מסמך אוטומטי מחשבונית ירוקה.</li>
            <li>ניתן לבחור סוג מסמך: חשבונית מס, חשבונית מס/קבלה, הצעת מחיר ועוד.</li>
            <li>ניתן ליצור כטיוטה לבדיקה או כמסמך סופי עם מספר רשמי.</li>
            <li>סנכרון סטטוס אוטומטי מחשבונית ירוקה לתוך המערכת.</li>
            <li>סגירת טיוטה (הנפקה) ישירות מדף העבודה.</li>
            <li>פרטי הלקוח והסכום נשלחים בצורה מובנית.</li>
            <li>ההגדרות נשמרות בחשבון שלך בלבד.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
