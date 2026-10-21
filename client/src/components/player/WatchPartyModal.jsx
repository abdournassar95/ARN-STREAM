import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, X, Plus, LogIn, Copy, Check, Sparkles, Tv } from 'lucide-react';
import client from '../../api/client';

export default function WatchPartyModal({
  isOpen,
  onClose,
  mediaType,
  mediaId,
  mediaTitle,
  currentTime = 0,
  isPlaying = false,
  onJoinRoom
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'join'
  const [roomCode, setRoomCode] = useState('');
  const [createdRoom, setCreatedRoom] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCreateRoom = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await client.post('/syncplay/create', {
        mediaType,
        mediaId,
        mediaTitle,
        initialTime: Math.floor(currentTime),
        isPlaying
      });

      if (res.data?.success && res.data.roomId) {
        setCreatedRoom(res.data.roomId);
      }
    } catch (err) {
      setError(isAr ? 'تعذر إنشاء الغرفة، يرجى المحاولة لاحقاً' : 'Failed to create room');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinWithCode = (e) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (!code) return;
    onJoinRoom(code);
    onClose();
  };

  const handleStartWatching = () => {
    if (!createdRoom) return;
    onJoinRoom(createdRoom);
    onClose();
  };

  const handleCopyLink = () => {
    if (!createdRoom) return;
    const url = `${window.location.origin}${window.location.pathname}?roomId=${createdRoom}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-white/15 p-6 shadow-2xl text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 end-4 p-1.5 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition"
        >
          <X size={18} />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white shadow-lg">
            <Users size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold">
              {isAr ? 'المشاهدة الجماعية (Watch Party)' : 'ARN Watch Party'}
            </h3>
            <p className="text-xs text-white/60">
              {isAr ? 'شاهد مع أصدقائك في نفس اللحظة مع تزامن كامل ودردشة' : 'Watch with friends with full synchronization and live chat'}
            </p>
          </div>
        </div>

        {/* Tabs: Create / Join */}
        {!createdRoom && (
          <div className="flex rounded-xl bg-black/40 p-1 mb-5 border border-white/10">
            <button
              onClick={() => { setActiveTab('create'); setError(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                activeTab === 'create'
                  ? 'bg-sky-500 text-white shadow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {isAr ? 'إنشاء غرفة جديدة' : 'Create Room'}
            </button>
            <button
              onClick={() => { setActiveTab('join'); setError(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                activeTab === 'join'
                  ? 'bg-sky-500 text-white shadow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {isAr ? 'الانضمام برمز' : 'Join via Code'}
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-xs">
            {error}
          </div>
        )}

        {/* Tab 1: Create Room */}
        {activeTab === 'create' && !createdRoom && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/80 space-y-1">
              <div className="font-bold text-white line-clamp-1">{mediaTitle}</div>
              <div className="text-[11px] text-sky-400">
                {isAr ? 'ستكون أنت المضيف (Host) وتتحكم بالتشغيل' : 'You will be the Host and control playback'}
              </div>
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-sky-500/25 transition flex items-center justify-center gap-2"
            >
              <Sparkles size={16} />
              <span>{isSubmitting ? (isAr ? 'جاري الإنشاء...' : 'Creating...') : (isAr ? 'إنشاء الغرفة الآن' : 'Create Watch Party')}</span>
            </button>
          </div>
        )}

        {/* Created Room Success State */}
        {createdRoom && (
          <div className="space-y-4 text-center animate-fadeIn">
            <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 space-y-2">
              <span className="text-xs text-sky-300 font-semibold">{isAr ? 'رمز الغرفة الخاص بك:' : 'Your Room Code:'}</span>
              <div className="text-2xl font-black font-mono tracking-widest text-white select-all">
                {createdRoom}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copied ? (isAr ? 'تم نسخ الرابط' : 'Link Copied') : (isAr ? 'نسخ رابط الدعوة' : 'Copy Invite Link')}</span>
              </button>

              <button
                onClick={handleStartWatching}
                className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-bold text-white transition shadow-md flex items-center justify-center gap-1.5"
              >
                <Tv size={14} />
                <span>{isAr ? 'بدء المشاهدة' : 'Start Watching'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Join via Code */}
        {activeTab === 'join' && !createdRoom && (
          <form onSubmit={handleJoinWithCode} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-2">
                {isAr ? 'أدخل رمز الغرفة (مثال: ARN-1A2B3C)' : 'Enter Room Code (e.g. ARN-1A2B3C)'}
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ARN-XXXX"
                className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white font-mono text-center tracking-widest text-lg uppercase focus:outline-none focus:border-sky-400"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!roomCode.trim()}
              className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white font-bold text-sm shadow-lg transition flex items-center justify-center gap-2"
            >
              <LogIn size={16} />
              <span>{isAr ? 'الانضمام إلى الغرفة' : 'Join Room'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
