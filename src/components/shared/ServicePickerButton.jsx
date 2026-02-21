import React, { useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { BookOpen, ChevronDown } from 'lucide-react';

/**
 * A button that opens a popover listing saved services (from job_types config).
 * When a service is selected, `onSelect({ label, unit_price })` is called.
 */
export default function ServicePickerButton({ onSelect }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded || !user) return;
    supabase
      .from('app_configs')
      .select('config_data')
      .eq('owner_id', user.id)
      .eq('config_type', 'job_types')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setServices(data?.config_data?.types || []);
        setLoaded(true);
      });
  }, [open, loaded, user]);

  const handleSelect = (service) => {
    onSelect({
      description: service.label,
      unit_price: service.unit_price ?? 0,
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <BookOpen className="w-4 h-4" />
          הוסף מרשימת שירותים
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2" dir="rtl">
        {!loaded ? (
          <p className="text-sm text-center py-4 text-slate-400">טוען...</p>
        ) : services.length === 0 ? (
          <p className="text-sm text-center py-4 text-slate-400">
            אין שירותים שמורים. הוסף שירותים בהגדרות &gt; סוגי עבודות.
          </p>
        ) : (
          <div className="space-y-1">
            {services.map((service) => (
              <button
                key={service.value}
                type="button"
                onClick={() => handleSelect(service)}
                className="w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-right"
              >
                <span className="font-medium text-slate-800 dark:text-slate-100">{service.label}</span>
                {service.unit_price > 0 && (
                  <span className="text-slate-500 text-xs" dir="ltr">
                    ₪{service.unit_price.toLocaleString('he-IL')}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
