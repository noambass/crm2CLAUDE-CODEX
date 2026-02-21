import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { testConnection } from '@/lib/greeninvoice/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ExternalLink,
  Loader2,
  Save,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Bot,
  MessageSquare,
  FileText,
  Sparkles,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { getHebrewErrorMessage } from '@/lib/errorMessages';

// ─── Integration definitions ─────────────────────────────────────────────────

const INTEGRATIONS = [
  {
    id: 'greeninvoice_api',
    name: 'חשבונית ירוקה',
    description: 'הנפקת חשבוניות ומסמכים כספיים ישירות מהמערכת',
    Icon: FileText,
    iconBg: 'bg-emerald-100 dark:bg-emerald-950',
    iconColor: 'text-emerald-700 dark:text-emerald-400',
    docsUrl: 'https://app.greeninvoice.co.il/settings/api',
    docsLabel: 'ניהול מפתחות API',
    fields: [
      { key: 'api_key', label: 'מפתח API', type: 'password', placeholder: 'הזן את מפתח ה-API' },
      { key: 'api_secret', label: 'סוד API', type: 'password', placeholder: 'הזן את סוד ה-API' },
    ],
    hasTest: true,
    comingSoon: false,
  },
  {
    id: 'openai_api',
    name: 'OpenAI — AI צ׳אט',
    description: 'עוזר AI לשירות לקוחות, יצירת לידים ושאלות בעברית',
    Icon: Bot,
    iconBg: 'bg-violet-100 dark:bg-violet-950',
    iconColor: 'text-violet-700 dark:text-violet-400',
    docsUrl: 'https://platform.openai.com/api-keys',
    docsLabel: 'לוח הבקרה של OpenAI',
    fields: [
      { key: 'api_key', label: 'מפתח API', type: 'password', placeholder: 'sk-...' },
    ],
    hasTest: false,
    comingSoon: false,
  },
  {
    id: 'anthropic_api',
    name: 'Anthropic Claude — BI',
    description: 'ניתוח נתוני CRM חכם: שאלות בעברית → תובנות עסקיות',
    Icon: Sparkles,
    iconBg: 'bg-orange-100 dark:bg-orange-950',
    iconColor: 'text-orange-700 dark:text-orange-400',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    docsLabel: 'לוח הבקרה של Anthropic',
    fields: [
      { key: 'api_key', label: 'מפתח API', type: 'password', placeholder: 'sk-ant-...' },
    ],
    hasTest: false,
    comingSoon: false,
  },
  {
    id: 'whatsapp_api',
    name: 'WhatsApp Business',
    description: 'קבלת פניות לקוחות ישירות מ-WhatsApp למערכת ה-CRM',
    Icon: MessageSquare,
    iconBg: 'bg-green-100 dark:bg-green-950',
    iconColor: 'text-green-700 dark:text-green-400',
    docsUrl: null,
    docsLabel: null,
    fields: [
      { key: 'verify_token', label: 'Verify Token', type: 'password', placeholder: 'הזן verify token' },
      { key: 'phone_number_id', label: 'Phone Number ID', type: 'text', placeholder: '10000000000', dir: 'ltr' },
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'EAAxxxxxxx' },
    ],
    hasTest: false,
    comingSoon: true,
  },
];

// ─── Single integration card ──────────────────────────────────────────────────

