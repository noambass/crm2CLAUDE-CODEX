import React from 'react';
import { PieChart as PieChartIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const STATUS_CONFIG = {
  quote: { label: 'הצעת מחיר', color: '#8b5cf6' },
  waiting_schedule: { label: 'ממתין לתזמון', color: '#f59e0b' },
  waiting_execution: { label: 'ממתין לביצוע', color: '#3b82f6' },
  done: { label: 'בוצע', color: '#10b981' },
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-md dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{payload[0].name}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">{payload[0].value} עבודות</p>
    </div>
  );
};

export default function JobStatsChartWidget({ data }) {
  const { allJobs } = data;

  const statusCounts = {};
  (allJobs || []).forEach((job) => {
    const status = job.status || 'quote';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const chartData = Object.entries(statusCounts).map(([status, count]) => ({
    name: STATUS_CONFIG[status]?.label || status,
    value: count,
    color: STATUS_CONFIG[status]?.color || '#94a3b8',
  }));

  if (chartData.length === 0) {
    return (
      <Card className="border-0 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/50">
              <PieChartIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </span>
            התפלגות עבודות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">אין מספיק נתונים להצגת גרף</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/50">
            <PieChartIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </span>
          התפלגות עבודות
          <span className="mr-auto text-sm font-normal text-slate-500 dark:text-slate-400">
            סה"כ {allJobs?.length || 0}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => <span className="text-xs text-slate-600 dark:text-slate-400">{value}</span>}
                iconType="circle"
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
