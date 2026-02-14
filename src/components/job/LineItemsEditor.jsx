import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, FileText } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

export default function LineItemsEditor({ items = [], onChange, vatRate = 0.18 }) {
  const { user } = useAuth();
  const [jobTypes, setJobTypes] = useState([]);
  const [lineItems, setLineItems] = useState(items.length > 0 ? items.map(item => {
    // הסר את שדה vat_type אם קיים
    const { vat_type, ...rest } = item;
    return { ...rest, description: item.description || '', quantity: item.quantity || 1, price: item.price || 0 };
  }) : [{
    description: '',
    quantity: 1,
    price: 0
  }]);

  useEffect(() => {
    if (!user) {
      setJobTypes([]);
      return;
    }
    loadJobTypes();
  }, [user]);

  useEffect(() => {
    onChange(lineItems);
  }, [lineItems]);

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
    }
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      description: '',
      quantity: 1,
      price: 0
    }]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index, field, value) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const getTotalBeforeVat = () => {
   return lineItems.reduce((sum, item) => {
     const quantity = parseFloat(item.quantity) || 0;
     const price = parseFloat(item.price) || 0;
     return sum + (quantity * price);
   }, 0);
  };

  const getTotalPrice = () => {
    return getTotalBeforeVat() * (1 + (Number(vatRate) || 0));
  };

  return (
    <div className="space-y-4">
      {lineItems.map((item, index) => (
        <Card key={index} className="border-slate-200">
          <CardContent className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-slate-700">פריט {index + 1}</h4>
              {lineItems.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLineItem(index)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="space-y-2">
               <Label>תיאור השירות/מוצר *</Label>
               {jobTypes.length > 0 ? (
                 <Select value={item.description} onValueChange={(value) => updateLineItem(index, 'description', value)}>
                   <SelectTrigger>
                     <SelectValue placeholder="בחר סוג עבודה..." />
                   </SelectTrigger>
                   <SelectContent>
                     {jobTypes.map((type) => (
                       <SelectItem key={type.value} value={type.value}>
                         {type.label}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               ) : (
                 <Input
                   value={item.description}
                   onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                   placeholder="למשל: ציפוי אמבטיה מלאה, תיקון סדק באמייל..."
                 />
               )}
             </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>כמות</Label>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                  min="1"
                  step="1"
                />
              </div>

              <div className="space-y-2">
                <Label>מחיר ליחידה (₪)</Label>
                <Input
                  type="number"
                  value={item.price}
                  onChange={(e) => updateLineItem(index, 'price', e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">לפני מע"מ:</span>
                <span className="text-slate-700">₪{((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">עם מע"מ ({Math.round((Number(vatRate) || 0) * 100)}%):</span>
                <span className="font-semibold text-slate-800">₪{(((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)) * (1 + (Number(vatRate) || 0))).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addLineItem}
        className="w-full border-dashed"
      >
        <Plus className="w-4 h-4 ml-2" />
        הוסף פריט נוסף
      </Button>

      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">סכום לפני מע"מ:</span>
          <span className="font-semibold text-slate-800">₪{getTotalBeforeVat().toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-emerald-300">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
          <span className="font-semibold text-slate-800">סה"כ כולל מע"מ {Math.round((Number(vatRate) || 0) * 100)}%:</span>
          </div>
          <span className="text-2xl font-bold text-emerald-600">
            ₪{getTotalPrice().toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
