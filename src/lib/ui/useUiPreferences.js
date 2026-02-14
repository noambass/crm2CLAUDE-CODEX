import { useCallback, useEffect, useMemo, useState } from 'react';

export const UI_PREFERENCE_KEYS = Object.freeze({
  themeMode: 'crm_ui_theme',
  calendarView: 'crm_ui_calendar_view',
  clientsView: 'crm_ui_clients_view',
  mapSidebarMode: 'crm_ui_map_mode',
  densityMode: 'crm_ui_density',
  mobileCalendarView: 'crm_ui_mobile_calendar_view',
  mobileWeekStyle: 'crm_ui_mobile_week_style',
  mobileMapSheet: 'crm_ui_mobile_map_sheet',
});

export const DEFAULT_UI_PREFERENCES = Object.freeze({
  themeMode: 'light',
  calendarView: 'month',
  clientsView: 'compact_cards',
  mapSidebarMode: 'compact',
  densityMode: 'comfortable',
  mobileCalendarView: 'week',
  mobileWeekStyle: 'day_carousel',
  mobileMapSheet: 'half',
});

const allowedValues = Object.freeze({
  themeMode: new Set(['light', 'dark']),
  calendarView: new Set(['month', 'week']),
  clientsView: new Set(['compact_cards', 'expanded_cards']),
  mapSidebarMode: new Set(['compact', 'expanded']),
  densityMode: new Set(['comfortable', 'compact']),
  mobileCalendarView: new Set(['week', 'month']),
  mobileWeekStyle: new Set(['day_carousel', 'compact_columns', 'hour_timeline']),
  mobileMapSheet: new Set(['collapsed', 'half', 'full']),
});

function safeRead(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in private mode.
  }
}

function normalizePreference(name, value) {
  if (!allowedValues[name]) return DEFAULT_UI_PREFERENCES[name];
  return allowedValues[name].has(value) ? value : DEFAULT_UI_PREFERENCES[name];
}

function readPreferencesFromStorage() {
  const next = { ...DEFAULT_UI_PREFERENCES };
  for (const [name, key] of Object.entries(UI_PREFERENCE_KEYS)) {
    const raw = safeRead(key);
    next[name] = normalizePreference(name, raw);
  }
  return next;
}

export function useUiPreferences() {
  const [preferences, setPreferences] = useState(() => readPreferencesFromStorage());

  const setPreference = useCallback((name, value) => {
    setPreferences((prev) => {
      const normalized = normalizePreference(name, value);
      const next = {
        ...prev,
        [name]: normalized,
      };
      safeWrite(UI_PREFERENCE_KEYS[name], normalized);
      return next;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_UI_PREFERENCES);
    for (const [name, key] of Object.entries(UI_PREFERENCE_KEYS)) {
      safeWrite(key, DEFAULT_UI_PREFERENCES[name]);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (preferences.themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [preferences.themeMode]);

  return useMemo(
    () => ({
      preferences,
      setPreference,
      resetPreferences,
    }),
    [preferences, resetPreferences, setPreference]
  );
}
