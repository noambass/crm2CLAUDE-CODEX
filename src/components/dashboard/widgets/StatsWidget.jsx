import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, Clock, CheckCircle2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';

const kpiConfig = [
  {
    key: 'totalAccounts',
    label: 'לקוחות',
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    page: 'Clients',
  },
  {
    key: 'openQuotes',
    label: 'הצעות פתוחות',
    icon: FileText,
    color: 'text-violet-600',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    iconBg: 'bg-violet-100 dark:bg-violet-900/50',
    page: 'Quotes',
  },
  {
    key: 'pendingJobs',
    label: 'עבודות פתוחות',
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    page: 'Jobs',
  },
  {
    key: 'doneJobs',
    label: 'עבודות שבוצעו',
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
    page: 'Jobs',
  },
];

export default function StatsWidget({ data }) {
  const navigate = useNavigate();
  const { stats } = data;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {kpiConfig.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card
            key={kpi.key}
            className={`border-0 shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${kpi.bg}`}
            onClick={() => navigate(createPageUrl(kpi.page))}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`rounded-lg p-2 ${kpi.iconBg}`}>
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{kpi.label}</p>
              <p className={`text-2xl font-bold ${kpi.color}`}>{stats[kpi.key]}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
