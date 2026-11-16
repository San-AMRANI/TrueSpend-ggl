import { initGoogleAuth } from './lib/googleAuth';
import React, { useState, useEffect, useRef } from 'react';
import { MotionConfig, AnimatePresence, motion } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme, THEME_PRESETS, type ThemeId } from './context/ThemeContext';
import { PrivacyProvider, usePrivacy } from './context/PrivacyContext';
import Dashboard from './components/Dashboard';
import { DesktopHeaderNav } from './components/dashboard/DesktopHeaderNav';
import { DesktopSidebarNav } from './components/dashboard/DesktopSidebarNav';
import { AuthPortal } from './components/auth/AuthPortal';
import type { DashboardTab } from './types';
import { NAV_GROUP_ORDER, NAV_ITEMS } from './config/navigation';
import { getOfflineOutbox } from './lib/offlineOutbox';
import { isTabAvailableForUser } from './lib/entitlements';
import {
  Menu,
  X,
  Search,
  Eye,
  EyeOff,
  Palette,
  Check,
  Bell,
  CloudOff,
  PanelLeft,
  PanelTop,
  Plus,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Calculator,
  Calendar,
  Scale,
} from 'lucide-react';

const appIconSrc = `${(import.meta as any).env?.BASE_URL || '/'}app-icon.png?v=transparent`;

