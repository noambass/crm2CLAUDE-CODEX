import { useState, useCallback } from 'react';

const STORAGE_KEY = 'crm_dashboard_layout';

export const DEFAULT_LAYOUT = [
  { id: 'stats', visible: true, size: 'full' },
  { id: 'revenue', visible: true, size: 'full' },
  { id: 'weekly_calendar', visible: true, size: 'full' },
  { id: 'today_jobs', visible: true, size: 'half' },
  { id: 'unscheduled_jobs', visible: true, size: 'half' },
  { id: 'job_stats_chart', visible: true, size: 'half' },
  { id: 'conversion_funnel', visible: true, size: 'half' },
  { id: 'unconverted_quotes', visible: true, size: 'full' },
  { id: 'recent_jobs', visible: true, size: 'half' },
  { id: 'customers_no_jobs', visible: true, size: 'half' },
  { id: 'activity_timeline', visible: true, size: 'full' },
  { id: 'quick_actions', visible: true, size: 'full' },
];

function loadLayout() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const existingIds = new Set(parsed.map((w) => w.id));
      return [...parsed, ...DEFAULT_LAYOUT.filter((w) => !existingIds.has(w.id))];
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LAYOUT;
}

function saveLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState(loadLayout);

  const updateLayout = useCallback((newLayout) => {
    setLayout(newLayout);
    saveLayout(newLayout);
  }, []);

  const toggleWidget = useCallback((widgetId) => {
    setLayout((prev) => {
      const updated = prev.map((w) => (w.id === widgetId ? { ...w, visible: !w.visible } : w));
      saveLayout(updated);
      return updated;
    });
  }, []);

  const reorderWidgets = useCallback((startIndex, endIndex) => {
    setLayout((prev) => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      saveLayout(result);
      return result;
    });
  }, []);

  const resizeWidget = useCallback((widgetId, size) => {
    setLayout((prev) => {
      const updated = prev.map((w) => (w.id === widgetId ? { ...w, size } : w));
      saveLayout(updated);
      return updated;
    });
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    saveLayout(DEFAULT_LAYOUT);
  }, []);

  return {
    layout,
    updateLayout,
    toggleWidget,
    reorderWidgets,
    resizeWidget,
    resetLayout,
    visibleWidgets: layout.filter((w) => w.visible),
  };
}
