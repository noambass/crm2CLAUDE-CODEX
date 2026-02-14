import React from 'react';
import { Badge } from "@/components/ui/badge";

const jobStatusConfig = {
  new: { label: 'חדש', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  scheduled: { label: 'מתוזמן', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  in_progress: { label: 'בביצוע', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  on_the_way: { label: 'בדרך', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  completed: { label: 'הושלם', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'בוטל', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  pending_payment: { label: 'ממתין לתשלום', color: 'bg-orange-100 text-orange-700 border-orange-200' },
};

const priorityConfig = {
  low: { label: 'נמוכה', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  medium: { label: 'בינונית', color: 'bg-blue-100 text-blue-600 border-blue-200' },
  high: { label: 'גבוהה', color: 'bg-orange-100 text-orange-600 border-orange-200' },
  urgent: { label: 'דחוף', color: 'bg-red-100 text-red-600 border-red-200' },
};

const invoiceStatusConfig = {
  not_created: { label: 'לא נוצרה', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  created: { label: 'נוצרה', color: 'bg-blue-100 text-blue-600 border-blue-200' },
  sent: { label: 'נשלחה', color: 'bg-purple-100 text-purple-600 border-purple-200' },
  paid: { label: 'שולמה', color: 'bg-emerald-100 text-emerald-600 border-emerald-200' },
};

export function JobStatusBadge({ status }) {
  const config = jobStatusConfig[status] || jobStatusConfig.new;
  return (
    <Badge variant="outline" className={`${config.color} border font-medium`}>
      {config.label}
    </Badge>
  );
}

export function PriorityBadge({ priority }) {
  const normalized = String(priority || '').toLowerCase();
  if (!normalized || normalized === 'normal' || normalized === 'not_urgent') {
    return null;
  }
  const config = priorityConfig[priority] || priorityConfig.medium;
  return (
    <Badge variant="outline" className={`${config.color} border font-medium`}>
      {config.label}
    </Badge>
  );
}

export function InvoiceStatusBadge({ status }) {
  const config = invoiceStatusConfig[status] || invoiceStatusConfig.not_created;
  return (
    <Badge variant="outline" className={`${config.color} border font-medium`}>
      {config.label}
    </Badge>
  );
}

export function ClientTypeBadge({ type }) {
  const config = type === 'business' 
    ? { label: 'עסקי', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' }
    : { label: 'פרטי', color: 'bg-teal-100 text-teal-700 border-teal-200' };
  return (
    <Badge variant="outline" className={`${config.color} border font-medium`}>
      {config.label}
    </Badge>
  );
}
