import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { changePasswordApi } from '../../api/client';
import client from '../../api/client';
import EditProfileModal from './EditProfileModal';
import { 
  User, Shield, LogOut, KeyRound, Activity, ChevronDown, Check, AlertCircle, X, Sparkles, Play, RotateCcw
} from 'lucide-react';

export default function UserMenu({ isSidebar = false }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { user, logout, isAdmin } = useAuthStore();
  const { theme } = useSettingsStore();
  const isDark = theme !== 'light';
  const [open, setOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const menuRef = useRef(null);

  const handleRestartServer = async () => {
    setShowRestartConfirm(false);
    setIsRestarting(true);
    try {
      await client.post('/system/restart');
    } catch (e) {
      console.warn('[Restart] Trigger sent:', e.message);
    }

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch('/api/libraries?non_empty=true', { cache: 'no-store' });
        if (res.ok) {
          clearInterval(interval);
          setIsRestarting(false);
          window.location.reload();
        }
      } catch (err) {}
      if (attempts > 30) {
        clearInterval(interval);
        window.location.reload();
      }
    }, 1500);
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const roleLabels = {
    admin: isRtl ? 'مدير النظام' : 'Administrator',
    user: isRtl ? 'مستخدم' : 'Standard User',
    guest: isRtl ? 'ضيف' : 'Guest'
  };

  const roleColors = {
    admin: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    user: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    guest: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  };

  return (
    <div className={`relative ${isSidebar ? 'w-full' : 'inline-block text-right'}`} ref={menuRef}>
      {/* Trigger Pill */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={isSidebar 
          ? `flex items-center p-1 rounded-2xl transition w-full group/btn ${
              isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-black/5 text-slate-800'
            }`
          : `flex items-center gap-2.5 px-3.5 py-1.5 rounded-full transition shadow-md backdrop-blur-md group ${
              isDark
                ? 'bg-slate-900/60 border border-white/10 hover:border-cyan-500/40 hover:bg-slate-800/80 text-white'
                : 'bg-surface border border-border hover:border-cyan-500/40 hover:bg-surfaceHover text-text shadow-sm'
            }`
        }
      >
        {/* Avatar / Icon */}
        <div 
          className={`w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-cyan-500/20 shrink-0 overflow-hidden ${isSidebar ? 'mx-auto group-hover/sidebar:mx-0' : ''}`}
          style={{ width: 32, height: 32, minWidth: 32, minHeight: 32, maxWidth: 32, maxHeight: 32, borderRadius: '9999px' }}
        >
          {user.avatar ? (
            <img 
              src={user.avatar} 
              alt={user.display_name || user.username} 
              className="w-full h-full rounded-full object-cover" 
              style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', objectFit: 'cover', borderRadius: '9999px' }}
            />
          ) : (
            <span>{(user.display_name || user.username).charAt(0).toUpperCase()}</span>
          )}
        </div>

        {/* Name & Role */}
        <div className={isSidebar ? "opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-180 ease-out flex flex-col text-start ps-2 whitespace-nowrap overflow-hidden" : "hidden sm:flex flex-col text-start pe-1"}>
          <span className={`text-xs font-bold group-hover:text-cyan-400 transition line-clamp-1 max-w-[120px] ${
            isDark ? 'text-slate-100' : 'text-text'
          }`}>
            {user.display_name || user.username}
          </span>
          <span className="text-[10px] text-text-muted line-clamp-1">
            {roleLabels[user.role] || user.role}
          </span>
        </div>

        {!isSidebar && (
          <ChevronDown size={14} className={`text-text-muted transition-transform duration-200 ${open ? 'rotate-180 text-cyan-400' : ''}`} />
        )}
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className={isSidebar 
          ? `absolute bottom-0 ${isRtl ? 'end-full me-3' : 'start-full ms-3'} w-56 rounded-2xl backdrop-blur-xl shadow-2xl p-2 z-[100] animate-fadeIn text-right font-sans border ${
              isDark
                ? 'bg-slate-900/95 border-white/15 text-white'
                : 'bg-surface border-border text-text'
            }`
          : `absolute left-0 sm:right-0 sm:left-auto mt-2 w-56 rounded-2xl backdrop-blur-xl shadow-2xl p-2 z-50 animate-fadeIn text-right font-sans border ${
              isDark
                ? 'bg-slate-900/95 border-white/15 text-white'
                : 'bg-surface border-border text-text'
            }`
        }>
          {/* User Info Header */}
          <div className="px-3 py-2.5 border-b border-border mb-1">
            <p className="text-xs font-bold text-text truncate">
              {user.display_name || user.username}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleColors[user.role] || roleColors.user}`}>
                {roleLabels[user.role] || user.role}
              </span>
              <span className="text-[11px] text-text-muted truncate">@{user.username}</span>
            </div>
          </div>

          {/* Links */}
          <div className="space-y-0.5">
            <button
              onClick={() => {
                setOpen(false);
                setShowProfileModal(true);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:text-cyan-400 transition ${isRtl ? 'text-right' : 'text-left'} ${
                isDark ? 'text-slate-200 hover:bg-white/10' : 'text-text hover:bg-surfaceHover'
              }`}
            >
              <User size={16} className="text-cyan-400" />
              <span>{isRtl ? 'تعديل الملف الشخصي' : 'Edit Profile'}</span>
            </button>

            <button
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new CustomEvent('arn:show-splash'));
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:text-cyan-400 transition ${isRtl ? 'text-right' : 'text-left'} ${
                isDark ? 'text-slate-200 hover:bg-white/10' : 'text-text hover:bg-surfaceHover'
              }`}
            >
              <Play size={16} className="text-cyan-400" />
              <span>{isRtl ? 'شاشة الإقلاع (Splash Screen)' : 'Show Splash Screen'}</span>
            </button>

            {isAdmin() && (
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:text-cyan-400 transition ${
                  isDark ? 'text-slate-200 hover:bg-white/10' : 'text-text hover:bg-surfaceHover'
                }`}
              >
                <Activity size={16} className="text-emerald-400" />
                <span>{isRtl ? 'لوحة التحكم' : 'Dashboard'}</span>
              </Link>
            )}

            {isAdmin() && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setShowRestartConfirm(true);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:text-amber-400 transition ${isRtl ? 'text-right' : 'text-left'} ${
                  isDark ? 'text-slate-200 hover:bg-white/10' : 'text-text hover:bg-surfaceHover'
                }`}
              >
                <RotateCcw size={16} className="text-amber-400" />
                <span>{isRtl ? 'إعادة تشغيل الخادم' : 'Restart Server'}</span>
              </button>
            )}

            <button
              onClick={() => {
                setOpen(false);
                setShowPasswordModal(true);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:text-cyan-400 transition ${isRtl ? 'text-right' : 'text-left'} ${
                isDark ? 'text-slate-200 hover:bg-white/10' : 'text-text hover:bg-surfaceHover'
              }`}
            >
              <KeyRound size={16} className="text-amber-400" />
              <span>{isRtl ? 'تغيير كلمة المرور' : 'Change Password'}</span>
            </button>

            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition ${isRtl ? 'text-right' : 'text-left'}`}
            >
              <LogOut size={16} />
              <span>{isRtl ? 'تسجيل الخروج' : 'Logout'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showProfileModal && (
        <EditProfileModal onClose={() => setShowProfileModal(false)} />
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}

      {/* Restart Confirmation Modal */}
      {showRestartConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className={`w-full max-w-sm rounded-3xl border shadow-2xl p-6 text-center ${
            isDark ? 'bg-slate-900 border-white/15 text-white' : 'bg-surface border-border text-text'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
              <RotateCcw size={24} />
            </div>
            <h3 className="text-base font-bold mb-2">
              {isRtl ? 'إعادة تشغيل الخادم' : 'Restart Server'}
            </h3>
            <p className="text-xs text-white/70 dark:text-white/70 mb-6 leading-relaxed">
              {isRtl 
                ? 'هل أنت متأكد من رغبتك في إعادة تشغيل خادم ARN Stream؟ سيتم إعادة تشغيل كافة الخدمات تلقائياً.' 
                : 'Are you sure you want to restart ARN Stream server? All background services will reload automatically.'}
            </p>
            <div className="flex items-center gap-3 justify-center">
              <button
                type="button"
                onClick={() => setShowRestartConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleRestartServer}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition"
              >
                {isRtl ? 'إعادة التشغيل الآن' : 'Restart Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restarting Overlay */}
      {isRestarting && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl text-white select-none animate-fadeIn">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-6 border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
            <RotateCcw size={32} className="animate-spin" />
          </div>
          <h2 className="text-xl font-black mb-2 tracking-tight">
            {isRtl ? 'جاري إعادة تشغيل خادم ARN Stream...' : 'Restarting ARN Stream Server...'}
          </h2>
          <p className="text-xs text-white/60 max-w-sm text-center leading-relaxed mb-6">
            {isRtl 
              ? 'يرجى الانتظار، جاري إعادة تشغيل الخدمات والاتصال التلقائي بالخادم فور اكتمال الإقلاع...' 
              : 'Please wait, reloading background services and reconnecting automatically as soon as online...'}
          </p>
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400/80">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>{isRtl ? 'جاري الفحص وإعادة الاتصال...' : 'Checking server status...'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ChangePasswordModal({ onClose }) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentPassword || !newPassword) {
      setErrorMsg(isRtl ? 'يرجى ملء جميع الحقول' : 'Please fill all fields');
      return;
    }

    if (newPassword.length < 4) {
      setErrorMsg(isRtl ? 'يجب أن تكون كلمة المرور الجديدة 4 أحرف على الأقل' : 'New password must be at least 4 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await changePasswordApi({
        current_password: currentPassword,
        new_password: newPassword
      });
      setSuccessMsg(isRtl ? 'تم تحديث كلمة المرور بنجاح!' : 'Password updated successfully!');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMsg(err.response?.data?.error?.message || (isRtl ? 'فشل تحديث كلمة المرور. تحقق من كلمة المرور الحالية.' : 'Failed to update password. Verify current password.'));
    } finally {
      setLoading(false);
    }
  };

  const { theme } = useSettingsStore();
  const isDark = theme !== 'light';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className={`w-full max-w-md border rounded-3xl p-6 md:p-8 shadow-2xl relative ${
        isDark ? 'bg-slate-900 border-white/15 text-slate-100' : 'bg-surface border-border text-text'
      }`}>
        <button
          onClick={onClose}
          className={`absolute top-5 ${isRtl ? 'left-5' : 'right-5'} p-1 rounded-full transition ${
            isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-text-muted hover:text-text hover:bg-surfaceHover'
          }`}
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <KeyRound size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-text">{isRtl ? 'تغيير كلمة المرور' : 'Change Password'}</h3>
            <p className="text-xs text-text-muted">{isRtl ? 'أدخل كلمة المرور الحالية ثم اختر كلمة مرور جديدة' : 'Enter current password, then choose a new password'}</p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <Check size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text mb-1">{isRtl ? 'كلمة المرور الحالية' : 'Current Password'}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">{isRtl ? 'كلمة المرور الجديدة' : 'New Password'}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">{isRtl ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text transition"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition disabled:opacity-60"
            >
              {loading ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'حفظ كلمة المرور' : 'Save Password')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
