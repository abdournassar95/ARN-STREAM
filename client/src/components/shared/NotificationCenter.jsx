import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  X,
  Scan,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Tv,
  Film,
  Music,
  ExternalLink,
  Volume2,
  VolumeX,
  Clock
} from 'lucide-react';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useSettingsStore } from '../../store/useSettingsStore';

function getCategoryIcon(category, type) {
  switch (category) {
    case 'scan':
      return <Scan size={18} className="text-emerald-400" />;
    case 'metadata':
      return <Sparkles size={18} className="text-cyan-400" />;
    case 'health':
      return type === 'warning' || type === 'error' ? (
        <ShieldAlert size={18} className="text-amber-400" />
      ) : (
        <ShieldCheck size={18} className="text-emerald-400" />
      );
    case 'device':
      return <Tv size={18} className="text-purple-400" />;
    case 'movies':
      return <Film size={18} className="text-rose-400" />;
    case 'music':
      return <Music size={18} className="text-amber-400" />;
    default:
      return <Bell size={18} className="text-sky-400" />;
  }
}

function formatRelativeTime(dateStr, isRtl) {
  if (!dateStr) return '';
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return isRtl ? 'الآن' : 'Just now';
    if (diff < 3600) {
      const mins = Math.floor(diff / 60);
      return isRtl ? `منذ ${mins} دقيقة` : `${mins}m ago`;
    }
    if (diff < 86400) {
      const hrs = Math.floor(diff / 3600);
      return isRtl ? `منذ ${hrs} ساعة` : `${hrs}h ago`;
    }
    const days = Math.floor(diff / 86400);
    return isRtl ? `منذ ${days} يوم` : `${days}d ago`;
  } catch {
    return '';
  }
}

/**
 * نافذة درج الإشعارات الرئيسية (Dark Glassmorphism Notification Drawer)
 */
