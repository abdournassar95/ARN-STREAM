import { useState, useRef, useEffect } from 'react';
import { X, Search as SearchIcon, Upload, Check, Image as ImageIcon, Film, Save, Star, Sparkles, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { updateSeason, updateSeasonImage, searchMetadata, deletePoster, deleteBackdrop } from '../../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Spinner from './Spinner';

export default function EditSeasonModal({ isOpen, onClose, season, seriesId, seriesTitle = '' }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const qc = useQueryClient();

  const [title, setTitle] = useState(season?.title || '');
  const [seasonNumber, setSeasonNumber] = useState(season?.season_number || 1);
  const [year, setYear] = useState(season?.year || '');
  const [plot, setPlot] = useState(season?.plot || '');

  const [posterUrlInput, setPosterUrlInput] = useState('');
  const [backdropUrlInput, setBackdropUrlInput] = useState('');

  const [searchQuery, setSearchQuery] = useState(seriesTitle || '');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [localPoster, setLocalPoster] = useState(null);
  const [localBackdrop, setLocalBackdrop] = useState(null);

  const posterFileRef = useRef(null);
  const backdropFileRef = useRef(null);

  const prevOpenRef = useRef(false);
  const prevSeasonIdRef = useRef(null);

  useEffect(() => {
    const justOpened = isOpen && !prevOpenRef.current;
    const seasonChanged = season && String(season.id) !== String(prevSeasonIdRef.current);

    if (isOpen && season && (justOpened || seasonChanged)) {
      setTitle(season.title || '');
      setSeasonNumber(season.season_number || 1);
      setYear(season.year ? String(season.year) : '');
      setPlot(season.plot || '');
      setPosterUrlInput('');
      setBackdropUrlInput('');
      setSearchQuery(seriesTitle || '');
      setSearchResults([]);
      setLocalPoster(null);
      setLocalBackdrop(null);
    }

    prevOpenRef.current = isOpen;
    if (season) prevSeasonIdRef.current = season.id;
  }, [isOpen, season?.id, seriesTitle]);

  const mut = useMutation({
    mutationFn: async () => {
      if (posterUrlInput.trim()) {
        await updateSeasonImage(season.id, posterUrlInput.trim(), 'season_poster');
        setPosterUrlInput('');
      }
      if (backdropUrlInput.trim()) {
        await updateSeasonImage(season.id, backdropUrlInput.trim(), 'backdrop');
        setBackdropUrlInput('');
      }
      await updateSeason(season.id, {
        title,
        season_number: Number(seasonNumber),
        year: year ? Number(year) : null,
        plot
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['series', String(seriesId)] });
      await qc.invalidateQueries({ queryKey: ['series', Number(seriesId)] });
      await qc.invalidateQueries({ queryKey: ['series'] });
      await qc.invalidateQueries({ queryKey: ['library'] });
      await qc.invalidateQueries({ queryKey: ['shows'] });
      await qc.refetchQueries({ queryKey: ['series', String(seriesId)] });
      onClose();
    },
    onError: (err) => {
      console.error('Failed to save season:', err);
      alert(isRtl ? 'حدث خطأ أثناء حفظ بيانات الموسم' : 'Failed to save season data');
    }
  });

  const posterMut = useMutation({
    mutationFn: async (payload) => {
      return await updateSeasonImage(season.id, payload, 'season_poster');
    },
    onSuccess: (res) => {
      if (res?.data?.thumb || res?.data?.full) {
        setLocalPoster(res.data.thumb || res.data.full);
      }
      qc.invalidateQueries({ queryKey: ['series', String(seriesId)] });
      qc.invalidateQueries({ queryKey: ['series', Number(seriesId)] });
      qc.invalidateQueries({ queryKey: ['series'] });
      qc.invalidateQueries({ queryKey: ['library'] });
      qc.invalidateQueries({ queryKey: ['shows'] });
    }
  });

  const backdropMut = useMutation({
    mutationFn: async (payload) => {
      return await updateSeasonImage(season.id, payload, 'backdrop');
    },
    onSuccess: (res) => {
      if (res?.data?.thumb || res?.data?.full) {
        setLocalBackdrop(res.data.thumb || res.data.full);
      }
      qc.invalidateQueries({ queryKey: ['series', String(seriesId)] });
      qc.invalidateQueries({ queryKey: ['series', Number(seriesId)] });
      qc.invalidateQueries({ queryKey: ['series'] });
      qc.invalidateQueries({ queryKey: ['library'] });
      qc.invalidateQueries({ queryKey: ['shows'] });
    }
  });

  // Delete poster mutation
  const deletePosterMut = useMutation({
    mutationFn: () => deletePoster('season', season.id),
    onSuccess: () => {
      setLocalPoster(null);
      qc.invalidateQueries({ queryKey: ['series', String(seriesId)] });
      qc.invalidateQueries({ queryKey: ['series', Number(seriesId)] });
      qc.invalidateQueries({ queryKey: ['series'] });
      qc.invalidateQueries({ queryKey: ['library'] });
      qc.invalidateQueries({ queryKey: ['shows'] });
    }
  });

  // Delete backdrop mutation
  const deleteBackdropMut = useMutation({
    mutationFn: () => deleteBackdrop('season', season.id),
    onSuccess: () => {
      setLocalBackdrop(null);
      qc.invalidateQueries({ queryKey: ['series', String(seriesId)] });
      qc.invalidateQueries({ queryKey: ['series', Number(seriesId)] });
      qc.invalidateQueries({ queryKey: ['series'] });
      qc.invalidateQueries({ queryKey: ['library'] });
      qc.invalidateQueries({ queryKey: ['shows'] });
    }
  });

  const isSaving = mut.isPending || posterMut.isPending || backdropMut.isPending || deletePosterMut.isPending || deleteBackdropMut.isPending;

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchMetadata(searchQuery, 'season');
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleApplyResult = async (res) => {
    const newTitle = res.title || title;
    const newYear = res.year ? String(res.year) : year;
    const newPlot = res.plot || plot;

    if (newTitle) setTitle(newTitle);
    if (newYear) setYear(newYear);
    if (newPlot) setPlot(newPlot);

    try {
      await updateSeason(season.id, {
        title: newTitle,
        season_number: Number(seasonNumber),
        year: newYear ? Number(newYear) : null,
        plot: newPlot
      });
      await qc.invalidateQueries({ queryKey: ['series', String(seriesId)] });
      await qc.invalidateQueries({ queryKey: ['series', Number(seriesId)] });
      await qc.invalidateQueries({ queryKey: ['series'] });
    } catch (e) {
      console.error('Failed to auto-save season metadata on apply:', e);
    }

    if (res.poster) {
      setLocalPoster(res.poster);
      posterMut.mutate(res.poster);
    }
    if (res.backdrop) {
      setLocalBackdrop(res.backdrop);
      backdropMut.mutate(res.backdrop);
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
    formData.append('imageType', 'season_poster');
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

  if (!isOpen || !season) return null;

  const currentPoster = localPoster || season.posters?.[0]?.thumb || season.posters?.[0]?.url;
  const currentBackdrop = localBackdrop || season.backdrops?.[0]?.thumb || season.backdrops?.[0]?.url;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl dark:shadow-[0_25px_70px_rgba(0,0,0,0.95)] relative text-slate-800 dark:text-text">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400">
              <Film size={20} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{isRtl ? 'تعديل بيانات وصور الموسم' : 'Edit Season Data & Media'}</h2>
              <p className="text-xs text-slate-500 dark:text-muted">{seriesTitle ? `${seriesTitle} • ` : ''}{isRtl ? `الموسم ${season.season_number}` : `Season ${season.season_number}`}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-muted hover:text-slate-900 dark:hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col md:flex-row gap-6 custom-scrollbar">
          {/* Left Column: Form & Images */}
          <div className="flex-1 flex flex-col gap-5">
            {/* Title & Season Number */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1.5 text-slate-600 dark:text-muted">{isRtl ? 'اسم الموسم (اختياري)' : 'Season Name (Optional)'}</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={isRtl ? `الموسم ${season.season_number}` : `Season ${season.season_number}`}
                  className="w-full bg-white dark:bg-black/20 border border-slate-300 dark:border-border rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:border-amber-500 outline-none transition font-medium placeholder-slate-400 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-600 dark:text-muted">{isRtl ? 'رقم الموسم' : 'Season Number'}</label>
                <input
                  type="number"
                  value={seasonNumber}
                  onChange={e => setSeasonNumber(e.target.value)}
                  className="w-full bg-white dark:bg-black/20 border border-slate-300 dark:border-border rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:border-amber-500 outline-none transition font-medium"
                />
              </div>
            </div>

            {/* Year */}
            <div className="w-full sm:w-1/2">
              <label className="block text-xs font-semibold mb-1.5 text-slate-600 dark:text-muted">{isRtl ? 'سنة الإنتاج' : 'Release Year'}</label>
              <input
                type="number"
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="2023"
                className="w-full bg-white dark:bg-black/20 border border-slate-300 dark:border-border rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:border-amber-500 outline-none transition font-medium placeholder-slate-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Overview / Plot */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-slate-600 dark:text-muted">{isRtl ? 'قصة / نبذة عن الموسم' : 'Season Overview'}</label>
              <textarea
                value={plot}
                onChange={e => setPlot(e.target.value)}
                rows={3}
                placeholder={isRtl ? 'نبذة مختصرة عن أحداث هذا الموسم...' : 'Brief overview of this season...'}
                className="w-full bg-white dark:bg-black/20 border border-slate-300 dark:border-border rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:border-amber-500 outline-none resize-none transition leading-relaxed placeholder-slate-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Image Management Section */}
            <div className="border-t border-slate-200 dark:border-border pt-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-text mb-3 flex items-center gap-2">
                <ImageIcon size={16} className="text-primaryMovies" />
                {isRtl ? 'صور الموسم (البوستر والباكدروب)' : 'Season Artwork (Poster & Backdrop)'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Season Poster */}
                <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-black/25 flex flex-col gap-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{isRtl ? 'بوستر الموسم (2:3)' : 'Season Poster (2:3)'}</span>
                    {posterMut.isPending && <Spinner size={12} />}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-16 h-24 rounded-xl bg-slate-200 dark:bg-black/50 border border-slate-300 dark:border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-md relative group">
                      {currentPoster ? (
                        <img src={currentPoster} alt="Poster" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 dark:text-muted">{isRtl ? 'لا يوجد' : 'None'}</span>
                      )}
                      {currentPoster && (
                        <button
                          type="button"
                          onClick={() => { if (confirm(isRtl ? 'هل تريد حذف بوستر الموسم نهائياً؟' : 'Delete this season poster permanently?')) deletePosterMut.mutate(); }}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                          title={isRtl ? 'حذف البوستر' : 'Delete Poster'}
                        >
                          {deletePosterMut.isPending ? <Spinner size={14} /> : <Trash2 size={16} className="text-red-400" />}
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <input type="file" ref={posterFileRef} className="hidden" accept="image/*" onChange={handlePosterUpload} />
                      <button
                        type="button"
                        onClick={() => posterFileRef.current?.click()}
                        className="w-full py-1.5 px-3 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition text-slate-800 dark:text-white shadow-sm"
                      >
                        <Upload size={12} className="text-amber-500 dark:text-amber-400" /> {isRtl ? 'رفع ملف' : 'Upload'}
                      </button>

                      <div className="flex gap-1.5">
                        <input
                          type="url"
                          placeholder={isRtl ? 'أو رابط بوستر...' : 'Or poster URL...'}
                          value={posterUrlInput}
                          onChange={e => setPosterUrlInput(e.target.value)}
                          className="flex-1 min-w-0 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 placeholder-slate-400 dark:placeholder-gray-500"
                        />
                        <button
                          type="button"
                          disabled={!posterUrlInput.trim()}
                          onClick={() => {
                            posterMut.mutate(posterUrlInput.trim());
                            setPosterUrlInput('');
                          }}
                          className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-black rounded-lg text-xs font-bold disabled:opacity-30 flex-shrink-0 shadow-sm"
                        >
                          {isRtl ? 'حفظ' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Season Backdrop */}
                <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-black/25 flex flex-col gap-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{isRtl ? 'خلفية الموسم (16:9)' : 'Season Backdrop (16:9)'}</span>
                    {backdropMut.isPending && <Spinner size={12} />}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-24 h-16 rounded-xl bg-slate-200 dark:bg-black/50 border border-slate-300 dark:border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-md relative group">
                      {currentBackdrop ? (
                        <img src={currentBackdrop} alt="Backdrop" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 dark:text-muted">{isRtl ? 'لا يوجد' : 'None'}</span>
                      )}
                      {currentBackdrop && (
                        <button
                          type="button"
                          onClick={() => { if (confirm(isRtl ? 'هل تريد حذف خلفية الموسم نهائياً؟' : 'Delete this season backdrop permanently?')) deleteBackdropMut.mutate(); }}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                          title={isRtl ? 'حذف الخلفية' : 'Delete Backdrop'}
                        >
                          {deleteBackdropMut.isPending ? <Spinner size={14} /> : <Trash2 size={16} className="text-red-400" />}
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <input type="file" ref={backdropFileRef} className="hidden" accept="image/*" onChange={handleBackdropUpload} />
                      <button
                        type="button"
                        onClick={() => backdropFileRef.current?.click()}
                        className="w-full py-1.5 px-3 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition text-slate-800 dark:text-white shadow-sm"
                      >
                        <Upload size={12} className="text-amber-500 dark:text-amber-400" /> {isRtl ? 'رفع ملف' : 'Upload'}
                      </button>

                      <div className="flex gap-1.5">
                        <input
                          type="url"
                          placeholder={isRtl ? 'أو رابط خلفية...' : 'Or backdrop URL...'}
                          value={backdropUrlInput}
                          onChange={e => setBackdropUrlInput(e.target.value)}
                          className="flex-1 min-w-0 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 placeholder-slate-400 dark:placeholder-gray-500"
                        />
                        <button
                          type="button"
                          disabled={!backdropUrlInput.trim()}
                          onClick={() => {
                            backdropMut.mutate(backdropUrlInput.trim());
                            setBackdropUrlInput('');
                          }}
                          className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-black rounded-lg text-xs font-bold disabled:opacity-30 flex-shrink-0 shadow-sm"
                        >
                          {isRtl ? 'حفظ' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Online Search (IMDb / TMDB) */}
          <div className="w-full md:w-[360px] flex flex-col gap-4 border-t md:border-t-0 md:border-e border-slate-200 dark:border-white/10 md:pe-6 pt-6 md:pt-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={15} className="text-amber-500 dark:text-amber-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">{isRtl ? 'البحث وجلب البيانات أونلاين' : 'Online Metadata Search'}</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-muted mb-3">{isRtl ? 'ابحث باسم المسلسل أو الصق معرّف IMDb (مثل tt2290891) أو TMDB' : 'Search by series name or paste IMDb (e.g. tt2290891) / TMDB'}</p>
              
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={isRtl ? 'اسم المسلسل أو كود tt... أو TMDB...' : 'Series name or tt... / TMDB code...'}
                  className="flex-1 min-w-0 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-amber-500 outline-none placeholder-slate-400 dark:placeholder-gray-500"
                />
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-300 dark:border-white/15 rounded-xl flex items-center justify-center transition text-slate-700 dark:text-white disabled:opacity-30 flex-shrink-0 shadow-sm"
                >
                  {isSearching ? <Spinner size={14} /> : <SearchIcon size={14} />}
                </button>
              </form>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[360px] ps-1 custom-scrollbar">
              {searchResults.length === 0 && !isSearching && (
                <div className="text-center text-slate-400 dark:text-muted text-xs py-10">
                  {isRtl ? 'ابحث لجلب البوسترات والميتاداتا مباشرة من IMDb و TMDB' : 'Search to fetch artwork & metadata from IMDb & TMDB'}
                </div>
              )}

              {searchResults.map((res, i) => (
                <div key={res.tmdb_id || res.id || i} className="flex gap-3 p-2.5 border border-slate-200 dark:border-border/80 rounded-xl bg-white dark:bg-black/15 hover:bg-slate-50 dark:hover:bg-black/30 transition relative group shadow-sm">
                  <div className="w-12 h-16 bg-slate-100 dark:bg-surfaceHover rounded-lg flex-shrink-0 overflow-hidden border border-slate-200 dark:border-tx/5">
                    {res.poster ? (
                      <img src={res.poster} alt={res.title || "Poster"} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 dark:text-muted">{isRtl ? 'بلا بوستر' : 'No Poster'}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="font-semibold text-xs text-slate-900 dark:text-text truncate">{res.title}</div>
                    <div className="text-[11px] text-slate-500 dark:text-muted flex items-center gap-1.5 mt-1">
                      {res.year && <span>{res.year}</span>}
                      {res.rating && (
                        <span className="flex items-center gap-0.5 text-amber-500 dark:text-amber-400 font-semibold">
                          <Star size={10} fill="currentColor" /> {res.rating}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                        res.source === 'imdb'
                          ? 'bg-[#f5c518] text-black'
                          : res.source === 'tmdb'
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-700 text-slate-200'
                      }`}>
                        {res.source}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyResult(res)}
                    className="absolute inset-0 bg-black/75 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-xl"
                  >
                    <div className="flex items-center gap-1 bg-white text-black px-3.5 py-1.5 rounded-full text-xs font-bold shadow-lg">
                      <Check size={14} /> {isRtl ? 'تطبيق' : 'Apply'}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-border flex justify-end gap-3 bg-slate-50/80 dark:bg-black/25">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2 rounded-full font-medium hover:bg-slate-200/70 dark:hover:bg-tx/10 transition text-sm text-slate-600 dark:text-muted hover:text-slate-900 dark:hover:text-text disabled:opacity-40"
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => mut.mutate()}
            disabled={isSaving}
            className="px-6 py-2 rounded-full bg-primaryMovies text-white font-bold hover:brightness-110 transition text-sm flex items-center gap-2 shadow-lg shadow-primaryMovies/25 disabled:opacity-40"
          >
            {isSaving && <Spinner size={16} />}
            <Save size={15} />
            <span>{isSaving ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'حفظ التعديلات' : 'Save Changes')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
