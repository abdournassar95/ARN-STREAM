import { useState, useRef, useEffect } from 'react';
import { X, Upload, Check, Image as ImageIcon, User, Sparkles, Globe, Music2, Save, FileText, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { updateArtist, updateArtistImage, fetchMediaImages, setPrimaryImage, deleteMediaImage, deleteBackdrop } from '../../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Spinner from '../shared/Spinner';

export default function EditArtistModal({ isOpen, onClose, artist }) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'photo' | 'backdrop'
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  const [genre, setGenre] = useState('');

  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [backdropUrlInput, setBackdropUrlInput] = useState('');
  const [imagesList, setImagesList] = useState([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  const [notice, setNotice] = useState(null);

  const photoFileRef = useRef(null);
  const backdropFileRef = useRef(null);

  // Sync state when artist or modal opens
  useEffect(() => {
    if (artist && isOpen) {
      setName(artist.name || '');
      setBio(artist.bio || '');
      setCountry(artist.country || '');
      setGenre(artist.genre || '');
      setPhotoUrlInput('');
      setBackdropUrlInput('');
      setNotice(null);
      loadArtistImages();
    }
  }, [artist, isOpen]);

  const loadArtistImages = async () => {
    if (!artist?.id) return;
    setIsLoadingImages(true);
    try {
      const imgs = await fetchMediaImages('artist', artist.id);
      setImagesList(imgs || []);
    } catch (err) {
      console.error('Failed to load artist images:', err);
    } finally {
      setIsLoadingImages(false);
    }
  };

  const showNotice = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  // Mutation to save core metadata (name, bio, country, genre)
  const saveMetadataMut = useMutation({
    mutationFn: async () => {
      // 1. If photo URL is typed
      if (photoUrlInput.trim()) {
        await updateArtistImage(artist.id, photoUrlInput.trim(), 'poster');
        setPhotoUrlInput('');
      }
      // 2. If backdrop URL is typed
      if (backdropUrlInput.trim()) {
        await updateArtistImage(artist.id, backdropUrlInput.trim(), 'backdrop');
        setBackdropUrlInput('');
      }
      // 3. Save metadata
      await updateArtist(artist.id, {
        name: name.trim(),
        bio: bio.trim(),
        country: country.trim(),
        genre: genre.trim()
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['artist', String(artist.id)] });
      await qc.invalidateQueries({ queryKey: ['artist', Number(artist.id)] });
      await qc.invalidateQueries({ queryKey: ['artists'] });
      await qc.invalidateQueries({ queryKey: ['all-artists'] });
      await qc.invalidateQueries({ queryKey: ['library'] });
      await qc.invalidateQueries({ queryKey: ['libraries'] });
      await qc.invalidateQueries({ queryKey: ['music-home'] });
      showNotice(isRtl ? 'تم حفظ التعديلات بنجاح!' : 'Changes saved successfully!');
      setTimeout(() => onClose(), 600);
    },
    onError: (err) => {
      console.error('Failed to update artist:', err);
      alert(isRtl ? 'حدث خطأ أثناء حفظ التعديلات' : 'Failed to save changes');
    }
  });

  // Direct upload for profile photo
  const uploadPhotoMut = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('imageType', 'poster');
      await updateArtistImage(artist.id, formData, 'poster');
    },
    onSuccess: async () => {
      await loadArtistImages();
      await qc.invalidateQueries({ queryKey: ['artist', String(artist.id)] });
      await qc.invalidateQueries({ queryKey: ['artist', Number(artist.id)] });
      await qc.invalidateQueries({ queryKey: ['artists'] });
      await qc.invalidateQueries({ queryKey: ['all-artists'] });
      await qc.invalidateQueries({ queryKey: ['library'] });
      await qc.invalidateQueries({ queryKey: ['libraries'] });
      await qc.invalidateQueries({ queryKey: ['music-home'] });
      showNotice(isRtl ? 'تم تحديث الصورة الشخصية بنجاح!' : 'Profile photo updated!');
    }
  });

  // Direct upload for backdrop image
  const uploadBackdropMut = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('imageType', 'backdrop');
      await updateArtistImage(artist.id, formData, 'backdrop');
    },
    onSuccess: async () => {
      await loadArtistImages();
      await qc.invalidateQueries({ queryKey: ['artist', String(artist.id)] });
      await qc.invalidateQueries({ queryKey: ['artist', Number(artist.id)] });
      await qc.invalidateQueries({ queryKey: ['artists'] });
      await qc.invalidateQueries({ queryKey: ['all-artists'] });
      await qc.invalidateQueries({ queryKey: ['library'] });
      await qc.invalidateQueries({ queryKey: ['libraries'] });
      await qc.invalidateQueries({ queryKey: ['music-home'] });
      showNotice(isRtl ? 'تم تحديث صورة الغلاف والخلفية بنجاح!' : 'Backdrop updated!');
    }
  });

  // Set primary image from gallery
  const setPrimaryMut = useMutation({
    mutationFn: async (imageId) => {
      await setPrimaryImage(imageId);
    },
    onSuccess: async () => {
      await loadArtistImages();
      await qc.invalidateQueries({ queryKey: ['artist', String(artist.id)] });
      await qc.invalidateQueries({ queryKey: ['artist', Number(artist.id)] });
      await qc.invalidateQueries({ queryKey: ['artists'] });
      await qc.invalidateQueries({ queryKey: ['all-artists'] });
      await qc.invalidateQueries({ queryKey: ['library'] });
      await qc.invalidateQueries({ queryKey: ['libraries'] });
      await qc.invalidateQueries({ queryKey: ['music-home'] });
      showNotice(isRtl ? 'تم تعيين الصورة كرئيسية!' : 'Primary image updated!');
    }
  });

  // Delete backdrop mutation
  const deleteBackdropMut = useMutation({
    mutationFn: async () => {
      await deleteBackdrop('artist', artist.id);
    },
    onSuccess: async () => {
      await loadArtistImages();
      await qc.invalidateQueries({ queryKey: ['artist', String(artist.id)] });
      await qc.invalidateQueries({ queryKey: ['artist', Number(artist.id)] });
      await qc.invalidateQueries({ queryKey: ['artists'] });
      await qc.invalidateQueries({ queryKey: ['all-artists'] });
      await qc.invalidateQueries({ queryKey: ['library'] });
      await qc.invalidateQueries({ queryKey: ['libraries'] });
      await qc.invalidateQueries({ queryKey: ['music-home'] });
      showNotice(isRtl ? 'تم حذف وإلغاء صورة البانر بنجاح!' : 'Backdrop banner removed!');
    },
    onError: (err) => {
      console.error('Failed to delete backdrop:', err);
      alert(isRtl ? 'فشل حذف صورة الخلفية' : 'Failed to delete backdrop');
    }
  });

  // Delete single image from gallery mutation
  const deleteImageMut = useMutation({
    mutationFn: async (imageId) => {
      await deleteMediaImage(imageId);
    },
    onSuccess: async () => {
      await loadArtistImages();
      await qc.invalidateQueries({ queryKey: ['artist', String(artist.id)] });
      await qc.invalidateQueries({ queryKey: ['artist', Number(artist.id)] });
      await qc.invalidateQueries({ queryKey: ['artists'] });
      await qc.invalidateQueries({ queryKey: ['all-artists'] });
      await qc.invalidateQueries({ queryKey: ['library'] });
      await qc.invalidateQueries({ queryKey: ['libraries'] });
      await qc.invalidateQueries({ queryKey: ['music-home'] });
      showNotice(isRtl ? 'تم حذف الصورة بنجاح!' : 'Image deleted!');
    },
    onError: (err) => {
      console.error('Failed to delete image:', err);
      alert(isRtl ? 'فشل حذف الصورة' : 'Failed to delete image');
    }
  });

  if (!isOpen || !artist) return null;

  const isSaving = saveMetadataMut.isPending || uploadPhotoMut.isPending || uploadBackdropMut.isPending;

  // Separate images by type
  const posterImages = imagesList.filter(i => i.image_type === 'poster' || i.image_type === 'avatar' || !i.image_type);
  const backdropImages = imagesList.filter(i => i.image_type === 'backdrop' || i.image_type === 'fanart');

  const currentPoster = posterImages.find(i => i.is_primary)?.full || artist.poster || artist.images?.[0]?.url || artist.fallbackCover;
  const currentBackdrop = backdropImages.find(i => i.is_primary)?.full || artist.backdrop;

  const isQuran = (artist.name || '').includes('الشيخ') || (artist.name || '').includes('القارئ') || (artist.name || '').includes('قرآن');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-[#0f172a] text-slate-800 dark:text-text rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-surface/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-primaryMusic/15 border border-primaryMusic/30 flex items-center justify-center text-primaryMusic flex-shrink-0">
              <User size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg truncate">
                {isRtl ? `تعديل بيانات: ${artist.name}` : `Edit Artist: ${artist.name}`}
              </h3>
              <p className="text-xs text-muted">
                {isQuran ? (isRtl ? 'الصور الشخصية، خلفية البانر، وسيرة القارئ' : 'Reciter info, avatar and backdrop') : (isRtl ? 'الصور الشخصية، صورة البانر، وسيرة الفنان' : 'Artist info, avatar and backdrop')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-surfaceHover hover:bg-slate-200 dark:hover:bg-white/10 text-muted hover:text-text flex items-center justify-center transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notice banner */}
        {notice && (
          <div className="px-6 py-2.5 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <Check size={16} />
            <span>{notice}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 px-6 pt-3 border-b border-slate-200 dark:border-white/10 bg-slate-50/40 dark:bg-transparent">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === 'info'
                ? 'border-primaryMusic text-primaryMusic bg-primaryMusic/10 dark:bg-primaryMusic/5'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            <FileText size={15} />
            <span>{isRtl ? 'البيانات العامة' : 'General Info'}</span>
          </button>

          <button
            onClick={() => setActiveTab('photo')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === 'photo'
                ? 'border-primaryMusic text-primaryMusic bg-primaryMusic/10 dark:bg-primaryMusic/5'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            <User size={15} />
            <span>{isRtl ? 'الصورة الشخصية' : 'Profile Photo'}</span>
          </button>

          <button
            onClick={() => setActiveTab('backdrop')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === 'backdrop'
                ? 'border-primaryMusic text-primaryMusic bg-primaryMusic/10 dark:bg-primaryMusic/5'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            <ImageIcon size={15} />
            <span>{isRtl ? 'صورة الغلاف والخلفية' : 'Backdrop Banner'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          
          {/* TAB 1: General Info */}
          {activeTab === 'info' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  {isQuran ? (isRtl ? 'اسم القارئ / الشيخ' : 'Reciter Name') : (isRtl ? 'اسم الفنان / الفرقة' : 'Artist Name')} *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={isRtl ? 'مثال: الشيخ عبد الباسط عبد الصمد' : 'Artist Name'}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-surface border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:border-primaryMusic transition shadow-sm"
                />
              </div>

              {/* Country & Genre Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1.5 flex items-center gap-1.5">
                    <Globe size={13} />
                    <span>{isRtl ? 'البلد / الجنسية' : 'Country / Nationality'}</span>
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    placeholder={isRtl ? 'مثال: مصر، السعودية، المغرب...' : 'Country'}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-surface border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:border-primaryMusic transition shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1.5 flex items-center gap-1.5">
                    <Music2 size={13} />
                    <span>{isRtl ? 'النوع / الأسلوب' : 'Genre / Style'}</span>
                  </label>
                  <input
                    type="text"
                    value={genre}
                    onChange={e => setGenre(e.target.value)}
                    placeholder={isQuran ? (isRtl ? 'مثال: حفلات خارجية، مرتل، تجويد...' : 'Recitation Style') : (isRtl ? 'مثال: طرب أصيل، كلاسيك، شعبي...' : 'Genre')}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-surface border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:border-primaryMusic transition shadow-sm"
                  />
                </div>
              </div>

              {/* Bio / Description */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  {isRtl ? 'السيرة الذاتية / نبذة تعريفية' : 'Biography / Description'}
                </label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={4}
                  placeholder={isRtl ? 'أدخل نبذة مختصرة عن القارئ أو الفنان، تاريخ ولادته، وأهم محطاته...' : 'Enter biography or artist description...'}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-surface border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:border-primaryMusic transition shadow-sm resize-y"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Profile Photo */}
          {activeTab === 'photo' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-slate-50 dark:bg-surface/40 border border-slate-200 dark:border-white/5">
                {/* Live Avatar Preview */}
                <div className="w-32 h-32 rounded-2xl overflow-hidden bg-surface shadow-xl border-2 border-primaryMusic/40 flex-shrink-0 relative group">
                  {currentPoster ? (
                    <img src={currentPoster} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-bold bg-primaryMusic/10 text-primaryMusic">
                      {name ? name[0] : '♫'}
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3 w-full text-center sm:text-start">
                  <div className="text-sm font-bold">{isRtl ? 'تغيير الصورة الشخصية' : 'Change Profile Picture'}</div>
                  <p className="text-xs text-muted">
                    {isRtl ? 'اختر صورة من جهازك بصيغة JPG أو PNG أو أدخل رابط ويب مباشر.' : 'Upload an image from your computer or enter a direct web URL.'}
                  </p>

                  <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                    <input
                      type="file"
                      ref={photoFileRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadPhotoMut.mutate(file);
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadPhotoMut.isPending}
                      onClick={() => photoFileRef.current?.click()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primaryMusic text-black font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                    >
                      {uploadPhotoMut.isPending ? <Spinner size={14} /> : <Upload size={14} />}
                      <span>{isRtl ? 'رفع صورة من الجهاز' : 'Upload from Device'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct Image URL input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-muted">
                  {isRtl ? 'أو أدخل رابط صورة مباشر (URL):' : 'Or enter direct image URL:'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={photoUrlInput}
                    onChange={e => setPhotoUrlInput(e.target.value)}
                    placeholder="https://example.com/artist-photo.jpg"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-surface border border-slate-200 dark:border-white/10 text-xs sm:text-sm focus:outline-none focus:border-primaryMusic transition shadow-sm"
                  />
                  <button
                    type="button"
                    disabled={!photoUrlInput.trim() || isSaving}
                    onClick={async () => {
                      if (!photoUrlInput.trim()) return;
                      await updateArtistImage(artist.id, photoUrlInput.trim(), 'poster');
                      setPhotoUrlInput('');
                      await loadArtistImages();
                      await qc.invalidateQueries({ queryKey: ['artist', String(artist.id)] });
                      await qc.invalidateQueries({ queryKey: ['artist', Number(artist.id)] });
                      await qc.invalidateQueries({ queryKey: ['artists'] });
                      await qc.invalidateQueries({ queryKey: ['all-artists'] });
                      await qc.invalidateQueries({ queryKey: ['library'] });
                      await qc.invalidateQueries({ queryKey: ['libraries'] });
                      await qc.invalidateQueries({ queryKey: ['music-home'] });
                      showNotice(isRtl ? 'تم تطبيق الصورة بنجاح!' : 'Photo applied!');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-white/10 text-text font-bold text-xs border border-slate-200 dark:border-white/10 transition disabled:opacity-50 active:scale-95"
                  >
                    {isRtl ? 'تطبيق الرابط' : 'Apply URL'}
                  </button>
                </div>
              </div>

              {/* Existing Gallery of Artist Photos */}
              {posterImages.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
                  <div className="text-xs font-bold text-muted">{isRtl ? 'الصور المتوفرة لهذا الفنان:' : 'Available photos:'}</div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {posterImages.map(img => (
                      <div
                        key={img.id}
                        onClick={() => setPrimaryMut.mutate(img.id)}
                        className={`group relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                          img.is_primary
                            ? 'border-primaryMusic ring-2 ring-primaryMusic/40 shadow-lg scale-105'
                            : 'border-slate-200 dark:border-white/10 hover:border-primaryMusic/60'
                        }`}
                      >
                        <img src={img.thumb || img.full} alt="" className="w-full h-full object-cover" />
                        {img.is_primary && (
                          <div className="absolute top-1.5 end-1.5 w-5 h-5 rounded-full bg-primaryMusic text-black flex items-center justify-center shadow">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(isRtl ? 'هل تريد حذف هذه الصورة نهائياً؟' : 'Delete this photo permanently?')) {
                              deleteImageMut.mutate(img.id);
                            }
                          }}
                          className="absolute top-1.5 start-1.5 w-6 h-6 rounded-lg bg-black/70 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                          title={isRtl ? 'حذف الصورة' : 'Delete photo'}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Backdrop Banner */}
          {activeTab === 'backdrop' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Live Banner Preview */}
              <div className="relative aspect-[16/7] w-full rounded-2xl overflow-hidden bg-surfaceHover border-2 border-primaryMusic/30 shadow-xl">
                {currentBackdrop ? (
                  <img src={currentBackdrop} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted p-4 bg-gradient-to-br from-surface to-surfaceHover">
                    <ImageIcon size={32} className="opacity-40 mb-1" />
                    <span className="text-xs">{isRtl ? 'لا توجد صورة خلفية مخصصة حتى الآن' : 'No custom backdrop yet'}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                <div className="absolute bottom-3 start-4 text-white font-bold text-sm pointer-events-none drop-shadow">
                  {name}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-surface/40 border border-slate-200 dark:border-white/5">
                <div className="text-xs text-muted text-center sm:text-start space-y-1">
                  <div>{isRtl ? 'صورة الخلفية تظهر كبانر عريض سينمائي في أعلى صفحة الفنان.' : 'The backdrop appears as a sleek bounded hero banner behind the artist.'}</div>
                  <div className="text-primaryMusic font-semibold">{isRtl ? '💡 المقاس الموصى به: 1920×1080 (16:9) أو بانر عريض 1920×600 بكسل.' : '💡 Recommended: 1920×1080 (16:9) or wide banner 1920×600 px.'}</div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                  {currentBackdrop && (
                    <button
                      type="button"
                      disabled={deleteBackdropMut.isPending}
                      onClick={() => {
                        if (confirm(isRtl ? 'هل تريد بالتأكيد إلغاء وحذف صورة البانر والرجوع للتدرج اللوني الافتراضي؟' : 'Are you sure you want to remove the backdrop banner?')) {
                          deleteBackdropMut.mutate();
                        }
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 font-bold text-xs border border-red-500/20 transition disabled:opacity-50 whitespace-nowrap"
                      title={isRtl ? 'حذف صورة الغلاف والعودة للتدرج اللوني الافتراضي' : 'Remove backdrop'}
                    >
                      {deleteBackdropMut.isPending ? <Spinner size={14} /> : <Trash2 size={14} />}
                      <span>{isRtl ? 'إلغاء صورة البانر' : 'Remove Backdrop'}</span>
                    </button>
                  )}

                  <input
                    type="file"
                    ref={backdropFileRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadBackdropMut.mutate(file);
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploadBackdropMut.isPending}
                    onClick={() => backdropFileRef.current?.click()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primaryMusic text-black font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition disabled:opacity-50 whitespace-nowrap"
                  >
                    {uploadBackdropMut.isPending ? <Spinner size={14} /> : <Upload size={14} />}
                    <span>{isRtl ? 'رفع صورة خلفية' : 'Upload Backdrop'}</span>
                  </button>
                </div>
              </div>

              {/* Direct Backdrop URL input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-muted">
                  {isRtl ? 'أو أدخل رابط صورة خلفية مباشر (URL):' : 'Or enter direct backdrop URL:'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={backdropUrlInput}
                    onChange={e => setBackdropUrlInput(e.target.value)}
                    placeholder="https://example.com/artist-banner.jpg"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-surface border border-slate-200 dark:border-white/10 text-xs sm:text-sm focus:outline-none focus:border-primaryMusic transition shadow-sm"
                  />
                  <button
                    type="button"
                    disabled={!backdropUrlInput.trim() || isSaving}
                    onClick={async () => {
                      if (!backdropUrlInput.trim()) return;
                      await updateArtistImage(artist.id, backdropUrlInput.trim(), 'backdrop');
                      setBackdropUrlInput('');
                      await loadArtistImages();
                      await qc.invalidateQueries({ queryKey: ['artist', String(artist.id)] });
                      await qc.invalidateQueries({ queryKey: ['artist', Number(artist.id)] });
                      await qc.invalidateQueries({ queryKey: ['artists'] });
                      await qc.invalidateQueries({ queryKey: ['all-artists'] });
                      await qc.invalidateQueries({ queryKey: ['library'] });
                      await qc.invalidateQueries({ queryKey: ['libraries'] });
                      await qc.invalidateQueries({ queryKey: ['music-home'] });
                      showNotice(isRtl ? 'تم تطبيق صورة الخلفية بنجاح!' : 'Backdrop applied!');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-white/10 text-text font-bold text-xs border border-slate-200 dark:border-white/10 transition disabled:opacity-50 active:scale-95"
                  >
                    {isRtl ? 'تطبيق الرابط' : 'Apply URL'}
                  </button>
                </div>
              </div>

              {/* Existing Gallery of Backdrop Photos */}
              {backdropImages.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
                  <div className="text-xs font-bold text-muted">{isRtl ? 'صور الخلفية المخزنة:' : 'Stored backdrops:'}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {backdropImages.map(img => (
                      <div
                        key={img.id}
                        onClick={() => setPrimaryMut.mutate(img.id)}
                        className={`group relative aspect-[16/9] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                          img.is_primary
                            ? 'border-primaryMusic ring-2 ring-primaryMusic/40 shadow-lg scale-105'
                            : 'border-slate-200 dark:border-white/10 hover:border-primaryMusic/60'
                        }`}
                      >
                        <img src={img.thumb || img.full} alt="" className="w-full h-full object-cover" />
                        {img.is_primary && (
                          <div className="absolute top-1.5 end-1.5 w-5 h-5 rounded-full bg-primaryMusic text-black flex items-center justify-center shadow">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(isRtl ? 'هل تريد حذف صورة الخلفية هذه نهائياً؟' : 'Delete this backdrop permanently?')) {
                              deleteImageMut.mutate(img.id);
                            }
                          }}
                          className="absolute top-1.5 start-1.5 w-6 h-6 rounded-lg bg-black/70 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                          title={isRtl ? 'حذف صورة الخلفية' : 'Delete backdrop'}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-surface/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-muted hover:text-text transition"
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="button"
            disabled={isSaving || !name.trim()}
            onClick={() => saveMetadataMut.mutate()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primaryMusic text-black font-bold text-xs sm:text-sm shadow-lg shadow-primaryMusic/20 hover:brightness-110 active:scale-95 transition disabled:opacity-50"
          >
            {isSaving ? <Spinner size={16} /> : <Save size={16} />}
            <span>{isRtl ? 'حفظ التغييرات' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
