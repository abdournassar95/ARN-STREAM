import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Users, 
  X, 
  LogIn, 
  Sparkles, 
  Play, 
  Tv, 
  Film, 
  Radio, 
  RefreshCw,
  Check,
  AlertCircle
} from 'lucide-react';
import client from '../../api/client';

export default function JoinWatchPartyModal({ isOpen, onClose }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'active'
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [activeRooms, setActiveRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  // Fetch active rooms
  const fetchActiveRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const res = await client.get('/syncplay/active');
      if (res.data?.success) {
        setActiveRooms(res.data.rooms || []);
      }
    } catch (e) {
      console.warn('[SyncPlay] Failed to fetch active rooms:', e);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      fetchActiveRooms();
      const interval = setInterval(fetchActiveRooms, 6000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleJoinWithCode = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode) return;

    // Ensure format like ARN-XXXX or accept raw
    const formattedCode = cleanCode.startsWith('ARN-') ? cleanCode : (cleanCode.length === 6 ? `ARN-${cleanCode}` : cleanCode);

    setIsLoading(true);
    setError(null);

    try {
      const res = await client.get(`/syncplay/room/${formattedCode}`);
      if (res.data?.success && res.data.room) {
        const room = res.data.room;
        onClose();
        // Redirect directly to the player for this video with roomId attached
        navigate(`/watch/${room.mediaType || 'movie'}/${room.mediaId}?roomId=${room.id}`);
      } else {
        setError(isAr ? 'لم يتم العثور على الغرفة أو أنها غير متاحة حالياً.' : 'Room not found or no longer active.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || (isAr ? 'كود الغرفة غير صحيح أو أن الغرفة انتهت صلاحيتها.' : 'Invalid room code or expired.');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoomDirect = (room) => {
    onClose();
    navigate(`/watch/${room.mediaType || 'movie'}/${room.mediaId}?roomId=${room.id}`);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-3xl bg-slate-900/95 border border-white/20 p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.85)] text-white backdrop-blur-2xl"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 end-5 p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition"
          title={isAr ? 'إغلاق' : 'Close'}
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <Users size={24} />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold flex items-center gap-2">
              <span>{isAr ? 'المشاهدة الجماعية' : 'ARN Watch Party'}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-sky-500 to-indigo-500 text-white">
                SyncPlay
              </span>
            </h3>
            <p className="text-xs text-white/60 mt-0.5">
              {isAr 
                ? 'شاهد مع أصدقائك في نفس اللحظة مع تزامن كامل للصوت والصورة والدردشة' 
                : 'Watch in real-time with synchronized playback and live chat'}
            </p>
          </div>
        </div>

        {/* Tabs: Code vs Active Rooms */}
        <div className="flex p-1 rounded-2xl bg-white/5 border border-white/10 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'code'
                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <LogIn size={15} />
            <span>{isAr ? 'كود الغرفة' : 'Room Code'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 relative ${
              activeTab === 'active'
                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio size={15} className={activeRooms.length > 0 ? 'text-emerald-400' : ''} />
            <span>{isAr ? 'الغرف النشطة' : 'Active Rooms'}</span>
            {activeRooms.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950">
                {activeRooms.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Join with Code */}
        {activeTab === 'code' && (
          <form onSubmit={handleJoinWithCode} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-2">
                {isAr ? 'أدخل كود غرفة المشاهدة:' : 'Enter Watch Party Room Code:'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="e.g. ARN-EA58E7"
                  maxLength={12}
                  autoFocus
                  className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-mono text-center tracking-widest text-base sm:text-lg uppercase focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 shadow-inner placeholder-white/30"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 animate-fadeIn">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !roomCode.trim()}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:brightness-110 active:scale-98 disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 transition cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>{isAr ? 'جاري التحقق والانضمام...' : 'Connecting...'}</span>
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>{isAr ? 'الانضمام للمشاهدة الآن' : 'Join Watch Party'}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Tab 2: Active Rooms List */}
        {activeTab === 'active' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-white/60 px-1">
              <span>{isAr ? 'الغرف التي تبث حالياً في الشبكة' : 'Rooms currently active on this server'}</span>
              <button
                type="button"
                onClick={fetchActiveRooms}
                disabled={isLoadingRooms}
                className="hover:text-white transition flex items-center gap-1"
                title={isAr ? 'تحديث' : 'Refresh'}
              >
                <RefreshCw size={12} className={isLoadingRooms ? 'animate-spin' : ''} />
                <span>{isAr ? 'تحديث' : 'Refresh'}</span>
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pe-1 scrollbar-thin">
              {activeRooms.length === 0 ? (
                <div className="py-10 text-center text-white/40 flex flex-col items-center justify-center">
                  <Tv size={36} className="mb-2.5 opacity-30" />
                  <p className="text-xs font-medium">
                    {isAr ? 'لا توجد غرف نشطة حالياً في السيرفر' : 'No active watch party rooms right now'}
                  </p>
                  <p className="text-[11px] text-white/30 mt-1">
                    {isAr 
                      ? 'يمكنك إنشاء غرفة جديدة أثناء تشغيل أي فيلم ومشاركة الكود مع أصدقائك!' 
                      : 'You can create a room while watching any movie and share the code!'}
                  </p>
                </div>
              ) : (
                activeRooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => handleJoinRoomDirect(room)}
                    className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-sky-500/40 transition flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white font-bold flex-shrink-0 shadow">
                        {room.mediaType === 'series' ? <Tv size={18} /> : <Film size={18} />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-sky-300 transition">
                          {room.mediaTitle || (isAr ? 'عرض فيديو' : 'Video')}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-white/50 mt-0.5">
                          <span className="font-mono text-sky-400 font-semibold">{room.id}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {isAr ? `${room.memberCount} مشاركين` : `${room.memberCount} members`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center gap-1.5 shadow transition flex-shrink-0"
                    >
                      <Play size={12} className="fill-white" />
                      <span>{isAr ? 'انضمام' : 'Join'}</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
