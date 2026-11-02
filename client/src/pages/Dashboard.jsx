import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  ArrowRight, Settings, Monitor, FolderSearch, PlayCircle, Users,
  BarChart3, Zap, Database, ShieldCheck
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { motionTokens } from '../utils/motionTokens';
import { useSettingsStore } from '../store/useSettingsStore';
import DashboardStats from './DashboardStats';
import DashboardSettings from './DashboardSettings';
import DashboardUsers from './DashboardUsers';
import DashboardDatabase from './DashboardDatabase';
import DashboardLicense from './DashboardLicense';

export default function Dashboard() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { theme } = useSettingsStore();
  const isDark = theme !== 'light';
  
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'stats';

  const setTab = (tab) => {
    setSearchParams({ tab });
  };

  const tabs = [
    { id: 'stats', label: isRtl ? 'الإحصائيات' : 'Stats', icon: <BarChart3 size={19} /> },
    { id: 'database', label: isRtl ? 'قاعدة البيانات' : 'Database', icon: <Database size={19} /> },
    { id: 'users', label: isRtl ? 'المستخدمين والصلاحيات' : 'Users & Roles', icon: <Users size={19} /> },
    { id: 'license', label: isRtl ? 'حالة التنشيط والاشتراك' : 'License & Subscription', icon: <ShieldCheck size={19} /> },
    { id: 'general', label: isRtl ? 'إعدادات عامة' : 'General', icon: <Settings size={19} /> },
    { id: 'display', label: isRtl ? 'إعدادات العرض' : 'Display', icon: <Monitor size={19} /> },
    { id: 'playback', label: isRtl ? 'التشغيل' : 'Playback', icon: <PlayCircle size={19} /> },
    { id: 'libraries', label: isRtl ? 'إدارة المكتبات' : 'Libraries', icon: <FolderSearch size={19} /> }
  ];

  return (
    <div className="min-h-screen relative font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* === Studio Pro Background (Calm, Pure, Refined) === */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute inset-0 transition-colors duration-500"
          style={{
            backgroundColor: 'var(--dash-bg-deep)',
            backgroundImage: isDark
              ? `radial-gradient(circle at 18% 22%, rgba(0, 210, 255, 0.05) 0%, transparent 45%), radial-gradient(circle at 82% 65%, rgba(58, 123, 213, 0.04) 0%, transparent 50%)`
              : `radial-gradient(circle at 18% 22%, rgba(0, 210, 255, 0.03) 0%, transparent 45%), radial-gradient(circle at 82% 65%, rgba(58, 123, 213, 0.02) 0%, transparent 50%)`
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'var(--dash-vignette)' }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* === Sidebar (Sticky Glassmorphic Rail) === */}
        <aside
          className={`hidden md:flex flex-col items-center pt-6 pb-24 px-2 w-[76px] flex-shrink-0 backdrop-blur-2xl sticky top-0 h-screen self-start z-30 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
          style={{
            background: 'var(--dash-sidebar-bg)',
            [`border${isRtl ? 'Left' : 'Right'}`]: '1px solid var(--dash-sidebar-border)'
          }}
        >
          {/* Logo Badge */}
          <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-7 shadow-lg shadow-black/20 group hover:border-[#00d2ff]/40 transition-colors">
            <Zap size={20} className="text-[#00d2ff] transition-transform group-hover:scale-110" />
          </div>

          {/* Nav Icons */}
          <nav className="flex flex-col gap-2 flex-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setTab(tab.id)}
                  className={`group relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? 'bg-[#00d2ff]/12 border border-[#00d2ff]/35 text-[#00d2ff] shadow-[0_0_16px_rgba(0,210,255,0.18)]'
                      : 'border border-transparent text-[#8b92a5] hover:text-white hover:bg-white/[0.04]'
                  }`}
                  title={tab.label}
                >
                  {tab.icon}
                  
                  {/* Tooltip */}
                  <span
                    className={`absolute ${isRtl ? 'right-full mr-3' : 'left-full ml-3'} px-3 py-1.5 rounded-xl border border-white/10 text-xs font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-2xl z-50`}
                    style={{ background: 'var(--dash-modal-bg)' }}
                  >
                    {tab.label}
                  </span>

                  {/* Active indicator with smooth layout spring animation */}
                  {isActive && (
                    <motion.span
                      layoutId="dashTabActiveIndicator"
                      transition={motionTokens.spring.snappy}
                      className={`absolute ${isRtl ? '-left-[1px]' : '-right-[1px]'} top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-[#00d2ff] shadow-[0_0_10px_rgba(0,210,255,0.8)]`}
                    />
                  )}
                </motion.button>
              );
            })}
          </nav>

          {/* Bottom Back Button */}
          <Link
            to="/"
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#8b92a5] hover:text-white hover:bg-white/[0.05] border border-transparent hover:border-white/10 transition-all shadow-sm"
            title={isRtl ? 'العودة للرئيسية' : 'Back to Home'}
          >
            <ArrowRight size={18} className={isRtl ? '' : 'rotate-180'} />
          </Link>
        </aside>

        {/* === Main Content Area === */}
        <main className="flex-1 min-w-0 dash-scope">
          <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-8 lg:px-10">
            
            {/* Header */}
            <header className="relative pt-7 pb-5 mb-3">
              {/* Decorative subtle hairline */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00d2ff]/20 to-transparent" />
              
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3">
                    <span style={{ color: 'var(--dash-heading-text)' }}>
                      {isRtl ? 'شبكة التحكم الموحدة' : 'Unified Control Network'}
                    </span>
                  </h1>
                  <p className="mt-1 text-xs md:text-sm text-[#8b92a5]">
                    {isRtl 
                      ? 'مراقبة حالة الخادم والموارد وعمليات البث بالإضافة إلى إدارة إعدادات النظام بالكامل.' 
                      : 'Monitor server health, active streams, and manage system settings with precision.'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Mobile tab selector */}
                  <select
                    className="md:hidden border text-sm rounded-xl px-3 py-2 focus:outline-none backdrop-blur-xl"
                    style={{
                      background: 'var(--dash-input-bg)',
                      borderColor: 'var(--dash-input-border)',
                      color: 'var(--dash-input-text)'
                    }}
                    value={activeTab}
                    onChange={(e) => setTab(e.target.value)}
                  >
                    {tabs.map(tab => (
                      <option key={tab.id} value={tab.id}>{tab.label}</option>
                    ))}
                  </select>

                  {/* Return Home Pill Button */}
                  <Link
                    to="/"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition-all backdrop-blur-xl bg-white/[0.03] hover:bg-white/[0.08] hover:border-[#00d2ff]/40 text-[#8b92a5] hover:text-white shadow-sm"
                    style={{
                      borderColor: 'var(--dash-input-border)'
                    }}
                  >
                    <ArrowRight size={15} className={isRtl ? '' : 'rotate-180'} />
                    {isRtl ? 'الرئيسية' : 'Home'}
                  </Link>
                </div>
              </div>
            </header>

            {/* Content with Smooth Motion Transition */}
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
                  ) : activeTab === 'license' ? (
                    <DashboardLicense />
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
