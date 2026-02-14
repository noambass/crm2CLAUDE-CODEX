import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import logo from '@/assets/logo.png';
import { Toaster } from 'sonner';
import {
  Users, Briefcase, Settings, Menu, Home,
  LogOut, User, Plus, MapPin, Calendar as CalendarIcon, FileText
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import FloatingActionButton from "@/components/shared/FloatingActionButton";

const navItems = [
  { name: 'דשבורד', icon: Home, page: 'Dashboard' },
  { name: 'לקוחות', icon: Users, page: 'Clients' },
  { name: 'הצעות מחיר', icon: FileText, page: 'Quotes' },
  { name: 'עבודות', icon: Briefcase, page: 'Jobs' },
  { name: 'לוח שנה', icon: CalendarIcon, page: 'Calendar' },
  { name: 'מפה', icon: MapPin, page: 'Map' },
  { name: 'הגדרות', icon: Settings, page: 'Settings' },
];

export default function Layout({ children, currentPageName }) {
  const { user, logout, isLoadingAuth } = useAuth();
  const [profile, setProfile] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

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
      } catch (e) {
        if (!mounted) return;
        setProfile(null);
      }
    };
    loadProfile();
    return () => {
      mounted = false;
    };
  }, [user]);

  const handleLogout = async () => {
    await logout();
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'משתמש';
  const resolvedRole = user?.app_metadata?.role || user?.user_metadata?.role || 'admin';
  const roleLabel = resolvedRole === 'admin' ? 'מנהל' : 'עובד';

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
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              isActive
                ? 'text-white shadow-lg'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            style={isActive ? { backgroundColor: '#00214d' } : {}}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap');
        * { font-family: 'Heebo', sans-serif; }
        :root {
          --primary: #00214d;
          --primary-dark: #001a3d;
        }
      `}</style>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:right-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-l border-slate-200 px-4 py-6">
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 mb-4">
            <img
              src={logo}
              alt="לוגו"
              className="h-12 w-auto"
            />
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#00214d' }}>עולם הציפויים</h1>
              <p className="text-xs text-slate-500">מערכת ניהול</p>
            </div>
          </div>

          {/* Navigation */}
          <NavContent />

          {/* Quick Actions */}
          <div className="mt-auto px-2">
            <Button
              onClick={() => navigate(createPageUrl('JobForm'))}
              className="w-full shadow-lg text-white"
              style={{ backgroundColor: '#00214d' }}
            >
              <Plus className="w-4 h-4 ml-2" />
              עבודה חדשה
            </Button>
          </div>

          {/* User Profile */}
          {user && !isLoadingAuth && (
            <div className="border-t border-slate-200 pt-4 px-2">
              <Button
                type="button"
                data-testid="logout-button-desktop"
                variant="outline"
                className="mb-3 w-full"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 ml-2" />
                התנתקות
              </Button>
              <DropdownMenu dir="rtl">
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-slate-100 transition-colors">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback style={{ backgroundColor: '#e8f0f7', color: '#00214d' }}>
                        {displayName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-right">
                      <p className="text-sm font-medium text-slate-800">{displayName}</p>
                      <p className="text-xs text-slate-500">{roleLabel}</p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56" dir="rtl">
                  <DropdownMenuItem onClick={() => navigate(createPageUrl('Settings'))}>
                    <User className="w-4 h-4 ml-2" />
                    הפרופיל שלי
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(createPageUrl('Settings'))}>
                    <Settings className="w-4 h-4 ml-2" />
                    הגדרות
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="w-4 h-4 ml-2" />
                    יציאה
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 bg-white border-b border-slate-200 px-4 shadow-sm">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button data-testid="mobile-menu-trigger" variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0" dir="rtl">
            <div className="flex flex-col h-full bg-white">
              {/* Mobile Logo */}
              <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-200">
                <img
                  src={logo}
                  alt="לוגו"
                  className="h-10 w-auto"
                />
                <div>
                  <h1 className="text-lg font-bold" style={{ color: '#00214d' }}>עולם הציפויים</h1>
                  <p className="text-xs text-slate-500">מערכת ניהול</p>
                </div>
              </div>

              {/* Mobile Navigation */}
              <div className="flex-1 overflow-y-auto py-4">
                <NavContent mobile />
              </div>

              {/* Mobile Quick Action */}
              <div className="p-4 border-t border-slate-200">
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(createPageUrl('JobForm'));
                  }}
                  className="w-full text-white"
                  style={{ backgroundColor: '#00214d' }}
                >
                  <Plus className="w-4 h-4 ml-2" />
                  עבודה חדשה
                </Button>
                <Button
                  data-testid="logout-button-mobile"
                  type="button"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 ml-2" />
                  התנתקות
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex items-center justify-center">
          <h1 className="text-lg font-bold" style={{ color: '#00214d' }}>עולם הציפויים</h1>
        </div>

        {user && !isLoadingAuth && (
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-sm" style={{ backgroundColor: '#e8f0f7', color: '#00214d' }}>
              {displayName?.charAt(0)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Main Content */}
      <main className="lg:pr-64">
        <div className="min-h-screen">
          {children}
        </div>
      </main>

      {/* Floating Action Button */}
      <FloatingActionButton />

      {/* Toast Notifications */}
      <Toaster position="top-center" dir="rtl" richColors />
      </div>
      );
      }
