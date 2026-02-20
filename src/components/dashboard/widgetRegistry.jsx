import {
  BarChart3,
  TrendingUp,
  Calendar,
  Briefcase,
  AlertCircle,
  FileText,
  Users,
  Zap,
  PieChart,
  GitBranch,
  Clock,
} from 'lucide-react';

import StatsWidget from './widgets/StatsWidget';
import RevenueWidget from './widgets/RevenueWidget';
import TodayJobsWidget from './widgets/TodayJobsWidget';
import UnscheduledJobsWidget from './widgets/UnscheduledJobsWidget';
import UnconvertedQuotesWidget from './widgets/UnconvertedQuotesWidget';
import RecentJobsWidget from './widgets/RecentJobsWidget';
import CustomersNoJobsWidget from './widgets/CustomersNoJobsWidget';
import QuickActionsWidget from './widgets/QuickActionsWidget';
import JobStatsChartWidget from './widgets/JobStatsChartWidget';
import ConversionFunnelWidget from './widgets/ConversionFunnelWidget';
import ActivityTimelineWidget from './widgets/ActivityTimelineWidget';
import WeeklyCalendar from './WeeklyCalendar';

export const WIDGET_REGISTRY = {
  stats: {
    id: 'stats',
    label: 'סטטיסטיקות KPI',
    description: 'מספרים מרכזיים: לקוחות, הצעות, עבודות',
    icon: BarChart3,
    defaultSize: 'full',
    component: StatsWidget,
  },
  revenue: {
    id: 'revenue',
    label: 'הכנסות חודשיות',
    description: 'סך הכנסות החודש כולל מע"מ',
    icon: TrendingUp,
    defaultSize: 'full',
    component: RevenueWidget,
  },
  weekly_calendar: {
    id: 'weekly_calendar',
    label: 'לוח שבועי',
    description: 'תצוגת לוח עבודות לשבוע הקרוב',
    icon: Calendar,
    defaultSize: 'full',
    component: WeeklyCalendar,
  },
  today_jobs: {
    id: 'today_jobs',
    label: 'עבודות להיום',
    description: 'עבודות המתוזמנות להיום',
    icon: Calendar,
    defaultSize: 'half',
    component: TodayJobsWidget,
  },
  unscheduled_jobs: {
    id: 'unscheduled_jobs',
    label: 'עבודות לא מתוזמנות',
    description: 'עבודות שטרם תוזמנו',
    icon: AlertCircle,
    defaultSize: 'half',
    component: UnscheduledJobsWidget,
  },
  job_stats_chart: {
    id: 'job_stats_chart',
    label: 'גרף עבודות',
    description: 'תרשים התפלגות עבודות לפי סטטוס',
    icon: PieChart,
    defaultSize: 'half',
    component: JobStatsChartWidget,
  },
  conversion_funnel: {
    id: 'conversion_funnel',
    label: 'משפך המרה',
    description: 'שיעור המרה מהצעות מחיר לעבודות',
    icon: GitBranch,
    defaultSize: 'half',
    component: ConversionFunnelWidget,
  },
  unconverted_quotes: {
    id: 'unconverted_quotes',
    label: 'הצעות ממתינות',
    description: 'הצעות מחיר שטרם הומרו לעבודה',
    icon: FileText,
    defaultSize: 'full',
    component: UnconvertedQuotesWidget,
  },
  recent_jobs: {
    id: 'recent_jobs',
    label: 'עבודות אחרונות',
    description: 'עבודות שנוצרו לאחרונה',
    icon: Briefcase,
    defaultSize: 'half',
    component: RecentJobsWidget,
  },
  customers_no_jobs: {
    id: 'customers_no_jobs',
    label: 'לקוחות ללא עבודה',
    description: 'לקוחות שאין להם עבודות פתוחות',
    icon: Users,
    defaultSize: 'half',
    component: CustomersNoJobsWidget,
  },
  activity_timeline: {
    id: 'activity_timeline',
    label: 'ציר זמן פעילות',
    description: 'פעולות אחרונות במערכת',
    icon: Clock,
    defaultSize: 'full',
    component: ActivityTimelineWidget,
  },
  quick_actions: {
    id: 'quick_actions',
    label: 'פעולות מהירות',
    description: 'יצירה מהירה של רשומות חדשות',
    icon: Zap,
    defaultSize: 'full',
    component: QuickActionsWidget,
  },
};
