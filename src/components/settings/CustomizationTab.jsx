import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import {
  Plus, Edit, Trash2, Save, Loader2, Palette, Tag, Lock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Built-in statuses shown read-only in the UI (by config_type)
const BUILTIN_STATUSES = {
  job_statuses: [
    { value: 'waiting_schedule', label: 'ממתין לתזמון', color: '#f59e0b' },
    { value: 'waiting_execution', label: 'מתוזמן',       color: '#0284c7' },
    { value: 'done',             label: 'בוצע',           color: '#10b981' },
  ],
  job_priorities: [],
  client_statuses_private: [],
  client_statuses_company: [],
  client_statuses_customer_service: [],
  invoice_statuses: [],
};

export default function CustomizationTab({ configs, setConfigs }) {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [statusForm, setStatusForm] = useState({ value: '', label: '', color: '#10b981' });
  const [saving, setSaving] = useState(false);

  const getConfig = (type) => configs.find(c => c.config_type === type);

  const generateValue = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `custom_${timestamp}_${random}`;
  };

  const openDialog = (type, status = null) => {
    setEditingType(type);
    if (status) {
      setStatusForm(status);
    } else {
      setStatusForm({ value: '', label: '', color: '#10b981', isNew: true });
    }
    setDialogOpen(true);
  };

  const saveStatus = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const config = getConfig(editingType);
      let newData = [];
      
      // Generate value automatically if it's a new status
      const finalStatusForm = {
        ...statusForm,
        value: statusForm.isNew ? generateValue() : statusForm.value
      };
      delete finalStatusForm.isNew;

      if (config) {
        const existingStatuses = config.config_data.statuses || [];
        const existingIndex = existingStatuses.findIndex(s => s.value === finalStatusForm.value);
        
        if (existingIndex >= 0) {
          // Edit existing
          newData = existingStatuses.map((s, i) => i === existingIndex ? finalStatusForm : s);
        } else {
          // Add new
          newData = [...existingStatuses, finalStatusForm];
        }

        const { error } = await supabase
          .from('app_configs')
          .update({ config_data: { statuses: newData } })
          .eq('id', config.id)
          .eq('owner_id', user.id);
        if (error) throw error;
        setConfigs(configs.map(c => 
          c.id === config.id ? { ...c, config_data: { statuses: newData } } : c
        ));
      } else {
        // Create new config
        newData = [finalStatusForm];
        const { data: newConfig, error } = await supabase
          .from('app_configs')
          .insert([{
            owner_id: user.id,
            config_type: editingType,
            config_data: { statuses: newData },
            is_active: true
          }])
          .select('*')
          .single();
        if (error) throw error;
        setConfigs([...configs, newConfig]);
      }

      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving status:', error);
    } finally {
      setSaving(false);
    }
  };

  const deleteStatus = async (type, value) => {
    try {
      if (!user) return;
      const config = getConfig(type);
      if (!config) return;

      const existingStatuses = config.config_data.statuses || [];
      const newData = existingStatuses.filter(s => s.value !== value);

      const { error } = await supabase
        .from('app_configs')
        .update({ config_data: { statuses: newData } })
        .eq('id', config.id)
        .eq('owner_id', user.id);
      if (error) throw error;
      setConfigs(configs.map(c => 
        c.id === config.id ? { ...c, config_data: { statuses: newData } } : c
      ));
    } catch (error) {
      console.error('Error deleting status:', error);
    }
  };

  const renderStatusList = (type, title, description) => {
    const config = getConfig(type);
    const customStatuses = config?.config_data?.statuses || [];
    const builtinStatuses = BUILTIN_STATUSES[type] || [];

    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button
            onClick={() => openDialog(type)}
            style={{ backgroundColor: '#00214d' }}
            className="hover:opacity-90"
            size="sm"
          >
            <Plus className="w-4 h-4 ml-2" />
            הוסף
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Built-in statuses (read-only) */}
            {builtinStatuses.map((status) => (
              <div
                key={status.value}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 opacity-75"
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: status.color }}
                />
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{status.label}</p>
                </div>
                <Badge
                  variant="outline"
                  style={{
                    backgroundColor: `${status.color}20`,
                    color: status.color,
                    borderColor: status.color,
                  }}
                >
                  {status.label}
                </Badge>
                <Badge variant="outline" className="text-xs text-slate-500 border-slate-200 bg-slate-100 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  מובנה
                </Badge>
              </div>
            ))}

            {/* Custom statuses */}
            {customStatuses.length === 0 && builtinStatuses.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Tag className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>עדיין לא הוספו סטטוסים מותאמים אישית</p>
              </div>
            ) : customStatuses.length === 0 ? (
              <p className="text-center py-4 text-sm text-slate-400">לחץ &quot;הוסף&quot; להוספת סטטוס מותאם אישית</p>
            ) : (
              customStatuses.map((status) => (
                <div
                  key={status.value}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: status.color }}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{status.label}</p>
                  </div>
                  <Badge
                    variant="outline"
                    style={{
                      backgroundColor: `${status.color}20`,
                      color: status.color,
                      borderColor: status.color,
                    }}
                  >
                    {status.label}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openDialog(type, status)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteStatus(type, status.value)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {renderStatusList('job_statuses', 'סטטוסים של עבודות', 'הגדר סטטוסים מותאמים אישית לעבודות')}
        {renderStatusList('job_priorities', 'עדיפויות עבודות', 'הגדר רמות עדיפות מותאמות אישית')}
        {renderStatusList('client_statuses_private', 'סטטוסים של לקוחות פרטיים', 'הגדר סטטוסים מותאמים אישית ללקוחות פרטיים')}
        {renderStatusList('client_statuses_company', 'סטטוסים של לקוחות חברות', 'הגדר סטטוסים מותאמים אישית ללקוחות חברות')}
        {renderStatusList('client_statuses_customer_service', 'סטטוסים של שירות לקוחות', 'הגדר סטטוסים מותאמים אישית לשירות לקוחות')}
        {renderStatusList('invoice_statuses', 'סטטוסים של חשבוניות', 'הגדר סטטוסים מותאמים אישית לחשבוניות')}

        {/* Info Card */}
        <Card className="border-0 shadow-sm bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="w-5 h-5 text-blue-600" />
              איך זה עובד?
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-700 space-y-2">
            <p>• הוסף סטטוסים מותאמים אישית עם צבעים ותיאורים משלך</p>
            <p>• הסטטוסים החדשים יופיעו בכל מקום במערכת</p>
            <p>• ניתן לערוך או למחוק סטטוסים בכל זמן</p>
            <p>• הצבעים עוזרים לזהות במהירות את מצב העבודות והלקוחות</p>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {statusForm.value ? 'עריכת סטטוס' : 'סטטוס חדש'}
            </DialogTitle>
            <DialogDescription>
              הגדר את הסטטוס המותאם אישית
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>שם הסטטוס *</Label>
              <Input
                value={statusForm.label}
                onChange={(e) => setStatusForm({ ...statusForm, label: e.target.value })}
                placeholder="סטטוס חדש"
              />
            </div>
            <div className="space-y-2">
              <Label>צבע</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={statusForm.color}
                  onChange={(e) => setStatusForm({ ...statusForm, color: e.target.value })}
                  className="w-20 h-10"
                />
                <Badge 
                  variant="outline"
                  className="flex-1 justify-center py-2"
                  style={{ 
                    backgroundColor: `${statusForm.color}20`,
                    color: statusForm.color,
                    borderColor: statusForm.color
                  }}
                >
                  {statusForm.label || 'תצוגה מקדימה'}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button 
              onClick={saveStatus} 
              disabled={saving || !statusForm.label}
              style={{ backgroundColor: '#00214d' }}
              className="hover:opacity-90"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />}
              שמור
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