function AppContent() {
  const { user, loading, switchExperienceTier } = useAuth();
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();
  const {
    theme,
    resolvedTheme,
    activePreset,
    desktopNavLayout,
    setTheme,
    setDesktopNavLayout,
  } = useTheme();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [outboxCount, setOutboxCount] = useState(() => {
    try {
      return getOfflineOutbox().length;
    } catch {
      return 0;
    }
  });
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const quickMenuRef = useRef<HTMLDivElement>(null);

  const visibleNavItems = NAV_ITEMS.filter((item) =>
    isTabAvailableForUser(item.id, user?.experienceTier, user?.role)
  );
  const activeNavMeta = NAV_ITEMS.find((item) => item.id === activeTab);

  const handleSelectTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    window.dispatchEvent(new CustomEvent('truespend:setTab', { detail: tab }));
  };

  useEffect(() => {
    const cleanup = initGoogleAuth();
    const handleOpen = () => setIsSidebarOpen(true);
    const handleUnreadCount = (e: any) => {
      if (typeof e.detail === 'number') setUnreadNotifCount(e.detail);
    };
    const handleOutboxUpdated = (e: any) => {
      if (typeof e.detail?.count === 'number') {
        setOutboxCount(e.detail.count);
      } else {
        setOutboxCount(getOfflineOutbox().length);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeMenuOpen(false);
      }
      if (quickMenuRef.current && !quickMenuRef.current.contains(e.target as Node)) {
        setIsQuickMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsThemeMenuOpen(false);
        setIsQuickMenuOpen(false);
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('truespend:openSidebar', handleOpen);
    window.addEventListener('truespend:unreadNotificationsCount', handleUnreadCount);
    window.addEventListener('truespend:outbox-updated', handleOutboxUpdated);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      cleanup && cleanup();
      window.removeEventListener('truespend:openSidebar', handleOpen);
      window.removeEventListener('truespend:unreadNotificationsCount', handleUnreadCount);
      window.removeEventListener('truespend:outbox-updated', handleOutboxUpdated);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const isChatOnMobile = activeTab === 'chat';

  if (loading) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <button disabled className="md:hidden p-1.5 -ml-1.5 rounded-md text-gray-400">
                <Menu className="h-5 w-5" />
              </button>
              <img src={appIconSrc} alt="TrueSpend Logo" className="h-8 w-8 opacity-50" />
              <span className="text-lg font-bold tracking-tight text-gray-400">TrueSpend</span>
            </div>
            <div className="hidden sm:flex items-center gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
          </div>
        </header>
        <main className="mx-auto min-w-0 max-w-7xl p-3 sm:p-6 lg:p-8">
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 h-96 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
              <div className="h-96 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return <AuthPortal appIconSrc={appIconSrc} />;
  }

  const isAdvancedTier = user.experienceTier === 'advanced';

  return (
    <div
      className={`${
        isChatOnMobile ? 'h-dvh overflow-hidden' : 'min-h-screen overflow-x-clip'
      } flex bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100`}
    >
      {/* Optional Desktop Side Menu Rail */}
      {desktopNavLayout === 'side' && (
        <DesktopSidebarNav
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          appIconSrc={appIconSrc}
          outboxCount={outboxCount}
        />
      )}

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">

        {/* Header — Spacious 3-Zone Architecture (zero right-button clipping/override) */}
        <header
          className={`sticky top-0 z-30 shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-3 sm:px-6 lg:px-8 h-14 flex items-center ${
            isChatOnMobile ? 'hidden sm:flex' : ''
          }`}
        >
          <div className="mx-auto w-full max-w-[1440px] flex items-center justify-between gap-3 min-w-0">
            {/* Zone 1: Brand (Mobile + Top Mode) OR Page Breadcrumb (Side Mode) */}
            <div className="flex items-center gap-2.5 shrink-0 min-w-0">
              <button
                type="button"
                aria-label="Open menu"
                className="md:hidden p-1.5 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>

              {desktopNavLayout === 'side' ? (
                <>
                  {/* Mobile brand */}
                  <div className="flex md:hidden items-center gap-2">
                    <img src={appIconSrc} alt="TrueSpend Logo" className="h-7 w-7 shrink-0" />
                    <span className="font-display text-base font-bold tracking-tight text-gray-900 dark:text-white whitespace-nowrap">
                      TrueSpend
                    </span>
                  </div>

                  {/* Desktop contextual breadcrumb in Side Menu mode */}
                  <div className="hidden md:flex items-center gap-2 min-w-0">
                    {activeNavMeta && (
                      <>
                        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap">
                          {activeNavMeta.groupLabel}
                        </span>
                        <span className="text-gray-300 dark:text-gray-700">/</span>
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          <activeNavMeta.icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span>{activeNavMeta.label}</span>
                        </span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSelectTab('overview')}
                  className="flex items-center gap-2 shrink-0 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <img src={appIconSrc} alt="TrueSpend Logo" className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" />
                  <span className="font-display text-base sm:text-lg font-bold tracking-tight text-gray-900 dark:text-white whitespace-nowrap">
                    TrueSpend
                  </span>
                </button>
              )}
            </div>

            {/* Zone 2: Primary Top Menu (Only in Top Mode — capped to 5 core links + Explore popover) */}
            {desktopNavLayout === 'top' && (
              <div className="hidden md:flex items-center justify-center min-w-0 flex-1 px-2">
                <DesktopHeaderNav activeTab={activeTab} onSelectTab={handleSelectTab} />
              </div>
            )}

            {/* Zone 3: Right Utility Controls (Always shrink-0, spaced cleanly so never overridden) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Quick Log & Financial Utilities Split Menu (Works in both Side and Top nav modes) */}
              <div className="relative flex items-center" ref={quickMenuRef}>
                <div className="inline-flex items-center rounded-lg bg-indigo-600 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickMenuOpen(false);
                      window.dispatchEvent(
                        new CustomEvent('truespend:openQuickTransaction', { detail: 'Expense' }),
                      );
                    }}
                    title="Quick Log Expense (N)"
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span className={desktopNavLayout === 'top' ? 'hidden xl:inline' : 'hidden sm:inline'}>
                      Quick Log
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Open quick actions menu"
                    aria-expanded={isQuickMenuOpen}
                    onClick={() => setIsQuickMenuOpen((prev) => !prev)}
                    className="px-1.5 py-1.5 text-white/90 hover:text-white hover:bg-indigo-700 border-l border-indigo-500/70 transition-colors cursor-pointer"
                    title="Log Income, Transfer, Smart Calculator & Calendar"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-150 ${
                        isQuickMenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>

                <AnimatePresence>
                  {isQuickMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.97 }}
                      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl py-1.5 z-50"
                    >
                      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Quick Record
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsQuickMenuOpen(false);
                          window.dispatchEvent(
                            new CustomEvent('truespend:openQuickTransaction', { detail: 'Expense' }),
                          );
                        }}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <ArrowUpRight className="h-3.5 w-3.5 text-rose-500" />
                          <span>Log Expense</span>
                        </span>
                        <kbd className="text-[10px] font-mono text-gray-400">N</kbd>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsQuickMenuOpen(false);
                          window.dispatchEvent(
                            new CustomEvent('truespend:openQuickTransaction', { detail: 'Income' }),
                          );
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        <ArrowDownRight className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Log Income</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsQuickMenuOpen(false);
                          window.dispatchEvent(
                            new CustomEvent('truespend:openQuickTransaction', { detail: 'Transfer' }),
                          );
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
                        <span>Transfer Between Wallets</span>
                      </button>

                      <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Tools &amp; Schedule
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsQuickMenuOpen(false);
                          window.dispatchEvent(new CustomEvent('truespend:openSmartCalculator'));
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        <Calculator className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Smart Calculator</span>
                      </button>
                      {isAdvancedTier && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsQuickMenuOpen(false);
                            handleSelectTab('calculators');
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <Scale className="h-3.5 w-3.5 text-amber-500" />
                          <span>What-If &amp; Tax Simulators</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setIsQuickMenuOpen(false);
                          handleSelectTab('calendar');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        <Calendar className="h-3.5 w-3.5 text-teal-500" />
                        <span>Financial Calendar</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Extra 1-click Smart Calculator & Calendar shortcuts when Side Menu gives generous header space */}
              {desktopNavLayout === 'side' && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(new CustomEvent('truespend:openSmartCalculator'))
                    }
                    title="Tactile Smart Calculator"
                    className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium transition-colors shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    <Calculator className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="hidden xl:inline">Calculator</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectTab('calendar')}
                    title="Financial Calendar & Payday Schedule"
                    className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                      activeTab === 'calendar'
                        ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span className="hidden xl:inline">Calendar</span>
                  </button>
                </>
              )}

              {/* Subtle Free Experience Tier Switcher */}
              <button
                type="button"
                onClick={async () => {
                  const next = isAdvancedTier ? 'basic' : 'advanced';
                  await switchExperienceTier(next);
                  window.dispatchEvent(
                    new CustomEvent('truespend:toast', {
                      detail: {
                        message: `Switched to ${next === 'advanced' ? 'Advanced' : 'Basic'} Mode (Free).`,
                        type: 'info',
                      },
                    })
                  );
                }}
                title={`Active Mode: ${isAdvancedTier ? 'Advanced' : 'Basic'} (100% Free). Click to switch experience tier without losing data.`}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium transition-colors shrink-0 whitespace-nowrap cursor-pointer"
              >
                <span className={`h-2 w-2 rounded-full ${isAdvancedTier ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                <span>{isAdvancedTier ? 'Advanced' : 'Basic'} · Free</span>
              </button>

              {/* Desktop Menu Layout Quick Toggle (Side <-> Top) */}
              <button
                type="button"
                onClick={() =>
                  setDesktopNavLayout(desktopNavLayout === 'side' ? 'top' : 'side')
                }
                title={
                  desktopNavLayout === 'side'
                    ? 'Switch to Top Navigation Bar'
                    : 'Switch to Side Navigation Menu'
                }
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium transition-colors shrink-0 whitespace-nowrap cursor-pointer"
              >
                {desktopNavLayout === 'side' ? (
                  <>
                    <PanelTop className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="hidden xl:inline">Top Menu</span>
                  </>
                ) : (
                  <>
                    <PanelLeft className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="hidden xl:inline">Side Menu</span>
                  </>
                )}
              </button>

              {/* Quick Theme Switcher Popover */}
              <div className="relative" ref={themeMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsThemeMenuOpen((prev) => !prev)}
                  title={`Active Theme: ${activePreset.name}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium transition-colors shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <span
                    className="h-3 w-3 rounded-full border border-black/15 dark:border-white/20 shrink-0"
                    style={{ backgroundColor: activePreset.swatches.accent }}
                  />
                  <Palette className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 sm:hidden shrink-0" />
                  <span
                    className={`hidden truncate max-w-[96px] ${
                      desktopNavLayout === 'top' ? '2xl:inline' : 'sm:inline'
                    }`}
                  >
                    {activePreset.name}
                  </span>
                </button>

                <AnimatePresence>
                  {isThemeMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.97 }}
                      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl py-2 z-50"
                    >
                      <div className="px-3.5 pb-1.5 mb-1 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          Select Theme (12 Presets)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsThemeMenuOpen(false);
                            handleSelectTab('settings');
                          }}
                          className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Style Studio
                        </button>
                      </div>

                      <div className="max-h-80 overflow-y-auto ts-scrollbar">
                        {THEME_PRESETS.map((preset) => {
                          const isSelected =
                            theme === preset.id || (theme === 'system' && resolvedTheme === preset.id);
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => {
                                setTheme(preset.id as ThemeId);
                                setIsThemeMenuOpen(false);
                              }}
                              className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className="h-4 w-4 rounded-full border border-black/15 dark:border-white/20 shrink-0 flex items-center justify-center"
                                  style={{ backgroundColor: preset.swatches.canvas }}
                                >
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: preset.swatches.accent }}
                                  />
                                </span>
                                <div className="truncate">
                                  <div className="truncate">{preset.name}</div>
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 font-normal truncate">
                                    {preset.tagline}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Privacy Mode Toggle */}
              <button
                type="button"
                onClick={togglePrivacyMode}
                aria-pressed={isPrivacyMode}
                title={
                  isPrivacyMode
                    ? 'Balances Hidden (Click to show amounts)'
                    : 'Hide Balances & Amounts (Privacy Mode)'
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                  isPrivacyMode
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {isPrivacyMode ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span
                      className={`hidden ${
                        desktopNavLayout === 'top' ? '2xl:inline' : 'lg:inline'
                      }`}
                    >
                      Hidden
                    </span>
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0" />
                    <span
                      className={`hidden ${
                        desktopNavLayout === 'top' ? '2xl:inline' : 'lg:inline'
                      }`}
                    >
                      Privacy
                    </span>
                  </>
                )}
              </button>

              {/* Outbox Counter (only shown when offline queue > 0 in top mode) */}
              {outboxCount > 0 && desktopNavLayout === 'top' && (
                <button
                  type="button"
                  onClick={() => handleSelectTab('settings')}
                  title={`${outboxCount} offline transaction(s) queued for sync — open Settings to manage`}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 text-xs font-medium transition-colors shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <CloudOff className="h-3.5 w-3.5 shrink-0" />
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums font-bold bg-amber-600 text-white">
                    {outboxCount}
                  </span>
                </button>
              )}

              {/* Alerts Bell */}
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent('truespend:openNotifications'))
                }
                title="Smart Notifications & Financial Insights"
                className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium transition-colors shrink-0 whitespace-nowrap cursor-pointer"
              >
                <Bell className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span
                  className={`hidden ${
                    desktopNavLayout === 'top' ? '2xl:inline' : 'xl:inline'
                  }`}
                >
                  Alerts
                </span>
                {unreadNotifCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums font-bold bg-indigo-600 text-white">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {/* Search Command Palette Trigger */}
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent('truespend:openCommandPalette'))
                }
                title="Universal Search & Command Palette (⌘K)"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium transition-colors shrink-0 whitespace-nowrap cursor-pointer"
              >
                <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span
                  className={`hidden text-gray-500 dark:text-gray-400 ${
                    desktopNavLayout === 'top' ? '2xl:inline' : 'xl:inline'
                  }`}
                >
                  Search
                </span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-500 dark:text-gray-400">
                  ⌘K
                </kbd>
              </button>
            </div>
          </div>
        </header>

        <main
          className={`flex-1 min-h-0 mx-auto w-full min-w-0 ${
            isChatOnMobile
              ? 'flex flex-col max-w-6xl p-0 sm:px-6 sm:py-3 lg:px-8'
              : 'max-w-[1440px] p-3 pb-24 sm:p-6 sm:pb-24 md:pb-8 lg:px-8'
          }`}
        >
          <Dashboard activeTab={activeTab} onTabChange={setActiveTab} />
        </main>
      </div>

      {/* Mobile Sidebar Drawer (Animated) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[100] flex md:hidden"
          >
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setIsSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0.08, duration: 0.28 }}
              className="relative w-68 max-w-[82vw] flex flex-col bg-white dark:bg-gray-900 h-full shadow-2xl border-r border-gray-200 dark:border-gray-800"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <img src={appIconSrc} alt="TrueSpend" className="h-6 w-6" />
                  <span className="font-display font-bold text-base text-gray-900 dark:text-white">
                    Menu
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto ts-scrollbar py-2 space-y-2">
                {NAV_GROUP_ORDER.map((group) => {
                  const groupTabs = visibleNavItems.filter((item) => item.group === group.id);
                  if (groupTabs.length === 0) return null;
                  return (
                    <div key={group.id}>
                      <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        {group.label}
                      </div>
                      {groupTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                            activeTab === tab.id
                              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-r-2 border-indigo-600 dark:border-indigo-400'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                          onClick={() => {
                            window.dispatchEvent(
                              new CustomEvent('truespend:setTab', { detail: tab.id })
                            );
                            setIsSidebarOpen(false);
                          }}
                        >
                          <tab.icon
                            className={`h-5 w-5 shrink-0 ${
                              activeTab === tab.id ? 'stroke-[2.5]' : ''
                            }`}
                          />
                          <span className="truncate">{tab.label}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
              <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Quick Themes (12)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectTab('settings');
                      setIsSidebarOpen(false);
                    }}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                  >
                    Style Studio
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-0.5">
                  {THEME_PRESETS.map((preset) => {
                    const active = resolvedTheme === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setTheme(preset.id as ThemeId)}
                        className={`px-1.5 py-1.5 rounded border text-[10px] font-medium truncate transition-colors flex items-center gap-1 ${
                          active
                            ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: preset.swatches.accent }}
                        />
                        <span className="truncate">{preset.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <PrivacyProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </PrivacyProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
