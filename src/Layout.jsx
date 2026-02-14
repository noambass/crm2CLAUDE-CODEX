import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import logo from '@/assets/logo.png';
import { Toaster } from 'sonner';
import {
  Users,
  Briefcase,
  Menu,
  Home,
  Plus,
  MapPin,
  Calendar as CalendarIcon,
  FileText,
  Search,
  Sun,
  Moon,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import FloatingActionButton from '@/components/shared/FloatingActionButton';
import { useUiPreferences } from '@/lib/ui/useUiPreferences';

const navItems = [
  { name: 'דשבורד', icon: Home, page: 'Dashboard' },
  { name: 'לקוחות', icon: Users, page: 'Clients' },
  { name: 'הצעות מחיר', icon: FileText, page: 'Quotes' },
  { name: 'עבודות', icon: Briefcase, page: 'Jobs' },
  { name: 'לוח שנה', icon: CalendarIcon, page: 'Calendar' },
  { name: 'מפה', icon: MapPin, page: 'Map' },
];

const mobileNavItems = [
  { name: 'דשבורד', icon: Home, page: 'Dashboard' },
  { name: 'לקוחות', icon: Users, page: 'Clients' },
  { name: 'עבודות', icon: Briefcase, page: 'Jobs' },
  { name: 'לוח שנה', icon: CalendarIcon, page: 'Calendar' },
  { name: 'מפה', icon: MapPin, page: 'Map' },
];

const pageTitleMap = {
  Dashboard: 'תמונת מצב ניהולית',
  Clients: 'ניהול לקוחות',
  Quotes: 'ניהול הצעות מחיר',
  Jobs: 'ניהול עבודות',
  Calendar: 'לוח שנה תפעולי',
  Map: 'מפת עבודות',
  Settings: 'הגדרות מערכת',
};

const quickCreateActions = [
  { label: 'לקוח חדש', page: 'ClientForm', icon: Users },
  { label: 'הצעה חדשה', page: 'QuoteForm', icon: FileText },
  { label: 'עבודה חדשה', page: 'JobForm', icon: Briefcase },
];

function normalizeText(value) {
  return String(value || '').trim();
}

function mapSearchResultToUrl(item) {
  if (item.type === 'job') return createPageUrl(`JobDetails?id=${item.id}`);
  if (item.type === 'client') return createPageUrl(`ClientDetails?id=${item.id}`);
  if (item.type === 'quote') return createPageUrl(`QuoteDetails?id=${item.id}`);
  return createPageUrl('Dashboard');
}

function mapSearchResultIcon(type) {
  if (type === 'job') return Briefcase;
  if (type === 'client') return Users;
  return FileText;
}

export default function Layout({ children, currentPageName }) {
  const { user, isLoadingAuth } = useAuth();
  const { preferences, setPreference } = useUiPreferences();
  const [profile, setProfile] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setQuickCreateOpen(false);
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    let mounted = true;

    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', user.id)
          .maybeSingle();

        if (!mounted) return;
        if (error) throw error;
        setProfile(data || null);
      } catch {
        if (!mounted) return;
        setProfile(null);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setGlobalSearchResults([]);
      return undefined;
    }

    const q = normalizeText(globalSearchQuery);
    if (q.length < 2) {
      setGlobalSearchResults([]);
      setSearchLoading(false);
      return undefined;
    }

    let active = true;
    const handle = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const pattern = `%${q}%`;
        const [jobsRes, clientsRes, quotesRes] = await Promise.all([
          supabase
            .from('jobs')
            .select('id,title,status')
            .ilike('title', pattern)
            .order('updated_at', { ascending: false })
            .limit(4),
          supabase
            .from('accounts')
            .select('id,account_name,status,client_type')
            .ilike('account_name', pattern)
            .order('updated_at', { ascending: false })
            .limit(4),
          supabase
            .from('quotes')
            .select('id,title,status')
            .ilike('title', pattern)
            .order('updated_at', { ascending: false })
            .limit(4),
        ]);

        if (!active) return;

        const next = [];

        (jobsRes.data || []).forEach((item) => {
          next.push({
            type: 'job',
            id: item.id,
            title: normalizeText(item.title) || 'עבודה ללא כותרת',
            subtitle: 'עבודה',
          });
        });

        (clientsRes.data || []).forEach((item) => {
          next.push({
            type: 'client',
            id: item.id,
            title: normalizeText(item.account_name) || 'לקוח ללא שם',
            subtitle: 'לקוח',
          });
        });

        (quotesRes.data || []).forEach((item) => {
          next.push({
            type: 'quote',
            id: item.id,
            title: normalizeText(item.title) || 'הצעה ללא כותרת',
            subtitle: 'הצעת מחיר',
          });
        });

        setGlobalSearchResults(next.slice(0, 12));
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [globalSearchQuery, user]);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'משתמש';
  const resolvedRole = user?.app_metadata?.role || user?.user_metadata?.role || 'admin';
  const roleLabel = resolvedRole === 'admin' ? 'מנהל' : 'עובד';

  const pageTitle = useMemo(() => {
    return pageTitleMap[currentPageName] || 'מערכת ניהול CRM';
  }, [currentPageName]);

  const shouldShowSearchPanel =
    searchLoading || globalSearchResults.length > 0 || normalizeText(globalSearchQuery).length >= 2;

  const toggleTheme = () => {
    setPreference('themeMode', preferences.themeMode === 'dark' ? 'light' : 'dark');
  };

  const handleSearchResultClick = (item) => {
    setGlobalSearchQuery('');
    setGlobalSearchResults([]);
    setMobileSearchOpen(false);
    navigate(mapSearchResultToUrl(item));
  };

  const NavContent = ({ mobile = false }) => (
    <nav className="flex flex-col gap-1 p-2">
      {navItems.map((item) => {
        const isActive = currentPageName === item.page;
        return (
          <Link
            key={item.page}
            data-testid={`nav-${item.page.toLowerCase()}`}
            to={createPageUrl(item.page)}
            onClick={() => mobile && setMobileMenuOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
              isActive
                ? 'bg-[#00214d] text-white shadow-lg'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );

  const SearchResultsPanel = ({ mobile = false }) => {
    if (!shouldShowSearchPanel) return null;

    return (
      <div
        className={`z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 ${
          mobile ? 'mt-2' : 'absolute right-0 top-12 w-full'
        }`}
      >
        {searchLoading ? (
          <div className="p-3 text-xs text-slate-500 dark:text-slate-300">מחפש...</div>
        ) : globalSearchResults.length === 0 ? (
          <div className="p-3 text-xs text-slate-500 dark:text-slate-300">אין תוצאות תואמות</div>
        ) : (
          <div className="max-h-72 overflow-y-auto p-1">
            {globalSearchResults.map((item) => {
              const ResultIcon = mapSearchResultIcon(item.type);
              return (
                <button
                  key={`${item.type}:${item.id}`}
                  type="button"
                  onClick={() => handleSearchResultClick(item)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-right transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ResultIcon className="h-4 w-4 text-slate-500 dark:text-slate-300" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{item.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">{item.subtitle}</p>
                  </div>
                  <ChevronLeft className="h-4 w-4 text-slate-400" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap');
        * { font-family: 'Heebo', sans-serif; }
      `}</style>

      <aside className="hidden lg:fixed lg:inset-y-0 lg:right-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-l border-slate-200 bg-white px-4 py-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3 px-4">
            <img src={logo} alt="לוגו" className="h-12 w-auto" />
            <div>
              <h1 className="text-lg font-bold text-[#00214d] dark:text-cyan-300">עולם הציפויים</h1>
              <p className="text-xs text-slate-500 dark:text-slate-300">מערכת ניהול</p>
            </div>
          </div>

          <NavContent />

          <div className="mt-auto px-2">
            <Button
              type="button"
              className="w-full bg-[#00214d] text-white shadow-lg hover:opacity-90"
              onClick={() => navigate(createPageUrl('JobForm'))}
            >
              <Plus className="ml-2 h-4 w-4" />
              עבודה חדשה
            </Button>
          </div>

          {user && !isLoadingAuth ? (
            <div className="border-t border-slate-200 px-2 pt-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-right transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => navigate(createPageUrl('Settings'))}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback style={{ backgroundColor: '#e8f0f7', color: '#00214d' }}>
                      {displayName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{displayName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">{roleLabel}</p>
                  </div>
                </button>
                <Button type="button" variant="outline" size="icon" onClick={toggleTheme}>
                  {preferences.themeMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      <div
        className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex h-14 items-center gap-2 px-3">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button data-testid="mobile-menu-trigger" variant="ghost" size="icon" className="rounded-xl">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0" dir="rtl">
              <div className="flex h-full flex-col bg-white dark:bg-slate-900">
                <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-6 dark:border-slate-800">
                  <img src={logo} alt="לוגו" className="h-10 w-auto" />
                  <div>
                    <h1 className="text-lg font-bold text-[#00214d] dark:text-cyan-300">עולם הציפויים</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-300">מערכת ניהול</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto py-4">
                  <NavContent mobile />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <button type="button" className="min-w-0 flex-1 text-right" onClick={() => navigate(createPageUrl('Dashboard'))}>
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{pageTitle}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-300">עולם הציפויים</p>
          </button>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={mobileSearchOpen ? 'default' : 'outline'}
              size="icon"
              className={mobileSearchOpen ? 'bg-[#00214d] text-white hover:bg-[#00214d]/90' : ''}
              onClick={() => setMobileSearchOpen((prev) => !prev)}
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={toggleTheme}>
              {preferences.themeMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <button
              type="button"
              onClick={() => navigate(createPageUrl('Settings'))}
              className="rounded-full p-0.5"
              aria-label="הגדרות"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-sm" style={{ backgroundColor: '#e8f0f7', color: '#00214d' }}>
                  {displayName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </button>
          </div>
        </div>

        {mobileSearchOpen ? (
          <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-800">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={globalSearchQuery}
                onChange={(event) => setGlobalSearchQuery(event.target.value)}
                placeholder="חפש לקוח, עבודה או הצעה..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-3 text-sm outline-none transition focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <SearchResultsPanel mobile />
          </div>
        ) : null}

      </div>

      <main className="pb-[calc(7.75rem+env(safe-area-inset-bottom))] lg:pr-64 lg:pb-0">
        <div className="sticky top-0 z-30 hidden border-b border-slate-200 bg-white/95 backdrop-blur lg:block dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex items-center justify-between gap-4 px-8 py-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{pageTitle}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-300">חיפוש גלובלי ופעולות מהירות</p>
            </div>

            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={globalSearchQuery}
                onChange={(event) => setGlobalSearchQuery(event.target.value)}
                placeholder="חפש לקוח, עבודה או הצעה..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-3 text-sm outline-none transition focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <SearchResultsPanel />
            </div>

            <div className="relative">
              <Button type="button" className="bg-[#00214d] text-white hover:opacity-90" onClick={() => setQuickCreateOpen((prev) => !prev)}>
                <Plus className="ml-2 h-4 w-4" />
                פעולה חדשה
              </Button>
              {quickCreateOpen ? (
                <div className="absolute left-0 top-12 z-50 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {quickCreateActions.map((action) => (
                    <button
                      key={action.page}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-right text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                      onClick={() => {
                        setQuickCreateOpen(false);
                        navigate(createPageUrl(action.page));
                      }}
                    >
                      <action.icon className="h-4 w-4" />
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-h-[calc(100vh-64px)]">{children}</div>
      </main>

      <FloatingActionButton />

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pt-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {mobileNavItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <button
                key={item.page}
                type="button"
                onClick={() => navigate(createPageUrl(item.page))}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] font-medium transition ${
                  isActive
                    ? 'bg-[#00214d] text-white shadow-md dark:bg-cyan-900/60 dark:text-cyan-100'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <item.icon className="mb-1 h-4 w-4" />
                {item.name}
              </button>
            );
          })}
        </div>
      </nav>

      <Toaster position="top-center" dir="rtl" richColors />
    </div>
  );
}
