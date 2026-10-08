import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPlaylists, createPlaylist, addTrackToPlaylist, addBatchToPlaylist } from '../../api/client';
import { useTranslation } from 'react-i18next';
import { ListPlus, Plus, Check, Music2 } from 'lucide-react';

/**
 * AddToPlaylist - A dropdown menu component for adding tracks to playlists.
 * 
 * Usage modes:
 * - Single track:  <AddToPlaylist trackId={123} />
 * - Album:         <AddToPlaylist albumId={456} />
 * - Artist:        <AddToPlaylist artistId={789} />
 * - Multiple:      <AddToPlaylist trackIds={[1,2,3]} />
 * 
 * Props:
 *   - trackId:   single track id
 *   - trackIds:  array of track ids
 *   - albumId:   add entire album
 *   - artistId:  add all artist tracks
 *   - iconSize:  icon size (default 16)
 *   - className: additional wrapper classes
 *   - variant:   'icon' (default) | 'button'
 *   - label:     button label when variant='button'
 */
export default function AddToPlaylist({ 
  trackId, trackIds, albumId, artistId, libraryId,
  iconSize = 16, className = '', variant = 'icon', label 
}) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(null); // playlist id that was just added to
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const ref = useRef(null);
  const qc = useQueryClient();

  const { data: playlists = [] } = useQuery({ 
    queryKey: ['playlists', libraryId], 
    queryFn: () => fetchPlaylists(libraryId),
    enabled: open 
  });

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAdd = async (playlistId) => {
    try {
      if (trackId) {
        // Single track
        await addTrackToPlaylist(playlistId, trackId);
      } else {
        // Batch: album, artist, or multiple tracks
        const body = {};
        if (albumId) body.album_id = albumId;
        else if (artistId) body.artist_id = artistId;
        else if (trackIds?.length) body.track_ids = trackIds;
        
        await addBatchToPlaylist(playlistId, body);
      }
      
      setAdded(playlistId);
      setTimeout(() => setAdded(null), 1500);
      qc.invalidateQueries({ queryKey: ['playlists'] });
      qc.invalidateQueries({ queryKey: ['playlist', String(playlistId)] });
    } catch (err) {
      console.error('Failed to add to playlist:', err);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const data = await createPlaylist({
        libraryId: libraryId ? Number(libraryId) : null,
        name: newName.trim(),
        type: 'manual'
      });
      setNewName('');
      setCreating(false);
      qc.invalidateQueries({ queryKey: ['playlists'] });
      // Add to the newly created playlist
      if (data?.id) {
        setTimeout(() => handleAdd(data.id), 200);
      }
    } catch (err) {
      console.error('Failed to create playlist:', err);
    }
  };

  const triggerBtn = variant === 'button' ? (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surfaceHover hover:bg-surface border border-border text-sm font-medium transition hover:border-primaryMusic/40 ${className}`}
      title={isRtl ? 'أضف إلى قائمة تشغيل' : 'Add to playlist'}
    >
      <ListPlus size={iconSize} className="text-primaryMusic" />
      <span>{label || (isRtl ? 'أضف لقائمة تشغيل' : 'Add to Playlist')}</span>
    </button>
  ) : (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
      className={`w-8 h-8 rounded-lg flex items-center justify-center hover:bg-tx/10 transition text-muted hover:text-primaryMusic ${className}`}
      title={isRtl ? 'أضف إلى قائمة تشغيل' : 'Add to playlist'}
    >
      <ListPlus size={iconSize} />
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      {triggerBtn}
      
      {open && (
        <div className="absolute bottom-full end-0 mb-2 w-56 bg-surface/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border/50">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider">
              {isRtl ? 'أضف إلى قائمة تشغيل' : 'Add to Playlist'}
            </div>
          </div>

          {/* Playlist List */}
          <div className="max-h-48 overflow-y-auto py-1">
            {playlists.length === 0 && !creating ? (
              <div className="text-center py-6 px-4">
                <Music2 size={20} className="text-muted mx-auto mb-2" />
                <p className="text-xs text-muted">{isRtl ? 'لا توجد قوائم تشغيل' : 'No playlists yet'}</p>
              </div>
            ) : (
              playlists.map(pl => (
                <button
                  key={pl.id}
                  onClick={(e) => { e.stopPropagation(); handleAdd(pl.id); }}
                  className="w-full text-start px-4 py-2.5 text-sm hover:bg-surfaceHover flex items-center gap-3 transition group"
                >
                  {added === pl.id ? (
                    <Check size={14} className="text-emerald-400 flex-shrink-0" />
                  ) : (
                    <Plus size={14} className="text-primaryMusic flex-shrink-0 opacity-0 group-hover:opacity-100 transition" />
                  )}
                  <span className="truncate flex-1">{pl.name}</span>
                  <span className="text-[10px] text-muted">{pl.tracksCount}</span>
                </button>
              ))
            )}
          </div>

          {/* Create New */}
          <div className="border-t border-border/50">
            {creating ? (
              <div className="p-2 flex gap-2">
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder={isRtl ? 'اسم القائمة...' : 'Name...'}
                  className="flex-1 h-8 px-3 rounded-lg bg-bg border border-border text-xs outline-none focus:border-primaryMusic transition"
                  autoFocus
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); handleCreate(); }}
                  className="px-3 h-8 rounded-lg bg-primaryMusic text-black text-xs font-semibold hover:brightness-110 transition"
                >
                  {isRtl ? 'إنشاء' : 'OK'}
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setCreating(true); }}
                className="w-full px-4 py-3 text-start text-sm text-primaryMusic hover:bg-surfaceHover flex items-center gap-2 transition font-medium"
              >
                <Plus size={14} />
                <span>{isRtl ? 'قائمة تشغيل جديدة' : 'New Playlist'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
