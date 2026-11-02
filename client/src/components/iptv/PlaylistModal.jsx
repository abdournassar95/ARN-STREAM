import React, { useState } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import {
  X,
  KeyRound,
  Link2,
  FileUp,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Trash2,
  Server,
  UserCheck,
  Layers,
  Download,
  Upload,
  Sparkles,
} from 'lucide-react';

const SAMPLE_M3U_CONTENT = `#EXTM3U
#EXTINF:-1 group-title="القنوات الإخبارية",الجزيرة الإخبارية FHD
https://live-hls-apps-aja-fa.getaj.net/AJA/01.m3u8
#EXTINF:-1 group-title="القنوات الإخبارية",العربية FHD
https://live.alarabiya.net/alarabiapublish/alarabiya.smil/playlist.m3u8
#EXTINF:-1 group-title="القنوات الإخبارية",سكاي نيوز عربية FHD
https://live-stream.skynewsarabia.com/c-horizontal-channel/horizontal-stream/index.m3u8
#EXTINF:-1 group-title="القنوات الرياضية",الكويت الرياضية KTV Sport FHD
https://kwtspta.cdn.mangomolo.com/sp/smil:sp.stream.smil/chunklist.m3u8
#EXTINF:-1 group-title="قنوات الترفيه والأفلام",إم بي سي 1 — MBC 1 FHD
https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-1-na/eec141533c90dd34722c503a296dd0d8/index.m3u8
#EXTINF:-1 group-title="قنوات الترفيه والأفلام",شاهد أفلام — Shahid Aflam FHD
https://shd-amg-fast.edgenextcdn.net/tx001/playlist.m3u8`;

