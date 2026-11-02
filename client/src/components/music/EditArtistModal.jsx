import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Upload,
  Check,
  Image as ImageIcon,
  User,
  Globe,
  Music2,
  Save,
  FileText,
  Trash2,
  Crop,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  updateArtist,
  updateArtistImage,
  fetchMediaImages,
  setPrimaryImage,
  deleteMediaImage,
  deleteBackdrop
} from '../../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Spinner from '../shared/Spinner';

/**
 * Interactive Crop & Pan Editor for Backdrop Banner (3:1 Aspect Ratio -> 1920x640)
 * Allows user to drag/pan in any direction and zoom in/out with live preview of the Artist Hero Banner.
 */
function BackdropCropper({ src, artistName, posterUrl, isRtl, onApply, onCancel, isApplying }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });
  const [containerSize, setContainerSize] = useState({ w: 600, h: 200 });

  // Zoom (1 = cover fit, up to 3.5x) & Pan offset in container pixels
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const [showOverlayPreview, setShowOverlayPreview] = useState(true);

  // Measure container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({ w: rect.width, h: rect.height });
        }
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [imgLoaded]);

  // Calculate base cover dimensions so image always covers the container at zoom = 1
  const getScaledDims = useCallback(
    (z = zoom) => {
      const cw = containerSize.w || 600;
      const ch = containerSize.h || 200;
      const iw = naturalSize.w || 1;
      const ih = naturalSize.h || 1;

      const scaleCover = Math.max(cw / iw, ch / ih);
      const renderedW = iw * scaleCover * z;
      const renderedH = ih * scaleCover * z;
      const maxX = Math.max(0, (renderedW - cw) / 2);
      const maxY = Math.max(0, (renderedH - ch) / 2);

      return { cw, ch, iw, ih, scaleCover, renderedW, renderedH, maxX, maxY };
    },
    [containerSize, naturalSize, zoom]
  );

  // Clamp offset so no empty edges appear inside the crop frame
  const clampOffset = useCallback(
    (rawX, rawY, z = zoom) => {
      const { maxX, maxY } = getScaledDims(z);
      return {
        x: Math.min(maxX, Math.max(-maxX, rawX)),
        y: Math.min(maxY, Math.max(-maxY, rawY))
      };
    },
    [getScaledDims, zoom]
  );

  const handleImageLoad = (e) => {
    const img = e.currentTarget;
    setNaturalSize({ w: img.naturalWidth || 1280, h: img.naturalHeight || 720 });
    setImgLoaded(true);
    setImgError(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleZoomChange = (newZoom) => {
    const clampedZoom = Math.min(3.5, Math.max(1, Number(newZoom)));
    setZoom(clampedZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, clampedZoom));
  };

  const handlePointerDown = (e) => {
    if (!imgLoaded) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      startX: offset.x,
      startY: offset.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;
      setOffset(clampOffset(dragStartRef.current.startX + dx, dragStartRef.current.startY + dy));
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, clampOffset]);

  const handleWheel = (e) => {
    if (!imgLoaded) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    handleZoomChange(zoom + delta);
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleConfirmCrop = async () => {
    if (!imgRef.current || !imgLoaded) return;

    const targetW = 1920;
    const targetH = 640; // 3:1 Hero Banner aspect ratio matching Artist.jsx
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    const { cw, ch, iw, ih, renderedW, renderedH } = getScaledDims(zoom);

    // Top-left of rendered image relative to container top-left
    const imgLeftInContainer = (cw - renderedW) / 2 + offset.x;
    const imgTopInContainer = (ch - renderedH) / 2 + offset.y;

    // Visible rectangle in source image coordinates
    const ratioX = iw / renderedW;
    const ratioY = ih / renderedH;

    const sx = Math.max(0, -imgLeftInContainer * ratioX);
    const sy = Math.max(0, -imgTopInContainer * ratioY);
    const sw = Math.min(iw - sx, cw * ratioX);
    const sh = Math.min(ih - sy, ch * ratioY);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, targetW, targetH);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const croppedFile = new File([blob], `artist-backdrop-${Date.now()}.webp`, {
            type: 'image/webp'
          });
          onApply(croppedFile);
        }
      },
      'image/webp',
      0.94
    );
  };

  const { renderedW, renderedH } = getScaledDims(zoom);

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-slate-900/90 border-2 border-primaryMusic/50 shadow-2xl animate-fadeIn">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-primaryMusic font-bold text-xs sm:text-sm">
          <Crop size={16} />
          <span>
            {isRtl
              ? 'محرر قص وتحريك صورة الخلفية (اسحب الصورة لتحريكها أو كبّرها لتلائم النافذة)'
              : 'Crop & Pan Backdrop (Drag to reposition, zoom to fit banner)'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowOverlayPreview((v) => !v)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
            showOverlayPreview
              ? 'bg-primaryMusic/15 border-primaryMusic/40 text-primaryMusic'
              : 'bg-white/5 border-white/10 text-slate-300'
          }`}
        >
          {isRtl ? 'معاينة عناصر البانر' : 'Banner Overlay'}
        </button>
      </div>

      {/* Interactive 3:1 Banner Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onWheel={handleWheel}
        className={`relative w-full aspect-[3/1] rounded-2xl overflow-hidden bg-black/90 border border-white/20 select-none shadow-inner ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {!imgError ? (
          <img
            ref={imgRef}
            src={src}
            alt="Crop preview"
            crossOrigin="anonymous"
            onLoad={handleImageLoad}
            onError={() => setImgError(true)}
            draggable={false}
            style={{
              width: `${renderedW}px`,
              height: `${renderedH}px`,
              maxWidth: 'none',
              maxHeight: 'none',
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`
            }}
            className="pointer-events-none select-none transition-none"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-red-400 text-xs p-4 text-center">
            {isRtl
              ? 'تعذر تحميل الصورة للمعاينة والقص. تأكد من صحة الرابط أو ارفع الصورة من جهازك.'
              : 'Could not load image for cropping. Please check URL or upload from device.'}
          </div>
        )}

        {/* Rule of Thirds Grid Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="w-full h-full grid grid-cols-3 grid-rows-3">
            <div className="border-e border-b border-white/15" />
            <div className="border-e border-b border-white/15" />
            <div className="border-b border-white/15" />
            <div className="border-e border-b border-white/15" />
            <div className="border-e border-b border-white/15" />
            <div className="border-b border-white/15" />
            <div className="border-e border-white/15" />
            <div className="border-e border-white/15" />
            <div />
          </div>
        </div>

        {/* Simulated Artist Page Banner Scrim & Avatar Overlay */}
        {showOverlayPreview && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-3 sm:p-4">
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <div className="relative z-10 flex items-end gap-3">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 border-white/30 bg-surface shadow-lg flex-shrink-0">
                {posterUrl ? (
                  <img src={posterUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primaryMusic font-bold text-lg">
                    {artistName?.[0] || '♫'}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-white font-bold text-xs sm:text-base truncate drop-shadow">
                  {artistName}
                </div>
                <div className="text-[10px] text-slate-300">
                  {isRtl ? 'معاينة مطابقة لصفحة الفنان / القارئ' : 'Live Banner Preview'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Drag Helper Badge */}
        <div className="absolute top-2.5 start-2.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[11px] text-white/90 flex items-center gap-1.5 pointer-events-none shadow">
          <Move size={12} className="text-primaryMusic" />
          <span>{isRtl ? 'اسحب لتحريك الصورة' : 'Drag to reposition'}</span>
        </div>
      </div>

      {/* Controls Bar: Zoom Slider + Reset + Save/Cancel */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        {/* Zoom Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-xs">
          <button
            type="button"
            onClick={() => handleZoomChange(zoom - 0.15)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition"
            title={isRtl ? 'تصغير' : 'Zoom Out'}
          >
            <ZoomOut size={15} />
          </button>

          <input
            type="range"
            min="1"
            max="3.5"
            step="0.02"
            value={zoom}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
            dir="ltr"
            className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-white/15 rounded-lg"
          />

          <button
            type="button"
            onClick={() => handleZoomChange(zoom + 0.15)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition"
            title={isRtl ? 'تكبير' : 'Zoom In'}
          >
            <ZoomIn size={15} />
          </button>

          <span className="text-[11px] font-mono text-slate-300 w-11 text-center">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-primaryMusic transition"
            title={isRtl ? 'إعادة الضبط والتوسيط' : 'Reset'}
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            disabled={isApplying}
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition"
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="button"
            disabled={!imgLoaded || imgError || isApplying}
            onClick={handleConfirmCrop}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primaryMusic text-black font-bold text-xs shadow-lg shadow-primaryMusic/25 hover:brightness-110 active:scale-95 transition disabled:opacity-50"
          >
            {isApplying ? <Spinner size={14} /> : <Check size={15} strokeWidth={2.5} />}
            <span>{isRtl ? 'اعتماد القص وحفظ الخلفية' : 'Apply Crop & Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

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

  // Interactive backdrop cropper state
  const [cropSourceUrl, setCropSourceUrl] = useState(null);

  const [notice, setNotice] = useState(null);

  const photoFileRef = useRef(null);
  const backdropFileRef = useRef(null);

  // Clean up object URLs when cropper closes
  useEffect(() => {
    return () => {
      if (cropSourceUrl && cropSourceUrl.startsWith('blob:')) {
        URL.revokeObjectURL(cropSourceUrl);
      }
    };
  }, [cropSourceUrl]);

  // Sync state when artist or modal opens
  useEffect(() => {
    if (artist && isOpen) {
      setName(artist.name || '');
      setBio(artist.bio || '');
      setCountry(artist.country || '');
      setGenre(artist.genre || '');
      setPhotoUrlInput('');
      setBackdropUrlInput('');
      setCropSourceUrl(null);
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

  const invalidateAllArtistQueries = async () => {
    await qc.invalidateQueries({ queryKey: ['artist', String(artist.id)] });
    await qc.invalidateQueries({ queryKey: ['artist', Number(artist.id)] });
    await qc.invalidateQueries({ queryKey: ['artists'] });
    await qc.invalidateQueries({ queryKey: ['all-artists'] });
    await qc.invalidateQueries({ queryKey: ['library'] });
    await qc.invalidateQueries({ queryKey: ['libraries'] });
    await qc.invalidateQueries({ queryKey: ['music-home'] });
  };

  // Mutation to save core metadata (name, bio, country, genre)
  const saveMetadataMut = useMutation({
    mutationFn: async () => {
      // 1. If photo URL is typed
      if (photoUrlInput.trim()) {
        await updateArtistImage(artist.id, photoUrlInput.trim(), 'poster');
        setPhotoUrlInput('');
      }
      // 2. If backdrop URL is typed without cropping yet
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
      await invalidateAllArtistQueries();
      showNotice(isRtl ? 'تم حفظ التعديلات بنجاح!' : 'Changes saved successfully!');
      setTimeout(() => onClose(), 600);
    },
    onError: (err) => {
      console.error('Failed to update artist:', err);
      alert(isRtl ? 'حدث خطأ أثناء حفظ التعديلات' : 'Failed to save changes');
    }
  });

  // Direct upload for profile photo (strictly poster)
  const uploadPhotoMut = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('imageType', 'poster');
      formData.append('file', file);
      await updateArtistImage(artist.id, formData, 'poster');
    },
    onSuccess: async () => {
      await loadArtistImages();
      await invalidateAllArtistQueries();
      showNotice(isRtl ? 'تم تحديث الصورة الشخصية بنجاح!' : 'Profile photo updated!');
    }
  });

  // Upload for backdrop image (strictly backdrop, supports cropped canvas output)
  const uploadBackdropMut = useMutation({
    mutationFn: async ({ file, isCropped = true }) => {
      const formData = new FormData();
      formData.append('imageType', 'backdrop');
      if (isCropped) formData.append('cropped', '1');
      formData.append('file', file);
      await updateArtistImage(artist.id, formData, 'backdrop', isCropped ? { cropped: '1' } : {});
    },
    onSuccess: async () => {
      setCropSourceUrl(null);
      setBackdropUrlInput('');
      await loadArtistImages();
      await invalidateAllArtistQueries();
      showNotice(isRtl ? 'تم تحديث وقص صورة الخلفية بنجاح!' : 'Backdrop updated!');
    },
    onError: (err) => {
      console.error('Failed to upload backdrop:', err);
      alert(isRtl ? 'فشل تحديث صورة الخلفية' : 'Failed to update backdrop');
    }
  });

  // Set primary image from gallery
  const setPrimaryMut = useMutation({
    mutationFn: async (imageId) => {
      await setPrimaryImage(imageId);
    },
    onSuccess: async () => {
      await loadArtistImages();
      await invalidateAllArtistQueries();
      showNotice(isRtl ? 'تم تعيين الصورة كرئيسية!' : 'Primary image updated!');
    }
  });

  // Delete backdrop mutation
  const deleteBackdropMut = useMutation({
    mutationFn: async () => {
      await deleteBackdrop('artist', artist.id);
    },
    onSuccess: async () => {
      setCropSourceUrl(null);
      await loadArtistImages();
      await invalidateAllArtistQueries();
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
      await invalidateAllArtistQueries();
      showNotice(isRtl ? 'تم حذف الصورة بنجاح!' : 'Image deleted!');
    },
    onError: (err) => {
      console.error('Failed to delete image:', err);
      alert(isRtl ? 'فشل حذف الصورة' : 'Failed to delete image');
    }
  });

  if (!isOpen || !artist) return null;

  const isSaving = saveMetadataMut.isPending || uploadPhotoMut.isPending || uploadBackdropMut.isPending;

  // Strictly separate images by type (never allow backdrop to leak into posterImages!)
  const posterImages = imagesList.filter(
    (i) => i.image_type === 'poster' || i.image_type === 'avatar'
  );
  const backdropImages = imagesList.filter(
    (i) => i.image_type === 'backdrop' || i.image_type === 'fanart'
  );

  const artistInitialPoster =
    artist.poster ||
    artist.images?.find((i) => (i.image_type === 'poster' || i.image_type === 'avatar') && i.url)?.url ||
    artist.fallbackCover;

  const currentPoster =
    posterImages.find((i) => i.is_primary)?.full ||
    posterImages[0]?.full ||
    artistInitialPoster;

  const currentBackdrop =
    backdropImages.find((i) => i.is_primary)?.full ||
    backdropImages[0]?.full ||
    artist.backdrop ||
    null;

  const isQuran =
    (artist.name || '').includes('الشيخ') ||
    (artist.name || '').includes('القارئ') ||
    (artist.name || '').includes('قرآن');

  // Open cropper when user selects a local file
  const handleSelectBackdropFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (cropSourceUrl && cropSourceUrl.startsWith('blob:')) {
      URL.revokeObjectURL(cropSourceUrl);
    }
    const objUrl = URL.createObjectURL(file);
    setCropSourceUrl(objUrl);
    e.target.value = '';
  };

  // Open cropper for external URL via safe backend proxy
  const handleOpenCropperForUrl = (rawUrl) => {
    const trimmed = (rawUrl || '').trim();
    if (!trimmed) return;
    if (trimmed.startsWith('/api/') || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
      setCropSourceUrl(trimmed);
    } else {
      setCropSourceUrl(`/api/metadata/proxy-image?url=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-[#0f172a] text-slate-800 dark:text-text rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
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
                {isQuran
                  ? isRtl
                    ? 'الصور الشخصية، خلفية البانر، وسيرة القارئ'
                    : 'Reciter info, avatar and backdrop'
                  : isRtl
                  ? 'الصور الشخصية، صورة البانر، وسيرة الفنان'
                  : 'Artist info, avatar and backdrop'}
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
                  {isQuran
                    ? isRtl
                      ? 'اسم القارئ / الشيخ'
                      : 'Reciter Name'
                    : isRtl
                    ? 'اسم الفنان / الفرقة'
                    : 'Artist Name'}{' '}
                  *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                    onChange={(e) => setCountry(e.target.value)}
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
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder={
                      isQuran
                        ? isRtl
                          ? 'مثال: حفلات خارجية، مرتل، تجويد...'
                          : 'Recitation Style'
                        : isRtl
                        ? 'مثال: طرب أصيل، كلاسيك، شعبي...'
                        : 'Genre'
                    }
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
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  placeholder={
                    isRtl
                      ? 'أدخل نبذة مختصرة عن القارئ أو الفنان، تاريخ ولادته، وأهم محطاته...'
                      : 'Enter biography or artist description...'
                  }
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
                  <div className="text-sm font-bold">
                    {isRtl ? 'تغيير الصورة الشخصية (مربعة 1:1)' : 'Change Profile Picture (1:1)'}
                  </div>
                  <p className="text-xs text-muted">
                    {isRtl
                      ? 'تظهر هذه الصورة في قائمة الفنانين والقراء وفي الإطار الشخصي داخل صفحة الفنان دون التأثر بصورة الخلفية.'
                      : 'This photo appears in the artists list and profile avatar independently from the backdrop.'}
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
                        e.target.value = '';
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
                  {isRtl ? 'أو أدخل رابط صورة شخصية مباشر (URL):' : 'Or enter direct profile photo URL:'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={photoUrlInput}
                    onChange={(e) => setPhotoUrlInput(e.target.value)}
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
                      await invalidateAllArtistQueries();
                      showNotice(isRtl ? 'تم تطبيق الصورة الشخصية بنجاح!' : 'Photo applied!');
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
                  <div className="text-xs font-bold text-muted">
                    {isRtl ? 'الصور الشخصية المتوفرة لهذا الفنان:' : 'Available profile photos:'}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {posterImages.map((img) => (
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
                            if (
                              confirm(
                                isRtl
                                  ? 'هل تريد حذف هذه الصورة الشخصية نهائياً؟'
                                  : 'Delete this photo permanently?'
                              )
                            ) {
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

          {/* TAB 3: Backdrop Banner with Interactive Crop & Pan */}
          {activeTab === 'backdrop' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Interactive Crop & Pan Editor when active */}
              {cropSourceUrl ? (
                <BackdropCropper
                  src={cropSourceUrl}
                  artistName={name || artist.name}
                  posterUrl={currentPoster}
                  isRtl={isRtl}
                  isApplying={uploadBackdropMut.isPending}
                  onCancel={() => setCropSourceUrl(null)}
                  onApply={(croppedFile) => {
                    uploadBackdropMut.mutate({ file: croppedFile, isCropped: true });
                  }}
                />
              ) : (
                /* Standard Live Banner Preview */
                <div className="relative aspect-[3/1] w-full rounded-2xl overflow-hidden bg-surfaceHover border-2 border-primaryMusic/30 shadow-xl group">
                  {currentBackdrop ? (
                    <img src={currentBackdrop} alt="" className="w-full h-full object-cover object-center" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted p-4 bg-gradient-to-br from-surface to-surfaceHover">
                      <ImageIcon size={32} className="opacity-40 mb-1" />
                      <span className="text-xs">
                        {isRtl ? 'لا توجد صورة خلفية مخصصة حتى الآن' : 'No custom backdrop yet'}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                  <div className="absolute bottom-3 start-4 text-white font-bold text-sm pointer-events-none drop-shadow">
                    {name}
                  </div>

                  {/* Quick Reposition / Crop button over current backdrop */}
                  {currentBackdrop && (
                    <button
                      type="button"
                      onClick={() => handleOpenCropperForUrl(currentBackdrop)}
                      className="absolute top-3 end-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/75 hover:bg-primaryMusic text-white hover:text-black font-bold text-xs border border-white/15 backdrop-blur-md shadow-lg transition cursor-pointer"
                    >
                      <Crop size={14} />
                      <span>{isRtl ? 'قص وتحريك الخلفية' : 'Crop & Reposition'}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Upload & Action Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-surface/40 border border-slate-200 dark:border-white/5">
                <div className="text-xs text-muted text-center sm:text-start space-y-1">
                  <div>
                    {isRtl
                      ? 'صورة الخلفية تظهر كبانر عريض في أعلى صفحة الفنان فقط ولا تستبدل الصورة الشخصية.'
                      : 'The backdrop appears solely as the wide hero banner and never replaces the profile photo.'}
                  </div>
                  <div className="text-primaryMusic font-semibold">
                    {isRtl
                      ? '💡 عند اختيار أي صورة سيفتح محرر القص والتحريك لضبط أبعادها بدقة.'
                      : '💡 Selecting an image opens the interactive crop & pan editor.'}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                  {currentBackdrop && (
                    <button
                      type="button"
                      disabled={deleteBackdropMut.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            isRtl
                              ? 'هل تريد بالتأكيد إلغاء وحذف صورة البانر والرجوع للتدرج اللوني الافتراضي؟'
                              : 'Are you sure you want to remove the backdrop banner?'
                          )
                        ) {
                          deleteBackdropMut.mutate();
                        }
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 font-bold text-xs border border-red-500/20 transition disabled:opacity-50 whitespace-nowrap"
                      title={
                        isRtl
                          ? 'حذف صورة الغلاف والعودة للتدرج اللوني الافتراضي'
                          : 'Remove backdrop'
                      }
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
                    onChange={handleSelectBackdropFile}
                  />
                  <button
                    type="button"
                    disabled={uploadBackdropMut.isPending}
                    onClick={() => backdropFileRef.current?.click()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primaryMusic text-black font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition disabled:opacity-50 whitespace-nowrap"
                  >
                    {uploadBackdropMut.isPending ? <Spinner size={14} /> : <Upload size={14} />}
                    <span>{isRtl ? 'اختيار وقص صورة خلفية' : 'Select & Crop Backdrop'}</span>
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
                    onChange={(e) => setBackdropUrlInput(e.target.value)}
                    placeholder="https://example.com/artist-banner.jpg"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-surface border border-slate-200 dark:border-white/10 text-xs sm:text-sm focus:outline-none focus:border-primaryMusic transition shadow-sm"
                  />
                  <button
                    type="button"
                    disabled={!backdropUrlInput.trim() || isSaving}
                    onClick={() => handleOpenCropperForUrl(backdropUrlInput)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primaryMusic/15 hover:bg-primaryMusic/25 text-primaryMusic font-bold text-xs border border-primaryMusic/30 transition disabled:opacity-50 active:scale-95 whitespace-nowrap"
                  >
                    <Crop size={14} />
                    <span>{isRtl ? 'معاينة وقص الرابط' : 'Crop & Apply URL'}</span>
                  </button>
                </div>
              </div>

              {/* Existing Gallery of Backdrop Photos */}
              {backdropImages.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
                  <div className="text-xs font-bold text-muted">
                    {isRtl ? 'صور الخلفية المخزنة:' : 'Stored backdrops:'}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {backdropImages.map((img) => (
                      <div
                        key={img.id}
                        onClick={() => setPrimaryMut.mutate(img.id)}
                        className={`group relative aspect-[3/1] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
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
                        <div className="absolute top-1.5 start-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenCropperForUrl(img.full);
                            }}
                            className="w-6 h-6 rounded-lg bg-black/75 hover:bg-primaryMusic text-white hover:text-black flex items-center justify-center transition shadow"
                            title={isRtl ? 'قص وتحريك هذه الخلفية' : 'Crop & reposition'}
                          >
                            <Crop size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                confirm(
                                  isRtl
                                    ? 'هل تريد حذف صورة الخلفية هذه نهائياً؟'
                                    : 'Delete this backdrop permanently?'
                                )
                              ) {
                                deleteImageMut.mutate(img.id);
                              }
                            }}
                            className="w-6 h-6 rounded-lg bg-black/75 hover:bg-red-600 text-white flex items-center justify-center transition shadow"
                            title={isRtl ? 'حذف صورة الخلفية' : 'Delete backdrop'}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
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
