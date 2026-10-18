import { useState, useRef, useEffect } from 'react';
import { X, Search as SearchIcon, Upload, Check, Image as ImageIcon, Sparkles, Star, Film, Tv, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { updateMetadata, updatePoster, searchMetadata, deletePoster, deleteBackdrop } from '../../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Spinner from './Spinner';

export default function EditMetadataModal({ isOpen, onClose, item, type = 'movie', onSave }) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [plot, setPlot] = useState('');
  const [rating, setRating] = useState('');
  const [genres, setGenres] = useState('');

  const [posterUrlInput, setPosterUrlInput] = useState('');
  const [backdropUrlInput, setBackdropUrlInput] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [applyNotice, setApplyNotice] = useState(null);

  const [localPoster, setLocalPoster] = useState(null);
  const [localBackdrop, setLocalBackdrop] = useState(null);

  const posterFileRef = useRef(null);
  const backdropFileRef = useRef(null);
  const prevOpenRef = useRef(false);
  const prevItemIdRef = useRef(null);

  // Sync state whenever modal opens or item changes (Guard against query refetches wiping active inputs!)
  useEffect(() => {
    const justOpened = isOpen && !prevOpenRef.current;
    const itemChanged = item && String(item.id) !== String(prevItemIdRef.current);

    if (isOpen && item && (justOpened || itemChanged)) {
      setTitle(item.title || '');
      setYear(item.year ? String(item.year) : '');
      setPlot(item.plot || '');
      setRating(item.rating ? String(item.rating) : '');
      const existingTags = item.tags?.map(t => t.name).join(', ') || '';
      setGenres(existingTags);
      setSearchQuery(item.title || '');
      setSearchResults([]);
      setApplyNotice(null);
      setLocalPoster(null);
      setLocalBackdrop(null);
    }

    prevOpenRef.current = isOpen;
    if (item) prevItemIdRef.current = item.id;
  }, [item, isOpen]);

  const mut = useMutation({
    mutationFn: async () => {
      // 1. If user typed/pasted a poster URL, save it
      if (posterUrlInput.trim()) {
        await updatePoster(type, item.id, posterUrlInput.trim(), 'poster');
        setPosterUrlInput('');
      }
      // 2. If user typed/pasted a backdrop URL, save it
      if (backdropUrlInput.trim()) {
        await updatePoster(type, item.id, backdropUrlInput.trim(), 'backdrop');
        setBackdropUrlInput('');
      }
      // 3. Save core metadata (title, year, plot, rating, genres)
      await updateMetadata(type, item.id, { 
        title, 
        year: year ? Number(year) : null, 
        plot, 
        rating: rating ? Number(rating) : null,
        genres
      });
    },
    onSuccess: async () => {
      const parsedTags = genres
        ? (Array.isArray(genres) ? genres : String(genres).split(',')).map(s => s.trim()).filter(Boolean).map((name, i) => ({ id: `t-${i}`, name }))
        : [];

      const updater = (old) => {
        if (!old) return old;
        return {
          ...old,
          title: title || old.title,
          year: year ? Number(year) : old.year,
          plot: plot !== undefined ? plot : old.plot,
          rating: rating ? Number(rating) : old.rating,
          tags: parsedTags.length > 0 ? parsedTags : old.tags
        };
      };

      qc.setQueryData([type, String(item.id)], updater);
      qc.setQueryData([type, Number(item.id)], updater);

      await Promise.all([
        qc.invalidateQueries({ queryKey: [type] }),
        qc.invalidateQueries({ queryKey: ['movies'] }),
        qc.invalidateQueries({ queryKey: ['series'] }),
        qc.invalidateQueries({ queryKey: ['library'] }),
        qc.invalidateQueries({ queryKey: ['libraries'] }),
        qc.invalidateQueries({ queryKey: ['movies-library'] }),
        qc.invalidateQueries({ queryKey: ['movies-similar'] }),
        qc.invalidateQueries({ queryKey: ['related-series'] })
      ]);

      await Promise.all([
        qc.refetchQueries({ queryKey: [type, String(item.id)], type: 'active' }),
        qc.refetchQueries({ queryKey: [type, Number(item.id)], type: 'active' })
      ]);

      if (onSave) onSave({ title, year, plot, rating, genres });
      onClose();
    },
    onError: (err) => {
      console.error('Failed to save metadata:', err);
      alert(isArabic ? 'حدث خطأ أثناء حفظ التغييرات' : 'Failed to save changes');
    }
  });

  const posterMut = useMutation({
    mutationFn: async (payload) => {
      return await updatePoster(type, item.id, payload, 'poster');
    },
    onSuccess: async (res) => {
      const newThumb = res?.data?.thumb || res?.data?.full;
      const newFull = res?.data?.full || res?.data?.thumb;
      if (newThumb) {
        setLocalPoster(newThumb);
      }
      const updater = (old) => {
        if (!old) return old;
        const newImgObj = {
          id: res?.data?.id || Date.now(),
          url: newFull,
          thumb: newThumb,
          is_primary: true
        };
        const oldPosters = (old.posters || []).map(p => ({ ...p, is_primary: false }));
        return {
          ...old,
          poster: newThumb,
          posters: [newImgObj, ...oldPosters]
        };
      };
      qc.setQueryData([type, String(item.id)], updater);
      qc.setQueryData([type, Number(item.id)], updater);

      await qc.invalidateQueries({ queryKey: [type] });
      await qc.invalidateQueries({ queryKey: ['library'] });
      await qc.invalidateQueries({ queryKey: ['series'] });
      await qc.invalidateQueries({ queryKey: ['movies'] });
      await qc.refetchQueries({ queryKey: [type, String(item.id)], type: 'active' });
      await qc.refetchQueries({ queryKey: [type, Number(item.id)], type: 'active' });
    }
  });

  const backdropMut = useMutation({
    mutationFn: async (payload) => {
      return await updatePoster(type, item.id, payload, 'backdrop');
    },
    onSuccess: async (res) => {
      const newThumb = res?.data?.thumb || res?.data?.full;
      const newFull = res?.data?.full || res?.data?.thumb;
      if (newFull) {
        setLocalBackdrop(newFull);
      }
      const updater = (old) => {
        if (!old) return old;
        const newImgObj = {
          id: res?.data?.id || Date.now(),
          url: newFull,
          thumb: newThumb,
          is_primary: true
        };
        const oldBackdrops = (old.backdrops || []).map(b => ({ ...b, is_primary: false }));
        return {
          ...old,
          backdrop: newFull,
          backdrops: [newImgObj, ...oldBackdrops]
        };
      };
      qc.setQueryData([type, String(item.id)], updater);
      qc.setQueryData([type, Number(item.id)], updater);

      await qc.invalidateQueries({ queryKey: [type] });
      await qc.invalidateQueries({ queryKey: ['library'] });
      await qc.invalidateQueries({ queryKey: ['series'] });
      await qc.invalidateQueries({ queryKey: ['movies'] });
      await qc.refetchQueries({ queryKey: [type, String(item.id)], type: 'active' });
      await qc.refetchQueries({ queryKey: [type, Number(item.id)], type: 'active' });
    }
  });

  // Delete poster mutation
  const deletePosterMut = useMutation({
    mutationFn: () => deletePoster(type, item.id),
    onSuccess: async () => {
      setLocalPoster(null);
      await qc.invalidateQueries({ queryKey: [type] });
      await qc.invalidateQueries({ queryKey: ['library'] });
      await qc.invalidateQueries({ queryKey: ['series'] });
      await qc.invalidateQueries({ queryKey: ['movies'] });
      await qc.refetchQueries({ queryKey: [type, String(item.id)], type: 'active' });
      await qc.refetchQueries({ queryKey: [type, Number(item.id)], type: 'active' });
    }
  });

  // Delete backdrop mutation
  const deleteBackdropMut = useMutation({
    mutationFn: () => deleteBackdrop(type, item.id),
    onSuccess: async () => {
      setLocalBackdrop(null);
      await qc.invalidateQueries({ queryKey: [type] });
      await qc.invalidateQueries({ queryKey: ['library'] });
      await qc.invalidateQueries({ queryKey: ['series'] });
      await qc.invalidateQueries({ queryKey: ['movies'] });
      await qc.refetchQueries({ queryKey: [type, String(item.id)], type: 'active' });
      await qc.refetchQueries({ queryKey: [type, Number(item.id)], type: 'active' });
    }
  });

  const isSaving = mut.isPending || posterMut.isPending || backdropMut.isPending || deletePosterMut.isPending || deleteBackdropMut.isPending;

  const handleApplyResult = async (res) => {
    const newTitle = res.title || title;
    const newYear = res.year ? String(res.year) : year;
    const newPlot = res.plot || plot;
    const newRating = res.rating ? String(res.rating) : rating;
    const newGenres = res.genres ? (Array.isArray(res.genres) ? res.genres.join(', ') : String(res.genres)) : genres;
    const tmdbIdNum = res.id && String(res.id).startsWith('tmdb-') ? Number(String(res.id).replace('tmdb-', '')) : null;

    if (newTitle) setTitle(newTitle);
    if (newYear) setYear(newYear);
    if (newPlot) setPlot(newPlot);
    if (newRating) setRating(newRating);
    if (newGenres) setGenres(newGenres);

    // Save core metadata immediately to backend so nothing is lost
    try {
      await updateMetadata(type, item.id, {
        title: newTitle,
        year: newYear ? Number(newYear) : null,
        plot: newPlot,
        rating: newRating ? Number(newRating) : null,
        genres: newGenres,
        tmdb_id: tmdbIdNum
      });
      const updater = (old) => {
        if (!old) return old;
        return {
          ...old,
          title: newTitle,
          year: newYear ? Number(newYear) : old.year,
          plot: newPlot,
          rating: newRating ? Number(newRating) : old.rating,
          tags: Array.isArray(res.genres) ? res.genres.map((g, i) => ({ id: `t-${i}`, name: g })) : old.tags
        };
      };
      qc.setQueryData([type, String(item.id)], updater);
      qc.setQueryData([type, Number(item.id)], updater);
      await qc.invalidateQueries({ queryKey: [type] });
      await qc.invalidateQueries({ queryKey: ['library'] });
      await qc.invalidateQueries({ queryKey: ['series'] });
      await qc.invalidateQueries({ queryKey: ['movies'] });
    } catch (e) {
      console.error('Failed to auto-save metadata on apply:', e);
    }

    if (res.poster) {
      setLocalPoster(res.poster);
      posterMut.mutate(res.poster);
    }
    if (res.backdrop) {
      setLocalBackdrop(res.backdrop);
      backdropMut.mutate(res.backdrop);
    }

    setApplyNotice(isArabic ? `تم تطبيق وحفظ بيانات وملصقات: "${newTitle}" بنجاح!` : `Applied and saved metadata for "${newTitle}"!`);
    setTimeout(() => setApplyNotice(null), 4000);
  };

  const executeSearch = async (queryToSearch, autoApplyIfSingle = false) => {
    const q = (queryToSearch || searchQuery).trim();
    if (!q) return;
    setIsSearching(true);
    setApplyNotice(null);
    try {
      const results = await searchMetadata(q, type);
      setSearchResults(results || []);

      if (results && results.length > 0) {
        if (autoApplyIfSingle) {
          handleApplyResult(results[0]);
        }
      } else {
        setApplyNotice(isArabic ? 'لم يتم العثور على نتائج متطابقة لهذا الرابط أو الاسم' : 'No matching results found for this code or title');
        setTimeout(() => setApplyNotice(null), 4000);
      }
    } catch (err) {
      console.error('Metadata search failed:', err);
      setSearchResults([]);
      setApplyNotice(isArabic ? 'حدث خطأ أثناء البحث عن البيانات' : 'Error searching metadata');
      setTimeout(() => setApplyNotice(null), 4000);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePosterUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const preview = URL.createObjectURL(file);
      setLocalPoster(preview);
    } catch {}
    const formData = new FormData();
    formData.append('file', file);
    formData.append('imageType', 'poster');
    posterMut.mutate(formData);
  };

  const handleBackdropUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const preview = URL.createObjectURL(file);
      setLocalBackdrop(preview);
    } catch {}
    const formData = new FormData();
    formData.append('file', file);
    formData.append('imageType', 'backdrop');
    backdropMut.mutate(formData);
  };

  if (!isOpen || !item) return null;

  const currentPoster = localPoster || item.posters?.[0]?.url || item.poster;
  const currentBackdrop = localBackdrop || item.backdrops?.[0]?.url || item.backdrop;
  const isSeries = type === 'series' || type === 'season';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl dark:shadow-[0_25px_70px_rgba(0,0,0,0.95)] relative text-slate-800 dark:text-text">
        
        {/* ============================================================ */}
        {/* HEADER BAR */}
        {/* ============================================================ */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400 shadow-inner">
              {isSeries ? <Tv size={20} /> : <Film size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {isArabic ? 'تعديل بيانات العمل والملصقات' : 'Edit Metadata & Artwork'}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  isSeries 
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30' 
                    : 'bg-primaryMovies/20 text-red-700 dark:text-red-300 border border-primaryMovies/30'
                }`}>
                  {isSeries ? (isArabic ? 'مسلسل' : 'Series') : (isArabic ? 'فيلم' : 'Movie')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-muted truncate max-w-md">
                {item.title}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-muted hover:text-slate-900 dark:hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* ============================================================ */}
        {/* MODAL BODY (SCROLLABLE) */}
        {/* ============================================================ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">

          {/* Alert / Success Notification */}
          {applyNotice && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-semibold shadow-sm animate-fadeIn">
              <Check size={16} className="text-emerald-500 flex-shrink-0" />
              <span>{applyNotice}</span>
            </div>
          )}

          {/* ============================================================ */}
          {/* TOP SECTION: ONLINE SEARCH & DIRECT ID / CODE FETCH */}
          {/* ============================================================ */}
          <div className="rounded-2xl bg-slate-50/80 dark:bg-surface/80 border border-slate-200 dark:border-white/10 p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500 dark:text-amber-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {isArabic ? 'البحث أو الجلب المباشر بكود العمل (TMDB / IMDb)' : 'Online Search & Direct Fetch (TMDB / IMDb)'}
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-white/5 text-slate-600 dark:text-gray-400 border border-slate-300/60 dark:border-white/5 font-medium">
                {isSeries ? (isArabic ? 'مسلسلات فقط' : 'TV Series Only') : (isArabic ? 'أفلام فقط' : 'Movies Only')}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-muted leading-relaxed">
              {isArabic 
                ? 'يمكنك وضع الكود اللي في الرابط بعد tv/ (مثل: 52698-al-kabeer أو 52698)، أو الرابط كاملاً، أو كود IMDb (مثل: tt2290891)، أو البحث باسم العمل مباشرة:'
                : 'Paste the TMDB code from the URL (e.g. 52698-al-kabeer or 52698), the full URL, or IMDb ID (tt...), or search by title:'}
            </p>

            {/* Search Input with Dual Action Buttons */}
            <form onSubmit={(e) => { e.preventDefault(); executeSearch(searchQuery, false); }} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 min-w-0">
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={
                    isArabic
                      ? "مثال: 52698-al-kabeer أو رابط TMDB أو كود tt2290891 أو اسم المسلسل..."
                      : "e.g. 52698-al-kabeer, full TMDB URL, tt2290891, or title..."
                  }
                  className="w-full bg-white dark:bg-black/40 border border-slate-300 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-muted dark:hover:text-white text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Direct Fetch by Code / URL Button */}
                <button
                  type="button"
                  disabled={isSearching || !searchQuery.trim()}
                  onClick={() => executeSearch(searchQuery, true)}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-black text-xs sm:text-sm font-extrabold shadow-lg shadow-amber-500/25 transition disabled:opacity-40 active:scale-95"
                  title={isArabic ? 'جلب البيانات وتطبيقها فوراً بالكود أو الرابط' : 'Fetch and auto-apply by code or URL'}
                >
                  <Sparkles size={15} />
                  <span>{isArabic ? 'جلب تلقائي بالكود أو الرابط' : 'Fetch by Code / URL'}</span>
                </button>

                {/* Search by Title Button */}
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-surfaceHover hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white text-xs sm:text-sm font-semibold transition disabled:opacity-40"
                >
                  {isSearching ? <Spinner size={15} /> : <SearchIcon size={15} />}
                  <span>{isArabic ? 'بحث' : 'Search'}</span>
                </button>
              </div>
            </form>

            {/* Results Shelf */}
            {searchResults.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-muted">
                  <span>{isArabic ? `النتائج المتطابقة (${searchResults.length}):` : `Matching Results (${searchResults.length}):`}</span>
                  <span className="text-[11px] text-amber-600 dark:text-amber-400">{isArabic ? 'اضغط "تطبيق البيانات والصور" لاعتماد العمل' : 'Click "Apply" to populate metadata and artwork'}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto custom-scrollbar p-1">
                  {searchResults.map((res, i) => {
                    const isDirect = res.isDirectMatch;
                    return (
                      <div
                        key={res.id || i}
                        className={`flex gap-3 p-2.5 rounded-xl border transition relative group text-start ${
                          isDirect
                            ? 'bg-amber-500/10 border-amber-400/50 shadow-md shadow-amber-500/10'
                            : 'bg-white dark:bg-black/30 border-slate-200 dark:border-white/10 hover:border-amber-400/40 hover:bg-slate-50 dark:hover:bg-black/40 shadow-sm'
                        }`}
                      >
                        {/* Poster Thumbnail */}
                        <div className="w-14 aspect-[2/3] bg-slate-100 dark:bg-black/60 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200 dark:border-white/10">
                          {res.poster ? (
                            <img src={res.poster} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-muted">
                              <Film size={18} className="opacity-30" />
                            </div>
                          )}
                        </div>

                        {/* Title & Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <div>
                            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-300 transition">
                              {res.title}
                            </div>
                            
                            <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                              {res.year && <span className="text-slate-600 dark:text-gray-300 font-semibold">{res.year}</span>}
                              
                              {res.rating && (
                                <span className="flex items-center gap-0.5 text-amber-500 dark:text-amber-400 font-bold">
                                  <Star size={11} fill="currentColor" />
                                  <span>{res.rating}</span>
                                </span>
                              )}

                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider ${
                                res.source === 'imdb'
                                  ? 'bg-[#f5c518] text-black'
                                  : 'bg-sky-500 text-white'
                              }`}>
                                {res.source}
                              </span>

                              {isDirect && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/30">
                                  {isArabic ? 'كود مباشر' : 'Direct'}
                                </span>
                              )}
                            </div>

                            {res.genres?.length > 0 && (
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                {(Array.isArray(res.genres) ? res.genres : [res.genres]).slice(0, 3).map((g, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-gray-300 font-medium">
                                    {g}
                                  </span>
                                ))}
                              </div>
                            )}

                            {res.plot && (
                              <p className="text-[11px] text-slate-500 dark:text-muted line-clamp-2 mt-1 leading-tight">
                                {res.plot}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleApplyResult(res)}
                            className="mt-2 w-full py-1 px-2.5 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-amber-400 hover:text-black border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                          >
                            <Check size={12} />
                            <span>{isArabic ? 'تطبيق البيانات والصور' : 'Apply All'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* LOWER SECTION: METADATA FORM & ARTWORK MANAGEMENT */}
          {/* ============================================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* -------------------------------------------------------- */}
            {/* COLUMN 1: METADATA FIELDS (7 COLS) */}
            {/* -------------------------------------------------------- */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {isArabic ? 'بيانات وتفاصيل العمل' : 'Work Details & Plot'}
                </span>
              </div>

              {/* Title Field */}
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-muted">
                  {isArabic ? 'اسم العمل (العنوان):' : 'Title:'}
                </label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-white dark:bg-black/30 border border-slate-300 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none transition font-medium"
                />
              </div>

              {/* Year & Rating in 2 Columns */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-muted">
                    {isArabic ? 'سنة الإنتاج:' : 'Release Year:'}
                  </label>
                  <input
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    type="number"
                    placeholder={isArabic ? 'مثال: 2026' : 'e.g. 2026'}
                    className="w-full bg-white dark:bg-black/30 border border-slate-300 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none transition font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-muted">
                    {isArabic ? 'التقييم (0 - 10):' : 'Rating (0 - 10):'}
                  </label>
                  <input
                    value={rating}
                    onChange={e => setRating(e.target.value)}
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    placeholder={isArabic ? 'مثال: 8.5' : 'e.g. 8.5'}
                    className="w-full bg-white dark:bg-black/30 border border-slate-300 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none transition font-medium"
                  />
                </div>
              </div>

              {/* Genres / Tags */}
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-muted">
                  {isArabic ? 'التصنيف / النوع (الوسوم):' : 'Genres / Classification:'}
                </label>
                <input
                  value={genres}
                  onChange={e => setGenres(e.target.value)}
                  placeholder={isArabic ? 'مثال: كوميديا, دراما, إثارة...' : 'e.g. Comedy, Drama, Action...'}
                  className="w-full bg-white dark:bg-black/30 border border-slate-300 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none transition font-medium"
                />
              </div>

              {/* Plot / Overview */}
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-muted">
                  {isArabic ? 'قصة العمل / الملخص:' : 'Plot / Summary:'}
                </label>
                <textarea
                  value={plot}
                  onChange={e => setPlot(e.target.value)}
                  rows={5}
                  placeholder={isArabic ? 'اكتب ملخص أو قصة العمل هنا...' : 'Enter plot summary...'}
                  className="w-full bg-white dark:bg-black/30 border border-slate-300 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none transition resize-none leading-relaxed font-normal"
                />
              </div>
            </div>

            {/* -------------------------------------------------------- */}
            {/* COLUMN 2: ARTWORK (POSTER & BACKDROP) (5 COLS) */}
            {/* -------------------------------------------------------- */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <ImageIcon size={16} className="text-amber-500 dark:text-amber-400" />
                  <span>{isArabic ? 'إدارة البوستر وصورة الخلفية' : 'Media Artwork'}</span>
                </span>
                {(posterMut.isPending || backdropMut.isPending) && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-500 dark:text-amber-400">
                    <Spinner size={12} />
                    <span>{isArabic ? 'جاري التحديث...' : 'Updating...'}</span>
                  </span>
                )}
              </div>

              {/* 1. Dedicated Poster Card */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-surface/90 border border-slate-200 dark:border-white/10 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {isArabic ? 'البوستر الرسمي (Poster 2:3)' : 'Official Poster (2:3)'}
                  </span>
                  {posterMut.isPending && <Spinner size={12} />}
                </div>

                <div className="flex items-center gap-3.5">
                  {/* Poster Preview Box */}
                  <div className="w-20 sm:w-24 aspect-[2/3] bg-slate-200 dark:bg-black/60 rounded-xl border border-slate-300 dark:border-white/15 overflow-hidden flex-shrink-0 shadow-md relative group">
                    {currentPoster ? (
                      <img src={currentPoster} alt="Poster" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-muted">
                        <Film size={20} className="opacity-40 mb-1" />
                        <span className="text-[10px]">{isArabic ? 'بدون بوستر' : 'No Poster'}</span>
                      </div>
                    )}
                    {/* Delete overlay */}
                    {currentPoster && (
                      <button
                        type="button"
                        onClick={() => { if (confirm(isArabic ? 'هل تريد حذف البوستر نهائياً؟' : 'Delete this poster permanently?')) deletePosterMut.mutate(); }}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                        title={isArabic ? 'حذف البوستر' : 'Delete Poster'}
                      >
                        {deletePosterMut.isPending ? <Spinner size={16} /> : <Trash2 size={20} className="text-red-400" />}
                      </button>
                    )}
                  </div>

                  {/* Poster Actions Stack */}
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <input 
                      type="file" 
                      ref={posterFileRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handlePosterUpload} 
                    />
                    
                    <button
                      type="button"
                      onClick={() => posterFileRef.current?.click()}
                      className="w-full py-2 px-3 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/15 border border-slate-300 dark:border-white/15 text-xs font-semibold text-slate-800 dark:text-white flex items-center justify-center gap-2 transition active:scale-95 shadow-sm"
                    >
                      <Upload size={13} className="text-amber-500 dark:text-amber-400" />
                      <span>{isArabic ? 'رفع بوستر من الجهاز' : 'Upload File'}</span>
                    </button>

                    {/* URL Input Bar */}
                    <div className="flex gap-1.5">
                      <input
                        type="url"
                        placeholder={isArabic ? 'أو الصق رابط بوستر مباشر...' : 'Or paste URL...'}
                        value={posterUrlInput}
                        onChange={e => setPosterUrlInput(e.target.value)}
                        className="flex-1 min-w-0 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 placeholder-slate-400 dark:placeholder-gray-500"
                      />
                      <button
                        type="button"
                        disabled={!posterUrlInput.trim()}
                        onClick={() => {
                          posterMut.mutate(posterUrlInput.trim());
                          setPosterUrlInput('');
                        }}
                        className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-black rounded-lg text-xs font-bold transition disabled:opacity-30 flex-shrink-0 shadow-sm"
                      >
                        {isArabic ? 'حفظ' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Dedicated Backdrop Card */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-surface/90 border border-slate-200 dark:border-white/10 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {isArabic ? 'صورة الخلفية البانورامية (Backdrop 16:9)' : 'Landscape Backdrop (16:9)'}
                  </span>
                  {backdropMut.isPending && <Spinner size={12} />}
                </div>

                <div className="flex items-center gap-3.5">
                  {/* Backdrop Preview Box */}
                  <div className="w-28 sm:w-32 aspect-video bg-slate-200 dark:bg-black/60 rounded-xl border border-slate-300 dark:border-white/15 overflow-hidden flex-shrink-0 shadow-md relative group">
                    {currentBackdrop ? (
                      <img src={currentBackdrop} alt="Backdrop" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-muted">
                        <ImageIcon size={20} className="opacity-40 mb-1" />
                        <span className="text-[10px]">{isArabic ? 'بدون خلفية' : 'No Backdrop'}</span>
                      </div>
                    )}
                    {/* Delete overlay */}
                    {currentBackdrop && (
                      <button
                        type="button"
                        onClick={() => { if (confirm(isArabic ? 'هل تريد حذف صورة الخلفية نهائياً؟' : 'Delete this backdrop permanently?')) deleteBackdropMut.mutate(); }}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                        title={isArabic ? 'حذف الخلفية' : 'Delete Backdrop'}
                      >
                        {deleteBackdropMut.isPending ? <Spinner size={16} /> : <Trash2 size={20} className="text-red-400" />}
                      </button>
                    )}
                  </div>

                  {/* Backdrop Actions Stack */}
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <input 
                      type="file" 
                      ref={backdropFileRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleBackdropUpload} 
                    />
                    
                    <button
                      type="button"
                      onClick={() => backdropFileRef.current?.click()}
                      className="w-full py-2 px-3 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/15 border border-slate-300 dark:border-white/15 text-xs font-semibold text-slate-800 dark:text-white flex items-center justify-center gap-2 transition active:scale-95 shadow-sm"
                    >
                      <Upload size={13} className="text-amber-500 dark:text-amber-400" />
                      <span>{isArabic ? 'رفع خلفية من الجهاز' : 'Upload File'}</span>
                    </button>

                    {/* URL Input Bar */}
                    <div className="flex gap-1.5">
                      <input
                        type="url"
                        placeholder={isArabic ? 'أو الصق رابط خلفية...' : 'Or paste URL...'}
                        value={backdropUrlInput}
                        onChange={e => setBackdropUrlInput(e.target.value)}
                        className="flex-1 min-w-0 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 placeholder-slate-400 dark:placeholder-gray-500"
                      />
                      <button
                        type="button"
                        disabled={!backdropUrlInput.trim()}
                        onClick={() => {
                          backdropMut.mutate(backdropUrlInput.trim());
                          setBackdropUrlInput('');
                        }}
                        className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-black rounded-lg text-xs font-bold transition disabled:opacity-30 flex-shrink-0 shadow-sm"
                      >
                        {isArabic ? 'حفظ' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* ============================================================ */}
        {/* FOOTER ACTIONS */}
        {/* ============================================================ */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-3 bg-slate-50/80 dark:bg-white/[0.02]">
          <button 
            type="button"
            onClick={onClose} 
            disabled={isSaving}
            className="px-6 py-2.5 rounded-full font-semibold hover:bg-slate-200/70 dark:hover:bg-white/10 transition text-xs sm:text-sm text-slate-600 dark:text-muted hover:text-slate-900 dark:hover:text-white disabled:opacity-40"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>

          <button 
            type="button"
            onClick={() => mut.mutate()}
            disabled={isSaving}
            className="px-7 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-black font-extrabold shadow-lg shadow-amber-500/25 transition text-xs sm:text-sm flex items-center gap-2 active:scale-95 disabled:opacity-40"
          >
            {isSaving && <Spinner size={15} />}
            <span>{isSaving ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : (isArabic ? 'حفظ التغييرات' : 'Save Changes')}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
