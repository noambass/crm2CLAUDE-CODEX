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
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="סגור פעולות מהירות"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[55] bg-slate-900/20 backdrop-blur-[1px] lg:hidden"
        />
      ) : null}

      <div className="fixed bottom-[calc(5.2rem+env(safe-area-inset-bottom))] right-4 z-[60] lg:hidden">
        {isOpen ? (
          <div className="mb-3 flex flex-col items-end gap-2">
            {actions.map((action) => (
              <Button
                key={action.key}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate(createPageUrl(action.page));
                }}
                className="h-11 justify-start gap-2 rounded-full border border-slate-200 bg-white px-4 text-slate-700 shadow-lg hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <action.icon className="h-4 w-4" />
                <span className="text-xs font-semibold">{action.label}</span>
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
    </>
  );
}
