import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { updateProfileApi } from '../../api/client';
import AvatarPicker from './AvatarPicker';
import { 
  User, Shield, KeyRound, Check, X, AlertCircle, Loader2, Sparkles, Lock 
} from 'lucide-react';

export default function EditProfileModal({ onClose }) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { user, setUser } = useAuthStore();
  const { theme } = useSettingsStore();
  const isDark = theme !== 'light';

  const [displayName, setDisplayName] = useState(user?.display_name || user?.username || '');
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!user) return null;

  const roleLabels = {
    admin: isRtl ? 'مدير النظام' : 'Administrator',
    user: isRtl ? 'مستخدم عادي' : 'Standard User',
    guest: isRtl ? 'حساب ضيف' : 'Guest Account'
  };

  const roleColors = {
    admin: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    user: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    guest: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (showPasswordSection && newPassword) {
      if (!currentPassword) {
        setErrorMsg(isRtl ? 'يرجى إدخال كلمة المرور الحالية لتأكيد التغيير' : 'Current password is required to change password');
        return;
      }
      if (newPassword.length < 4) {
        setErrorMsg(isRtl ? 'كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل' : 'New password must be at least 4 characters');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg(isRtl ? 'كلمة المرور الجديدة وتأكيدها غير متطابقين' : 'Passwords do not match');
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        display_name: displayName.trim(),
        avatar: avatar || null
      };

      if (showPasswordSection && newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      const updatedUser = await updateProfileApi(payload);
      setUser(updatedUser);
      setSuccessMsg(isRtl ? 'تم تحديث الملف الشخصي بنجاح!' : 'Profile updated successfully!');
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      console.error('Update profile error:', err);
      const code = err.response?.data?.error?.code;
      if (code === 'WRONG_PASSWORD') {
        setErrorMsg(isRtl ? 'كلمة المرور الحالية غير صحيحة' : 'Current password is incorrect');
      } else {
        setErrorMsg(err.response?.data?.error?.message || (isRtl ? 'حدث خطأ أثناء حفظ التعديلات' : 'Failed to save changes'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn" dir={isRtl ? 'rtl' : 'ltr'}>
      <div 
        className={`w-full max-w-xl rounded-3xl border shadow-2xl p-6 sm:p-8 relative max-h-[92vh] overflow-y-auto scrollbar-thin ${
          isDark 
            ? 'bg-slate-900/95 border-white/10 text-white' 
            : 'bg-surface border-border text-text'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-5 ${isRtl ? 'left-5' : 'right-5'} p-2 rounded-full hover:bg-white/10 text-muted hover:text-text transition`}
          title={isRtl ? 'إغلاق' : 'Close'}
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10 shrink-0">
            <User size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black tracking-tight">
                {isRtl ? 'تعديل الملف الشخصي' : 'Edit Profile'}
              </h3>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${roleColors[user.role] || roleColors.user}`}>
                {roleLabels[user.role] || user.role}
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              @{user.username} • {isRtl ? 'تخصيص صورتك واسمك الظاهر وإعدادات حسابك' : 'Customize your avatar, display name, and account'}
            </p>
          </div>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <Check size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar Section */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-text">
              {isRtl ? 'الصورة الشخصية (Avatar)' : 'Profile Picture (Avatar)'}
            </label>
            <AvatarPicker 
              value={avatar} 
              onChange={setAvatar} 
              displayName={displayName || user.username} 
            />
          </div>

          {/* User Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-border/50">
            {/* Display Name */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-text">
                {isRtl ? 'الاسم الظاهر (Display Name)' : 'Display Name'}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={user.username}
                required
                className="w-full border rounded-xl px-4 py-2.5 text-xs bg-surface border-border focus:outline-none focus:border-cyan-500 text-text transition"
              />
            </div>

            {/* Username (Read Only) */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-text">
                {isRtl ? 'اسم الدخول (Username)' : 'Username'}
              </label>
              <input
                type="text"
                value={user.username}
                disabled
                className="w-full border rounded-xl px-4 py-2.5 text-xs bg-surface/50 border-border/50 text-muted cursor-not-allowed opacity-70"
              />
            </div>
          </div>

          {/* Password Accordion / Section */}
          <div className="pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="flex items-center justify-between w-full p-3 rounded-xl bg-surface/40 hover:bg-surface border border-border/60 text-xs font-bold text-text transition"
            >
              <div className="flex items-center gap-2">
                <Lock size={15} className="text-amber-400" />
                <span>{isRtl ? 'تغيير كلمة المرور (اختياري)' : 'Change Password (Optional)'}</span>
              </div>
              <span className="text-[11px] text-cyan-400 font-normal">
                {showPasswordSection ? (isRtl ? 'إخفاء' : 'Hide') : (isRtl ? 'تعديل' : 'Modify')}
              </span>
            </button>

            {showPasswordSection && (
              <div className="mt-3 p-4 rounded-2xl bg-surface/30 border border-border/40 space-y-3 animate-fadeIn">
                <div>
                  <label className="block text-[11px] font-semibold mb-1 text-muted">
                    {isRtl ? 'كلمة المرور الحالية' : 'Current Password'}
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border rounded-xl px-3.5 py-2 text-xs bg-surface border-border focus:outline-none focus:border-cyan-500 text-text"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-muted">
                      {isRtl ? 'كلمة المرور الجديدة' : 'New Password'}
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border rounded-xl px-3.5 py-2 text-xs bg-surface border-border focus:outline-none focus:border-cyan-500 text-text"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-muted">
                      {isRtl ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border rounded-xl px-3.5 py-2 text-xs bg-surface border-border focus:outline-none focus:border-cyan-500 text-text"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/50">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-full text-xs font-semibold hover:bg-surface text-muted hover:text-text transition"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{isRtl ? 'جاري الحفظ...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  <Check size={14} className="stroke-[3]" />
                  <span>{isRtl ? 'حفظ التعديلات' : 'Save Changes'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
