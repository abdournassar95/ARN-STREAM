import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchMovie, saveRating, fetchMovies, fetchSimilarMovies, triggerDownload, setPrimaryImage, deleteMediaImage, deleteMovieApi } from '../../api/client';
import TopBar from '../../components/shared/TopBar';
import Rating from '../../components/shared/Rating';
import Tag from '../../components/shared/Tag';
import Spinner from '../../components/shared/Spinner';
import {
  Play,
  Clock,
  Calendar,
  Film,
  Edit2,
  Cast,
  HardDrive,
  Cpu,
  Volume2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Eye,
  X,
  RotateCcw,
  Download,
  ArrowRight,
  ArrowLeft,
  Trash2,
  AlertTriangle,
  ListPlus,
  ListVideo,
  SkipForward,
  Send
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useDeviceHandoffStore } from '../../store/useDeviceHandoffStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import EditMetadataModal from '../../components/shared/EditMetadataModal';

function formatDuration(seconds, isRtl) {
  if (!seconds || isNaN(seconds)) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return isRtl ? `${hours} س و ${minutes} د` : `${hours}h ${minutes}m`;
  }
  return isRtl ? `${minutes} دقيقة` : `${minutes}m`;
}

export default function MovieDetails() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const qc = useQueryClient();
  const isAdmin = useAuthStore(s => s.isAdmin);
  const canDownload = useAuthStore(s => s.canDownload);
  const canCast = useAuthStore(s => s.canCast);
  const { openCastModal, activeRemoteSession, playMediaOnTarget, openFullRemote } = useDeviceHandoffStore();

  const navigate = useNavigate();
  const { videoQueue, addVideoToQueue, addVideoNext, clearVideoQueue } = usePlayerStore();
  const [playlistNotice, setPlaylistNotice] = useState(null);

  // Always scroll to top of movie page on navigation or movie change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [id]);

  const handlePlayMovieClick = () => {
    // If current queue does not contain this movie as a valid movie item, clear any stale (or TV series) queue
    const isThisMovieInQueue = videoQueue?.some(v => 
      String(v.id) === String(movie?.id) && 
      (v.type === 'movie' || v.media_type === 'movie') && 
      !v.series_id && !v.season_id && v.episode_number === undefined
    );
    if (!isThisMovieInQueue) {
      clearVideoQueue();
    }
  };

  const handleAddToPlaylist = (playNext = false) => {
    if (!movie) return;

    // If the queue contains episodes from a series, clear it first so movies and TV episodes don't get mixed up
    const hasOnlyEpisodes = videoQueue?.length > 0 && videoQueue.every(v => 
      v.type === 'episode' || v.media_type === 'episode' || v.series_id || v.season_id || v.episode_number !== undefined
    );
    if (hasOnlyEpisodes) {
      clearVideoQueue();
    }

    const movieItem = {
      id: movie.id,
      title: movie.title,
      type: 'movie',
      media_type: 'movie',
      poster: poster || null,
      backdrop: backdrop || null,
      duration: movie.duration || null,
      year: movie.year || null
    };

    if (playNext) {
      addVideoNext(movieItem);
      setPlaylistNotice(isRtl ? 'تمت إضافة الفيلم للتشغيل تالياً' : 'Added to play next');
    } else {
      addVideoToQueue(movieItem);
      setPlaylistNotice(isRtl ? 'تمت إضافة الفيلم إلى قائمة التشغيل بنجاح' : 'Added to playlist');
    }

    setTimeout(() => setPlaylistNotice(null), 3500);
  };

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedBackdropIndex, setSelectedBackdropIndex] = useState(0);
  const [selectedPosterIndex, setSelectedPosterIndex] = useState(0);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [copiedPath, setCopiedPath] = useState(false);

  const handleDeleteMovie = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteMovieApi(movie.id);
      await qc.invalidateQueries({ queryKey: ['movies'] });
      await qc.invalidateQueries({ queryKey: ['movies-library'] });
      await qc.invalidateQueries({ queryKey: ['library'] });
      await qc.invalidateQueries({ queryKey: ['libraries'] });
      setIsDeleteModalOpen(false);
      if (movie.library_id) {
        navigate(`/library/${movie.library_id}`);
      } else {
        navigate('/movies');
      }
    } catch (err) {
      console.error('Failed to delete movie:', err);
      alert(err.response?.data?.error?.message || err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Fetch current movie details
  const { data: movie, isLoading } = useQuery({
    queryKey: ['movie', id],
    queryFn: () => fetchMovie(id),
    enabled: !!id && id !== 'undefined'
  });

  // Fetch more movies with smart recommendations based on tags/genres
  const { data: moreMoviesData } = useQuery({
    queryKey: ['movies-similar', id],
    queryFn: () => fetchSimilarMovies(id),
    enabled: !!id && id !== 'undefined'
  });

  const ratingMut = useMutation({
    mutationFn: ({ rating }) => saveRating('movie', id, rating),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['movie', id] })
  });

  const setPrimaryMut = useMutation({
    mutationFn: (imageId) => setPrimaryImage(imageId),
    onMutate: async (imageId) => {
      await qc.cancelQueries({ queryKey: ['movie', id] });
      const prevData = qc.getQueryData(['movie', id]);
      if (prevData) {
        const isBackdrop = prevData.backdrops?.some(b => b.id === imageId);
        if (isBackdrop) {
          qc.setQueryData(['movie', id], {
            ...prevData,
            backdrops: (prevData.backdrops || []).map(b => ({
              ...b,
              is_primary: b.id === imageId
            }))
          });
        } else {
          qc.setQueryData(['movie', id], {
            ...prevData,
            posters: (prevData.posters || []).map(p => ({
              ...p,
              is_primary: p.id === imageId
            }))
          });
        }
      }
      return { prevData };
    },
    onError: (err, imageId, context) => {
      if (context?.prevData) {
        qc.setQueryData(['movie', id], context.prevData);
      }
      alert(err.response?.data?.error?.message || err.message || (isRtl ? 'حدث خطأ أثناء تعيين الصورة كرئيسية' : 'Failed to set primary image'));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['movie', id] });
      qc.invalidateQueries({ queryKey: ['movie', String(id)] });
      qc.invalidateQueries({ queryKey: ['movie', Number(id)] });
      qc.invalidateQueries({ queryKey: ['movies-library'] });
      qc.invalidateQueries({ queryKey: ['movies'] });
    }
  });

  const deleteImageMut = useMutation({
    mutationFn: (imageId) => deleteMediaImage(imageId),
    onMutate: async (imageId) => {
      await qc.cancelQueries({ queryKey: ['movie', id] });
      const prevData = qc.getQueryData(['movie', id]);
      if (prevData) {
        qc.setQueryData(['movie', id], {
          ...prevData,
          posters: (prevData.posters || []).filter(p => p.id !== imageId),
          backdrops: (prevData.backdrops || []).filter(b => b.id !== imageId)
        });
      }
      return { prevData };
    },
    onError: (err, imageId, context) => {
      if (context?.prevData) {
        qc.setQueryData(['movie', id], context.prevData);
      }
      alert(err.response?.data?.error?.message || err.message || (isRtl ? 'حدث خطأ أثناء حذف الصورة' : 'Failed to delete image'));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['movie', id] });
      qc.invalidateQueries({ queryKey: ['movie', String(id)] });
      qc.invalidateQueries({ queryKey: ['movie', Number(id)] });
      qc.invalidateQueries({ queryKey: ['movies-library'] });
      qc.invalidateQueries({ queryKey: ['movies'] });
      qc.invalidateQueries({ queryKey: ['library'] });
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg">
        <TopBar variant="movies" />
        <div className="flex justify-center pt-24"><Spinner /></div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-bg">
        <TopBar variant="movies" />
        <div className="p-12 text-center text-muted">{isRtl ? 'الفيلم غير موجود' : 'Movie not found'}</div>
      </div>
    );
  }

  const backdropsList = movie.backdrops || [];
  const postersList = movie.posters || [];
  const safeBackdropIndex = selectedBackdropIndex >= backdropsList.length ? 0 : selectedBackdropIndex;
  const safePosterIndex = selectedPosterIndex >= postersList.length ? 0 : selectedPosterIndex;
  const primaryBackdrop = backdropsList[safeBackdropIndex]?.url || backdropsList[0]?.url;
  const primaryPoster = postersList[safePosterIndex]?.url || postersList.find(p => p.is_primary)?.url || postersList[0]?.url;
  const playbackPos = movie.playback?.position || 0;
  const playbackPercent = movie.duration && playbackPos ? Math.min(100, Math.round((playbackPos / movie.duration) * 100)) : 0;
  const otherMovies = (Array.isArray(moreMoviesData) ? moreMoviesData : moreMoviesData?.data || [])
    .filter(m => String(m.id) !== String(movie.id))
    .slice(0, 12);
  const formattedDuration = formatDuration(movie.duration, isRtl);

  const handleCopyPath = () => {
    if (!movie.path) return;
    navigator.clipboard.writeText(movie.path).then(() => {
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2200);
    });
  };

  const handleOpenCast = () => {
    openCastModal({
      type: 'movie',
      id: movie.id,
      title: movie.title,
      poster: primaryPoster,
      currentTime: playbackPos,
      duration: movie.duration,
      isPlaying: false
    });
  };

  return (
    <div className="min-h-screen bg-bg text-text relative pb-24">
      <TopBar variant="movies" />

      {/* 1. Ambient blurred background for cohesive atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {primaryBackdrop && (
          <img
            src={primaryBackdrop}
            alt=""
            className="w-full h-full object-cover opacity-15 dark:opacity-25 filter blur-3xl scale-110 transition-all duration-300"
          />
        )}
        <div className="absolute inset-0 bg-bg/90 backdrop-blur-2xl" />
      </div>

      {/* 2. Panoramic Clean Backdrop Showcase (No heavy black scrims, crystal clear image!) */}
      <div className="relative w-full h-[360px] sm:h-[440px] md:h-[500px] overflow-hidden z-0">
        {primaryBackdrop ? (
          <img
            src={primaryBackdrop}
            alt={movie.title}
            className="w-full h-full object-cover object-top sm:object-[center_20%] filter brightness-100 contrast-[1.02] transition-all duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primaryMovies/20 via-surface to-bg" />
        )}

        {/* Theme-aware smooth fade into page background (Works seamlessly in both Light & Dark modes) */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/40 via-transparent to-bg/40 rtl:bg-gradient-to-l" />

        {/* Action to view backdrop full-screen */}
        {primaryBackdrop && (
          <button
            onClick={() => setLightboxImage(primaryBackdrop)}
            className="absolute top-20 left-4 rtl:left-auto rtl:right-4 px-3 py-1.5 rounded-xl bg-black/50 hover:bg-black/75 text-white/90 text-xs font-semibold backdrop-blur-md border border-white/20 transition flex items-center gap-1.5 shadow-lg"
            title={isRtl ? 'عرض صورة الخلفية بالكامل' : 'View full backdrop'}
          >
            <Eye size={14} />
            <span className="hidden sm:inline">{isRtl ? 'عرض الصورة كاملة' : 'Full Backdrop'}</span>
          </button>
        )}
      </div>

      {/* 3. Hero Glassmorphic Card (Overlaps the backdrop cleanly, unobstructed faces, theme-adaptive) */}
      <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-8 -mt-24 sm:-mt-32 md:-mt-40">
        <div className="p-6 sm:p-8 rounded-3xl bg-white/95 dark:bg-surface/95 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start text-text">
          
          {/* Poster with 3D Shadow, Elevation and Hover Zoom */}
          <div className="w-[180px] sm:w-[210px] md:w-[240px] aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border-2 border-white dark:border-white/15 flex-shrink-0 bg-surface relative group -mt-12 sm:-mt-16 md:-mt-24 transition-transform duration-500 hover:scale-[1.02]">
            {primaryPoster ? (
              <img
                src={primaryPoster}
                alt={movie.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted bg-surfaceHover">
                <Film size={54} />
              </div>
            )}
            {movie.resolution && (
              <div className="absolute top-2.5 right-2.5 rtl:right-auto rtl:left-2.5 px-2.5 py-0.5 rounded-lg bg-black/85 backdrop-blur-md border border-white/20 text-[11px] font-mono font-bold text-white shadow-md">
                {movie.resolution}
              </div>
            )}
          </div>

          {/* Title, Badges, Rating & Action Buttons */}
          <div className="flex-1 min-w-0 text-center md:text-start w-full">
            
            {/* Category tag & Release Year */}
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2 text-xs font-semibold">
              <span className="px-2.5 py-0.5 rounded-full bg-primaryMovies/15 text-primaryMovies border border-primaryMovies/30 font-bold">
                {isRtl ? 'فيلم سينمائي' : 'Movie'}
              </span>
              {movie.year && (
                <span className="flex items-center gap-1 text-muted">
                  <Calendar size={13} /> {movie.year}
                </span>
              )}
            </div>

            {/* Movie Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-text leading-tight tracking-tight">
              {movie.title}
            </h1>

            {/* Tech Chips */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mt-3 text-xs">
              {formattedDuration && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-surfaceHover border border-slate-200/80 dark:border-white/5 text-text font-medium">
                  <Clock size={13} className="text-primaryMovies" />
                  <span>{formattedDuration}</span>
                </span>
              )}
              {movie.resolution && (
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-surfaceHover border border-slate-200/80 dark:border-white/5 text-text font-mono font-semibold">
                  {movie.resolution}
                </span>
              )}
              {movie.video_codec && (
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-surfaceHover border border-slate-200/80 dark:border-white/5 text-muted font-mono">
                  {movie.video_codec}
                </span>
              )}
              {movie.audio_codec && (
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-surfaceHover border border-slate-200/80 dark:border-white/5 text-muted font-mono">
                  {movie.audio_codec}
                </span>
              )}
              
              {/* Interactive Rating */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-surfaceHover border border-slate-200/80 dark:border-white/5">
                <Rating value={movie.rating || 0} onChange={(v) => ratingMut.mutate({ rating: v })} size={16} />
                {movie.rating ? (
                  <span className="text-xs font-bold text-amber-500 ms-1">{movie.rating}/5</span>
                ) : null}
              </div>
            </div>

            {/* Tags / Genres */}
            {movie.tags?.length > 0 && (
              <div className="flex flex-wrap justify-center md:justify-start gap-1.5 mt-3.5">
                {movie.tags.map(tag => (
                  <Tag key={tag.id} tag={tag} />
                ))}
              </div>
            )}

            {/* Action Buttons Bar */}
            <div className="mt-6 flex flex-wrap items-center justify-center md:justify-start gap-3">
              {/* Play on Remote Target Device */}
              {activeRemoteSession && (
                <button
                  onClick={() => {
                    playMediaOnTarget({
                      type: 'movie',
                      id: movie.id,
                      title: movie.title,
                      poster: movie.poster_path,
                      currentTime: playbackPos > 30 ? playbackPos : 0,
                      duration: movie.duration
                    });
                    openFullRemote();
                  }}
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold hover:brightness-110 shadow-xl shadow-red-900/40 active:scale-95 transition border border-rose-400/40 animate-pulse"
                >
                  <Send size={18} />
                  <span>{isRtl ? `تشغيل على ${activeRemoteSession.targetDeviceName}` : `Play on ${activeRemoteSession.targetDeviceName}`}</span>
                </button>
              )}

              {/* Play from beginning */}
              <Link
                to={`/watch/movie/${movie.id}`}
                onClick={handlePlayMovieClick}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl bg-primaryMovies text-white font-bold hover:brightness-110 shadow-lg shadow-primaryMovies/30 active:scale-95 transition"
              >
                <Play size={20} fill="white" />
                <span>{playbackPos > 30 ? (isRtl ? 'إعادة من البداية' : 'Play from start') : t('common.play')}</span>
              </Link>

              {/* Resume playback if started */}
              {playbackPos > 30 && (
                <Link
                  to={`/watch/movie/${movie.id}?t=${Math.floor(playbackPos)}&autoPlay=true`}
                  onClick={handlePlayMovieClick}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-tx/10 text-text font-bold border border-slate-200 dark:border-white/10 active:scale-95 transition shadow-sm"
                >
                  <RotateCcw size={18} className="text-primaryMovies" />
                  <span>{isRtl ? `استئناف (${Math.floor(playbackPos / 60)} د)` : `Resume (${Math.floor(playbackPos / 60)}m)`}</span>
                </Link>
              )}

              {/* Cast / Handoff to another screen */}
              {canCast() && (
                <button
                  onClick={handleOpenCast}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-tx/10 text-text font-semibold border border-slate-200 dark:border-white/10 transition active:scale-95 shadow-sm"
                  title={isRtl ? 'نقل المشاهدة لشاشة أو جهاز آخر' : 'Cast to another screen'}
                >
                  <Cast size={18} className="text-primaryMovies" />
                  <span>{isRtl ? 'بث لشاشة أخرى' : 'Cast'}</span>
                </button>
              )}

              {/* Download Movie */}
              {canDownload() && (
                <button
                  onClick={() => triggerDownload(`/api/download/movie/${movie.id}`)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-tx/10 text-text font-semibold border border-slate-200 dark:border-white/10 transition active:scale-95 shadow-sm hover:border-amber-400/50 group"
                  title={isRtl ? 'تنزيل ملف الفيلم بجودته الأصلية' : 'Download original movie file'}
                >
                  <Download size={18} className="text-amber-400 group-hover:scale-110 transition-transform" />
                  <span>{isRtl ? 'تحميل الفيلم' : 'Download'}</span>
                </button>
              )}

              {/* Edit Metadata Modal */}
              {isAdmin() && (
                <>
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-tx/10 text-muted hover:text-text font-semibold border border-slate-200 dark:border-white/10 transition active:scale-95 shadow-sm"
                    title={isRtl ? 'تعديل بيانات الفيلم' : 'Edit movie metadata'}
                  >
                    <Edit2 size={17} />
                    <span>{isRtl ? 'تعديل' : 'Edit'}</span>
                  </button>

                  <button
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 font-semibold border border-rose-500/25 hover:border-rose-500/40 transition active:scale-95 shadow-sm"
                    title={isRtl ? 'حذف الفيلم من الخادم' : 'Delete movie from server'}
                  >
                    <Trash2 size={17} />
                    <span>{isRtl ? 'حذف من الخادم' : 'Delete'}</span>
                  </button>
                </>
              )}

              {/* Add to Video Playlist */}
              <button
                onClick={() => handleAddToPlaylist(false)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-tx/10 text-text font-semibold border border-slate-200 dark:border-white/10 transition active:scale-95 shadow-sm hover:border-primaryMovies/40 group"
                title={isRtl ? 'إضافة هذا الفيلم إلى قائمة التشغيل المتتالية' : 'Add to playlist queue'}
              >
                <ListPlus size={18} className="text-primaryMovies group-hover:scale-110 transition-transform" />
                <span>{isRtl ? 'إضافة لقائمة التشغيل' : 'Add to Playlist'}</span>
              </button>

              {/* Play Next if video queue is active */}
              {videoQueue?.length > 0 && (
                <button
                  onClick={() => handleAddToPlaylist(true)}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-tx/10 text-text font-semibold border border-slate-200 dark:border-white/10 transition active:scale-95 shadow-sm"
                  title={isRtl ? 'تشغيل هذا الفيلم تالياً مباشرة بعد الفيديو الحالي' : 'Play this movie next in queue'}
                >
                  <SkipForward size={17} className="text-emerald-400" />
                  <span>{isRtl ? 'تشغيل تالياً' : 'Play Next'}</span>
                </button>
              )}
            </div>

            {/* Playlist Feedback Toast / Banner */}
            {playlistNotice && (
              <div className="mt-3.5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-fadeIn">
                <Check size={15} className="stroke-[3]" />
                <span>{playlistNotice}</span>
              </div>
            )}

            {/* Active Queue Status Banner */}
            {(() => {
              const movieItemsInQueue = (videoQueue || []).filter(v => 
                (v.type === 'movie' || v.media_type === 'movie') && 
                !v.series_id && !v.season_id && v.episode_number === undefined
              );
              if (!movieItemsInQueue.length) return null;

              return (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <ListVideo size={14} className="text-primaryMovies" />
                  <span>
                    {isRtl
                      ? `قائمة التشغيل الحالية تحتوي على (${movieItemsInQueue.length}) أفلام`
                      : `Current playlist has (${movieItemsInQueue.length}) movies`}
                  </span>
                  <Link
                    to={`/watch/movie/${movieItemsInQueue[0].id}`}
                    className="text-primaryMovies font-bold hover:underline ms-1"
                  >
                    {isRtl ? 'تشغيل القائمة الآن' : 'Play Queue Now'}
                  </Link>
                  <button
                    onClick={() => clearVideoQueue()}
                    className="text-red-400 hover:text-red-500 font-semibold hover:underline ms-2"
                  >
                    {isRtl ? 'مسح القائمة' : 'Clear Queue'}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 4. Rich Content Section: Utilizing Empty Spaces (Two-Column Layout) */}
      <main className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-8 mt-8 grid lg:grid-cols-[1fr_360px] gap-8">
        
        {/* Main Column */}
        <div className="space-y-8">
          
          {/* Watch Progress Card (if in progress) */}
          {playbackPos > 30 && (
            <div className="p-4 rounded-2xl bg-white dark:bg-surface border border-slate-200/80 dark:border-border/80 shadow-md flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span className="text-text flex items-center gap-1.5">
                    <Sparkles size={14} className="text-primaryMovies" />
                    <span>{isRtl ? 'أنت تشاهد هذا الفيلم حالياً' : 'Currently Watching'}</span>
                  </span>
                  <span className="font-mono text-primaryMovies">{playbackPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-surfaceHover overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primaryMovies transition-all duration-500"
                    style={{ width: `${playbackPercent}%` }}
                  />
                </div>
              </div>
              <Link
                to={`/watch/movie/${movie.id}?t=${Math.floor(playbackPos)}&autoPlay=true`}
                onClick={handlePlayMovieClick}
                className="px-4 py-2 rounded-xl bg-primaryMovies hover:brightness-110 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <Play size={14} fill="white" />
                <span>{isRtl ? 'متابعة' : 'Resume'}</span>
              </Link>
            </div>
          )}

          {/* Story & Overview (Plot) Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-surface border border-slate-200/80 dark:border-border/80 shadow-md">
            <h2 className="text-lg font-bold text-text mb-3 flex items-center gap-2">
              <Film size={20} className="text-primaryMovies" />
              <span>{isRtl ? 'قصة ونبذة الفيلم' : t('movies.plot')}</span>
            </h2>
            <p className="text-muted leading-relaxed text-sm sm:text-base whitespace-pre-line">
              {movie.plot || (isRtl ? 'لا يتوفر وصف أو ملخص تفصيلي لهذا الفيلم حالياً.' : 'No plot available for this title.')}
            </p>
          </div>

          {/* Backdrops & Fanart Gallery Section (معرض الخلفيات واللقطات) */}
          {backdropsList.length > 0 && (
            <div className="p-6 rounded-3xl bg-white dark:bg-surface border border-slate-200/80 dark:border-border/80 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon size={20} className="text-primaryMovies" />
                  <h3 className="font-bold text-base text-text">
                    {isRtl ? 'معرض خلفيات ولقطات الفيلم' : 'Backdrops & Fanart Gallery'}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-surfaceHover text-muted font-mono font-semibold">
                    {backdropsList.length}
                  </span>
                </div>
                <span className="text-xs text-muted hidden sm:inline">
                  {isRtl ? 'انقر على أي لقطة لتعيينها كخلفية أو تكبيرها' : 'Click to preview or set as backdrop'}
                </span>
              </div>

              {/* Horizontal Scrollable Gallery */}
              <div className="flex gap-4 overflow-x-auto pb-2 pt-1 custom-scrollbar">
                {backdropsList.map((bd, idx) => {
                  const isSelected = idx === selectedBackdropIndex;
                  return (
                    <div
                      key={bd.id || idx}
                      onClick={() => setSelectedBackdropIndex(idx)}
                      className={`relative flex-shrink-0 w-60 sm:w-72 aspect-video rounded-2xl overflow-hidden border-2 cursor-pointer group shadow-md transition-all ${
                        isSelected
                          ? 'border-primaryMovies ring-4 ring-primaryMovies/20 scale-[1.02]'
                          : 'border-slate-200 dark:border-border/80 hover:border-primaryMovies/50 hover:scale-[1.01]'
                      }`}
                    >
                      <img
                        src={bd.thumb || bd.url}
                        alt={`Backdrop ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxImage(bd.url);
                          }}
                          className="p-2 rounded-xl bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition shadow-md hover:scale-105"
                          title={isRtl ? 'عرض الصورة بالحجم الكامل' : 'Full size'}
                        >
                          <Eye size={16} />
                        </button>
                        {isAdmin() && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrimaryMut.mutate(bd.id);
                                setSelectedBackdropIndex(idx);
                              }}
                              className="p-2 rounded-xl bg-amber-500/80 hover:bg-amber-500 text-black backdrop-blur-md transition shadow-md hover:scale-105"
                              title={isRtl ? 'تعيين كخلفية رئيسية' : 'Set as Primary'}
                            >
                              <Check size={16} strokeWidth={3} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(isRtl ? 'هل أنت متأكد من حذف هذه الصورة نهائياً؟' : 'Delete this image permanently?')) {
                                  deleteImageMut.mutate(bd.id);
                                  if (selectedBackdropIndex === idx) setSelectedBackdropIndex(0);
                                }
                              }}
                              className="p-2 rounded-xl bg-red-600/80 hover:bg-red-600 text-white backdrop-blur-md transition shadow-md hover:scale-105"
                              title={isRtl ? 'حذف الصورة' : 'Delete image'}
                            >
                              <X size={16} strokeWidth={3} />
                            </button>
                          </>
                        )}
                      </div>
                      {isSelected && (
                        <div className="absolute bottom-2 right-2 rtl:right-auto rtl:left-2 px-2 py-0.5 rounded-md bg-primaryMovies text-white text-[10px] font-bold shadow">
                          {isRtl ? 'الخلفية الحالية' : 'Active'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alternative Posters Section */}
          {postersList.length > 1 && (
            <div className="p-6 rounded-3xl bg-white dark:bg-surface border border-slate-200/80 dark:border-border/80 shadow-md space-y-4">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-primaryMovies" />
                <h3 className="font-bold text-base text-text">
                  {isRtl ? 'الملصقات والبوسترات البديلة' : 'Alternative Posters'}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-surfaceHover text-muted font-mono font-semibold">
                  {postersList.length}
                </span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 pt-1 custom-scrollbar">
                {postersList.map((p, idx) => {
                  const isSelected = idx === selectedPosterIndex;
                  return (
                    <div
                      key={p.id || idx}
                      onClick={() => setSelectedPosterIndex(idx)}
                      className={`relative flex-shrink-0 w-28 sm:w-32 aspect-[2/3] rounded-xl overflow-hidden border-2 cursor-pointer group transition-all shadow-md ${
                        isSelected
                          ? 'border-primaryMovies ring-4 ring-primaryMovies/20 scale-[1.02]'
                          : 'border-slate-200 dark:border-border/80 hover:border-primaryMovies/50 hover:scale-[1.01]'
                      }`}
                    >
                      <img
                        src={p.thumb || p.url}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setLightboxImage(p.url); }}
                            className="p-2 rounded-xl bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition shadow-md hover:scale-105"
                            title={isRtl ? 'عرض الصورة' : 'View'}
                          >
                            <Eye size={16} />
                          </button>
                          {isAdmin() && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(isRtl ? 'هل أنت متأكد من حذف هذا البوستر نهائياً؟' : 'Delete this poster permanently?')) {
                                  deleteImageMut.mutate(p.id);
                                  if (selectedPosterIndex === idx) setSelectedPosterIndex(0);
                                }
                              }}
                              className="p-2 rounded-xl bg-red-600/80 hover:bg-red-600 text-white backdrop-blur-md transition shadow-md hover:scale-105"
                              title={isRtl ? 'حذف البوستر' : 'Delete'}
                            >
                              <X size={16} strokeWidth={3} />
                            </button>
                          )}
                        </div>
                        {isAdmin() && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrimaryMut.mutate(p.id);
                              setSelectedPosterIndex(idx);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/90 hover:bg-amber-500 text-black backdrop-blur-md transition text-xs font-bold shadow-md hover:scale-105"
                            title={isRtl ? 'تعيين كبوستر رئيسي' : 'Set as Primary'}
                          >
                            {isRtl ? 'تعيين كرئيسي' : 'Set Primary'}
                          </button>
                        )}
                      </div>
                      {p.is_primary && (
                        <div className="absolute top-1.5 left-1.5 rtl:left-auto rtl:right-1.5 px-1.5 py-0.5 rounded bg-primaryMovies text-white text-[9px] font-bold shadow">
                          {isRtl ? 'الرئيسي' : 'Primary'}
                        </div>
                      )}
                      {isSelected && !p.is_primary && (
                        <div className="absolute bottom-1.5 right-1.5 rtl:right-auto rtl:left-1.5 px-1.5 py-0.5 rounded-md bg-amber-500 text-black text-[9px] font-bold shadow">
                          {isRtl ? 'معاينة' : 'Preview'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendations / More from this library */}
          {otherMovies.length > 0 && (
            <div className="p-6 rounded-3xl bg-white dark:bg-surface border border-slate-200/80 dark:border-border/80 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film size={20} className="text-primaryMovies" />
                  <h3 className="font-bold text-base text-text">
                    {isRtl ? 'أفلام أخرى مقترحة من نفس المكتبة' : 'More From This Library'}
                  </h3>
                </div>
                <Link
                  to={`/libraries/${movie.library_id}`}
                  className="text-xs text-primaryMovies hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>{isRtl ? 'عرض الكل' : 'View all'}</span>
                  {isRtl ? <ArrowLeft size={13} /> : <ArrowRight size={13} />}
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {otherMovies.map(om => (
                  <Link
                    key={om.id}
                    to={`/movies/${om.id}`}
                    className="group flex flex-col rounded-2xl overflow-hidden bg-slate-50 dark:bg-surfaceHover/60 border border-slate-200/80 dark:border-border/60 hover:border-primaryMovies/60 transition shadow-sm"
                  >
                    <div className="aspect-[2/3] w-full overflow-hidden bg-black/10 relative">
                      {om.poster ? (
                        <img
                          src={om.poster}
                          alt={om.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted">
                          <Film size={28} />
                        </div>
                      )}
                      {om.rating ? (
                        <div className="absolute top-2 left-2 rtl:left-auto rtl:right-2 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-amber-400 text-[10px] font-bold font-mono">
                          ★ {om.rating}
                        </div>
                      ) : null}
                    </div>
                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <div className="font-semibold text-xs text-text truncate group-hover:text-primaryMovies transition">
                        {om.title}
                      </div>
                      <div className="text-[11px] text-muted mt-1 flex items-center justify-between">
                        <span>{om.year || '—'}</span>
                        {om.duration && <span>{Math.floor(om.duration / 60)}m</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          
          {/* Detailed Technical & File Specs Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-surface border border-slate-200/80 dark:border-border/80 shadow-md space-y-4">
            <h3 className="text-base font-bold text-text flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-border/60">
              <HardDrive size={18} className="text-primaryMovies" />
              <span>{isRtl ? 'المواصفات الفنية وبيانات الملف' : 'Technical Specifications'}</span>
            </h3>

            <div className="space-y-3.5 text-xs">
              {/* File Path */}
              <div>
                <div className="text-muted flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5">
                    <HardDrive size={13} />
                    <span>{isRtl ? 'مسار الملف المخزن' : 'Storage Path'}</span>
                  </span>
                  <button
                    onClick={handleCopyPath}
                    className="text-primaryMovies hover:underline flex items-center gap-1 font-semibold"
                    title={isRtl ? 'نسخ المسار' : 'Copy path'}
                  >
                    {copiedPath ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    <span>{copiedPath ? (isRtl ? 'تم النسخ!' : 'Copied!') : (isRtl ? 'نسخ' : 'Copy')}</span>
                  </button>
                </div>
                <div
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-surfaceHover/80 font-mono text-[11px] text-text break-all border border-slate-200 dark:border-border/50 text-left"
                  dir="ltr"
                >
                  {movie.path}
                </div>
              </div>

              {/* Resolution */}
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-border/40">
                <span className="text-muted flex items-center gap-1.5">
                  <Film size={13} />
                  <span>{isRtl ? 'دقة العرض' : 'Resolution'}</span>
                </span>
                <span className="font-bold text-text font-mono">{movie.resolution || (isRtl ? 'تلقائي' : 'Auto')}</span>
              </div>

              {/* Video Codec */}
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-border/40">
                <span className="text-muted flex items-center gap-1.5">
                  <Cpu size={13} />
                  <span>{isRtl ? 'ترميز الفيديو' : 'Video Codec'}</span>
                </span>
                <span className="font-mono font-semibold text-text">{movie.video_codec || 'H.264'}</span>
              </div>

              {/* Audio Codec */}
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-border/40">
                <span className="text-muted flex items-center gap-1.5">
                  <Volume2 size={13} />
                  <span>{isRtl ? 'ترميز الصوت' : 'Audio Codec'}</span>
                </span>
                <span className="font-mono font-semibold text-text">{movie.audio_codec || 'AAC'}</span>
              </div>

              {/* Duration */}
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-border/40">
                <span className="text-muted flex items-center gap-1.5">
                  <Clock size={13} />
                  <span>{isRtl ? 'مدة العرض' : 'Duration'}</span>
                </span>
                <span className="font-bold text-text">{formattedDuration || (isRtl ? 'غير محدد' : 'Unknown')}</span>
              </div>

              {/* Added Date */}
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-border/40">
                <span className="text-muted flex items-center gap-1.5">
                  <Calendar size={13} />
                  <span>{isRtl ? 'تاريخ الإضافة' : 'Added Date'}</span>
                </span>
                <span className="text-text font-mono">
                  {movie.added_at ? new Date(movie.added_at).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US') : '—'}
                </span>
              </div>

              {/* TMDB Link */}
              {movie.tmdb_id && (
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-muted flex items-center gap-1">
                    <span>TMDB ID:</span>
                    <span className="font-mono font-bold text-text">#{movie.tmdb_id}</span>
                  </span>
                  <a
                    href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primaryMovies hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>{isRtl ? 'فتح في TMDB' : 'Open TMDB'}</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Quick Cast & Share Card */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-primaryMovies/10 via-white dark:via-surface to-white dark:to-surface border border-primaryMovies/25 shadow-md space-y-3">
            <div className="flex items-center gap-2 text-primaryMovies font-bold text-sm">
              <Cast size={18} />
              <span>{isRtl ? 'المشاهدة على شاشة أخرى' : 'Cast & Remote Screen'}</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              {isRtl
                ? 'يمكنك نقل عرض هذا الفيلم فورياً إلى شاشة التلفاز الذكي أو هاتفك والتحكم به عن بُعد.'
                : 'Instantly transfer playback of this movie to your Smart TV or tablet with timestamp sync.'}
            </p>
            <button
              onClick={handleOpenCast}
              className="w-full py-2.5 rounded-xl bg-primaryMovies hover:brightness-110 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-md"
            >
              <Cast size={16} />
              <span>{isRtl ? 'بدء البث لجهاز آخر' : 'Start Cast Session'}</span>
            </button>
          </div>

        </div>
      </main>

      {/* 5. Fullscreen Lightbox Modal for Backdrop / Poster Preview */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white p-1 rounded-full bg-white/10 transition"
            >
              <X size={24} />
            </button>
            <img
              src={lightboxImage}
              alt=""
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}

      {/* 6. Metadata Editing Modal */}
      <EditMetadataModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        item={movie}
        type="movie"
      />

      {/* 7. Delete from Server Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
          <div className="relative w-full max-w-md p-6 rounded-3xl bg-slate-900/95 border border-rose-500/30 shadow-[0_25px_60px_-15px_rgba(244,63,94,0.35)] text-text text-start">
            <div className="flex items-center gap-3 mb-4 text-rose-400">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">{isRtl ? 'حذف الفيلم من الخادم' : 'Delete Movie from Server'}</h3>
                <p className="text-xs text-slate-400 truncate max-w-[280px]">{movie.title}</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              {isRtl 
                ? `هل أنت متأكد من رغبتك في حذف فيلم "${movie.title}" نهائياً من الخادم وقاعدة البيانات؟`
                : `Are you sure you want to remove "${movie.title}" from the server and database?`}
            </p>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed mb-6 flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                {isRtl
                  ? 'ملاحظة هامة: هذا الإجراء يحذف الفيلم وسجلاته وميتاداتا الصور من قاعدة البيانات فقط، ولن يتم حذف ملف الفيلم الفعلي نهائياً من جهاز الكمبيوتر أو القرص الصلب.'
                  : 'Important note: This action only removes the movie, thumbnails, and watch records from the database. The actual video file will NOT be deleted from the disk or computer.'}
              </span>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition active:scale-95 disabled:opacity-50"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleDeleteMovie}
                disabled={isDeleting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-sm font-bold shadow-lg shadow-rose-600/30 border border-rose-400/30 transition active:scale-95 disabled:opacity-50"
              >
                {isDeleting && <Spinner size="sm" />}
                <span>{isDeleting ? (isRtl ? 'جاري الحذف...' : 'Deleting...') : (isRtl ? 'تأكيد الحذف من الخادم' : 'Confirm Delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
