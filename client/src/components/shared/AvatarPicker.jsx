import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PRESET_AVATARS } from '../../utils/avatarPresets';
import { uploadAvatarApi } from '../../api/client';
import { 
  Upload, Image as ImageIcon, Link as LinkIcon, Sparkles, Check, Trash2, Loader2, AlertCircle 
} from 'lucide-react';

export default function AvatarPicker({ value, onChange, displayName = '' }) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [activeTab, setActiveTab] = useState('presets'); // 'presets' | 'upload' | 'url'
  const [customUrl, setCustomUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const handleSelectPreset = (presetPath) => {
    onChange(presetPath);
    setUploadError('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError(isRtl ? 'يرجى اختيار ملف صورة صالح' : 'Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError(isRtl ? 'حجم الصورة يجب ألا يتجاوز 5 ميجابايت' : 'Image size must not exceed 5MB');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await uploadAvatarApi(formData);
      if (res?.avatarUrl) {
        onChange(res.avatarUrl);
      }
    } catch (err) {
      console.error('Avatar upload error:', err);
      setUploadError(err.response?.data?.error?.message || (isRtl ? 'فشل رفع الصورة' : 'Failed to upload image'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyUrl = () => {
    if (!customUrl.trim()) return;
    onChange(customUrl.trim());
    setCustomUrl('');
  };

  const handleRemoveAvatar = () => {
    onChange(null);
    setUploadError('');
  };

  const initialLetter = (displayName || 'U').charAt(0).toUpperCase();

  return (
    <div className="space-y-4">
      {/* Current Avatar Showcase Header */}
      <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-surface/50 border border-border/50 backdrop-blur-sm">
        <div className="relative group">
          <div className="w-20 h-20 rounded-full overflow-hidden p-1 bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-500 shadow-xl shadow-cyan-500/10 flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
              {value ? (
                <img 
                  src={value} 
                  alt={displayName || 'Avatar'} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className="text-2xl font-black text-white bg-gradient-to-tr from-cyan-600 to-blue-600 w-full h-full flex items-center justify-center">
                  {initialLetter}
                </span>
              )}
            </div>
          </div>

          {value && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition hover:scale-110"
              title={isRtl ? 'إزالة الصورة الحالية' : 'Remove Avatar'}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        <div className="flex-1 text-center sm:text-start">
          <h4 className="text-xs font-bold text-text mb-1">
            {isRtl ? 'الصورة الرمزية الحالية' : 'Current Avatar'}
          </h4>
          <p className="text-[11px] text-muted leading-relaxed">
            {value 
              ? (isRtl ? 'تم تخصيص صورة لملفك الشخصي. يمكنك اختيار صورة أخرى من النماذج أدناه أو رفع صورة جديدة.' : 'A profile avatar is assigned. Choose another below or upload a custom image.')
              : (isRtl ? 'يتم عرض الحرف الأول من اسمك حالياً. اختر صورة مميزة تعبر عن ذوقك!' : 'Your initial letter is currently shown. Pick an avatar to customize your profile!')}
          </p>
        </div>
      </div>

      {/* Tabs / Method Switcher */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface border border-border text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-semibold transition ${
            activeTab === 'presets'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-muted hover:text-text hover:bg-surfaceHover'
          }`}
        >
          <Sparkles size={14} />
          <span>{isRtl ? 'صور جاهزة' : 'Presets'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-semibold transition ${
            activeTab === 'upload'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-muted hover:text-text hover:bg-surfaceHover'
          }`}
        >
          <Upload size={14} />
          <span>{isRtl ? 'رفع صورة' : 'Upload'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-semibold transition ${
            activeTab === 'url'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-muted hover:text-text hover:bg-surfaceHover'
          }`}
        >
          <LinkIcon size={14} />
          <span>{isRtl ? 'رابط ويب' : 'Image URL'}</span>
        </button>
      </div>

      {uploadError && (
        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Content Area */}
      {activeTab === 'presets' && (
        <div className="space-y-2">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5 max-h-[200px] overflow-y-auto p-1.5 scrollbar-thin">
            {PRESET_AVATARS.map((item) => {
              const isSelected = value === item.path;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleSelectPreset(item.path)}
                  className={`relative group aspect-square rounded-2xl overflow-hidden p-1 transition-all duration-200 hover:scale-105 ${
                    isSelected
                      ? 'ring-2 ring-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/30'
                      : 'hover:ring-1 hover:ring-border/80 bg-surface'
                  }`}
                  title={isRtl ? item.nameAr : item.nameEn}
                >
                  <img 
                    src={item.path} 
                    alt={isRtl ? item.nameAr : item.nameEn}
                    className="w-full h-full rounded-xl object-contain drop-shadow-sm" 
                    loading="lazy"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-cyan-950/30 flex items-center justify-center rounded-xl">
                      <div className="w-5 h-5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shadow-md">
                        <Check size={12} className="stroke-[3]" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted text-center">
            {isRtl ? 'اختر شخصيتك المفضلة من تشكيلة ARN الحصرية' : 'Select your persona from ARN exclusive avatar collection'}
          </p>
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="p-4 rounded-2xl border border-dashed border-border/70 hover:border-cyan-500/50 bg-surface/30 text-center transition">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            id="avatar-file-upload"
            disabled={isUploading}
          />
          <label 
            htmlFor="avatar-file-upload" 
            className="cursor-pointer flex flex-col items-center justify-center gap-2 py-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition">
              {isUploading ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} />}
            </div>
            <div className="text-xs font-bold text-text">
              {isUploading 
                ? (isRtl ? 'جاري رفع الصورة...' : 'Uploading image...')
                : (isRtl ? 'اضغط لاختيار صورة من جهازك' : 'Click to browse an image from device')}
            </div>
            <p className="text-[10px] text-muted">
              {isRtl ? 'يدعم صيغ JPG, PNG, WEBP حتى 5 ميجابايت' : 'Supports JPG, PNG, WEBP up to 5MB'}
            </p>
          </label>
        </div>
      )}

      {activeTab === 'url' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://example.com/my-photo.jpg"
              className="flex-1 border rounded-xl px-3.5 py-2 text-xs bg-surface border-border focus:outline-none focus:border-cyan-500 text-text"
            />
            <button
              type="button"
              onClick={handleApplyUrl}
              disabled={!customUrl.trim()}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition disabled:opacity-40"
            >
              {isRtl ? 'تطبيق' : 'Apply'}
            </button>
          </div>
          <p className="text-[10px] text-muted">
            {isRtl ? 'الصق رابط صورة مباشر وسيقوم النظام بتطبيقها فوراً' : 'Paste a direct image URL to apply it to your profile'}
          </p>
        </div>
      )}
    </div>
  );
}
