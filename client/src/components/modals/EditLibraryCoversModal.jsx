import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Sparkles, RotateCcw, Image as ImageIcon, Search, Loader2, Upload, User, Disc3, FolderPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchAvailableCovers, saveLibraryCustomCovers, uploadLibraryCover } from '../../api/client';

export default function EditLibraryCoversModal({ library, isOpen, onClose, onSaved }) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableCovers, setAvailableCovers] = useState([]);
  const [selectedCovers, setSelectedCovers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'artist' | 'album' | 'upload'

  useEffect(() => {
    if (!isOpen || !library?.id) return;

    setLoading(true);
    fetchAvailableCovers(library.id)
      .then((res) => {
        setAvailableCovers(res.availableCovers || []);
        // If library already has custom covers, use them; otherwise use current library covers
        const initial = res.customCovers && res.customCovers.length > 0
          ? res.customCovers
          : (res.currentCovers || []);
        setSelectedCovers(initial.slice(0, 5));
      })
      .catch((err) => {
        console.error('Failed to load covers:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, library?.id]);

  if (!isOpen || !library) return null;

  const isMusic = library.type === 'music';

  const handleToggleCover = (url) => {
    if (selectedCovers.includes(url)) {
      setSelectedCovers(selectedCovers.filter(c => c !== url));
    } else {
      if (selectedCovers.length >= 5) {
        // Replace the last one or do nothing
        setSelectedCovers([...selectedCovers.slice(0, 4), url]);
      } else {
        setSelectedCovers([...selectedCovers, url]);
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const res = await uploadLibraryCover(library.id, file);
      if (res && res.url) {
        setAvailableCovers(prev => [res, ...prev]);
        handleToggleCover(res.url);
        setActiveTab('upload');
      }
    } catch (err) {
      console.error('Failed to upload custom cover:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetDefault = async () => {
    try {
      setSaving(true);
      await saveLibraryCustomCovers(library.id, []);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to reset covers:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveLibraryCustomCovers(library.id, selectedCovers);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save covers:', err);
    } finally {
      setSaving(false);
    }
  };

  // Counts by category
  const artistCount = availableCovers.filter(c => c.type === 'artist').length;
  const albumCount = availableCovers.filter(c => c.type === 'album').length;
  const uploadCount = availableCovers.filter(c => c.type === 'upload').length;

  const filteredCovers = availableCovers.filter(c => {
    if (activeTab === 'artist' && c.type !== 'artist') return false;
    if (activeTab === 'album' && c.type !== 'album') return false;
    if (activeTab === 'upload' && c.type !== 'upload') return false;
    if (searchQuery && (!c.title || !c.title.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
    return true;
  });

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div 
        className="bg-white dark:bg-[#0f172a]/95 border border-slate-200 dark:border-white/10 rounded-[28px] shadow-2xl dark:shadow-[0_25px_70px_rgba(0,0,0,0.85)] max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scaleIn text-slate-800 dark:text-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden file input for uploading from computer */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />

        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/80 dark:bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#10b981] to-emerald-400 text-black flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  {isArabic ? 'تخصيص صور خلفية المكتبة' : 'Customize Library Card Covers'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  {library.name}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-muted mt-0.5">
                {isArabic 
                  ? 'اختر حتى 5 بوسترات لعرضها بشكل مروحي جذاب داخل خلفية بطاقة المكتبة'
                  : 'Select up to 5 posters to showcase in the background fan collage'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-surface border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-surfaceHover text-slate-500 dark:text-muted hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Preview Bar & Upload Button */}
        <div className="p-4 sm:px-6 bg-slate-100/60 dark:bg-surface/30 border-b border-slate-200 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-text/80 font-medium">
            <ImageIcon size={16} className="text-emerald-500 dark:text-emerald-400" />
            <span>
              {isArabic
                ? `المحدد (${selectedCovers.length} من 5):`
                : `Selected (${selectedCovers.length} of 5):`}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {[0, 1, 2, 3, 4].map((idx) => {
              const url = selectedCovers[idx];
              return (
                <div
                  key={idx}
                  onClick={() => url && handleToggleCover(url)}
                  className={`relative rounded-lg overflow-hidden border transition-all duration-200 cursor-pointer ${
                    isMusic ? 'w-11 h-11' : 'w-9 h-13 sm:w-10 sm:h-14'
                  } ${
                    url 
                      ? 'border-emerald-500 shadow-md shadow-emerald-500/20 hover:scale-105' 
                      : 'border-dashed border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-muted/50 text-[10px]'
                  }`}
                  title={url ? (isArabic ? 'انقر للإزالة' : 'Click to remove') : ''}
                >
                  {url ? (
                    <>
                      <img src={url} alt={isArabic ? `غلاف مختار ${idx + 1}` : `Selected cover ${idx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition">
                        <X size={12} className="text-red-400" />
                      </div>
                      <span className="absolute top-0.5 start-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-black text-[9px] font-bold flex items-center justify-center shadow">
                        {idx + 1}
                      </span>
                    </>
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Toolbar: Upload Button & Search Bar */}
        <div className="p-4 sm:px-6 pb-2 space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-muted" />
              <input
                type="text"
                placeholder={isArabic ? 'البحث عن فنان، ألبوم، أو عنوان...' : 'Search artist, album, or title...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-surface border border-slate-300 dark:border-white/10 rounded-xl ps-9 pe-4 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-muted focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold text-xs transition active:scale-95 flex-shrink-0 shadow-sm disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>{isArabic ? 'جاري الرفع...' : 'Uploading...'}</span>
                </>
              ) : (
                <>
                  <Upload size={15} />
                  <span>{isArabic ? 'رفع صورة من الكمبيوتر' : 'Upload from Device'}</span>
                </>
              )}
            </button>
          </div>

          {/* Filter Tabs (All, Artists, Albums, Uploaded) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-emerald-500 text-black font-bold shadow'
                  : 'bg-slate-100 dark:bg-surface hover:bg-slate-200 dark:hover:bg-surfaceHover text-slate-600 dark:text-muted'
              }`}
            >
              <span>{isArabic ? 'الكل' : 'All'}</span>
              <span className="opacity-70 text-[10px]">({availableCovers.length})</span>
            </button>

            {artistCount > 0 && (
              <button
                onClick={() => setActiveTab('artist')}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  activeTab === 'artist'
                    ? 'bg-emerald-500 text-black font-bold shadow'
                    : 'bg-slate-100 dark:bg-surface hover:bg-slate-200 dark:hover:bg-surfaceHover text-slate-600 dark:text-muted'
                }`}
              >
                <User size={12} />
                <span>{isArabic ? 'الفنانين' : 'Artists'}</span>
                <span className="opacity-70 text-[10px]">({artistCount})</span>
              </button>
            )}

            {albumCount > 0 && (
              <button
                onClick={() => setActiveTab('album')}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  activeTab === 'album'
                    ? 'bg-emerald-500 text-black font-bold shadow'
                    : 'bg-slate-100 dark:bg-surface hover:bg-slate-200 dark:hover:bg-surfaceHover text-slate-600 dark:text-muted'
                }`}
              >
                <Disc3 size={12} />
                <span>{isArabic ? 'الألبومات' : 'Albums'}</span>
                <span className="opacity-70 text-[10px]">({albumCount})</span>
              </button>
            )}

            {uploadCount > 0 && (
              <button
                onClick={() => setActiveTab('upload')}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  activeTab === 'upload'
                    ? 'bg-emerald-500 text-black font-bold shadow'
                    : 'bg-slate-100 dark:bg-surface hover:bg-slate-200 dark:hover:bg-surfaceHover text-slate-600 dark:text-muted'
                }`}
              >
                <Upload size={12} />
                <span>{isArabic ? 'مرفوعة من الجهاز' : 'Uploaded'}</span>
                <span className="opacity-70 text-[10px]">({uploadCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Available Posters Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2 scrollbar-thin">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted">
              <Loader2 size={32} className="animate-spin text-emerald-400" />
              <p className="text-xs sm:text-sm">
                {isArabic ? 'جاري تحميل بوسترات وصور المكتبة...' : 'Loading library covers...'}
              </p>
            </div>
          ) : filteredCovers.length === 0 ? (
            <div className="py-16 text-center text-muted text-xs sm:text-sm">
              {isArabic ? 'لم يتم العثور على بوسترات مطابقة' : 'No matching covers found'}
            </div>
          ) : (
            <div className={`grid gap-3 ${
              isMusic 
                ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5' 
                : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6'
            }`}>
              {filteredCovers.map((item) => {
                const isSelected = selectedCovers.includes(item.url);
                const selectIndex = selectedCovers.indexOf(item.url);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggleCover(item.url)}
                    className={`group relative rounded-xl overflow-hidden cursor-pointer border transition-all duration-300 ${
                      isSelected 
                        ? 'border-emerald-500 ring-2 ring-emerald-500/50 scale-[0.98]' 
                        : 'border-white/10 hover:border-white/40 hover:scale-[1.02]'
                    } ${isMusic ? 'aspect-square' : 'aspect-[2/3]'}`}
                  >
                    <img
                      src={item.url}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />

                    {/* Gradient info overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/40 opacity-80 group-hover:opacity-95 transition" />

                    {/* Type Badge (Artist, Album, Upload) */}
                    {item.type && (
                      <div className="absolute top-1.5 start-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shadow ${
                          item.type === 'artist'
                            ? 'bg-emerald-500/90 text-black'
                            : item.type === 'upload'
                            ? 'bg-amber-500/90 text-black'
                            : 'bg-black/60 text-white/90 border border-white/20'
                        }`}>
                          {item.type === 'artist' ? (isArabic ? 'فنان' : 'Artist') : (item.type === 'upload' ? (isArabic ? 'مرفوع' : 'Upload') : (isArabic ? 'ألبوم' : 'Album'))}
                        </span>
                      </div>
                    )}

                    {/* Title label */}
                    <div className="absolute bottom-1.5 inset-x-1.5 text-[11px] font-medium text-white line-clamp-1 text-center drop-shadow">
                      {item.title}
                    </div>

                    {/* Selection badge */}
                    <div className="absolute top-1.5 end-1.5">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold text-xs shadow-lg">
                          {selectIndex + 1}
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-black/50 border border-white/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-surface/60 flex items-center justify-between gap-3">
          <button
            onClick={handleResetDefault}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-surface border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-surfaceHover text-xs text-slate-600 dark:text-muted hover:text-slate-900 dark:hover:text-white transition disabled:opacity-50 shadow-sm"
          >
            <RotateCcw size={14} />
            <span>{isArabic ? 'استعادة التلقائي' : 'Reset to Default'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-white dark:bg-surface border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-surfaceHover text-xs text-slate-700 dark:text-text transition disabled:opacity-50 shadow-sm"
            >
              {isArabic ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-[#10b981] hover:bg-emerald-400 text-black font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-95 transition disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{isArabic ? 'جاري الحفظ...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  <Check size={16} className="stroke-[3]" />
                  <span>{isArabic ? 'حفظ التغييرات' : 'Save Changes'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
