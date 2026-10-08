import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Activity, ArrowRight, Settings, Monitor, Tv, FolderSearch, PlayCircle, Users, RefreshCw,
  BarChart3, Zap, Database
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { motionTokens } from '../utils/motionTokens';
import { useSettingsStore } from '../store/useSettingsStore';
import DashboardStats from './DashboardStats';
import DashboardSettings from './DashboardSettings';
import DashboardUsers from './DashboardUsers';
import DashboardDatabase from './DashboardDatabase';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { theme } = useSettingsStore();
  const isDark = theme !== 'light';
  
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'stats';

  const setTab = (tab) => {
    setSearchParams({ tab });
  };

  const tabs = [
    { id: 'stats', label: isRtl ? 'الإحصائيات' : 'Stats', icon: <BarChart3 size={20} /> },
    { id: 'database', label: isRtl ? 'قاعدة\nالبيانات' : 'Database', icon: <Database size={20} /> },
    { id: 'users', label: isRtl ? 'المستخدمين\nوالصلاحيات' : 'Users', icon: <Users size={20} /> },
    { id: 'general', label: isRtl ? 'إعدادات عامة' : 'General', icon: <Settings size={20} /> },
    { id: 'display', label: isRtl ? 'إعدادات العرض' : 'Display', icon: <Monitor size={20} /> },
    { id: 'playback', label: isRtl ? 'التشغيل' : 'Playback', icon: <PlayCircle size={20} /> },
    { id: 'libraries', label: isRtl ? 'إدارة المكتبات' : 'Libraries', icon: <FolderSearch size={20} /> }
  ];

  return (
    <div className="min-h-screen relative" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* === Futuristic Background === */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, var(--dash-bg-deep), var(--dash-bg-mid), var(--dash-bg-end))` }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[500px] blur-2xl" style={{ background: `radial-gradient(ellipse at top, var(--dash-orb-cyan), transparent 65%)` }} />
        <div className="absolute -top-20 -right-20 w-[700px] h-[700px] blur-3xl" style={{ background: `radial-gradient(circle, var(--dash-orb-blue), transparent 60%)` }} />
        <div className="absolute -bottom-20 -left-20 w-[600px] h-[600px] blur-3xl" style={{ background: `radial-gradient(circle, var(--dash-orb-green), transparent 60%)` }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[600px] blur-3xl" style={{ background: `radial-gradient(circle, var(--dash-orb-indigo), transparent 65%)` }} />
        {/* Dot matrix */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(var(--dash-dot-color) 1px, transparent 1px)`, backgroundSize: '28px 28px' }} />
        {/* Vignette */}
        <div className="absolute inset-0" style={{ background: `var(--dash-vignette)` }} />
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* === Sidebar (Sticky) === */}
        <aside
          className={`hidden md:flex flex-col items-center pt-6 pb-24 px-2 w-[72px] flex-shrink-0 backdrop-blur-xl sticky top-0 h-screen self-start z-30 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
          style={{
            background: 'var(--dash-sidebar-bg)',
            [`border${isRtl ? 'Left' : 'Right'}`]: '1px solid var(--dash-sidebar-border)'
          }}
        >
          {/* Logo */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border border-cyan-400/20 flex items-center justify-center mb-8 shadow-lg shadow-cyan-500/10">
            <Zap size={20} className="text-cyan-400" />
          </div>

          {/* Nav Icons */}
          <nav className="flex flex-col gap-1.5 flex-1">
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setTab(tab.id)}
                className={`group relative w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'bg-cyan-500/15 border border-cyan-400/30 text-cyan-400 shadow-lg shadow-cyan-500/10'
                    : 'border border-transparent hover:bg-cyan-500/5'
                }`}
                style={{ color: activeTab !== tab.id ? 'var(--dash-muted-text)' : undefined }}
                title={tab.label.replace('\n', ' ')}
              >
                {tab.icon}
                {/* Tooltip */}
                <span
                  className={`absolute ${isRtl ? 'right-full mr-3' : 'left-full ml-3'} px-3 py-1.5 rounded-lg border border-cyan-500/20 text-xs font-semibold text-cyan-300 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-xl z-50`}
                  style={{ background: 'var(--dash-modal-bg)' }}
                >
                  {tab.label.replace('\n', ' ')}
                </span>
                {/* Active indicator with smooth layout spring animation */}
                {activeTab === tab.id && (
                  <motion.span
                    layoutId="dashTabActiveIndicator"
                    transition={motionTokens.spring.snappy}
                    className={`absolute ${isRtl ? '-left-[1px]' : '-right-[1px]'} top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]`}
                  />
                )}
              </motion.button>
            ))}
          </nav>

          {/* Bottom */}
          <Link
            to="/"
            className="w-12 h-12 rounded-xl flex items-center justify-center text-emerald-500/60 hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 transition-all"
            title={isRtl ? 'العودة للرئيسية' : 'Back to Home'}
          >
            <ArrowRight size={20} className={isRtl ? '' : 'rotate-180'} />
          </Link>
        </aside>

        {/* === Main Area === */}
        <main className="flex-1 min-w-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            {/* Header */}
            <header className="relative pt-6 pb-4 mb-2">
              {/* Decorative top line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
              
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3" style={{ color: 'var(--dash-heading-text)' }}>
                    <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                      {isRtl ? 'شبكة التحكم الموحدة' : 'Unified Control Network'}
                    </span>
                  </h1>
                  <p className="mt-1.5 text-xs md:text-sm max-w-lg" style={{ color: 'var(--dash-muted-text)' }}>
                    {isRtl 
                      ? 'مراقبة حالة الخادم والموارد وعمليات البث بالإضافة إلى إدارة إعدادات النظام بالكامل.' 
                      : 'Monitor server health, active streams, and manage system settings.'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Mobile tab selector */}
                  <select
                    className="md:hidden border text-cyan-300 text-sm rounded-xl px-3 py-2 focus:outline-none"
                    style={{ background: 'var(--dash-input-bg)', borderColor: 'var(--dash-input-border)' }}
                    value={activeTab}
                    onChange={(e) => setTab(e.target.value)}
                  >
                    {tabs.map(tab => (
                      <option key={tab.id} value={tab.id}>{tab.label.replace('\n', ' ')}</option>
                    ))}
                  </select>
                  <Link
                    to="/"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all backdrop-blur-sm hover:text-cyan-300"
                    style={{
                      background: isDark ? 'rgba(12,19,36,0.8)' : 'rgba(255,255,255,0.6)',
                      borderColor: 'var(--dash-input-border)',
                      color: 'var(--dash-muted-text)'
                    }}
                  >
                    <ArrowRight size={16} className={isRtl ? '' : 'rotate-180'} />
                    {isRtl ? 'العودة للرئيسية' : 'Home'}
                  </Link>
                </div>
              </div>
            </header>

            {/* Content with Motion UI Smooth Tab Transition */}
            <div className="pb-32 sm:pb-36 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: motionTokens.distance.md }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -motionTokens.distance.sm }}
                  transition={{
                    duration: motionTokens.duration.normal,
                    ease: motionTokens.easing.smooth,
                  }}
                >
                  {activeTab === 'stats' ? (
                    <DashboardStats />
                  ) : activeTab === 'database' ? (
                    <DashboardDatabase />
                  ) : activeTab === 'users' ? (
                    <DashboardUsers />
                  ) : (
                    <DashboardSettings activeTab={activeTab} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