export const PlaylistModal = ({
  isOpen,
  onClose,
  playlists,
  activePlaylistId,
  onSelectPlaylist,
  onDeletePlaylist,
  onImportSuccess,
  onLoadBuiltinCatalog,
}) => {
  const theme = useSettingsStore(s => s.theme);
  const isDark = theme !== 'light';

  const [activeTab, setActiveTab] = useState('fg');
  const [fgCode, setFgCode] = useState('232425');
  const [m3uName, setM3uName] = useState('قائمتي المخصصة M3U');
  const [m3uUrl, setM3uUrl] = useState('');
  const [m3uRawText, setM3uRawText] = useState('');

  // Xtream Codes State
  const [xtreamHost, setXtreamHost] = useState('');
  const [xtreamUsername, setXtreamUsername] = useState('');
  const [xtreamPassword, setXtreamPassword] = useState('');
  const [xtreamPlaylistName, setXtreamPlaylistName] = useState('اشتراك Xtream Codes');
  const [xtreamIncludeVod, setXtreamIncludeVod] = useState(true);
  const [xtreamIncludeSeries, setXtreamIncludeSeries] = useState(true);
  const [xtreamAccountInfo, setXtreamAccountInfo] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleTestXtreamAccount = async () => {
    if (!xtreamHost.trim() || !xtreamUsername.trim() || !xtreamPassword.trim()) {
      setErrorMsg('يرجى ملء كافة حقول السيرفر واسم المستخدم وكلمة المرور.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setStatusMessage('جاري الاتصال بسيرفر Xtream والتحقق من صلاحية الحساب...');

    try {
      const resp = await fetch('/api/live/xtream/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: xtreamHost.trim(),
          username: xtreamUsername.trim(),
          password: xtreamPassword.trim(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'فشلت المصادقة مع سيرفر Xtream');
      }
      setXtreamAccountInfo(data.userInfo);
      setStatusMessage(`الحساب صالح ونشط! ينتهي في: ${data.userInfo.expDate} · الحد الأقصى للأجهزة: ${data.userInfo.maxConnections}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء فحص الحساب');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncXtream = async (e) => {
    e.preventDefault();
    if (!xtreamHost.trim() || !xtreamUsername.trim() || !xtreamPassword.trim()) {
      setErrorMsg('يرجى إدخال عنوان السيرفر واسم المستخدم وكلمة المرور.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setStatusMessage('جاري جلب القنوات المباشرة، الأفلام VOD، والمسلسلات من Xtream...');

    try {
      const resp = await fetch('/api/live/xtream/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: xtreamHost.trim(),
          username: xtreamUsername.trim(),
          password: xtreamPassword.trim(),
          playlistName: xtreamPlaylistName.trim() || `Xtream (${xtreamUsername.trim()})`,
          includeVod: xtreamIncludeVod,
          includeSeries: xtreamIncludeSeries,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'تعذر استيراد ومزامنة حساب Xtream');
      }
      if (data.accountInfo) {
        setXtreamAccountInfo(data.accountInfo);
      }
      setStatusMessage(`تم بنجاح استيراد ${data.channels.length} قناة ومحتوى من سيرفر Xtream!`);
      onImportSuccess(data.playlist, data.categories, data.channels);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'فشل استيراد قائمة Xtream');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleActivateFgCode = async (e) => {
    e.preventDefault();
    if (!fgCode.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    setStatusMessage('جاري تشفير الطلب بـ AES-128-CBC والاتصال بمحرك دراما لايف...');

    try {
      const resp = await fetch('/api/live/fg/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: fgCode.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'فشل تفعيل الكود');
      }
      setStatusMessage(`تم تفعيل الكود ${fgCode} واستيراد ${data.channels.length} قناة حية بنجاح!`);
      onImportSuccess(data.playlist, data.categories, data.channels);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء تفعيل الكود');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportM3u = async (e) => {
    e.preventDefault();
    if (!m3uUrl.trim() && !m3uRawText.trim()) {
      setErrorMsg('يرجى إدخال رابط M3U8 أو لصق محتوى ملف #EXTM3U.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setStatusMessage('جاري تحليل قائمة M3U واستخراج الفئات والقنوات...');

    try {
      const resp = await fetch('/api/live/m3u/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: m3uName.trim() || 'قائمة M3U مضافة',
          url: m3uUrl.trim() || undefined,
          content: m3uRawText.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'تعذر تحليل قائمة M3U');
      }
      setStatusMessage(`تم استيراد ${data.channels.length} قناة في ${data.categories.length} تصنيف!`);
      onImportSuccess(data.playlist, data.categories, data.channels);
      setM3uRawText('');
      setM3uUrl('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'فشل استيراد ملف M3U');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('⚠️ حجم الملف كبير جداً (الحد الأقصى 15 ميجابايت).');
      return;
    }

    setM3uName(file.name.replace(/\.(m3u8?|txt)$/i, ''));
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const text = reader.result.trim();
        if (!text.includes('#EXTM3U')) {
          setErrorMsg('⚠️ تنبيه: الملف المحدد لا يحتوي على ترويسة #EXTM3U القياسية لقوائم البث.');
        } else {
          setErrorMsg(null);
        }
        setM3uRawText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleExportBackupJson = () => {
    try {
      const backupPayload = {
        app: 'ARN Stream - IPTV Pro',
        version: '2.6.0',
        exportedAt: new Date().toISOString(),
        playlists,
        favorites: JSON.parse(localStorage.getItem('arn_iptv_clean_v5_favorites') || '[]'),
        history: JSON.parse(localStorage.getItem('arn_iptv_clean_v5_history') || '[]'),
      };
      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ARN_IPTV_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage('تم تصدير النسخة الاحتياطية للقوائم والمفضلة بنجاح.');
    } catch {
      setErrorMsg('تعذر تصدير النسخة الاحتياطية.');
    }
  };

  const handleImportBackupJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (Array.isArray(parsed.favorites)) {
          localStorage.setItem('arn_iptv_clean_v5_favorites', JSON.stringify(parsed.favorites));
        }
        if (Array.isArray(parsed.history)) {
          localStorage.setItem('arn_iptv_clean_v5_history', JSON.stringify(parsed.history));
        }
        setStatusMessage('تم استعادة بيانات النسخة الاحتياطية بنجاح!');
      } catch {
        setErrorMsg('ملف النسخة الاحتياطية غير صالح.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className={`w-full max-w-3xl border rounded-2xl overflow-hidden flex flex-col max-h-[88vh] transition-colors duration-200 ${
        isDark
          ? 'bg-[#0d111a]/95 border-white/[0.08] text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.85)]'
          : 'bg-white/95 border-slate-200 text-slate-800 shadow-[0_24px_80px_rgba(0,0,0,0.18)]'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'bg-[#06080e]/90 border-white/[0.06]' : 'bg-slate-50/95 border-slate-200'
        }`}>
          <div>
            <h3 className={`text-base font-bold tracking-tight leading-normal ${isDark ? 'text-white' : 'text-slate-900'}`}>
              إدارة قوائم التشغيل وأكواد التفعيل
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              تفعيل أكواد دراما لايف (FG Code) أو مزامنة Xtream Codes وملفات M3U / M3U8
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onLoadBuiltinCatalog && (
              <button
                type="button"
                onClick={async () => {
                  setIsLoading(true);
                  setErrorMsg(null);
                  setStatusMessage('جاري تحميل الباقة العربية والمصرية المدمجة...');
                  try {
                    await onLoadBuiltinCatalog();
                    setStatusMessage('تم تحميل وتحديث الباقة العربية والمصرية المدمجة بنجاح!');
                  } catch {
                    setErrorMsg('تعذر تحميل الباقة المدمجة.');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/35 text-violet-400 text-xs font-bold transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>الباقة العربية المدمجة</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Active Playlists List */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <h4 className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                القوائم المحفوظة حالياً ({playlists.length})
              </h4>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExportBackupJson}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-slate-300 hover:text-white'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900'
                  }`}
                  title="تصدير نسخة احتياطية للقوائم والمفضلة (JSON)"
                >
                  <Download className="w-3 h-3 text-violet-500" />
                  <span>نسخة احتياطية</span>
                </button>
                <label
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-slate-300 hover:text-white'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900'
                  }`}
                  title="استيراد ملف نسخة احتياطية (JSON)"
                >
                  <Upload className="w-3 h-3 text-sky-500" />
                  <span>استعادة</span>
                  <input type="file" accept=".json" onChange={handleImportBackupJson} className="hidden" />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {playlists.map((pl) => {
                const isSelected = pl.id === activePlaylistId;
                return (
                  <div
                    key={pl.id}
                    onClick={() => onSelectPlaylist(pl.id)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? (isDark ? 'bg-violet-600/20 border-violet-500/40 text-white shadow-sm' : 'bg-violet-50 border-violet-300 text-violet-900 font-bold shadow-xs')
                        : (isDark ? 'bg-[#06080e]/70 border-white/[0.06] text-slate-300 hover:bg-white/[0.04] hover:border-white/[0.12]' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100')
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold truncate">{pl.name}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />}
                      </div>
                      <div className={`flex items-center gap-1.5 flex-wrap text-[11px] mt-1 tabular-nums ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        <span className="text-violet-500 font-semibold font-mono">
                          {pl.channelCount} قناة
                        </span>
                        <span>·</span>
                        <span className="font-mono uppercase text-[10px]" dir="ltr">
                          {pl.type}
                        </span>
                        {pl.updatedAt && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-[10px]" dir="ltr">
                              {pl.updatedAt}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {pl.type !== 'builtin' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePlaylist(pl.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="حذف القائمة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mode Tabs */}
          <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${
            isDark ? 'bg-[#070b14] border-white/[0.08]' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              type="button"
              onClick={() => setActiveTab('fg')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'fg'
                  ? 'bg-[#7c3aed] text-white shadow-md shadow-violet-600/30'
                  : isDark
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              تفعيل كود دراما لايف (FG Code)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('xtream')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'xtream'
                  ? 'bg-[#7c3aed] text-white shadow-md shadow-violet-600/30'
                  : isDark
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Server className="w-4 h-4" />
              حساب Xtream Codes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('m3u')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'm3u'
                  ? 'bg-[#7c3aed] text-white shadow-md shadow-violet-600/30'
                  : isDark
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Link2 className="w-4 h-4" />
              إضافة قائمة M3U / M3U8
            </button>
          </div>

          {/* Status / Error Banner */}
          {statusMessage && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-violet-500/15 border border-violet-500/35 text-xs text-violet-400 font-semibold">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-violet-500 shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-violet-500 shrink-0" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-500 font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Tab 1: FG Code Activation */}
          {activeTab === 'fg' && (
            <form onSubmit={handleActivateFgCode} className="space-y-4">
              <div className={`p-4 rounded-xl border space-y-3 ${
                isDark ? 'bg-[#070b14]/80 border-white/[0.08]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <label className={`block text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    كود التفعيل الرسمي (KEY_ACTIVATED_TYPE — v187)
                  </label>
                  <div className="flex items-center gap-1.5">
                    {['232425', '202122'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFgCode(preset)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono border transition cursor-pointer ${
                          fgCode === preset
                            ? 'bg-violet-500/25 border-violet-500/50 text-violet-400 font-bold'
                            : isDark
                            ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <input
                    type="text"
                    value={fgCode}
                    onChange={(e) => setFgCode(e.target.value)}
                    placeholder="مثال: 232425 أو 202122"
                    className={`flex-1 border rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none transition-colors ${
                      isDark
                        ? 'bg-[#0f172a] border-white/15 text-white focus:border-violet-400'
                        : 'bg-white border-slate-300 text-slate-900 focus:border-violet-500'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] disabled:opacity-50 text-white font-bold text-xs transition-colors whitespace-nowrap cursor-pointer shadow-md shadow-violet-600/30"
                  >
                    {isLoading ? 'جاري التفعيل...' : 'تفعيل وجلب القنوات'}
                  </button>
                </div>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  يقوم المحرك بتوليد حزمة دراما لايف v187 وتشفيرها بـ AES-128-CBC وتوجيه كافة القنوات عبر البروكسي المحلي لإزالة تشويش <code className="text-violet-500">k9x_</code>.
                </p>
              </div>
            </form>
          )}

          {/* Tab 2: Xtream Codes Account */}
          {activeTab === 'xtream' && (
            <form onSubmit={handleSyncXtream} className="space-y-4">
              <div className={`p-4 rounded-xl border space-y-4 ${
                isDark ? 'bg-[#070b14]/80 border-white/[0.08]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-violet-500" />
                    <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>إعدادات الاتصال بحساب Xtream API</span>
                  </div>
                  <span className={`text-[10px] font-mono border px-2 py-0.5 rounded ${
                    isDark ? 'text-violet-300 bg-violet-950/60 border-violet-500/25' : 'text-violet-700 bg-violet-50 border-violet-200'
                  }`}>
                    player_api.php
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-3">
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      عنوان السيرفر والمنفذ (Server URL / Host)
                    </label>
                    <input
                      type="text"
                      value={xtreamHost}
                      onChange={(e) => setXtreamHost(e.target.value)}
                      placeholder="http://iptv-server.com:8080 أو https://..."
                      className={`w-full border rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none transition-colors ${
                        isDark ? 'bg-[#0f172a] border-white/15 text-white focus:border-violet-400' : 'bg-white border-slate-300 text-slate-900 focus:border-violet-500'
                      }`}
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>اسم المستخدم (Username)</label>
                    <input
                      type="text"
                      value={xtreamUsername}
                      onChange={(e) => setXtreamUsername(e.target.value)}
                      placeholder="Username"
                      className={`w-full border rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none transition-colors ${
                        isDark ? 'bg-[#0f172a] border-white/15 text-white focus:border-violet-400' : 'bg-white border-slate-300 text-slate-900 focus:border-violet-500'
                      }`}
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>كلمة المرور (Password)</label>
                    <input
                      type="password"
                      value={xtreamPassword}
                      onChange={(e) => setXtreamPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full border rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none transition-colors ${
                        isDark ? 'bg-[#0f172a] border-white/15 text-white focus:border-violet-400' : 'bg-white border-slate-300 text-slate-900 focus:border-violet-500'
                      }`}
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>اسم القائمة في البرنامج</label>
                    <input
                      type="text"
                      value={xtreamPlaylistName}
                      onChange={(e) => setXtreamPlaylistName(e.target.value)}
                      placeholder="اشتراكي الشخصي"
                      className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none transition-colors ${
                        isDark ? 'bg-[#0f172a] border-white/15 text-white focus:border-violet-400' : 'bg-white border-slate-300 text-slate-900 focus:border-violet-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Section Checkboxes */}
                <div className={`flex flex-wrap items-center gap-4 pt-1 border-t text-xs ${
                  isDark ? 'border-white/5 text-slate-300' : 'border-slate-200 text-slate-700'
                }`}>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={xtreamIncludeVod}
                      onChange={(e) => setXtreamIncludeVod(e.target.checked)}
                      className="rounded border-slate-300 text-violet-600 focus:ring-0"
                    />
                    <span>تضمين باقات الأفلام (VOD)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={xtreamIncludeSeries}
                      onChange={(e) => setXtreamIncludeSeries(e.target.checked)}
                      className="rounded border-slate-300 text-violet-600 focus:ring-0"
                    />
                    <span>تضمين باقات المسلسلات (Series)</span>
                  </label>
                </div>

                {/* Account Details Card if authenticated */}
                {xtreamAccountInfo && (
                  <div className={`p-3 rounded-xl border grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] ${
                    isDark ? 'bg-violet-500/15 border-violet-500/30' : 'bg-violet-50 border-violet-200'
                  }`}>
                    <div className="space-y-0.5">
                      <span className={`block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>حالة الحساب</span>
                      <span className="text-violet-500 font-bold">{xtreamAccountInfo.status}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className={`block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>تاريخ الانتهاء</span>
                      <span className={`font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{xtreamAccountInfo.expDate}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className={`block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>أقصى اتصالات</span>
                      <span className={`font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{xtreamAccountInfo.maxConnections} أجهزة</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className={`block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>المستخدم</span>
                      <span className="text-sky-500 font-mono truncate block">{xtreamAccountInfo.username}</span>
                    </div>
                  </div>
                )}

                <div className={`flex items-center justify-between pt-2 border-t ${
                  isDark ? 'border-white/[0.08]' : 'border-slate-200'
                }`}>
                  <button
                    type="button"
                    onClick={handleTestXtreamAccount}
                    disabled={isLoading}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer ${
                      isDark ? 'bg-white/[0.08] hover:bg-white/15 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 text-violet-500" />
                    فحص بيانات الحساب والاشتراك
                  </button>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-md shadow-violet-600/30"
                  >
                    <Layers className="w-4 h-4" />
                    استيراد ومزامنة القنوات الآن
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Tab 3: M3U Import */}
          {activeTab === 'm3u' && (
            <form onSubmit={handleImportM3u} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>اسم القائمة</label>
                  <input
                    type="text"
                    value={m3uName}
                    onChange={(e) => setM3uName(e.target.value)}
                    className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none transition-colors ${
                      isDark ? 'bg-[#070b14] border-white/15 text-white focus:border-violet-400' : 'bg-white border-slate-300 text-slate-900 focus:border-violet-500'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>رابط M3U / M3U8 مباشر (اختياري)</label>
                  <input
                    type="url"
                    value={m3uUrl}
                    onChange={(e) => setM3uUrl(e.target.value)}
                    placeholder="https://example.com/playlist.m3u8"
                    className={`w-full border rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none transition-colors ${
                      isDark ? 'bg-[#070b14] border-white/15 text-white focus:border-violet-400' : 'bg-white border-slate-300 text-slate-900 focus:border-violet-500'
                    }`}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    أو الصق محتوى ملف #EXTM3U / ارفع ملفاً من جهازك
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setM3uRawText(SAMPLE_M3U_CONTENT)}
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                        isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-violet-500" />
                      ملء قائمة M3U تجريبية
                    </button>
                    <label className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                      isDark ? 'bg-white/[0.08] hover:bg-white/15 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}>
                      <FileUp className="w-3.5 h-3.5" />
                      رفع ملف .m3u
                      <input type="file" accept=".m3u,.m3u8,.txt" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                <textarea
                  rows={5}
                  value={m3uRawText}
                  onChange={(e) => setM3uRawText(e.target.value)}
                  placeholder="#EXTM3U&#10;#EXTINF:-1 group-title=&quot;Sports&quot;,Channel Name&#10;https://..."
                  className={`w-full border rounded-xl p-3 text-xs font-mono focus:outline-none transition-colors ${
                    isDark ? 'bg-[#070b14] border-white/15 text-slate-200 focus:border-violet-400' : 'bg-white border-slate-300 text-slate-900 focus:border-violet-500'
                  }`}
                  dir="ltr"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold text-xs transition-colors cursor-pointer shadow-md shadow-violet-600/30"
                >
                  استيراد وتحليل القائمة الآن
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
export default PlaylistModal;
