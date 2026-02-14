import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Save, Loader2 } from 'lucide-react';
import EmptyState from "@/components/shared/EmptyState";

export default function JobTypesTab() {
  const { user } = useAuth();
  const [jobTypes, setJobTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [newType, setNewType] = useState({ label: '' });

  useEffect(() => {
    if (!user) return;
    loadJobTypes();
  }, [user]);

  const loadJobTypes = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('app_configs')
        .select('config_data')
        .eq('owner_id', user.id)
        .eq('config_type', 'job_types')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data?.config_data?.types) {
        setJobTypes(data.config_data.types);
      }
    } catch (error) {
      console.error('Error loading job types:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveJobTypes = async (updatedTypes) => {
    if (!user) return;
    setSaving(true);
    try {
      const configData = {
        config_type: 'job_types',
        config_data: { types: updatedTypes },
        is_active: true
      };

      const { error } = await supabase
        .from('app_configs')
        .upsert([{ ...configData, owner_id: user.id }], { onConflict: 'owner_id,config_type' });
      if (error) throw error;
      setJobTypes(updatedTypes);
      setNewType({ label: '' });
      setEditingIndex(null);
    } catch (error) {
      console.error('Error saving job types:', error);
    } finally {
      setSaving(false);
    }
  };

  const generateValue = (label) => {
    const timestamp = Date.now();
    return `type_${timestamp}`;
  };

  const addJobType = () => {
    if (newType.label) {
      const typeWithValue = {
        value: generateValue(newType.label),
        label: newType.label
      };
      saveJobTypes([...jobTypes, typeWithValue]);
    }
  };

  const updateJobType = (index, field, value) => {
    const updated = [...jobTypes];
    updated[index] = { ...updated[index], [field]: value };
    setJobTypes(updated);
  };

  const saveEditedType = (index) => {
    saveJobTypes(jobTypes);
    setEditingIndex(null);
  };

  const deleteJobType = (index) => {
    const updated = jobTypes.filter((_, i) => i !== index);
    saveJobTypes(updated);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">ניהול סוגי עבודות</CardTitle>
        <CardDescription>הגדר את סוגי העבודות שאתה מבצע</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {jobTypes.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="אין סוגי עבודות"
            description="הוסף סוגי עבודות להזנה מהירה בעבודות"
          />
        ) : (
          <div className="space-y-3">
            {jobTypes.map((type, index) => (
              <div key={index} className="flex gap-3 p-4 rounded-xl bg-slate-50">
                {editingIndex === index ? (
                  <>
                    <div className="flex-1">
                      <Input
                        value={type.label}
                        onChange={(e) => updateJobType(index, 'label', e.target.value)}
                        placeholder="שם סוג העבודה"
                      />
                    </div>
                    <Button
                      size="icon"
                      onClick={() => saveEditedType(index)}
                      disabled={saving}
                      style={{ backgroundColor: '#00214d' }}
                      className="hover:opacity-90"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{type.label}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingIndex(index)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteJobType(index)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="pt-4 border-t border-slate-200">
          <Label className="mb-3 block">סוג עבודה חדש</Label>
          <div className="flex gap-3">
            <Input
              value={newType.label}
              onChange={(e) => setNewType({ label: e.target.value })}
              placeholder="למשל: ציפוי אמבטיה, תיקון סדק, שיפוץ..."
              className="flex-1"
            />
            <Button
              onClick={addJobType}
              disabled={!newType.label || saving}
              style={{ backgroundColor: '#00214d' }}
              className="hover:opacity-90"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
              הוסף
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
