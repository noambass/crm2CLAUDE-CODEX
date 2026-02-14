export type ThemeMode = 'light' | 'dark';
export type CalendarViewMode = 'month' | 'week';
export type ClientsViewMode = 'compact_cards' | 'expanded_cards';
export type MapSidebarMode = 'compact' | 'expanded';
export type DensityMode = 'comfortable' | 'compact';

export interface UiPreferences {
  themeMode: ThemeMode;
  calendarView: CalendarViewMode;
  clientsView: ClientsViewMode;
  mapSidebarMode: MapSidebarMode;
  densityMode: DensityMode;
}
