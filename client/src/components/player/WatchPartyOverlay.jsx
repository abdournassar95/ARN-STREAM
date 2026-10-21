import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Users, 
  MessageSquare, 
  X, 
  Send, 
  Copy, 
  Check, 
  Crown, 
  LogOut, 
  Share2, 
  Sparkles 
} from 'lucide-react';

const EMOJI_OPTIONS = ['❤️', '🔥', '😂', '🎉', '👏', '🍿', '😱', '😍'];

export default function WatchPartyOverlay({
  roomId,
  isHost,
  members = [],
  messages = [],
  onSendMessage,
  onSendEmoji,
  onLeaveParty,
  floatingEmojis = []
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [copied, setCopied] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesContainerRef = useRef(null);

  // Auto scroll chat internally without causing page displacement
  useEffect(() => {
    if (isChatOpen) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
      setUnreadCount(0);
    } else if (messages.length > 0) {
      setUnreadCount((prev) => prev + 1);
    }
  }, [messages, isChatOpen]);

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?roomId=${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <>
      {/* ── 1. Floating Emojis Animation Canvas ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
        {floatingEmojis.map((item) => (
          <div
            key={item.id}
            className="absolute bottom-16 text-3xl sm:text-4xl animate-floatEmoji drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] select-none"
            style={{
              left: `${item.left}%`,
              animationDuration: `${item.duration}s`
            }}
          >
            {item.emoji}
          </div>
        ))}
      </div>

      {/* ── 2. Top-Center Room Bar (Always centered & clearly visible) ── */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/95 backdrop-blur-xl border border-sky-500/40 text-white shadow-[0_8px_30px_rgba(0,0,0,0.7)] pointer-events-auto select-none"
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-sky-300 font-mono tracking-wider">
            {roomId}
          </span>
        </div>

        <div className="h-3.5 w-px bg-white/20 mx-1" />

        {/* Member Avatars & Count */}
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1.5 rtl:space-x-reverse overflow-hidden">
            {members.slice(0, 4).map((m, idx) => (
              <div
                key={m.id || idx}
                title={m.username}
                className="w-5 h-5 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 border border-slate-900 flex items-center justify-center text-[10px] font-bold text-white shadow"
              >
                {m.avatar ? (
                  <img src={m.avatar} alt={m.username} className="w-full h-full object-cover rounded-full" />
                ) : (
                  (m.username || 'U')[0].toUpperCase()
                )}
              </div>
            ))}
          </div>
          <span className="text-[11px] font-semibold text-white/80">
            {members.length}
          </span>
        </div>

        <div className="h-3.5 w-px bg-white/20 mx-1" />

        {/* Copy Invite Link */}
        <button
          onClick={handleCopyLink}
          title={isAr ? 'نسخ رابط الدعوة' : 'Copy Invite Link'}
          className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition flex items-center gap-1 text-[11px] font-medium"
        >
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          <span className="hidden sm:inline">{copied ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'دعوة' : 'Invite')}</span>
        </button>

        {/* Chat Toggle Button */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          title={isAr ? 'المحادثة الجماعية' : 'Live Chat'}
          className={`relative p-1.5 rounded-full transition flex items-center justify-center ${
            isChatOpen ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/50' : 'hover:bg-white/10 text-white/80 hover:text-white'
          }`}
        >
          <MessageSquare size={14} />
          {!isChatOpen && unreadCount > 0 && (
            <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-red-500 text-[9px] font-black flex items-center justify-center text-white ring-2 ring-slate-900 animate-bounce">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Leave Party Button */}
        <button
          onClick={onLeaveParty}
          title={isAr ? 'مغادرة الغرفة' : 'Leave Party'}
          className="p-1 rounded-full hover:bg-red-500/20 text-white/70 hover:text-red-400 transition"
        >
          <LogOut size={13} />
        </button>
      </div>

      {/* ── 3. Quick Emoji Reactions Floating Bar (Visible when chat is closed) ── */}
      {!isChatOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-20 start-4 z-[55] flex items-center gap-1 p-1 rounded-full bg-slate-900/90 backdrop-blur-md border border-white/20 shadow-xl pointer-events-auto"
        >
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendEmoji(emoji)}
              className="w-8 h-8 rounded-full hover:bg-white/15 active:scale-125 transition-transform flex items-center justify-center text-lg select-none"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* ── 4. Collapsible Live Chat Drawer ── */}
      {isChatOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-16 bottom-24 ${
            isAr ? 'start-3 sm:start-4' : 'end-3 sm:end-4'
          } w-72 sm:w-80 rounded-2xl bg-slate-950/95 backdrop-blur-2xl border border-sky-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col z-[65] overflow-hidden pointer-events-auto animate-fadeIn`}
        >
          {/* Header */}
          <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/[0.04]">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-sky-400" />
              <h4 className="text-xs font-bold text-white">
                {isAr ? 'المحادثة اللحظية' : 'Watch Party Chat'}
              </h4>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition"
              title={isAr ? 'إغلاق الدردشة' : 'Close chat'}
            >
              <X size={15} />
            </button>
          </div>

          {/* Messages Feed */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin text-xs"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-white/40 p-4">
                <Sparkles size={24} className="mb-2 text-sky-400/60" />
                <p>{isAr ? 'ابدأ الدردشة مع أصدقائك أثناء المشاهدة!' : 'Start chatting with your friends!'}</p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="flex flex-col gap-0.5 animate-fadeIn">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sky-300 text-[11px]">{m.user?.username || 'مستخدم'}</span>
                    <span className="text-[9px] text-white/40">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-xl bg-white/10 text-white/90 leading-relaxed break-words w-fit max-w-[90%]">
                    {m.text}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick Emojis inside Chat Bar */}
          <div className="px-2 py-1 flex items-center justify-between border-t border-white/10 bg-white/[0.02]">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onSendEmoji(emoji)}
                className="w-7 h-7 rounded-lg hover:bg-white/10 active:scale-125 transition-transform flex items-center justify-center text-sm select-none"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSubmit} className="p-2 border-t border-white/10 bg-white/[0.03] flex items-center gap-1.5">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isAr ? 'اكتب رسالتك...' : 'Type a message...'}
              className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 text-xs focus:outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white transition flex items-center justify-center cursor-pointer shadow-sm"
              title={isAr ? 'إرسال' : 'Send'}
            >
              <Send size={14} className={isAr ? 'rotate-180' : ''} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
