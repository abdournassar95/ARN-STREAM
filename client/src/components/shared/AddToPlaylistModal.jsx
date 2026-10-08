import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { X, Plus, ListMusic, Check, Loader2 } from 'lucide-react';
import { fetchPlaylists, createPlaylist } from '../../api/client';
import client from '../../api/client';

export default function AddToPlaylistModal({ isOpen, onClose, trackIds = [], libraryId, isQuran = false, onSuccess }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const qc = useQueryClient();

  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(trackIds.length === 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (trackIds.length === 0) {
      setIsCreatingNew(true);
    }
  }, [trackIds.length, isOpen]);

  const { data: playlists = [], isLoading } = useQuery({
    queryKey: ['playlists', libraryId],
    queryFn: () => fetchPlaylists(libraryId),
    enabled: isOpen
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    setIsSubmitting(true);
    try {
      let targetId = selectedPlaylistId;

      // If creating new playlist first
      if (isCreatingNew) {
        if (!newPlaylistName.trim()) {
          setErrorMsg(isRtl ? 'يرجى كتابة اسم القائمة' : 'Please enter playlist name');
          setIsSubmitting(false);
          return;
        }
        const created = await createPlaylist({
          libraryId: libraryId ? Number(libraryId) : null,
          name: newPlaylistName.trim(),
          description: isQuran ? 'قائمة تلاوات مختارة' : 'Custom playlist',
          type: 'manual'
        });
        targetId = created.id;
      }

      if (!targetId) {
        setErrorMsg(isRtl ? 'يرجى اختيار قائمة تشغيل' : 'Please select a playlist');
        setIsSubmitting(false);
        return;
      }

      // Add tracks in bulk if any exist
      if (trackIds.length > 0) {
        await client.post(`/playlists/${targetId}/batch`, {
          track_ids: trackIds
        });
      }

      await qc.invalidateQueries({ queryKey: ['playlists'] });
      await qc.invalidateQueries({ queryKey: ['playlist', String(targetId)] });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to add to playlist:', err);
      setErrorMsg(isRtl ? 'حدث خطأ أثناء الإضافة للقائمة' : 'Failed to add tracks to playlist');
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerTitle = trackIds.length === 0
    ? (isQuran ? (isRtl ? 'إنشاء قائمة تلاوة جديدة' : 'New Recitation Playlist') : (isRtl ? 'إنشاء قائمة تشغيل جديدة' : 'New Playlist'))
    : (isQuran ? (isRtl ? 'إضافة إلى قائمة تلاوة' : 'Add to Recitation Playlist') : (isRtl ? 'إضافة إلى قائمة تشغيل' : 'Add to Playlist'));

  const headerSubtitle = trackIds.length === 0
    ? (isQuran ? (isRtl ? 'أدخل اسم قائمة التلاوة لإنشائها' : 'Enter name to create recitation playlist') : (isRtl ? 'أدخل اسم القائمة لإنشائها' : 'Enter name to create playlist'))
    : (isRtl ? `تم تحديد ${trackIds.length} ${isQuran ? 'تلاوة' : 'مقطع'}` : `${trackIds.length} tracks selected`);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-surface/95 border border-white/15 rounded-3xl p-6 shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primaryMusic/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primaryMusic/20 border border-primaryMusic/30 flex items-center justify-center text-primaryMusic shadow-sm">
              <ListMusic size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-text">
                {headerTitle}
              </h3>
              <p className="text-xs text-muted">
                {headerSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-surfaceHover transition"
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-400">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Toggle existing vs new */}
          <div className="flex rounded-xl bg-surfaceHover/80 p-1 border border-border/40">
            <button
              type="button"
              onClick={() => setIsCreatingNew(false)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                !isCreatingNew ? 'bg-primaryMusic text-black shadow-sm' : 'text-muted hover:text-text'
              }`}
            >
              {isRtl ? 'قائمة حالية' : 'Existing List'}
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingNew(true)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                isCreatingNew ? 'bg-primaryMusic text-black shadow-sm' : 'text-muted hover:text-text'
              }`}
            >
              {isRtl ? '+ قائمة جديدة' : '+ New List'}
            </button>
          </div>

          {!isCreatingNew ? (
            /* Select existing playlist */
            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-none pr-1">
              {isLoading ? (
                <div className="py-8 text-center text-xs text-muted flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin text-primaryMusic" />
                  <span>{isRtl ? 'جاري تحميل القوائم...' : 'Loading playlists...'}</span>
                </div>
              ) : playlists.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted">
                  <p>{isRtl ? 'لا توجد قوائم تشغيل سابقة.' : 'No existing playlists.'}</p>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(true)}
                    className="mt-2 text-primaryMusic font-semibold hover:underline"
                  >
                    {isRtl ? 'إنشاء قائمة جديدة الآن' : 'Create a new list now'}
                  </button>
                </div>
              ) : (
                playlists.map(pl => {
                  const isSelected = selectedPlaylistId === pl.id;
                  return (
                    <div
                      key={pl.id}
                      onClick={() => setSelectedPlaylistId(pl.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer border transition-all ${
                        isSelected
                          ? 'bg-primaryMusic/15 border-primaryMusic/50 text-primaryMusic shadow-sm'
                          : 'bg-surface/50 hover:bg-surfaceHover border-border/30 text-text'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{pl.name}</div>
                        <div className="text-[11px] text-muted">{pl.tracksCount || 0} {isQuran ? 'تلاوة' : 'مقطع'}</div>
                      </div>
                      {isSelected && <Check size={16} className="text-primaryMusic flex-shrink-0" />}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Create new playlist input */
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                {isQuran ? (isRtl ? 'اسم قائمة التلاوة الجديدة:' : 'New Recitation List Name:') : (isRtl ? 'اسم قائمة التشغيل الجديدة:' : 'New Playlist Name:')}
              </label>
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder={isQuran ? (isRtl ? 'مثال: تلاوات الفجر الخاشعة...' : 'e.g. Dawn Recitations...') : (isRtl ? 'اسم القائمة...' : 'Playlist name...')}
                className="w-full h-11 px-4 rounded-xl bg-surfaceHover/80 border border-border/50 text-sm text-text focus:outline-none focus:border-primaryMusic transition"
                autoFocus
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || (!isCreatingNew && !selectedPlaylistId) || (isCreatingNew && !newPlaylistName.trim())}
              className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-98 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Check size={16} />
                  <span>
                    {trackIds.length === 0 
                      ? (isRtl ? 'إنشاء القائمة' : 'Create Playlist') 
                      : (isRtl ? 'تأكيد وإضافة' : 'Confirm & Add')}
                  </span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 h-11 rounded-2xl bg-surfaceHover text-muted hover:text-text text-sm font-semibold transition"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
