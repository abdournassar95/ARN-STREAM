import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchCollections, fetchCollection, createCollection } from '../api/client';
import client from '../api/client';
import TopBar from '../components/shared/TopBar';
import Spinner from '../components/shared/Spinner';
import { useAuthStore } from '../store/useAuthStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { 
  Play, 
  Shuffle, 
  ListVideo, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  ArrowRight, 
  Film, 
  Tv, 
  Layers, 
  Sparkles,
  Calendar,
  Check
} from 'lucide-react';

export default function Collections() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const qc = useQueryClient();
  const isAdmin = useAuthStore(s => s.isAdmin());
  const { setVideoQueue } = usePlayerStore();

  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // All Collections Query
  const { data: collections = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
    enabled: !id
  });

  // Single Collection Query
  const { data: collection, isLoading: isLoadingSingle } = useQuery({
    queryKey: ['collection', id],
    queryFn: () => fetchCollection(id),
    enabled: !!id
  });

  const createMut = useMutation({
    mutationFn: () => createCollection({ name: newCollectionName.trim(), description: newCollectionDesc.trim() }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['collections'] });
      setNewCollectionName('');
      setNewCollectionDesc('');
      setShowCreateModal(false);
      if (data?.id) navigate(`/collections/${data.id}`);
    }
  });

  const deleteItemMut = useMutation({
    mutationFn: (itemId) => client.delete(`/collections/${id}/items/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection', id] })
  });

  const deleteCollectionMut = useMutation({
    mutationFn: () => client.delete(`/collections/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections'] });
      navigate('/collections');
    }
  });

  // Play an entire collection consecutively
  const handlePlayCollection = (items, startIndex = 0, shuffle = false) => {
    if (!items || !items.length) return;
    let list = [...items];
    if (shuffle) {
      list.sort(() => Math.random() - 0.5);
    }
    const queue = list.map(it => ({
      id: it.media_id,
      title: it.title,
      type: it.media_type || 'movie',
      media_type: it.media_type || 'movie',
      poster: it.poster || null
    }));

    setVideoQueue(queue, startIndex);
    const startItem = queue[startIndex] || queue[0];
    navigate(`/watch/${startItem.type}/${startItem.id}`);
  };

  // If viewing single collection details
  if (id) {
    if (isLoadingSingle) {
      return (
        <div className="min-h-screen bg-bg">
          <TopBar variant="movies" />
          <div className="flex items-center justify-center h-[60vh]"><Spinner /></div>
        </div>
      );
    }

    if (!collection) {
      return (
        <div className="min-h-screen bg-bg">
          <TopBar variant="movies" />
          <div className="max-w-4xl mx-auto px-6 py-16 text-center">
            <h2 className="text-xl font-bold text-text mb-4">
              {isRtl ? 'المجموعة غير موجودة' : 'Collection Not Found'}
            </h2>
            <Link to="/collections" className="text-sm text-primaryMovies hover:underline">
              {isRtl ? 'العودة للمجموعات' : 'Back to Collections'}
            </Link>
          </div>
        </div>
      );
    }

    const items = collection.items || [];
    const moviesCount = items.filter(it => it.media_type === 'movie').length;
    const seriesCount = items.filter(it => it.media_type === 'series').length;

    return (
      <div className="min-h-screen bg-bg">
        <TopBar variant="movies" />
        
        <main className="max-w-[1400px] mx-auto px-4 sm:px-8 py-8">
          {/* Breadcrumb Header */}
          <div className="mb-6 flex items-center justify-between">
            <Link 
              to="/collections" 
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted hover:text-text transition"
            >
              {isRtl ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
              <span>{isRtl ? 'كل المجموعات' : 'All Collections'}</span>
            </Link>

            {isAdmin && (
              <button
                onClick={() => {
                  if (window.confirm(isRtl ? 'هل تريد حذف هذه المجموعة نهائياً؟' : 'Delete this collection?')) {
                    deleteCollectionMut.mutate();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition"
                title={isRtl ? 'حذف المجموعة' : 'Delete Collection'}
              >
                <Trash2 size={14} />
                <span>{isRtl ? 'حذف المجموعة' : 'Delete'}</span>
              </button>
            )}
          </div>

          {/* Hero Banner for Collection */}
          <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-border shadow-xl mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primaryMovies/20 border border-primaryMovies/40 flex items-center justify-center text-primaryMovies flex-shrink-0 shadow-lg shadow-primaryMovies/10">
                <Layers size={32} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-text mb-1">
                  {collection.name}
                </h1>
                <p className="text-xs sm:text-sm text-muted">
                  {collection.description || (isRtl ? 'مجموعة أفلام متتالية مخصصة' : 'Custom video collection playlist')} • {items.length} {isRtl ? 'عنصر' : 'items'}
                </p>
              </div>
            </div>

            {/* Play Collection Buttons */}
            {items.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <button
                  onClick={() => handlePlayCollection(items, 0, false)}
                  className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primaryMovies hover:brightness-110 text-white font-bold text-sm shadow-lg shadow-primaryMovies/30 active:scale-95 transition"
                >
                  <Play size={18} fill="white" />
                  <span>{isRtl ? 'تشغيل المجموعة كاملة' : 'Play Entire Collection'}</span>
                </button>

                <button
                  onClick={() => handlePlayCollection(items, 0, true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-surfaceHover hover:bg-slate-200 dark:hover:bg-white/10 text-text font-bold text-sm border border-border active:scale-95 transition shadow-sm"
                  title={isRtl ? 'تشغيل عشوائي للمجموعة' : 'Shuffle Collection'}
                >
                  <Shuffle size={18} />
                  <span className="hidden sm:inline">{isRtl ? 'خلط' : 'Shuffle'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Collection Items Grid */}
          {items.length === 0 ? (
            <div className="py-16 text-center text-muted border border-dashed border-border rounded-3xl p-8">
              <Film size={36} className="mx-auto mb-3 opacity-40 text-primaryMovies" />
              <div className="text-sm font-semibold text-text mb-1">
                {isRtl ? 'لا توجد أفلام في هذه المجموعة بعد' : 'No titles in this collection yet'}
              </div>
              <p className="text-xs text-muted max-w-sm mx-auto">
                {isRtl ? 'يمكنك إضافة أفلام ومسلسلات لهذه المجموعة من لوحة التحكم أو من شاشات الوسائط.' : 'Add titles to this collection from library or management panels.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {items.map((item, idx) => {
                const targetLink = item.media_type === 'movie' ? `/movies/${item.media_id}` : `/series/${item.media_id}`;
                return (
                  <div
                    key={`${item.media_type}-${item.media_id}-${idx}`}
                    className="group relative rounded-2xl overflow-hidden bg-surface border border-border hover:border-primaryMovies/60 transition shadow-md hover:shadow-xl flex flex-col"
                  >
                    {/* Poster with Play Overlay */}
                    <div className="aspect-[2/3] bg-surfaceHover relative overflow-hidden">
                      {item.poster ? (
                        <img 
                          src={item.poster} 
                          alt={item.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500" 
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-3 text-center text-xs text-muted">
                          {item.title}
                        </div>
                      )}

                      {/* Play from this index */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayCollection(items, idx, false);
                        }}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
                        title={isRtl ? 'تشغيل بدءاً من هذا الفيلم' : 'Play from here'}
                      >
                        <div className="w-11 h-11 rounded-full bg-primaryMovies text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Play size={18} fill="white" className="ms-0.5" />
                        </div>
                      </button>

                      {/* Admin Delete Item Button */}
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(isRtl ? 'إزالة هذا الفيلم من المجموعة؟' : 'Remove from collection?')) {
                              deleteItemMut.mutate(item.id);
                            }
                          }}
                          className="absolute top-2.5 end-2.5 w-7 h-7 rounded-lg bg-black/70 hover:bg-red-600 text-white/80 hover:text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition shadow-md"
                          title={isRtl ? 'إزالة من المجموعة' : 'Remove item'}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}

                      {/* Order Number Badge */}
                      <div className="absolute top-2.5 start-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[11px] font-mono font-bold text-white shadow-sm">
                        #{idx + 1}
                      </div>
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <Link to={targetLink} className="font-semibold text-xs sm:text-sm text-text hover:text-primaryMovies transition truncate">
                        {item.title}
                      </Link>
                      <div className="text-[11px] text-muted mt-1 flex items-center justify-between">
                        <span>{item.media_type === 'movie' ? (isRtl ? 'فيلم' : 'Movie') : (isRtl ? 'مسلسل' : 'Series')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    );
  }

  // All Collections Overview List View
  return (
    <div className="min-h-screen bg-bg">
      <TopBar variant="movies" />
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text flex items-center gap-3">
              <Layers className="text-primaryMovies" size={28} />
              <span>{isRtl ? 'مجموعات وقوائم الأفلام' : 'Movie Collections'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted mt-1">
              {isRtl ? 'تشغيل سلاسل الأفلام والمجموعات متتالية كقوائم تشغيل سينمائية' : 'Curated movie collections and playlists'}
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primaryMovies text-white text-xs font-bold hover:brightness-110 active:scale-95 transition shadow-lg shadow-primaryMovies/25"
            >
              <Plus size={16} />
              <span>{isRtl ? 'إنشاء مجموعة جديدة' : 'New Collection'}</span>
            </button>
          )}
        </div>

        {/* Create Collection Modal */}
        {showCreateModal && (
          <div className="mb-8 p-6 rounded-3xl bg-surface border border-border shadow-xl animate-fadeIn">
            <h3 className="font-bold text-base text-text mb-4">
              {isRtl ? 'إنشاء مجموعة أفلام جديدة' : 'Create New Collection'}
            </h3>
            <div className="space-y-3 max-w-lg">
              <input
                value={newCollectionName}
                onChange={e => setNewCollectionName(e.target.value)}
                placeholder={isRtl ? 'اسم المجموعة (مثال: ماراثون أفلام هاري بوتر)' : 'Collection name (e.g. Marvel Marathon)'}
                className="w-full h-11 px-4 rounded-xl bg-surfaceHover border border-border text-xs sm:text-sm text-text focus:outline-none focus:border-primaryMovies transition"
              />
              <input
                value={newCollectionDesc}
                onChange={e => setNewCollectionDesc(e.target.value)}
                placeholder={isRtl ? 'وصف المجموعة (اختياري)' : 'Description (optional)'}
                className="w-full h-11 px-4 rounded-xl bg-surfaceHover border border-border text-xs sm:text-sm text-text focus:outline-none focus:border-primaryMovies transition"
              />
              <div className="flex items-center gap-2 pt-2">
                <button
                  disabled={!newCollectionName.trim() || createMut.isPending}
                  onClick={() => createMut.mutate()}
                  className="px-5 py-2.5 rounded-xl bg-primaryMovies text-white font-bold text-xs disabled:opacity-40 transition shadow-md"
                >
                  {createMut.isPending ? (isRtl ? 'جاري الإنشاء...' : 'Creating...') : (isRtl ? 'إنشاء المجموعة' : 'Create')}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-surfaceHover hover:bg-white/10 text-muted hover:text-text font-medium text-xs transition"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Collections Grid */}
        {isLoadingAll ? (
          <div className="flex items-center justify-center h-48"><Spinner /></div>
        ) : collections.length === 0 ? (
          <div className="text-center py-16 text-muted border border-dashed border-border rounded-3xl p-8">
            <Layers size={36} className="mx-auto mb-3 opacity-40 text-primaryMovies" />
            <div className="font-semibold text-sm text-text mb-1">
              {isRtl ? 'لا توجد مجموعات بعد' : 'No Collections Found'}
            </div>
            <p className="text-xs text-muted max-w-sm mx-auto">
              {isRtl ? 'المجموعات تمكنك من ترتيب وتشغيل عدة أفلام متتالية بكل سهولة.' : 'Collections let you play series of movies consecutively.'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map(c => (
              <div
                key={c.id}
                className="group p-5 rounded-2xl bg-surface border border-border hover:border-primaryMovies/50 transition-all shadow-md hover:shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <Link to={`/collections/${c.id}`} className="font-bold text-base text-text hover:text-primaryMovies transition">
                      {c.name}
                    </Link>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-surfaceHover text-muted font-mono flex-shrink-0">
                      {c.itemsCount || 0} {isRtl ? 'عنصر' : 'items'}
                    </span>
                  </div>
                  <p className="text-xs text-muted line-clamp-2 mb-4 leading-relaxed">
                    {c.description || (isRtl ? 'مجموعة أفلام متتالية' : 'Continuous playlist collection')}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/50">
                  <Link
                    to={`/collections/${c.id}`}
                    className="text-xs text-muted hover:text-text font-semibold transition"
                  >
                    {isRtl ? 'عرض العناصر' : 'View Items'}
                  </Link>

                  <Link
                    to={`/collections/${c.id}`}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primaryMovies text-white text-xs font-bold hover:brightness-110 active:scale-95 transition shadow-sm"
                  >
                    <Play size={13} fill="white" />
                    <span>{isRtl ? 'تشغيل' : 'Play'}</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
