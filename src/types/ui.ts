export type ThemeMode = 'light' | 'dark';
export type CalendarViewMode = 'month' | 'week';
export type ClientsViewMode = 'compact_cards' | 'expanded_cards';
export type MapSidebarMode = 'compact' | 'expanded';
export type DensityMode = 'comfortable' | 'compact';
export type MobileCalendarViewMode = 'week' | 'month';
export type MobileWeekStyleMode = 'day_carousel' | 'compact_columns' | 'hour_timeline';
export type MobileMapSheetMode = 'collapsed' | 'half' | 'full';

export interface UiPreferences {
  themeMode: ThemeMode;
  calendarView: CalendarViewMode;
  clientsView: ClientsViewMode;
  mapSidebarMode: MapSidebarMode;
  densityMode: DensityMode;
  mobileCalendarView: MobileCalendarViewMode;
  mobileWeekStyle: MobileWeekStyleMode;
  mobileMapSheet: MobileMapSheetMode;
}
