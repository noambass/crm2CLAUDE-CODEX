import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, X, Briefcase, Users, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

const actions = [
  { key: 'client', label: 'לקוח חדש', page: 'ClientForm', icon: Users },
  { key: 'quote', label: 'הצעה חדשה', page: 'QuoteForm', icon: FileText },
  { key: 'job', label: 'עבודה חדשה', page: 'JobForm', icon: Briefcase },
];

export default function FloatingActionButton() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 lg:hidden">
      {isOpen ? (
        <div className="mb-3 flex flex-col gap-2">
          {actions.map((action) => (
            <Button
              key={action.key}
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate(createPageUrl(action.page));
              }}
              className="h-11 justify-start gap-2 rounded-full bg-white px-4 text-slate-700 shadow-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <action.icon className="h-4 w-4" />
              <span className="text-xs font-medium">{action.label}</span>
            </Button>
          ))}
        </div>
      ) : null}

      <Button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-14 w-14 rounded-full bg-[#00214d] text-white shadow-xl transition hover:opacity-90"
        aria-label="פעולות יצירה מהירות"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </Button>
    </div>
  );
}