export default function NotificationCenter() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const navigate = useNavigate();
  const { theme } = useSettingsStore();
  const isDark = theme !== 'light';

  const {
    notifications,
    unreadCount,
    isDrawerOpen,
    closeDrawer,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    soundEnabled,
    toggleSound,
    initListeners
  } = useNotificationStore();

  const drawerRef = useRef(null);

  // تفعيل الاستماع اللحظي عند تحميل المكون
  useEffect(() => {
    initListeners();
  }, [initListeners]);

  // إغلاق النافذة عند النقر بالخارج
  useEffect(() => {
    if (!isDrawerOpen) return;
    const handleClickOutside = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        // تأكد من أن النقر ليس على زر الجرس نفسه
        const bellBtn = document.getElementById('topbar-notification-bell');
        if (bellBtn && bellBtn.contains(e.target)) return;
        closeDrawer();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDrawerOpen, closeDrawer]);

  const handleNotificationClick = (item) => {
    if (!item.read) {
      markAsRead(item.id);
    }
    if (item.link) {
      closeDrawer();
      navigate(item.link);
    }
  };

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <motion.div
          ref={drawerRef}
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={`fixed top-16 ${
            isRtl ? 'left-4 md:left-24' : 'right-4 md:right-24'
          } z-[9999] w-[94vw] sm:w-[420px] max-h-[82vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border ${
            isDark
              ? 'bg-slate-950/95 backdrop-blur-2xl border-white/15 text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.7)]'
              : 'bg-white/95 backdrop-blur-2xl border-slate-200 text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.15)]'
          }`}
          style={{ direction: isRtl ? 'rtl' : 'ltr' }}
        >
          {/* Header */}
          <div
            className={`px-4 py-3.5 border-b flex items-center justify-between gap-3 ${
              isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Bell size={16} />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">
                  {isRtl ? 'مركز الإشعارات' : 'Notifications'}
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500 text-slate-950">
                    {unreadCount} {isRtl ? 'جديد' : 'new'}
                  </span>
                )}
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSound}
                className={`p-1.5 rounded-lg transition-colors ${
                  soundEnabled
                    ? 'text-cyan-400 hover:bg-cyan-500/15'
                    : 'text-slate-500 hover:bg-white/10'
                }`}
                title={
                  soundEnabled
                    ? isRtl
                      ? 'صوت التنبيه مفعل (انقر للكتم)'
                      : 'Sound enabled (click to mute)'
                    : isRtl
                    ? 'صوت التنبيه مكتوم (انقر للتفعيل)'
                    : 'Sound muted (click to enable)'
                }
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              {notifications.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                    title={isRtl ? 'تعليم الكل كمقروء' : 'Mark all as read'}
                  >
                    <CheckCheck size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={clearAll}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors"
                    title={isRtl ? 'مسح كافة الإشعارات' : 'Clear all'}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={closeDrawer}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title={isRtl ? 'إغلاق' : 'Close'}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto max-h-[62vh] p-2 space-y-1.5 custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mb-3">
                  <BellOff size={24} />
                </div>
                <p className="text-sm font-semibold text-slate-300">
                  {isRtl ? 'لا توجد إشعارات حتى الآن' : 'No notifications yet'}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-[240px]">
                  {isRtl
                    ? 'ستظهر هنا تحديثات فحص المكتبة، جلب الميتاداتا، وتنبيهات الأجهزة.'
                    : 'Library scan updates, auto-fetched metadata, and alerts will appear here.'}
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const isUnread = !item.read;
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: isRtl ? -10 : 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={() => handleNotificationClick(item)}
                    className={`group relative p-3 rounded-xl transition-all cursor-pointer border ${
                      isUnread
                        ? isDark
                          ? 'bg-gradient-to-r from-cyan-950/40 to-slate-900/60 border-cyan-500/30 hover:border-cyan-500/50'
                          : 'bg-cyan-50/80 border-cyan-200 hover:border-cyan-300'
                        : isDark
                        ? 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
                        : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center border ${
                          isDark
                            ? 'bg-slate-900/80 border-white/10'
                            : 'bg-slate-100 border-slate-200'
                        }`}
                      >
                        {getCategoryIcon(item.category, item.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4
                            className={`text-xs font-bold truncate ${
                              isUnread ? 'text-cyan-300' : 'text-slate-200'
                            }`}
                          >
                            {item.title}
                          </h4>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 flex-shrink-0">
                            <Clock size={10} />
                            {formatRelativeTime(item.created_at, isRtl)}
                          </span>
                        </div>

                        {item.message && (
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {item.message}
                          </p>
                        )}

                        {item.link && (
                          <div className="flex items-center gap-1 text-[10px] text-cyan-400 mt-2 font-medium">
                            <span>{isRtl ? 'فتح في المنظومة' : 'View details'}</span>
                            <ExternalLink size={10} />
                          </div>
                        )}
                      </div>

                      {/* Delete icon on hover */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 flex-shrink-0"
                        title={isRtl ? 'حذف الإشعار' : 'Delete'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Unread indicator dot */}
                    {isUnread && (
                      <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * مكون التنبيهات العائمة اللحظية (Floating Real-time Toast Notifications)
 */
export function NotificationToasts() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const navigate = useNavigate();
  const { theme } = useSettingsStore();
  const isDark = theme !== 'light';

  const { toasts, removeToast } = useNotificationStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className={`fixed bottom-5 ${
        isRtl ? 'left-5' : 'right-5'
      } z-[99999] flex flex-col gap-2 pointer-events-none max-w-[360px] w-full`}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.92 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              if (toast.link) navigate(toast.link);
              removeToast(toast.id);
            }}
            className={`pointer-events-auto p-3.5 rounded-2xl border shadow-2xl cursor-pointer flex items-start gap-3 ${
              isDark
                ? 'bg-slate-950/95 backdrop-blur-2xl border-cyan-500/30 text-white shadow-[0_10px_35px_rgba(0,0,0,0.8)]'
                : 'bg-white/95 backdrop-blur-2xl border-cyan-300 text-slate-900 shadow-[0_10px_35px_rgba(0,0,0,0.15)]'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
              {getCategoryIcon(toast.category, toast.type)}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <h5 className="text-xs font-bold text-cyan-300 leading-tight">
                {toast.title}
              </h5>
              {toast.message && (
                <p className="text-[11px] text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                  {toast.message}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