function IntegrationCard({ integration, initialData, user }) {
  const { id, name, description, Icon, iconBg, iconColor, docsUrl, docsLabel, fields, hasTest, comingSoon } = integration;

  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => {
    const defaults = {};
    fields.forEach((f) => { defaults[f.key] = ''; });
    return defaults;
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success, message }

  // Populate form from DB data
  useEffect(() => {
    if (initialData) {
      const loaded = {};
      fields.forEach((f) => { loaded[f.key] = initialData[f.key] || ''; });
      setValues(loaded);
    }
  }, [initialData]);

  const isConfigured = fields.every((f) => !!(initialData?.[f.key]));

  const handleChange = useCallback((key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        owner_id: user.id,
        config_type: id,
        config_data: { ...values },
        is_active: true,
      };
      const { error } = await supabase
        .from('app_configs')
        .upsert([payload], { onConflict: 'owner_id,config_type' });
      if (error) throw error;
      toast.success(`הגדרות ${name} נשמרו בהצלחה`);
    } catch (err) {
      toast.error(getHebrewErrorMessage(err, 'שגיאה בשמירת ההגדרות.'));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (id !== 'greeninvoice_api') return;
    if (!values.api_key || !values.api_secret) {
      toast.error('יש להזין מפתח API וסוד לפני בדיקת חיבור');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(values.api_key, values.api_secret);
      setTestResult(result);
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
    } catch (err) {
      const fail = { success: false, message: err.message || 'שגיאת חיבור' };
      setTestResult(fail);
      toast.error(fail.message);
    } finally {
      setTesting(false);
    }
  };

  const canSave = fields.every((f) => !!values[f.key]) && !comingSoon;

  return (
    <Card className="border-border/70 shadow-sm overflow-hidden">
      {/* Card header — always visible */}
      <CardHeader className="p-4">
        <div className="flex items-center gap-3">
          {/* Integration icon */}
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>

          {/* Name + description */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-100">{name}</span>
              {comingSoon ? (
                <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-500 text-xs">
                  <Lock className="ml-1 h-3 w-3" />
                  בקרוב
                </Badge>
              ) : isConfigured ? (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-xs">
                  <CheckCircle2 className="ml-1 h-3 w-3" />
                  מחובר
                </Badge>
              ) : (
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500 text-xs">
                  לא מוגדר
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400 truncate">{description}</p>
          </div>

          {/* Toggle button */}
          <Button
            variant="outline"
            size="sm"
            className="flex-shrink-0 gap-1.5 text-sm"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? (
              <>סגור <ChevronUp className="h-3.5 w-3.5" /></>
            ) : (
              <>הגדרות <ChevronDown className="h-3.5 w-3.5" /></>
            )}
          </Button>
        </div>
      </CardHeader>

      {/* Collapsible settings form */}
      {open && (
        <CardContent className="border-t border-border/50 bg-slate-50/50 dark:bg-slate-900/30 p-4 space-y-4">
          {comingSoon && (
            <div className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              אינטגרציה זו תהיה זמינה בקרוב. ניתן למלא את הפרטים מראש.
            </div>
          )}

          {/* Dynamic fields */}
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`${id}-${field.key}`}>{field.label}</Label>
              <Input
                id={`${id}-${field.key}`}
                type={field.type}
                value={values[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                dir={field.dir || 'ltr'}
                disabled={comingSoon}
              />
            </div>
          ))}

          {/* Test connection result */}
          {testResult && (
            <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
              testResult.success
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200'
            }`}>
              {testResult.success
                ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                : <XCircle className="h-4 w-4 flex-shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Docs link */}
          {docsUrl && (
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {docsLabel}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              onClick={handleSave}
              disabled={saving || !canSave}
              size="sm"
            >
              {saving ? <Loader2 className="ml-1.5 h-4 w-4 animate-spin" /> : <Save className="ml-1.5 h-4 w-4" />}
              {saving ? 'שומר...' : 'שמור הגדרות'}
            </Button>

            {hasTest && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing || !values.api_key || !values.api_secret}
              >
                {testing ? (
                  <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />
                ) : testResult?.success ? (
                  <Wifi className="ml-1.5 h-4 w-4 text-emerald-600" />
                ) : (
                  <WifiOff className="ml-1.5 h-4 w-4" />
                )}
                {testing ? 'בודק...' : 'בדוק חיבור'}
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main tab component ───────────────────────────────────────────────────────

export default function IntegrationsTab() {
  const { user } = useAuth();
  const [configMap, setConfigMap] = useState({}); // { [config_type]: config_data }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void loadConfigs();
  }, [user?.id]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const configTypes = INTEGRATIONS.map((i) => i.id);
      const { data, error } = await supabase
        .from('app_configs')
        .select('config_type, config_data')
        .eq('owner_id', user.id)
        .in('config_type', configTypes);
      if (error) throw error;

      const map = {};
      (data || []).forEach((row) => { map[row.config_type] = row.config_data; });
      setConfigMap(map);
    } catch (err) {
      toast.error(getHebrewErrorMessage(err, 'שגיאה בטעינת הגדרות האינטגרציות.'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-14">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const configuredCount = INTEGRATIONS.filter(
    (i) => !i.comingSoon && i.fields.every((f) => !!(configMap[i.id]?.[f.key]))
  ).length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          חיבורים פעילים
        </span>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {configuredCount} / {INTEGRATIONS.filter((i) => !i.comingSoon).length}
        </span>
      </div>

      {/* Integration cards */}
      {INTEGRATIONS.map((integration) => (
        <IntegrationCard
          key={integration.id}
          integration={integration}
          initialData={configMap[integration.id] || null}
          user={user}
        />
      ))}
    </div>
  );
}
