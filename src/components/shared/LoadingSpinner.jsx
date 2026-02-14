import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ text = 'טוען...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
      <p className="text-slate-500">{text}</p>
    </div>
  );
}