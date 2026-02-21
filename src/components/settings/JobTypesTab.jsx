import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Save, Loader2, X } from 'lucide-react';
import EmptyState from "@/components/shared/EmptyState";

export default function JobTypesTab() {
  const { user } = useAuth();
  const [jobTypes, setJobTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [newType, setNewType] = useState({ label: '', unit_price: '' });

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
      const { error } = await supabase
        .from('app_configs')
        .upsert([{
          owner_id: user.id,
          config_type: 'job_types',
          config_data: { types: updatedTypes },
          is_active: true,
        }], { onConflict: 'owner_id,config_type' });
      if (error) throw error;
      setJobTypes(updatedTypes);
      setNewType({ label: '', unit_price: '' });
      setEditingIndex(null);
    } catch (error) {
      console.error('Error saving job types:', error);
    } finally {
      setSaving(false);
    }
  };

  const addJobType = () => {
    if (!newType.label.trim()) return;
    const typeWithValue = {
      value: `type_${Date.now()}`,
      label: newType.label.trim(),
      unit_price: newType.unit_price !== '' ? parseFloat(newType.unit_price) || 0 : 0,
    };
    saveJobTypes([...jobTypes, typeWithValue]);
  };

  const updateJobType = (index, field, value) => {
    const updated = [...jobTypes];
    updated[index] = { ...updated[index], [field]: value };
    setJobTypes(updated);
  };

  const saveEditedType = (index) => {
    const updated = [...jobTypes];
    updated[index] = {
      ...updated[index],
      unit_price: parseFloat(updated[index].unit_price) || 0,
    };
    saveJobTypes(updated);
  };

  const deleteJobType = (index) => {
    saveJobTypes(jobTypes.filter((_, i) => i !== index));
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
        <CardTitle className="text-lg">שירותים שמורים</CardTitle>
        <CardDescription>
          הגדר שירותים עם מחיר — ניתן לבחור אותם בעת יצירת עבודה או הצעת מחיר
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {jobTypes.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="אין שירותים שמורים"
            description="הוסף שירותים כדי לבחור מהם בעת יצירת עבודה"
          />
        ) : (
          <div className="space-y-3">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_100px_auto] gap-2 px-4 text-xs text-slate-500">
              <span>שם השירות</span>
              <span className="text-center">מחיר יחידה (₪)</span>
              <span />
            </div>

            {jobTypes.map((type, index) => (
              <div key={index} className="grid grid-cols-[1fr_100px_auto] gap-2 items-center p-3 rounded-xl bg-slate-50">
                {editingIndex === index ? (
                  <>
                    <Input
                      value={type.label}
                      onChange={(e) => updateJobType(index, 'label', e.target.value)}
                      placeholder="שם השירות"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={type.unit_price ?? ''}
                      onChange={(e) => updateJobType(index, 'unit_price', e.target.value)}
                      placeholder="0"
                      dir="ltr"
                      className="text-center"
                    />
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        onClick={() => saveEditedType(index)}
                        disabled={saving}
                        style={{ backgroundColor: '#00214d' }}
                        className="hover:opacity-90"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingIndex(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-slate-800">{type.label}</p>
                    <p className="text-center text-slate-600 text-sm" dir="ltr">
                      {type.unit_price > 0 ? `₪${type.unit_price.toLocaleString('he-IL')}` : '—'}
                    </p>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditingIndex(index)}>
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
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new service */}
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <Label className="block">שירות חדש</Label>
          <div className="grid grid-cols-[1fr_100px_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">שם השירות</Label>
              <Input
                value={newType.label}
                onChange={(e) => setNewType({ ...newType, label: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && addJobType()}
                placeholder="למשל: ציפוי אמבטיה, תיקון סדק..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">מחיר (₪)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newType.unit_price}
                onChange={(e) => setNewType({ ...newType, unit_price: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && addJobType()}
                placeholder="0"
                dir="ltr"
                className="text-center"
              />
            </div>
            <Button
              onClick={addJobType}
              disabled={!newType.label.trim() || saving}
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
