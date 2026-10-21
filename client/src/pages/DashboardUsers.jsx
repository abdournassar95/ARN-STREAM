import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  fetchUsersList, createUserApi, updateUserApi, deleteUserApi, fetchLibraries 
} from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { localizeLibraryName } from '../utils/localization';
import AvatarPicker from '../components/shared/AvatarPicker';
import { 
  Users, UserPlus, Shield, User, KeyRound, Check, X, AlertCircle, 
  Trash2, Edit, CheckCircle2, XCircle, Lock, BookOpen, Film, Tv, Music,
  Download, Cast, Eye
} from 'lucide-react';

export default function DashboardUsers() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const { theme } = useSettingsStore();
  const isDark = theme !== 'light';

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);

  // Fetch users list
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['usersList'],
    queryFn: fetchUsersList
  });

  // Fetch libraries for permission mapping
  const { data: libraries = [] } = useQuery({
    queryKey: ['libraries'],
    queryFn: () => fetchLibraries(false)
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteUserApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['usersList']);
      setDeleteConfirmUser(null);
    }
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => updateUserApi(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries(['usersList']);
    }
  });

  const roleBadges = {
    admin: { label: isRtl ? 'مدير النظام (Admin)' : 'Admin', class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    user: { label: isRtl ? 'مستخدم عادي (User)' : 'User', class: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    guest: { label: isRtl ? 'ضيف (Guest)' : 'Guest', class: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
  };

  const headingStyle = { color: 'var(--dash-heading-text)' };
  const mutedStyle = { color: 'var(--dash-muted-text)' };
  const bodyStyle = { color: 'var(--dash-body-text)' };

  return (
    <div className="space-y-3 animate-fadeIn">
      {/* Header bar */}
      <div className="dash-card"><div className="dash-card-inner flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2" style={headingStyle}>
            <Users className="text-cyan-400" size={20} />
            <span>{isRtl ? 'إدارة المستخدمين والصلاحيات (RBAC)' : 'User Management & Permissions (RBAC)'}</span>
          </h2>
          <p className="text-[11px] mt-0.5" style={mutedStyle}>
            {isRtl 
              ? 'تحكم بالحسابات المسموح لها بالوصول إلى الخادم، تعيين الرتب، وتخصيص المكتبات المسموح بمشاهدتها لكل مستخدم.' 
              : 'Control server access accounts, assign roles, and customize library access permissions.'}
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 transition active:scale-95 shrink-0"
        >
          <UserPlus size={15} />
          <span>{isRtl ? 'إضافة مستخدم جديد' : 'Add New User'}</span>
        </button>
      </div></div>

      {/* Users Table / Grid */}
      {isLoading ? (
        <div className="p-10 text-center text-xs" style={mutedStyle}>
          <div className="w-7 h-7 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          {isRtl ? 'جاري تحميل قائمة المستخدمين...' : 'Loading users list...'}
        </div>
      ) : (
        <div className="dash-card"><div className="dash-card-inner overflow-hidden">
          <div className="overflow-x-auto">
            <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
              <thead style={{ background: 'var(--dash-table-header-bg)', borderBottom: '1px solid var(--dash-card-border)' }} className="text-[10px] font-bold uppercase">
                <tr>
                  <th className="py-2.5 px-3" style={mutedStyle}>{isRtl ? 'المستخدم' : 'User'}</th>
                  <th className="py-2.5 px-3" style={mutedStyle}>{isRtl ? 'اسم الدخول' : 'Username'}</th>
                  <th className="py-2.5 px-3" style={mutedStyle}>{isRtl ? 'الرتبة' : 'Role'}</th>
                  <th className="py-2.5 px-3" style={mutedStyle}>{isRtl ? 'المكتبات المتاحة' : 'Allowed Libraries'}</th>
                  <th className="py-2.5 px-3" style={mutedStyle}>{isRtl ? 'الصلاحيات' : 'Permissions'}</th>
                  <th className="py-2.5 px-3" style={mutedStyle}>{isRtl ? 'الحالة' : 'Status'}</th>
                  <th className="py-2.5 px-3" style={mutedStyle}>{isRtl ? 'آخر ظهور' : 'Last Login'}</th>
                  <th className="py-2.5 px-3 text-center" style={mutedStyle}>{isRtl ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ '--tw-divide-opacity': 1, borderColor: 'var(--dash-card-border)' }}>
                {users.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  const roleInfo = roleBadges[u.role] || roleBadges.user;

                  return (
                    <tr key={u.id} className="transition" onMouseEnter={e => e.currentTarget.style.background = 'var(--dash-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                      {/* Name & Avatar */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0 overflow-hidden">
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.display_name || u.username} className="w-full h-full object-cover" />
                            ) : (
                              <span>{(u.display_name || u.username).charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold flex items-center gap-1.5 text-xs" style={headingStyle}>
                              <span>{u.display_name || u.username}</span>
                              {isSelf && (
                                <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1 py-0.2 rounded border border-cyan-500/30">
                                  {isRtl ? 'أنت' : 'You'}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px]" style={mutedStyle}>ID: #{u.id}</div>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="py-2.5 px-3 font-mono text-xs" style={bodyStyle}>
                        @{u.username}
                      </td>

                      {/* Role */}
                      <td className="py-2.5 px-3">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleInfo.class}`}>
                          {roleInfo.label}
                        </span>
                      </td>

                      {/* Allowed Libraries */}
                      <td className="py-2.5 px-3">
                        {!u.allowed_libraries || u.allowed_libraries.length === 0 ? (
                          <span className="text-emerald-400 font-semibold text-[10px] flex items-center gap-1">
                            <Check size={13} /> {isRtl ? 'كل المكتبات' : 'All Libraries'}
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {u.allowed_libraries.map((libId) => {
                              const found = libraries.find(l => l.id === libId);
                              return (
                                <span
                                  key={libId}
                                  className="text-[9px] border px-1.5 py-0.2 rounded"
                                  style={{ background: 'var(--dash-input-bg)', borderColor: 'var(--dash-input-border)', color: 'var(--dash-body-text)' }}
                                >
                                  {found ? localizeLibraryName(found.name, isRtl) : `${isRtl ? 'مكتبة' : 'Library'} #${libId}`}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Permissions */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1 items-center">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border transition ${
                            (u.role === 'admin' || u.can_download)
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'text-slate-600 border-slate-500/10 line-through opacity-60'
                          }`} style={{ background: !(u.role === 'admin' || u.can_download) ? 'var(--dash-input-bg)' : undefined }} title={(u.role === 'admin' || u.can_download) ? (isRtl ? 'صلاحية التنزيل مفعلة' : 'Download enabled') : (isRtl ? 'صلاحية التنزيل معطلة' : 'Download disabled')}>
                            <Download size={10} />
                            <span>{isRtl ? 'تنزيل' : 'Download'}</span>
                          </span>

                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border transition ${
                            (u.role === 'admin' || u.can_cast)
                              ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                              : 'text-slate-600 border-slate-500/10 line-through opacity-60'
                          }`} style={{ background: !(u.role === 'admin' || u.can_cast) ? 'var(--dash-input-bg)' : undefined }} title={(u.role === 'admin' || u.can_cast) ? (isRtl ? 'صلاحية البث مفعلة' : 'Cast enabled') : (isRtl ? 'صلاحية البث معطلة' : 'Cast disabled')}>
                            <Cast size={10} />
                            <span>{isRtl ? 'بث للأجهزة' : 'Cast'}</span>
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
                        <button
                          disabled={isSelf}
                          onClick={() => toggleActiveMutation.mutate({ id: u.id, is_active: !u.is_active })}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition ${
                            u.is_active 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
                              : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                          } ${isSelf ? 'opacity-70 cursor-not-allowed' : ''}`}
                          title={isSelf ? (isRtl ? 'لا يمكنك تجميد حسابك الخاص' : 'Cannot disable your own account') : (isRtl ? 'اضغط لتغيير الحالة' : 'Click to toggle status')}
                        >
                          {u.is_active ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                          <span>{u.is_active ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'معطّل' : 'Disabled')}</span>
                        </button>
                      </td>

                      {/* Last login */}
                      <td className="py-2.5 px-3 text-[10px]" style={mutedStyle}>
                        {u.last_login ? new Date(u.last_login).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : (isRtl ? 'لم يسجل دخول بعد' : 'Never logged in')}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setEditingUser(u)}
                            className="p-1.5 rounded-lg hover:bg-cyan-500/10 hover:text-cyan-300 border transition"
                            style={{ background: 'var(--dash-input-bg)', borderColor: 'var(--dash-input-border)', color: 'var(--dash-muted-text)' }}
                            title={isRtl ? 'تعديل المستخدم والصلاحيات' : 'Edit User & Permissions'}
                          >
                            <Edit size={13} />
                          </button>

                          {!isSelf && (
                            <button
                              onClick={() => setDeleteConfirmUser(u)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition"
                              title={isRtl ? 'حذف المستخدم' : 'Delete User'}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div></div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <UserFormModal
          mode="create"
          libraries={libraries}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['usersList']);
            setShowAddModal(false);
          }}
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <UserFormModal
          mode="edit"
          user={editingUser}
          libraries={libraries}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            queryClient.invalidateQueries(['usersList']);
            setEditingUser(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmUser && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="w-full max-w-sm border rounded-3xl p-6 shadow-2xl text-center" style={{ background: 'var(--dash-modal-bg)', borderColor: 'rgba(239,68,68,0.2)' }}>
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4 border border-red-500/30">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold mb-2" style={headingStyle}>{isRtl ? 'تأكيد حذف المستخدم' : 'Confirm User Deletion'}</h3>
            <p className="text-xs mb-6" style={mutedStyle}>
              {isRtl 
                ? <>هل أنت متأكد من حذف الحساب <span className="font-bold" style={headingStyle}>@{deleteConfirmUser.username}</span>؟ سيتم مسح كافة تفضيلاته وقوائمه الخاصة.</>
                : <>Are you sure you want to delete user <span className="font-bold" style={headingStyle}>@{deleteConfirmUser.username}</span>? All preferences and playlists will be erased.</>}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border transition"
                style={{ background: 'var(--dash-input-bg)', color: 'var(--dash-body-text)', borderColor: 'var(--dash-input-border)' }}
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteConfirmUser.id)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-red-600/25 transition disabled:opacity-60"
              >
                {deleteMutation.isPending ? (isRtl ? 'جاري الحذف...' : 'Deleting...') : (isRtl ? 'نعم، حذف الحساب' : 'Yes, Delete Account')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function UserFormModal({ mode = 'create', user = null, libraries = [], onClose, onSuccess }) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { theme } = useSettingsStore();
  const isDark = theme !== 'light';

  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role || 'user');
  const [allowedLibraries, setAllowedLibraries] = useState(user?.allowed_libraries || []);
  const [allLibraries, setAllLibraries] = useState(!user?.allowed_libraries || user?.allowed_libraries?.length === 0);
  const [canDownload, setCanDownload] = useState(user?.can_download !== undefined ? Boolean(user.can_download) : true);
  const [canCast, setCanCast] = useState(user?.can_cast !== undefined ? Boolean(user.can_cast) : true);
  const [showOnLogin, setShowOnLogin] = useState(user?.show_on_login !== undefined ? Boolean(user.show_on_login) : true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const headingStyle = { color: 'var(--dash-heading-text)' };
  const mutedStyle = { color: 'var(--dash-muted-text)' };
  const bodyStyle = { color: 'var(--dash-body-text)' };
  const inputStyle = { background: 'var(--dash-input-bg)', borderColor: 'var(--dash-input-border)', color: 'var(--dash-input-text)' };
  const cardInnerBg = isDark ? 'rgba(10,15,30,0.6)' : 'rgba(241,245,249,0.6)';

  const toggleLibrary = (libId) => {
    if (allowedLibraries.includes(libId)) {
      setAllowedLibraries(allowedLibraries.filter(id => id !== libId));
    } else {
      setAllowedLibraries([...allowedLibraries, libId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (mode === 'create') {
      if (!username.trim() || !password) {
        setErrorMsg(isRtl ? 'يرجى كتابة اسم المستخدم وكلمة المرور' : 'Please enter username and password');
        return;
      }
      if (password.length < 4) {
        setErrorMsg(isRtl ? 'يجب أن تكون كلمة المرور 4 أحرف على الأقل' : 'Password must be at least 4 characters');
        return;
      }

      setSubmitting(true);
      try {
        await createUserApi({
          username: username.trim(),
          password,
          display_name: displayName.trim() || username.trim(),
          avatar: avatar || null,
          role,
          allowed_libraries: allLibraries ? null : allowedLibraries,
          can_download: role === 'admin' ? true : canDownload,
          can_cast: role === 'admin' ? true : canCast,
          show_on_login: showOnLogin
        });
        onSuccess();
      } catch (err) {
        setErrorMsg(err.response?.data?.error?.message || (isRtl ? 'فشل إنشاء المستخدم' : 'Failed to create user'));
      } finally {
        setSubmitting(false);
      }
    } else {
      // Edit mode
      setSubmitting(true);
      try {
        const payload = {
          display_name: displayName.trim() || username.trim(),
          avatar: avatar || null,
          role,
          allowed_libraries: allLibraries ? null : allowedLibraries,
          can_download: role === 'admin' ? true : canDownload,
          can_cast: role === 'admin' ? true : canCast,
          show_on_login: showOnLogin
        };
        if (password) {
          if (password.length < 4) {
            setErrorMsg(isRtl ? 'يجب أن تكون كلمة المرور الجديدة 4 أحرف على الأقل' : 'New password must be at least 4 characters');
            setSubmitting(false);
            return;
          }
          payload.password = password;
        }

        await updateUserApi(user.id, payload);
        onSuccess();
      } catch (err) {
        setErrorMsg(err.response?.data?.error?.message || (isRtl ? 'فشل تحديث بيانات المستخدم' : 'Failed to update user'));
      } finally {
        setSubmitting(false);
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-fadeIn" dir={isRtl ? 'rtl' : 'ltr'}>
      <form 
        onSubmit={handleSubmit}
        className="w-full max-w-2xl border rounded-3xl shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden" 
        style={{ background: 'var(--dash-modal-bg)', borderColor: 'var(--dash-input-border)' }}
      >
        {/* Fixed Header */}
        <div className="px-6 py-4 sm:py-5 border-b shrink-0 flex items-center justify-between" style={{ borderColor: 'var(--dash-input-border)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              {mode === 'create' ? <UserPlus size={20} /> : <Edit size={20} />}
            </div>
            <div>
              <h3 className="text-base font-bold" style={headingStyle}>
                {mode === 'create' ? (isRtl ? 'إضافة مستخدم جديد' : 'Add New User') : (isRtl ? `تعديل المستخدم: @${user.username}` : `Edit User: @${user.username}`)}
              </h3>
              <p className="text-xs" style={mutedStyle}>
                {mode === 'create' 
                  ? (isRtl ? 'أنشئ حساباً جديداً وحدد الرتبة والمكتبات المتاحة له' : 'Create a new account, assign a role and accessible libraries')
                  : (isRtl ? 'تعديل الصلاحيات والمكتبات المتاحة أو إعادة تعيين كلمة المرور' : 'Update permissions, accessible libraries, or reset password')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-cyan-500/10 transition"
            style={{ color: 'var(--dash-muted-text)' }}
            title={isRtl ? 'إغلاق' : 'Close'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Avatar Selection */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={bodyStyle}>
              {isRtl ? 'الصورة الشخصية (Avatar)' : 'Profile Picture'}
            </label>
            <AvatarPicker
              value={avatar}
              onChange={setAvatar}
              displayName={displayName || username}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={bodyStyle}>{isRtl ? 'اسم الدخول (Username)' : 'Username'}</label>
              <input
                type="text"
                disabled={mode === 'edit'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ahmed"
                required
                className="w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none disabled:opacity-50"
                style={inputStyle}
              />
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={bodyStyle}>{isRtl ? 'الاسم الظاهر (Display Name)' : 'Display Name'}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={isRtl ? 'أحمد محمد' : 'Ahmed Mohamed'}
                className="w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={bodyStyle}>
              {mode === 'create' ? (isRtl ? 'كلمة المرور' : 'Password') : (isRtl ? 'تعيين كلمة مرور جديدة (اتركه فارغاً للإبقاء على الحالية)' : 'New Password (leave empty to keep current)')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required={mode === 'create'}
              className="w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none transition"
              style={inputStyle}
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={bodyStyle}>{isRtl ? 'رتبة المستخدم (Role)' : 'User Role'}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'user', label: isRtl ? 'مستخدم عادي' : 'Standard User', desc: isRtl ? 'مشاهدة ومفضلات وقوائم خاصة' : 'Watch, personal favorites & playlists' },
                { id: 'admin', label: isRtl ? 'مدير النظام' : 'Administrator', desc: isRtl ? 'صلاحيات كاملة ولوحة تحكم' : 'Full access & dashboard control' },
                { id: 'guest', label: isRtl ? 'ضيف' : 'Guest', desc: isRtl ? 'تصفح ومشاهدة فقط' : 'Browse & stream only' },
              ].map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={`p-3 rounded-xl border ${isRtl ? 'text-right' : 'text-left'} transition flex flex-col justify-between ${
                    role === r.id
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 shadow-md shadow-cyan-500/10'
                      : 'hover:bg-cyan-500/5'
                  }`}
                  style={{
                    background: role !== r.id ? cardInnerBg : undefined,
                    borderColor: role !== r.id ? 'var(--dash-input-border)' : undefined,
                    color: role !== r.id ? 'var(--dash-body-text)' : undefined
                  }}
                >
                  <span className="font-bold text-xs">{r.label}</span>
                  <span className="text-[10px] mt-1 leading-tight" style={mutedStyle}>{r.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Library Permissions */}
          <div className="pt-2 border-t" style={{ borderColor: 'var(--dash-input-border)' }}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold" style={bodyStyle}>
                {isRtl ? 'صلاحيات الوصول للمكتبات' : 'Library Access Permissions'}
              </label>
              <label className="flex items-center gap-1.5 text-xs text-cyan-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allLibraries}
                  onChange={(e) => setAllLibraries(e.target.checked)}
                  className="rounded border-white/20 text-cyan-500 focus:ring-0"
                />
                <span>{isRtl ? 'الوصول لكافة المكتبات' : 'Access all libraries'}</span>
              </label>
            </div>

            {!allLibraries && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 p-3 rounded-xl border max-h-36 overflow-y-auto" style={{ background: cardInnerBg, borderColor: 'var(--dash-input-border)' }}>
                {libraries.map((lib) => {
                  const isSelected = allowedLibraries.includes(lib.id);
                  return (
                    <button
                      type="button"
                      key={lib.id}
                      onClick={() => toggleLibrary(lib.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border ${isRtl ? 'text-right' : 'text-left'} text-xs transition ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                          : 'hover:opacity-80'
                      }`}
                      style={{
                        background: !isSelected ? cardInnerBg : undefined,
                        borderColor: !isSelected ? 'var(--dash-input-border)' : undefined,
                        color: !isSelected ? 'var(--dash-body-text)' : undefined
                      }}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-cyan-400 bg-cyan-400 text-black' : ''
                      }`} style={{ borderColor: !isSelected ? 'var(--dash-muted-text)' : undefined }}>
                        {isSelected && <Check size={10} />}
                      </span>
                      <span className="truncate">{localizeLibraryName(lib.name, isRtl)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Extra Feature Permissions (Downloads & Casting & Login Display) */}
          <div className="pt-3 border-t space-y-2.5" style={{ borderColor: 'var(--dash-input-border)' }}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold flex items-center gap-1.5" style={bodyStyle}>
                <Shield size={14} className="text-cyan-400" />
                <span>{isRtl ? 'صلاحيات الميزات المتقدمة' : 'Advanced Feature Permissions'}</span>
              </label>
              {role === 'admin' && (
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                  {isRtl ? 'المدير يمتلك كافة الصلاحيات دائماً' : 'Admins always have full permissions'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {/* Download Permission Card */}
              <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition select-none ${
                role === 'admin' || canDownload 
                  ? 'bg-amber-500/10 border-amber-500/30' 
                  : 'opacity-70'
              } ${role === 'admin' ? 'cursor-not-allowed' : 'cursor-pointer hover:border-amber-500/40'}`}
                style={{ background: !(role === 'admin' || canDownload) ? cardInnerBg : undefined, borderColor: !(role === 'admin' || canDownload) ? 'var(--dash-input-border)' : undefined }}
              >
                <input
                  type="checkbox"
                  disabled={role === 'admin'}
                  checked={role === 'admin' || canDownload}
                  onChange={(e) => setCanDownload(e.target.checked)}
                  className="mt-0.5 rounded border-cyan-500/20 text-amber-500 focus:ring-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5 text-amber-300">
                    <Download size={13} />
                    <span>{isRtl ? 'تنزيل الملفات (Downloads)' : 'File Downloads'}</span>
                  </div>
                  <p className="text-[10px] mt-0.5 leading-tight" style={mutedStyle}>
                    {isRtl 
                      ? 'السماح بتحميل الأفلام، المسلسلات، الألبومات، والتلاوات وحزم ZIP.' 
                      : 'Allow downloading movies, episodes, albums, tracks, and ZIP archives.'}
                  </p>
                </div>
              </label>

              {/* Cast Permission Card */}
              <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition select-none ${
                role === 'admin' || canCast 
                  ? 'bg-blue-500/10 border-blue-500/30' 
                  : 'opacity-70'
              } ${role === 'admin' ? 'cursor-not-allowed' : 'cursor-pointer hover:border-blue-500/40'}`}
                style={{ background: !(role === 'admin' || canCast) ? cardInnerBg : undefined, borderColor: !(role === 'admin' || canCast) ? 'var(--dash-input-border)' : undefined }}
              >
                <input
                  type="checkbox"
                  disabled={role === 'admin'}
                  checked={role === 'admin' || canCast}
                  onChange={(e) => setCanCast(e.target.checked)}
                  className="mt-0.5 rounded border-cyan-500/20 text-blue-500 focus:ring-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5 text-blue-300">
                    <Cast size={13} />
                    <span>{isRtl ? 'البث للأجهزة (Cast & Handoff)' : 'Device Casting & Handoff'}</span>
                  </div>
                  <p className="text-[10px] mt-0.5 leading-tight" style={mutedStyle}>
                    {isRtl 
                      ? 'السماح بنقل وتشغيل الوسائط والتحكم عن بُعد في شاشات وأجهزة الشبكة.' 
                      : 'Allow streaming and remote controlling other screens on the network.'}
                  </p>
                </div>
              </label>

              {/* Show on Login Card */}
              <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition select-none cursor-pointer hover:border-emerald-500/40 ${
                showOnLogin ? 'bg-emerald-500/10 border-emerald-500/30' : 'opacity-70'
              }`}
                style={{ background: !showOnLogin ? cardInnerBg : undefined, borderColor: !showOnLogin ? 'var(--dash-input-border)' : undefined }}
              >
                <input
                  type="checkbox"
                  checked={showOnLogin}
                  onChange={(e) => setShowOnLogin(e.target.checked)}
                  className="mt-0.5 rounded border-cyan-500/20 text-emerald-500 focus:ring-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5 text-emerald-300">
                    <Eye size={13} />
                    <span>{isRtl ? 'الظهور في شاشة الدخول' : 'Show on Login Screen'}</span>
                  </div>
                  <p className="text-[10px] mt-0.5 leading-tight" style={mutedStyle}>
                    {isRtl 
                      ? 'إظهار هذا المستخدم في واجهة اختيار الحسابات الرئيسية.' 
                      : 'Display this user on the main profile selection screen.'}
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Fixed Footer with Actions */}
        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-end gap-3 bg-black/20" style={{ borderColor: 'var(--dash-input-border)' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:opacity-80 transition"
            style={mutedStyle}
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition disabled:opacity-60 flex items-center gap-1.5"
          >
            {submitting ? (
              isRtl ? 'جاري الحفظ...' : 'Saving...'
            ) : mode === 'create' ? (
              <>
                <UserPlus size={16} />
                <span>{isRtl ? 'إنشاء المستخدم' : 'Create User'}</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>{isRtl ? 'حفظ التعديلات' : 'Save Changes'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
