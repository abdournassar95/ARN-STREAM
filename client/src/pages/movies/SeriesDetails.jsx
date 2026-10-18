import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchSeries, fetchSeriesList, fetchSimilarSeries, triggerDownload, scanSingleSeries, scanSingleSeason, deleteSeriesApi } from '../../api/client';
import TopBar from '../../components/shared/TopBar';
import Spinner from '../../components/shared/Spinner';
import { MovieCard } from '../../components/shared/Card';
import { Play, Layers, Edit2, Shuffle, ArrowRight, ArrowLeft, Film, Clock, Star, Sparkles, Check, ChevronLeft, ChevronRight, Download, CheckSquare, X, RefreshCw, Trash2, AlertTriangle, Send, Cast } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useDeviceHandoffStore } from '../../store/useDeviceHandoffStore';
import EditMetadataModal from '../../components/shared/EditMetadataModal';
import EditSeasonModal from '../../components/shared/EditSeasonModal';
import { usePlayerStore } from '../../store/usePlayerStore';

export default function SeriesDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const canDownload = useAuthStore(s => s.canDownload);
  const { activeRemoteSession, playMediaOnTarget, openFullRemote } = useDeviceHandoffStore();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [activeBottomTab, setActiveBottomTab] = useState('episodes'); // 'episodes' | 'related'
  const [isEpisodeSelectMode, setIsEpisodeSelectMode] = useState(false);
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState([]);
  const [isScanningSeries, setIsScanningSeries] = useState(false);
  const [isScanningSeason, setIsScanningSeason] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [scanToast, setScanToast] = useState(null);
  const queryClient = useQueryClient();

  // Always scroll to top of series page and reset selections when opening or switching series
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    setSelectedSeasonId(null);
    setSelectedEpisodeIds([]);
    setIsEpisodeSelectMode(false);
  }, [id]);

  const handleDeleteSeries = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteSeriesApi(s.id);
      await queryClient.invalidateQueries({ queryKey: ['series'] });
      await queryClient.invalidateQueries({ queryKey: ['related-series'] });
      await queryClient.invalidateQueries({ queryKey: ['library'] });
      await queryClient.invalidateQueries({ queryKey: ['libraries'] });
      setIsDeleteModalOpen(false);
      if (s.library_id) {
        navigate(`/library/${s.library_id}`);
      } else {
        navigate('/series');
      }
    } catch (err) {
      console.error('Failed to delete series:', err);
      alert(err.response?.data?.error?.message || err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleScanSeries = async () => {
    if (isScanningSeries) return;
    setIsScanningSeries(true);
    try {
      const res = await scanSingleSeries(id);
      const st = res.data?.stats || {};
      queryClient.invalidateQueries(['series', id]);
      setScanToast({
        title: isArabic ? 'تم تحديث المسلسل بنجاح' : 'Series Scanned Successfully',
        desc: isArabic
          ? `إجمالي الحلقات: ${st.total || 0} (جديد: ${st.added || 0}، محذوف: ${st.deleted || 0}، محدث: ${st.updated || 0})`
          : `Total: ${st.total || 0} (Added: ${st.added || 0}, Deleted: ${st.deleted || 0}, Updated: ${st.updated || 0})`,
        type: 'success'
      });
      setTimeout(() => setScanToast(null), 6000);
    } catch (err) {
      setScanToast({
        title: isArabic ? 'فشل فحص وتحديث المسلسل' : 'Scan Failed',
        desc: err?.response?.data?.error?.message || err.message,
        type: 'error'
      });
      setTimeout(() => setScanToast(null), 6000);
    } finally {
      setIsScanningSeries(false);
    }
  };

  const handleScanSeason = async (seasonId) => {
    if (isScanningSeason || !seasonId) return;
    setIsScanningSeason(true);
    try {
      const res = await scanSingleSeason(seasonId);
      const st = res.data?.stats || {};
      queryClient.invalidateQueries(['series', id]);
      setScanToast({
        title: isArabic ? 'تم تحديث الموسم بنجاح' : 'Season Scanned Successfully',
        desc: isArabic
          ? `إجمالي الحلقات: ${st.total || 0} (جديد: ${st.added || 0}، محذوف: ${st.deleted || 0})`
          : `Episodes: ${st.total || 0} (Added: ${st.added || 0}, Deleted: ${st.deleted || 0})`,
        type: 'success'
      });
      setTimeout(() => setScanToast(null), 6000);
    } catch (err) {
      setScanToast({
        title: isArabic ? 'فشل فحص وتحديث الموسم' : 'Scan Failed',
        desc: err?.response?.data?.error?.message || err.message,
        type: 'error'
      });
      setTimeout(() => setScanToast(null), 6000);
    } finally {
      setIsScanningSeason(false);
    }
  };

  const handleToggleEpisode = (epId) => {
    setSelectedEpisodeIds(prev =>
      prev.includes(epId) ? prev.filter(x => x !== epId) : [...prev, epId]
    );
  };

  const handleSelectAllEpisodes = () => {
    const currentEpisodes = activeSeason?.episodes || [];
    const allIds = currentEpisodes.map(e => e.id);
    if (selectedEpisodeIds.length === allIds.length) {
      setSelectedEpisodeIds([]);
    } else {
      setSelectedEpisodeIds(allIds);
    }
  };

  const handleDownloadSelectedEpisodes = () => {
    if (!selectedEpisodeIds.length) return;
    const sName = s?.title || (isArabic ? 'مسلسل' : 'Series');
    const seasonNum = activeSeason?.season_number ? `_${isArabic ? 'الموسم' : 'Season'}_${activeSeason.season_number}` : '';
    const customTitle = `${sName}${seasonNum}_${isArabic ? 'حلقات_مختارة' : 'selected_episodes'}`;
    triggerDownload('/api/download/batch', {
      type: 'episodes',
      ids: selectedEpisodeIds.join(','),
      title: customTitle
    });
    setIsEpisodeSelectMode(false);
    setSelectedEpisodeIds([]);
  };

  const handlePlaySelectedEpisodes = (shuffle = false) => {
    if (!selectedEpisodeIds.length || !activeSeason?.episodes) return;
    const selectedEpisodes = activeSeason.episodes.filter(ep => selectedEpisodeIds.includes(ep.id));
    if (!selectedEpisodes.length) return;

    const epPoster = activeSeason.posters?.[0]?.thumb || activeSeason.posters?.[0]?.url || poster;
    let list = selectedEpisodes.map(ep => ({
      id: ep.id,
      title: ep.title || (isArabic ? `الحلقة ${ep.episode_number}` : `Episode ${ep.episode_number}`),
      episode_number: ep.episode_number,
      season_number: activeSeason.season_number,
      season_id: activeSeason.id,
      series_id: id,
      series_title: s?.title,
      type: 'episode',
      media_type: 'episode',
      poster: epPoster || null,
      duration: ep.duration || null,
    }));

    if (shuffle) {
      list.sort(() => Math.random() - 0.5);
    }

    setVideoQueue(list, 0);
    setIsEpisodeSelectMode(false);
    setSelectedEpisodeIds([]);
    navigate(`/watch/episode/${list[0].id}`);
  };

  const handleDownloadSingleEpisode = (e, epId) => {
    e.stopPropagation();
    triggerDownload(`/api/download/episode/${epId}`);
  };

  const handleDownloadSeason = (seasonId) => {
    triggerDownload(`/api/download/season/${seasonId}`);
  };

  const handleDownloadSeries = () => {
    triggerDownload(`/api/download/series/${id}`);
  };

  const { setVideoQueue, currentTrack } = usePlayerStore();
  const { data: s, isLoading } = useQuery({ queryKey: ['series', id], queryFn: () => fetchSeries(id) });

  // Related series for "أعمال أخرى قد تعجبك" (Smart Recommendations based on tags/genres)
  const { data: relatedData } = useQuery({
    queryKey: ['related-series', id],
    queryFn: () => fetchSimilarSeries(id),
    enabled: !!id
  });

  const relatedSeries = (Array.isArray(relatedData) ? relatedData : relatedData?.data || [])
    .filter(item => String(item.id) !== String(id));

  useEffect(() => {
    if (s?.seasons?.length > 0 && !selectedSeasonId) {
      setSelectedSeasonId(s.seasons[0].id);
    }
  }, [s, selectedSeasonId]);

  const activeSeason = s?.seasons?.find(ss => ss.id === selectedSeasonId) || s?.seasons?.[0];
  const poster = s?.posters?.[0]?.url;
  const seriesBackdrop = s?.backdrops?.[0]?.url;
  const currentBackdrop = activeSeason?.backdrops?.[0]?.url || seriesBackdrop || poster;
  const totalEpisodes = s?.seasons?.reduce((acc, ss) => acc + (ss.episodes?.length || 0), 0) || 0;
  const firstEpisode = activeSeason?.episodes?.[0];
  const hasMultipleSeasons = (s?.seasons?.length || 0) > 1;
  const isDocumentary = s?.library_name?.includes('وثائق') || s?.library_name?.includes('برامج') || s?.library_name?.toLowerCase().includes('doc');

  const handlePlaySeason = (season, shuffle = false) => {
    if (!season?.episodes || season.episodes.length === 0) return;
    const epPoster = season.posters?.[0]?.thumb || season.posters?.[0]?.url || poster;
    let queue = season.episodes.map(ep => ({
      id: ep.id,
      title: ep.title || (isArabic ? `الحلقة ${ep.episode_number}` : `Episode ${ep.episode_number}`),
      episode_number: ep.episode_number,
      season_number: season.season_number,
      season_id: season.id,
      series_id: id,
      series_title: s?.title,
      type: 'episode',
      media_type: 'episode',
      poster: epPoster || null,
      duration: ep.duration || null,
    }));
    if (shuffle) {
      queue.sort(() => Math.random() - 0.5);
    }
    setVideoQueue(queue, 0);
    navigate(`/watch/episode/${queue[0].id}`);
  };

  // Last watched episode & watched episodes tracker from localStorage and playback state
  const [lastWatchedEp, setLastWatchedEp] = useState(null);
  const [watchedEpisodeIds, setWatchedEpisodeIds] = useState([]);

  useEffect(() => {
    if (!s) return;

    // 1. Read watched list from localStorage
    let storedWatchedIds = [];
    try {
      storedWatchedIds = JSON.parse(localStorage.getItem('arn_watched_episodes') || '[]');
    } catch {}

    const allWatched = new Set(storedWatchedIds.map(Number));
    let bestPlaybackEp = null;
    let bestPlaybackSeason = null;
    let latestTimestamp = 0;

    s.seasons?.forEach(season => {
      season.episodes?.forEach(ep => {
        if (ep.playback) {
          const pos = ep.playback.position || 0;
          const dur = ep.playback.duration || 1;
          if (pos > 30 || (dur > 0 && pos / dur >= 0.8)) {
            allWatched.add(Number(ep.id));
          }
          const upTime = ep.playback.updated_at ? new Date(ep.playback.updated_at).getTime() : 0;
          if (upTime > latestTimestamp || (!bestPlaybackEp && pos > 5)) {
            latestTimestamp = upTime;
            bestPlaybackEp = ep;
            bestPlaybackSeason = season;
          }
        }
      });
    });

    setWatchedEpisodeIds(Array.from(allWatched));

    // 2. Read last watched episode for this series from localStorage
    let storedLast = null;
    try {
      const raw = localStorage.getItem(`arn_last_watched_series_${id}`);
      if (raw) storedLast = JSON.parse(raw);
    } catch {}

    if (storedLast?.episodeId) {
      setLastWatchedEp(storedLast);
    } else if (bestPlaybackEp && bestPlaybackSeason) {
      const autoLast = {
        seriesId: id,
        seasonId: bestPlaybackSeason.id,
        seasonNumber: bestPlaybackSeason.season_number,
        episodeId: bestPlaybackEp.id,
        episodeNumber: bestPlaybackEp.episode_number,
        title: bestPlaybackEp.title,
        poster: bestPlaybackSeason.posters?.[0]?.thumb || bestPlaybackSeason.posters?.[0]?.url || s.posters?.[0]?.url,
        timestamp: latestTimestamp || Date.now()
      };
      setLastWatchedEp(autoLast);
      try {
        localStorage.setItem(`arn_last_watched_series_${id}`, JSON.stringify(autoLast));
      } catch {}
    } else {
      setLastWatchedEp(null);
    }
  }, [s, id]);

  const handlePlayEpisode = (episode, season) => {
    if (!season?.episodes) return;
    const epPoster = season.posters?.[0]?.thumb || season.posters?.[0]?.url || poster;
    const epIndex = season.episodes.findIndex(e => e.id === episode.id);
    const queue = season.episodes.map(ep => ({
      id: ep.id,
      title: ep.title || (isArabic ? `الحلقة ${ep.episode_number}` : `Episode ${ep.episode_number}`),
      episode_number: ep.episode_number,
      season_number: season.season_number,
      season_id: season.id,
      series_id: id,
      series_title: s?.title,
      type: 'episode',
      media_type: 'episode',
      poster: epPoster || null,
      duration: ep.duration || null,
    }));
    setVideoQueue(queue, epIndex >= 0 ? epIndex : 0);

    // Save last watched episode to localStorage immediately
    try {
      const lastWatched = {
        seriesId: id,
        seasonId: season.id,
        seasonNumber: season.season_number,
        episodeId: episode.id,
        episodeNumber: episode.episode_number,
        title: episode.title,
        poster: epPoster,
        timestamp: Date.now()
      };
      localStorage.setItem(`arn_last_watched_series_${id}`, JSON.stringify(lastWatched));
      localStorage.setItem('arn_last_watched_recent', JSON.stringify(lastWatched));
      setLastWatchedEp(lastWatched);
    } catch {}

    if (activeRemoteSession) {
      playMediaOnTarget({
        type: 'episode',
        id: episode.id,
        title: `${s?.title || ''}: ${episode.title || (isArabic ? `حلقة ${episode.episode_number}` : `Episode ${episode.episode_number}`)}`,
        poster: epPoster,
        currentTime: 0,
        duration: episode.duration || 0
      });
      openFullRemote();
      return;
    }

    navigate(`/watch/episode/${episode.id}`);
  };

  // Determine target episode for Resume / Start Watching
  let targetEpisode = null;
  let targetSeason = null;
  let isResume = false;

  if (lastWatchedEp?.episodeId && s?.seasons) {
    for (const sn of s.seasons) {
      const foundEp = sn.episodes?.find(e => String(e.id) === String(lastWatchedEp.episodeId));
      if (foundEp) {
        targetEpisode = foundEp;
        targetSeason = sn;
        isResume = true;
        break;
      }
    }
    // Fallback match by episode_number if ID moved
    if (!targetEpisode && lastWatchedEp.episodeNumber) {
      for (const sn of s.seasons) {
        const foundEp = sn.episodes?.find(e => Number(e.episode_number) === Number(lastWatchedEp.episodeNumber));
        if (foundEp) {
          targetEpisode = foundEp;
          targetSeason = sn;
          isResume = true;
          break;
        }
      }
    }
  }

  // If no episode has been watched yet, fallback to Episode 1 of Season 1
  if (!targetEpisode && s?.seasons?.length > 0) {
    const season1 = s.seasons[0];
    const ep1 = season1.episodes?.[0];
    if (ep1) {
      targetEpisode = ep1;
      targetSeason = season1;
      isResume = false;
    }
  }

  const targetEpNum = targetEpisode?.episode_number || 1;
  const targetThumb = targetSeason?.posters?.[0]?.thumb 
    || targetSeason?.posters?.[0]?.url 
    || lastWatchedEp?.poster 
    || poster;

  const handleResumeOrStart = () => {
    if (!targetEpisode || !targetSeason) return;
    if (selectedSeasonId !== targetSeason.id) {
      setSelectedSeasonId(targetSeason.id);
    }
    handlePlayEpisode(targetEpisode, targetSeason);
  };

  if (isLoading) return (
    <div className="min-h-screen bg-bg">
      <TopBar variant="movies"/>
      <div className="flex justify-center pt-24"><Spinner/></div>
    </div>
  );
  if (!s) return <div className="p-10 text-center text-muted">{t('errors.notFound', 'Series not found')}</div>;

  return (
    <div className="min-h-screen bg-bg text-text relative pb-24 selection:bg-amber-500/30 selection:text-amber-200">
      <TopBar variant="movies" />

      {/* Ambient background with delicate cinematic watermark and dark gradients */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {currentBackdrop && (
          <img
            src={currentBackdrop}
            alt=""
            className="w-full h-full object-cover opacity-20 scale-105 filter blur-sm transition-all duration-500"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/90 to-bg/50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.05)_0%,_transparent_60%)]" />
      </div>

      <main className="relative z-10 max-w-[1700px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-6 space-y-8">
        
        {/* ============================================================ */}
        {/* UPPER SECTION: Wide Landscape Hero + 2-Column Seasons Grid */}
        {/* ============================================================ */}
        <div className="flex flex-col-reverse lg:flex-row gap-6 items-stretch justify-between">
          
          {/* 1. Large Wide Landscape Hero Showcase Banner */}
          <div className="flex-1 min-w-0 h-[380px] sm:h-[440px] lg:h-[480px] xl:h-[500px] rounded-3xl overflow-hidden border-2 border-amber-400/40 shadow-xl dark:shadow-[0_20px_60px_rgba(0,0,0,0.85)] relative group bg-white dark:bg-[#0a0e17] flex flex-col justify-end transition-all duration-200">
            
            {/* Background Backdrop Image */}
            <div className="absolute inset-0 overflow-hidden">
              {currentBackdrop ? (
                <img
                  src={currentBackdrop}
                  alt={s.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-black flex items-center justify-center text-muted">
                  <Film size={64} className="opacity-30" />
                </div>
              )}
            </div>

            {/* Atmospheric gradients: Clean white-frosted glass in Light mode, deep cinematic vignette in Dark mode */}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/85 to-transparent dark:from-[#0a0e17] dark:via-[#0a0e17]/65 dark:to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/30 to-transparent dark:from-[#0a0e17]/80 dark:via-transparent dark:to-transparent pointer-events-none rtl:bg-gradient-to-l" />

            {/* Bottom Overlay Content */}
            <div className="relative z-10 p-5 sm:p-7 md:p-8 flex flex-col justify-end">
              
              {/* Season Badge & Metadata */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="px-3 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/85 dark:text-red-200 dark:border-red-600/40 shadow-sm backdrop-blur-md">
                  {isArabic 
                    ? `الموسم ${activeSeason?.season_number || 1}` 
                    : `Season ${activeSeason?.season_number || 1}`}
                </span>

                {(activeSeason?.year || s.year) && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/90 text-slate-700 border border-slate-200/90 dark:bg-black/60 dark:text-gray-300 dark:border-white/10 backdrop-blur-md shadow-sm">
                    {activeSeason?.year || s.year}
                  </span>
                )}

                {s.rating && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-400/30 backdrop-blur-md shadow-sm">
                    <Star size={11} fill="currentColor" />
                    <span>{s.rating}</span>
                  </span>
                )}

                {activeSeason?.episodes?.length > 0 && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/90 text-slate-700 border border-slate-200/90 dark:bg-black/60 dark:text-gray-300 dark:border-white/10 backdrop-blur-md shadow-sm">
                    {activeSeason.episodes.length} {isArabic ? 'حلقة' : 'episodes'}
                  </span>
                )}
              </div>

              {/* Series Title */}
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white drop-shadow-sm dark:drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] mb-2 tracking-tight">
                {s.title}
                {activeSeason?.title && activeSeason.title !== s.title && (
                  <span className="text-lg sm:text-2xl md:text-3xl text-amber-600 dark:text-amber-300 font-bold block sm:inline sm:ms-3 mt-1 sm:mt-0 drop-shadow-sm">
                    - {activeSeason.title}
                  </span>
                )}
              </h1>

              {/* Tags / Genres */}
              {s.tags?.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {s.tags.map(tag => (
                    <span
                      key={tag.id}
                      className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-400/30 shadow-sm"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Story / Plot */}
              <p className="text-xs sm:text-sm md:text-base text-slate-700 dark:text-gray-200/90 line-clamp-2 sm:line-clamp-3 max-w-3xl mb-5 leading-relaxed font-normal">
                {activeSeason?.plot || s.plot || (isArabic ? 'لا يوجد ملخص متاح لهذا العمل.' : 'No description available for this series.')}
              </p>

              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/80 dark:border-white/15">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Play on Remote Target Device */}
                  {activeRemoteSession && targetEpisode && (
                    <button
                      onClick={() => handlePlayEpisode(targetEpisode, targetSeason)}
                      className="group flex items-center gap-2.5 px-5 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-bold text-xs sm:text-sm shadow-xl shadow-red-900/40 border border-white/20 transition-all duration-300 transform-gpu hover:scale-105 active:scale-95 animate-pulse"
                      title={isArabic ? `تشغيل على ${activeRemoteSession.targetDeviceName}` : `Play on ${activeRemoteSession.targetDeviceName}`}
                    >
                      <Send size={14} className="flex-shrink-0" />
                      <span className="tracking-wide">
                        {isArabic ? `تشغيل على ${activeRemoteSession.targetDeviceName}` : `Play on ${activeRemoteSession.targetDeviceName}`}
                      </span>
                    </button>
                  )}

                  {/* Smart Action: Resume Watching / Start Watching with Episode Number & Thumbnail */}
                  {targetEpisode && (
                    <button
                      onClick={handleResumeOrStart}
                      className="group flex items-center gap-2.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-primaryMovies via-red-600 to-primaryMovies hover:brightness-110 text-white font-bold text-xs sm:text-sm shadow-xl shadow-primaryMovies/30 border border-white/20 transition-all duration-300 transform-gpu hover:scale-105 active:scale-95"
                      title={isResume 
                        ? (isArabic ? `استئناف المشاهدة من الحلقة ${targetEpNum}` : `Resume watching from Ep ${targetEpNum}`)
                        : (isArabic ? 'بدء المشاهدة من الحلقة الأولى' : 'Start watching from Episode 1')
                      }
                    >
                      {/* Episode Thumbnail */}
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden border border-white/50 shadow-inner flex-shrink-0 bg-black/40">
                        {targetThumb ? (
                          <img src={targetThumb} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/80">
                            <Play size={10} fill="white" />
                          </div>
                        )}
                      </div>

                      <Play size={14} fill="white" className="flex-shrink-0" />

                      <span className="tracking-wide">
                        {isResume
                          ? (isArabic ? `استئناف — حلقة ${targetEpNum}` : `Resume — Ep ${targetEpNum}`)
                          : (isArabic ? `ابدأ المشاهدة — حلقة ${targetEpNum}` : `Start Watching — Ep ${targetEpNum}`)}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => handlePlaySeason(activeSeason, true)}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 dark:bg-black/50 dark:hover:bg-white/15 dark:text-white dark:border-white/20 text-xs font-semibold backdrop-blur-md transition active:scale-95 shadow-sm"
                    title={isArabic ? 'تشغيل عشوائي' : 'Shuffle'}
                  >
                    <Shuffle size={14} />
                    <span className="hidden sm:inline">{isArabic ? 'عشوائي' : 'Shuffle'}</span>
                  </button>

                  {/* Download Entire Series */}
                  {canDownload() && (
                    <button
                      onClick={handleDownloadSeries}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-400/60 shadow-md shadow-amber-500/20 dark:bg-amber-500/30 dark:hover:bg-amber-500/40 dark:text-amber-200 dark:border-amber-400/50 text-xs backdrop-blur-md transition active:scale-95 group"
                      title={isArabic ? 'تنزيل المسلسل بالكامل بكافة مواسمه وحلقاته (ZIP)' : 'Download full series (ZIP)'}
                    >
                      <Download size={14} className="group-hover:translate-y-0.5 transition-transform" />
                      <span>{isArabic ? 'تحميل المسلسل بالكامل' : 'Download Series'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {useAuthStore.getState().isAdmin() && (
                    <>
                      <button
                        onClick={() => {
                          setEditingSeason(activeSeason);
                          setIsSeasonModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 dark:bg-black/60 dark:hover:bg-white/20 dark:text-white text-xs font-semibold dark:border-white/20 backdrop-blur-md transition shadow-sm"
                        title={isArabic ? 'تعديل هذا الموسم' : 'Edit Season'}
                      >
                        <Edit2 size={13} />
                        <span className="hidden sm:inline">{isArabic ? 'تعديل الموسم' : 'Edit Season'}</span>
                      </button>

                      <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 dark:bg-black/60 dark:hover:bg-white/20 dark:text-white text-xs font-semibold dark:border-white/20 backdrop-blur-md transition shadow-sm"
                        title={isArabic ? 'تعديل بيانات وصور المسلسل' : 'Edit Series'}
                      >
                        <Edit2 size={13} />
                        <span>{isArabic ? 'تعديل المسلسل' : 'Edit Series'}</span>
                      </button>

                      {/* Targeted Series Scan Button */}
                      <button
                        onClick={handleScanSeries}
                        disabled={isScanningSeries}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-400/40 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-xs font-semibold backdrop-blur-md transition shadow-sm disabled:opacity-50 active:scale-95"
                        title={isArabic ? 'فحص وتحديث ملفات المسلسل بالكامل (رصد الإضافات والحذف)' : 'Scan & Refresh full series files'}
                      >
                        <RefreshCw size={13} className={isScanningSeries ? 'animate-spin text-amber-500' : ''} />
                        <span>{isScanningSeries ? (isArabic ? 'جاري الفحص...' : 'Scanning...') : (isArabic ? (isDocumentary ? 'فحص وتحديث العمل' : 'فحص وتحديث المسلسل') : 'Scan Series')}</span>
                      </button>

                      {/* Delete Series from Server Button */}
                      <button
                        onClick={() => setIsDeleteModalOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/25 dark:border-rose-500/40 text-xs font-semibold backdrop-blur-md transition shadow-sm active:scale-95"
                        title={isArabic ? 'حذف المسلسل من الخادم وقاعدة البيانات' : 'Delete series from server'}
                      >
                        <Trash2 size={13} />
                        <span>{isArabic ? 'حذف من الخادم' : 'Delete'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Side Panel: Seasons Showcase / Multi-Season Selector */}
          <div className="w-full lg:w-[320px] xl:w-[360px] flex-shrink-0 flex flex-col bg-white/80 dark:bg-surface/50 backdrop-blur-md border border-slate-200/90 dark:border-white/10 rounded-3xl p-3.5 sm:p-4 shadow-lg justify-between">
            
            {/* CTA Header Banner Button */}
            <div className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm text-center shadow-md shadow-amber-500/20 border border-amber-300/40 select-none tracking-wide mb-3 flex items-center justify-center gap-2">
              <Sparkles size={16} className="text-black" />
              <span>
                {(s.seasons?.length || 0) > 1 
                  ? (isArabic ? `اختر موسمك المفضل (${s.seasons.length} مواسم)` : `Choose Your Season (${s.seasons.length})`)
                  : (isArabic ? 'بوستر العمل / الموسم' : 'Season Artwork')}
              </span>
            </div>

            {/* Single Season Feature Showcase (No empty void!) */}
            {(s.seasons?.length || 0) <= 1 ? (
              (() => {
                const singleSeason = s.seasons?.[0] || { season_number: 1, title: s.title };
                const seasonPoster = singleSeason.posters?.[0]?.thumb || singleSeason.posters?.[0]?.url || poster;
                const seasonTitle = singleSeason.title || (isArabic ? `الموسم ${singleSeason.season_number}` : `Season ${singleSeason.season_number}`);

                return (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 py-1">
                    <div className="relative w-full max-w-[240px] aspect-[2/3] rounded-2xl overflow-hidden shadow-xl border-2 border-amber-500/50 bg-slate-100 dark:bg-surface group transition-transform duration-500 hover:scale-[1.02]">
                      {seasonPoster ? (
                        <img
                          src={seasonPoster}
                          alt={seasonTitle}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-black/50 text-muted">
                          <Film size={40} className="opacity-30 mb-2" />
                          <span className="text-sm font-bold">{seasonTitle}</span>
                        </div>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-2.5 end-2.5 px-2.5 py-0.5 rounded-lg bg-red-600 text-white text-[11px] font-bold shadow-md">
                        {isArabic ? `موسم ${singleSeason.season_number}` : `S${singleSeason.season_number}`}
                      </div>

                      <div className="absolute top-2.5 start-2.5 w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-lg font-bold">
                        <Check size={13} strokeWidth={3} />
                      </div>

                      {/* Bottom Gradient with Title */}
                      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/75 to-transparent">
                        <div className="font-bold text-sm text-white truncate drop-shadow">
                          {seasonTitle}
                        </div>
                        <div className="text-xs text-gray-300 font-medium mt-0.5">
                          {singleSeason.episodes?.length || 0} {isArabic ? 'حلقة كاملة' : 'episodes'}
                        </div>
                      </div>

                      {/* Admin Quick Season Edit & Scan Buttons */}
                      {useAuthStore.getState().isAdmin() && (
                        <div className="absolute bottom-3 start-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => {
                              setEditingSeason(singleSeason);
                              setIsSeasonModalOpen(true);
                            }}
                            className="w-7 h-7 rounded-full bg-black/75 hover:bg-amber-500 text-white hover:text-black flex items-center justify-center transition shadow-lg border border-white/20"
                            title={isArabic ? 'تعديل هذا الموسم' : 'Edit Season'}
                          >
                            <Edit2 size={12} />
                          </button>

                          <button
                            onClick={() => handleScanSeason(singleSeason.id)}
                            disabled={isScanningSeason}
                            className="w-7 h-7 rounded-full bg-black/75 hover:bg-amber-500 text-white hover:text-black flex items-center justify-center transition shadow-lg border border-white/20 disabled:opacity-50"
                            title={isArabic ? 'فحص وتحديث ملفات هذا الموسم' : 'Scan Season'}
                          >
                            <RefreshCw size={12} className={isScanningSeason ? 'animate-spin' : ''} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Meta info badge at bottom */}
                    <div className="w-full max-w-[240px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-black/30 border border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs text-slate-700 dark:text-gray-300">
                      <span className="font-semibold">{isArabic ? 'إجمالي الحلقات:' : 'Episodes:'}</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">{singleSeason.episodes?.length || 0} {isArabic ? 'حلقة' : 'eps'}</span>
                    </div>
                  </div>
                );
              })()
            ) : (
              /* 2-Column Grid of Season Posters for Multi-Season Series */
              <div className="grid grid-cols-2 gap-3 max-h-[400px] lg:max-h-[430px] overflow-y-auto custom-scrollbar p-1">
                {s.seasons?.map(season => {
                  const isActive = selectedSeasonId === season.id;
                  const seasonPoster = season.posters?.[0]?.thumb || season.posters?.[0]?.url || poster;
                  const seasonTitle = season.title || (isArabic ? `الجزء ${season.season_number}` : `Season ${season.season_number}`);

                  return (
                    <div
                      key={season.id}
                      onClick={() => setSelectedSeasonId(season.id)}
                      className={`group relative rounded-2xl overflow-hidden cursor-pointer text-start transition-all duration-300 ease-out transform-gpu hover:-translate-y-1 hover:scale-[1.02] shadow-sm bg-white dark:bg-surface ${
                        isActive
                          ? 'ring-2 ring-amber-500 border-2 border-amber-500 shadow-lg shadow-amber-500/25'
                          : 'border border-slate-200 dark:border-white/10 hover:border-amber-400/60 hover:shadow-md'
                      }`}
                    >
                      {/* Season Poster Container */}
                      <div className="aspect-[2/3] w-full bg-surfaceHover relative overflow-hidden">
                        {seasonPoster ? (
                          <img
                            src={seasonPoster}
                            alt={seasonTitle}
                            className="w-full h-full object-cover group-hover:scale-105 group-hover:brightness-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-black/50 text-muted">
                            <span className="text-2xl font-black text-white/40">S{season.season_number}</span>
                          </div>
                        )}

                        {/* Top Red Badge */}
                        <div className="absolute top-2 end-2 px-2 py-0.5 rounded-md bg-red-700/90 text-white text-[10px] font-bold shadow-md">
                          {isArabic ? `موسم ${season.season_number}` : `S${season.season_number}`}
                        </div>

                        {/* Active Indicator Checkmark Badge */}
                        {isActive && (
                          <div className="absolute top-2 start-2 w-5 h-5 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-lg font-bold">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}

                        {/* Bottom Gradient for Title Readability */}
                        <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black via-black/70 to-transparent">
                          <div className="font-bold text-xs text-white truncate drop-shadow">
                            {seasonTitle}
                          </div>
                          <div className="text-[10px] text-gray-300 font-medium mt-0.5">
                            {season.episodes?.length || 0} {isArabic ? 'حلقة' : 'episodes'}
                          </div>
                        </div>

                        {/* Admin Quick Season Edit & Scan Buttons */}
                        {useAuthStore.getState().isAdmin() && (
                          <div className="absolute bottom-2 start-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSeason(season);
                                setIsSeasonModalOpen(true);
                              }}
                              className="w-6 h-6 rounded-full bg-black/70 hover:bg-amber-500 text-white hover:text-black flex items-center justify-center transition shadow-lg border border-white/10"
                              title={isArabic ? 'تعديل الموسم' : 'Edit Season'}
                            >
                              <Edit2 size={11} />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleScanSeason(season.id);
                              }}
                              disabled={isScanningSeason}
                              className="w-6 h-6 rounded-full bg-black/70 hover:bg-amber-500 text-white hover:text-black flex items-center justify-center transition shadow-lg border border-white/10 disabled:opacity-50"
                              title={isArabic ? 'فحص وتحديث هذا الموسم' : 'Scan Season'}
                            >
                              <RefreshCw size={11} className={isScanningSeason ? 'animate-spin' : ''} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* LOWER SECTION: Episodes Shelf & More Like This Tabs */}
        {/* ============================================================ */}
        <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-white/10">
          
          {/* Section Navigation Tabs Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-surface/90 border border-slate-200 dark:border-white/10 shadow-sm">
              <button
                onClick={() => setActiveBottomTab('episodes')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                  activeBottomTab === 'episodes'
                    ? 'bg-primaryMovies text-white shadow-md'
                    : 'text-muted hover:text-text'
                }`}
              >
                <Film size={16} />
                <span>
                  {isArabic 
                    ? `حلقات ${activeSeason?.title || `الموسم ${activeSeason?.season_number || 1}`}`
                    : `Episodes (${activeSeason?.episodes?.length || 0})`}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 text-text dark:text-white/90">
                  {activeSeason?.episodes?.length || 0}
                </span>
              </button>

              {relatedSeries.length > 0 && (
                <button
                  onClick={() => setActiveBottomTab('related')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                    activeBottomTab === 'related'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  <Sparkles size={16} />
                  <span>{isArabic ? 'أعمال أخرى قد تعجبك' : 'More Like This'}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 text-text dark:text-white/90">
                    {relatedSeries.length}
                  </span>
                </button>
              )}
            </div>

            {activeBottomTab === 'episodes' && activeSeason?.episodes?.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Resume / Start Quick Button in Episodes Bar */}
                {targetEpisode && (
                  <button
                    onClick={handleResumeOrStart}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-primaryMovies to-red-600 hover:brightness-110 text-white text-xs font-bold shadow-md shadow-primaryMovies/30 transition transform-gpu hover:scale-105 active:scale-95"
                  >
                    <div className="w-4 h-4 rounded-full overflow-hidden border border-white/40 flex-shrink-0 bg-black/30">
                      {targetThumb ? (
                        <img src={targetThumb} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Play size={8} fill="white" className="m-auto" />
                      )}
                    </div>
                    <Play size={12} fill="white" />
                    <span>
                      {isResume
                        ? (isArabic ? `استئناف — ${isDocumentary ? `فيديو #${targetEpNum}` : `حلقة ${targetEpNum}`}` : `Resume — Ep ${targetEpNum}`)
                        : (isArabic ? `ابدأ المشاهدة — ${isDocumentary ? `فيديو #${targetEpNum}` : `حلقة ${targetEpNum}`}` : `Start Watching — Ep ${targetEpNum}`)}
                    </span>
                  </button>
                )}

                <button
                  onClick={() => handlePlaySeason(activeSeason, false)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-white/10 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition border border-slate-200 dark:border-white/10 shadow-sm"
                >
                  <Play size={13} fill="currentColor" />
                  <span>{isArabic ? 'تشغيل الموسم' : 'Play Season'}</span>
                </button>

                {/* Scan & Refresh Season Button (Admin) */}
                {useAuthStore.getState().isAdmin() && (
                  <button
                    onClick={() => handleScanSeason(activeSeason?.id)}
                    disabled={isScanningSeason}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-white/10 text-xs font-bold text-text dark:text-white/90 hover:text-amber-600 dark:hover:text-amber-400 transition border border-slate-200 dark:border-white/10 shadow-sm disabled:opacity-50 group"
                    title={isArabic ? 'فحص وتحديث حلقات هذا الموسم فقط' : 'Scan & refresh this season'}
                  >
                    <RefreshCw size={12} className={isScanningSeason ? 'animate-spin text-amber-500' : 'text-amber-600 dark:text-amber-400 group-hover:rotate-180 transition-transform duration-500'} />
                    <span>{isScanningSeason ? (isArabic ? 'جاري الفحص...' : 'Scanning...') : (isArabic ? 'تحديث الموسم' : 'Refresh Season')}</span>
                  </button>
                )}

                {/* Download Season ZIP */}
                {canDownload() && (
                  <button
                    onClick={() => handleDownloadSeason(activeSeason.id)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-white/10 text-xs font-bold text-text dark:text-white/90 hover:text-amber-600 dark:hover:text-white transition border border-slate-200 dark:border-white/10 shadow-sm group"
                    title={isArabic ? 'تحميل جميع حلقات هذا الموسم كملف مضغوط (ZIP)' : 'Download all episodes of this season (ZIP)'}
                  >
                    <Download size={13} className="text-amber-600 dark:text-amber-400 group-hover:translate-y-0.5 transition-transform" />
                    <span>{isArabic ? 'تحميل الموسم (ZIP)' : 'Download Season'}</span>
                  </button>
                )}

                {/* Toggle Select Mode */}
                {canDownload() && (
                  <button
                    onClick={() => {
                      setIsEpisodeSelectMode(!isEpisodeSelectMode);
                      setSelectedEpisodeIds([]);
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition border shadow-sm ${
                      isEpisodeSelectMode
                        ? 'bg-amber-500 text-black border-amber-400 font-bold shadow-md shadow-amber-500/20'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-white/10 text-text dark:text-white/90 hover:text-amber-600 dark:hover:text-white border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <CheckSquare size={13} className={isEpisodeSelectMode ? 'text-black' : 'text-text dark:text-white/90'} />
                    <span>{isEpisodeSelectMode ? (isArabic ? 'إلغاء التحديد' : 'Done') : (isArabic ? 'تحديد حلقات' : 'Select Episodes')}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* TAB 1: Episodes Grid for the Selected Season */}
          {activeBottomTab === 'episodes' && (
            <div>
              {activeSeason?.episodes?.length === 0 ? (
                <div className="py-16 text-center text-muted bg-surface/40 rounded-3xl border border-dashed border-white/10">
                  <Film size={32} className="mx-auto opacity-40 mb-2" />
                  <p>{isArabic ? 'لا توجد حلقات مسجلة لهذا الموسم بعد.' : 'No episodes available for this season yet.'}</p>
                </div>
              ) : (
                <div className="episodes-grid-10">
                  {activeSeason?.episodes?.map(ep => {
                    const epThumb = activeSeason.posters?.[0]?.thumb || activeSeason.posters?.[0]?.url || poster;
                    const epTitle = ep.title || (isArabic ? `الحلقة ${ep.episode_number}` : `Episode ${ep.episode_number}`);
                    const isSelected = selectedEpisodeIds.includes(ep.id);
                    const isWatched = watchedEpisodeIds.includes(Number(ep.id));

                    return (
                      <div
                        key={ep.id}
                        onClick={() => {
                          if (isEpisodeSelectMode) {
                            handleToggleEpisode(ep.id);
                          } else {
                            handlePlayEpisode(ep, activeSeason);
                          }
                        }}
                        className={`group relative rounded-xl overflow-hidden bg-white dark:bg-surface border transition-all duration-300 ease-out transform-gpu hover:-translate-y-1.5 hover:scale-[1.02] cursor-pointer text-start ${
                          isSelected
                            ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-xl shadow-amber-500/20 bg-amber-500/5'
                            : isWatched
                            ? 'border-emerald-500/50 dark:border-emerald-500/40 shadow-sm shadow-emerald-500/10 hover:border-emerald-400'
                            : 'border-slate-200 dark:border-white/10 hover:border-amber-400/60 shadow-sm hover:shadow-lg dark:hover:shadow-black/70'
                        }`}
                      >
                        {/* Episode Card Thumbnail with Aspect Ratio 2:3 */}
                        <div className="aspect-[2/3] w-full bg-surfaceHover relative overflow-hidden">
                          {epThumb ? (
                            <img
                              src={epThumb}
                              alt={epTitle}
                              className="w-full h-full object-cover group-hover:scale-105 group-hover:brightness-105 transition-transform duration-500"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-black/40 text-muted">
                              <Play size={20} className="text-amber-400/60 mb-1" />
                              <span className="text-xs font-mono font-bold">E{String(ep.episode_number).padStart(2, '0')}</span>
                            </div>
                          )}

                          {/* Subtle Watched Dimmed Overlay (Keeps poster art visible) */}
                          {isWatched && (
                            <div className="absolute inset-0 bg-black/20 pointer-events-none transition-opacity group-hover:bg-black/5" />
                          )}

                          {/* Checkbox badge in Selection Mode */}
                          {isEpisodeSelectMode ? (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleEpisode(ep.id);
                              }}
                              className="absolute top-2 rtl:left-2 ltr:right-2 z-20 w-5 h-5 rounded-md bg-black/80 border border-white/20 flex items-center justify-center transition shadow backdrop-blur-md"
                            >
                              {isSelected ? (
                                <div className="w-full h-full bg-amber-400 rounded-md flex items-center justify-center text-black">
                                  <Check size={12} className="stroke-[3]" />
                                </div>
                              ) : (
                                <div className="w-3 h-3 rounded border border-white/40" />
                              )}
                            </div>
                          ) : canDownload() ? (
                            /* 1-Click Single Episode Download button */
                            <button
                              onClick={(e) => handleDownloadSingleEpisode(e, ep.id)}
                              className="absolute top-2 rtl:left-2 ltr:right-2 z-20 w-6 h-6 rounded-full bg-black/75 hover:bg-amber-500 hover:text-black text-white/90 border border-white/20 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-lg active:scale-90 backdrop-blur-md"
                              title={isArabic ? 'تنزيل هذه الحلقة' : 'Download this episode'}
                            >
                              <Download size={11} />
                            </button>
                          ) : null}

                          {/* Badges Container: Episode Number + Watched Checkmark */}
                          <div className="absolute top-2 rtl:right-2 ltr:left-2 flex items-center gap-1 z-10 flex-wrap">
                            {/* Episode Number Badge */}
                            <div className="px-1.5 py-0.5 rounded-md bg-black/80 border border-white/15 text-white text-[9px] sm:text-[10px] font-bold shadow-md backdrop-blur-md">
                              {isDocumentary ? `#${ep.episode_number}` : (isArabic ? `ح ${ep.episode_number}` : `Ep ${ep.episode_number}`)}
                            </div>

                            {/* Watched Indicator Checkmark Badge */}
                            {isWatched && (
                              <div
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-600/90 text-white text-[9px] font-bold shadow-md shadow-emerald-950/50 backdrop-blur-md border border-emerald-400/50"
                                title={isArabic ? 'تمت المشاهدة' : 'Watched'}
                              >
                                <Check size={10} strokeWidth={3} className="text-white" />
                                <span className="text-[8px] font-bold hidden xl:inline">{isArabic ? 'شوهدت' : 'Seen'}</span>
                              </div>
                            )}
                          </div>

                          {/* Resolution Badge (Bottom-Start) */}
                          {ep.resolution && (
                            <div className="absolute bottom-1.5 rtl:right-1.5 ltr:left-1.5 px-1 py-0.5 rounded text-[8px] font-bold bg-black/75 text-white/90 border border-white/15 shadow backdrop-blur-md">
                              {ep.resolution}
                            </div>
                          )}

                          {/* Hover Play Button Overlay (When not in selection mode) */}
                          {!isEpisodeSelectMode && (
                            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-black flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-300">
                                <Play size={16} fill="black" className="ms-0.5" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Episode Info at bottom */}
                        <div className="p-2 sm:p-2.5 bg-white dark:bg-surface border-t border-slate-100 dark:border-white/5">
                          <div className="font-bold text-xs text-slate-900 dark:text-text truncate group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
                            {epTitle}
                          </div>
                          <div className="text-[10px] text-muted mt-0.5 flex items-center justify-between">
                            <span>
                              {ep.duration
                                ? `${Math.floor(ep.duration / 60)} ${isArabic ? 'د' : 'm'}`
                                : (isArabic ? 'كاملة' : 'Full')}
                            </span>
                            {ep.playback && (
                              <span className={`text-[9px] font-semibold ${isWatched ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {Math.round((ep.playback.position / (ep.playback.duration || 1)) * 100)}%
                              </span>
                            )}
                          </div>

                          {/* Progress Bar */}
                          {ep.playback && (
                            <div className="h-1 bg-border rounded-full mt-1.5 w-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isWatched ? 'bg-emerald-400' : 'bg-amber-400'}`}
                                style={{
                                  width: `${ep.playback.duration ? Math.min(100, (ep.playback.position / ep.playback.duration) * 100) : 0}%`
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Floating Batch Selection Bar */}
          {isEpisodeSelectMode && (
            <div className={`fixed ${currentTrack ? 'bottom-24 sm:bottom-28' : 'bottom-6'} left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100vw-1.5rem)] sm:max-w-[calc(100vw-3rem)] overflow-x-auto scrollbar-none bg-slate-900/95 dark:bg-black/95 backdrop-blur-xl border border-amber-400/50 rounded-2xl shadow-2xl shadow-black/80 px-4 sm:px-5 py-2.5 sm:py-3 flex items-center gap-2.5 sm:gap-3.5 animate-scaleUp`}>
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white whitespace-nowrap flex-shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span>
                  {isArabic
                    ? `تم تحديد ${selectedEpisodeIds.length} حلقة`
                    : `${selectedEpisodeIds.length} selected`}
                </span>
              </div>

              <div className="h-4 w-px bg-white/20 flex-shrink-0" />

              <button
                onClick={() => handlePlaySelectedEpisodes(false)}
                disabled={!selectedEpisodeIds.length}
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-primaryMovies hover:brightness-110 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-primaryMovies/30 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 whitespace-nowrap flex-shrink-0"
              >
                <Play size={14} className="fill-white" />
                <span>{isArabic ? `تشغيل المحدد (${selectedEpisodeIds.length})` : `Play Selected (${selectedEpisodeIds.length})`}</span>
              </button>

              <button
                onClick={() => handlePlaySelectedEpisodes(true)}
                disabled={!selectedEpisodeIds.length}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition disabled:opacity-40 active:scale-95 whitespace-nowrap flex-shrink-0"
                title={isArabic ? 'تشغيل عشوائي للحلقات المحددة' : 'Shuffle Selected'}
              >
                <Shuffle size={14} />
                <span className="hidden sm:inline">{isArabic ? 'خلط' : 'Shuffle'}</span>
              </button>

              <button
                onClick={handleDownloadSelectedEpisodes}
                disabled={!selectedEpisodeIds.length}
                className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-black text-xs sm:text-sm font-extrabold shadow-lg shadow-amber-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 whitespace-nowrap flex-shrink-0"
              >
                <Download size={15} />
                <span>{isArabic ? 'تحميل (ZIP)' : 'Download (ZIP)'}</span>
              </button>

              <button
                onClick={handleSelectAllEpisodes}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition whitespace-nowrap flex-shrink-0"
              >
                {selectedEpisodeIds.length === (activeSeason?.episodes?.length || 0)
                  ? (isArabic ? 'إلغاء الكل' : 'Deselect All')
                  : (isArabic ? 'تحديد الكل' : 'Select All')}
              </button>

              <button
                onClick={() => {
                  setIsEpisodeSelectMode(false);
                  setSelectedEpisodeIds([]);
                }}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition flex-shrink-0"
                title={isArabic ? 'إغلاق' : 'Close'}
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Floating Resume / Continue Watching Bar (Visible when not in select mode) */}
          {!isEpisodeSelectMode && targetEpisode && (
            <div className={`fixed ${currentTrack ? 'bottom-24 sm:bottom-28' : 'bottom-6'} start-6 z-40 hidden md:flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-slate-900/95 dark:bg-black/95 backdrop-blur-xl border border-primaryMovies/40 shadow-2xl shadow-black/80 hover:border-primaryMovies transition-all duration-300 group`}>
              <div className="w-8 h-8 rounded-full overflow-hidden border border-white/30 flex-shrink-0 bg-black/50 shadow-md">
                {targetThumb ? (
                  <img src={targetThumb} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/80">
                    <Play size={12} fill="white" />
                  </div>
                )}
              </div>
              <div className="flex flex-col text-start">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                  {isResume ? (isArabic ? 'استكمال المشاهدة' : 'Continue Watching') : (isArabic ? 'ابدأ الآن' : 'Start Watching')}
                </span>
                <span className="text-xs font-extrabold text-white truncate max-w-[140px]">
                  {targetEpisode.title || (isArabic ? `الحلقة ${targetEpNum}` : `Ep ${targetEpNum}`)}
                </span>
              </div>
              <button
                onClick={handleResumeOrStart}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-primaryMovies to-red-600 hover:brightness-110 text-white text-xs font-bold shadow-md shadow-primaryMovies/30 transition active:scale-95 flex-shrink-0"
              >
                <Play size={12} fill="white" />
                <span>
                  {isResume
                    ? (isArabic ? `استئناف — ح ${targetEpNum}` : `Resume — Ep ${targetEpNum}`)
                    : (isArabic ? `ابدأ — ح ${targetEpNum}` : `Start — Ep ${targetEpNum}`)}
                </span>
              </button>
            </div>
          )}

          {/* TAB 2: Related Series ("أعمال أخرى قد تعجبك") */}
          {activeBottomTab === 'related' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {relatedSeries.map(item => (
                <MovieCard
                  key={item.id}
                  item={item}
                  to={`/series/${item.id}`}
                  className="w-full"
                />
              ))}
            </div>
          )}

        </div>
      </main>

      {/* Series Edit Modal */}
      <EditMetadataModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={() => queryClient.invalidateQueries(['series', id])}
        item={s}
        type="series"
      />

      {/* Season Edit Modal */}
      <EditSeasonModal
        isOpen={isSeasonModalOpen}
        onClose={() => {
          setIsSeasonModalOpen(false);
          setEditingSeason(null);
        }}
        season={s?.seasons?.find(sn => sn.id === editingSeason?.id) || editingSeason}
        seriesId={s.id}
        seriesTitle={s.title}
      />

      {/* Floating Scan Toast Notification */}
      {scanToast && (
        <div className="fixed top-5 end-5 z-[100] max-w-sm w-full animate-slideInRight">
          <div className={`flex items-center gap-3.5 p-4 rounded-2xl bg-slate-900/95 text-white border shadow-2xl backdrop-blur-xl ${scanToast.type === 'error' ? 'border-red-500/50 shadow-red-500/10' : 'border-amber-500/50 shadow-amber-500/10'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-sm ${scanToast.type === 'error' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
              <RefreshCw size={18} className={scanToast.type === 'error' ? '' : 'text-amber-400'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`flex items-center gap-1.5 text-xs font-bold ${scanToast.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                <Sparkles size={12} />
                <span>{scanToast.title}</span>
              </div>
              <div className="text-xs text-slate-200 mt-0.5 font-medium leading-relaxed">
                {scanToast.desc}
              </div>
            </div>
            <button
              onClick={() => setScanToast(null)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Delete Series from Server Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
          <div className="relative w-full max-w-md p-6 rounded-3xl bg-slate-900/95 border border-rose-500/30 shadow-[0_25px_60px_-15px_rgba(244,63,94,0.35)] text-text text-start">
            <div className="flex items-center gap-3 mb-4 text-rose-400">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">{isArabic ? 'حذف المسلسل من الخادم' : 'Delete Series from Server'}</h3>
                <p className="text-xs text-slate-400 truncate max-w-[280px]">{s.title}</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              {isArabic 
                ? `هل أنت متأكد من رغبتك في حذف مسلسل "${s.title}" بكافة مواسمه (${s.seasons?.length || 0}) وحلقاته (${totalEpisodes}) نهائياً من الخادم وقاعدة البيانات؟`
                : `Are you sure you want to remove "${s.title}" with all its seasons and episodes from the server and database?`}
            </p>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed mb-6 flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                {isArabic
                  ? 'ملاحظة هامة: سيتم تنظيف قاعدة البيانات بالكامل من كافة المواسم والحلقات وسجلات المشاهدة والصور، ولن يتم حذف أي ملفات فيديو نهائياً من القرص الصلب أو جهاز الكمبيوتر.'
                  : 'Important note: The database will be completely cleaned of all seasons, episodes, watch records, and posters. No physical video files will be deleted from your disk or computer.'}
              </span>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition active:scale-95 disabled:opacity-50"
              >
                {isArabic ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleDeleteSeries}
                disabled={isDeleting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-sm font-bold shadow-lg shadow-rose-600/30 border border-rose-400/30 transition active:scale-95 disabled:opacity-50"
              >
                {isDeleting && <Spinner size="sm" />}
                <span>{isDeleting ? (isArabic ? 'جاري الحذف...' : 'Deleting...') : (isArabic ? 'تأكيد الحذف من الخادم' : 'Confirm Delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
