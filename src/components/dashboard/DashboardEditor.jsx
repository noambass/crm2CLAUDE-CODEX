import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Settings } from 'lucide-react';

const AVAILABLE_WIDGETS = [
  { id: 'stats', label: 'סטטיסטיקות קיימות', description: 'סטטוס כלל העבודות והלקוחות' },
  { id: 'today_jobs', label: 'עבודות להיום', description: 'עבודות המתוזמנות היום' },
  { id: 'weekly_calendar', label: 'לוח שנה שבועי', description: 'תצוגת לוח שנה לשבוע הקרוב' },
  { id: 'recent_jobs', label: 'עבודות אחרונות', description: 'עבודות שנוצרו לאחרונה' },
  { id: 'unscheduled_jobs', label: 'עבודות שטרם תוזמנו', description: 'עבודות ללא תאריך תזמון' },
  { id: 'job_stats_chart', label: 'גרף סטטיסטיקות עבודות', description: 'גרף התפלגות עבודות לפי סטטוס' },
];

export default function DashboardEditor({ open, onOpenChange, activeWidgets, onWidgetsChange }) {
  const [selectedWidgets, setSelectedWidgets] = useState(new Set(activeWidgets));

  const handleToggleWidget = (widgetId) => {
    const updated = new Set(selectedWidgets);
    if (updated.has(widgetId)) {
      updated.delete(widgetId);
    } else {
      updated.add(widgetId);
    }
    setSelectedWidgets(updated);
  };

  const handleSave = () => {
    onWidgetsChange(Array.from(selectedWidgets));
    onOpenChange(false);
  };

  const handleReset = () => {
    setSelectedWidgets(new Set(['stats', 'today_jobs', 'weekly_calendar', 'unscheduled_jobs']));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            עריכת הדשבורד
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-600 mb-4">בחר אילו אלמנטים להציג בדשבורד:</p>
            <div className="space-y-3">
              {AVAILABLE_WIDGETS.map((widget) => (
                <div key={widget.id} className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <Checkbox
                    id={widget.id}
                    checked={selectedWidgets.has(widget.id)}
                    onCheckedChange={() => handleToggleWidget(widget.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor={widget.id} className="font-medium text-slate-800 cursor-pointer">
                      {widget.label}
                    </Label>
                    <p className="text-sm text-slate-500 mt-1">{widget.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row-reverse gap-2 pt-4">
          <Button onClick={handleSave} style={{ backgroundColor: '#00214d' }} className="hover:opacity-90">
            שמור שינויים
          </Button>
          <Button variant="outline" onClick={handleReset}>
            אפס לברירת מחדל
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
