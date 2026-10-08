import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  QrCode, 
  Copy, 
  Check, 
  Wifi, 
  Smartphone, 
  ExternalLink, 
  Sparkles, 
  Loader2, 
  RefreshCw 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { fetchNetworkInfo } from '../../api/client';

export default function ServerQrModal({ isOpen, onClose }) {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const [loading, setLoading] = useState(true);
  const [networkData, setNetworkData] = useState(null);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Fetch real server network IP on demand when modal opens
  const loadNetworkInfo = async () => {
    setLoading(true);
    try {
      const data = await fetchNetworkInfo();
      setNetworkData(data);

      // Determine best initial URL:
      // If current browser host is already a real LAN IP (not localhost), use it, otherwise use detected primary IP
      const currentHost = window.location.hostname;
      const port = data?.port || window.location.port || '8096';

      let targetUrl = data?.serverUrl;
      if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
        targetUrl = `${window.location.protocol}//${currentHost}:${port}`;
      }

      setSelectedUrl(targetUrl);
    } catch (err) {
      console.warn('Failed to fetch network info, falling back to location:', err);
      const port = window.location.port || '8096';
      const fallbackUrl = `http://127.0.0.1:${port}`;
      setSelectedUrl(fallbackUrl);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNetworkInfo();
    } else {
      setCopied(false);
    }
  }, [isOpen]);

  // Generate QR Code whenever selectedUrl changes
  useEffect(() => {
    if (!selectedUrl) return;

    QRCode.toDataURL(selectedUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR Code:', err);
      });
  }, [selectedUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!selectedUrl) return;
    navigator.clipboard.writeText(selectedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="relative bg-slate-900/95 border border-white/15 rounded-[32px] shadow-[0_25px_80px_rgba(0,0,0,0.85)] max-w-md w-full p-6 sm:p-7 overflow-hidden text-white animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Ambient Background Light */}
        <div className="absolute -top-24 -end-24 w-60 h-60 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -start-24 w-60 h-60 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-black flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
              <QrCode size={26} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  {isArabic ? 'تشغيل على الهاتف' : 'Connect via QR Code'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles size={10} />
                  <span>{isArabic ? 'مباشر' : 'Live'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                {isArabic 
                  ? 'امسح الرمز بكاميرا هاتفك لفتح المكتبة فوراً'
                  : 'Scan with your phone camera to launch instantly'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="relative my-2 flex flex-col items-center">
          <div className="relative p-3.5 bg-white rounded-2xl shadow-2xl shadow-emerald-500/15 border-2 border-emerald-500/40 group transition-all duration-300">
            {loading || !qrDataUrl ? (
              <div className="w-[220px] h-[220px] flex flex-col items-center justify-center gap-3 text-slate-600">
                <Loader2 size={36} className="animate-spin text-emerald-500" />
                <span className="text-xs font-semibold text-slate-500">
                  {isArabic ? 'جاري توليد الرمز...' : 'Generating QR code...'}
                </span>
              </div>
            ) : (
              <img 
                src={qrDataUrl} 
                alt="ARN Stream QR Code" 
                className="w-[220px] h-[220px] object-contain rounded-lg"
              />
            )}

            {/* Corner Decorative Elements */}
            <div className="absolute -top-1.5 -start-1.5 w-3 h-3 border-t-2 border-s-2 border-emerald-400 rounded-tl-sm" />
            <div className="absolute -top-1.5 -end-1.5 w-3 h-3 border-t-2 border-e-2 border-emerald-400 rounded-tr-sm" />
            <div className="absolute -bottom-1.5 -start-1.5 w-3 h-3 border-b-2 border-s-2 border-emerald-400 rounded-bl-sm" />
            <div className="absolute -bottom-1.5 -end-1.5 w-3 h-3 border-b-2 border-e-2 border-emerald-400 rounded-br-sm" />
          </div>

          {/* Network Interface Switcher (If multiple IPs detected) */}
          {networkData?.interfaces?.length > 1 && (
            <div className="mt-3 flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
              <span className="text-[11px] text-slate-400 px-2 flex items-center gap-1">
                <Wifi size={12} className="text-emerald-400" />
                <span>{isArabic ? 'الشبكة:' : 'Network:'}</span>
              </span>
              {networkData.interfaces.map((iface) => {
                const ifaceUrl = `http://${iface.address}:${networkData.port}`;
                const isActive = selectedUrl === ifaceUrl;
                return (
                  <button
                    key={iface.address}
                    onClick={() => setSelectedUrl(ifaceUrl)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      isActive 
                        ? 'bg-emerald-500 text-black font-bold shadow-sm' 
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {iface.name}: {iface.address}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Server URL Bar with Copy Button */}
        <div className="mt-4 p-2.5 ps-3.5 bg-slate-800/80 border border-white/10 rounded-2xl flex items-center justify-between gap-2 shadow-inner">
          <div className="min-w-0 flex items-center gap-2 text-xs font-mono text-emerald-400 font-semibold truncate select-all">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span className="truncate">{selectedUrl || 'http://localhost:8096'}</span>
          </div>

          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
              copied
                ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                : 'bg-white/10 hover:bg-white/15 text-white border border-white/10 active:scale-95'
            }`}
          >
            {copied ? (
              <>
                <Check size={14} className="stroke-[3]" />
                <span>{isArabic ? 'تم النسخ' : 'Copied'}</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>{isArabic ? 'نسخ الرابط' : 'Copy'}</span>
              </>
            )}
          </button>
        </div>

        {/* Instructions Guide */}
        <div className="mt-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 text-xs text-slate-300">
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
              1
            </div>
            <p className="leading-relaxed">
              {isArabic 
                ? 'تأكد أن الهاتف والكمبيوتر متصلان بنفس شبكة الواي فاي (Wi-Fi).'
                : 'Ensure both computer and phone are connected to the same Wi-Fi network.'}
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
              2
            </div>
            <p className="leading-relaxed">
              {isArabic
                ? 'افتح تطبيق الكاميرا على هاتفك ووجّهها نحو الرمز أعلاه.'
                : 'Open your phone camera app and point it at the QR code above.'}
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
              3
            </div>
            <p className="leading-relaxed">
              {isArabic
                ? 'انقر على الرابط المنبثق في شاشة الكاميرا لتشغيل ARN Stream مباشرة.'
                : 'Tap the link detected by your camera to open ARN Stream directly.'}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <button
            onClick={loadNetworkInfo}
            disabled={loading}
            className="flex items-center gap-1 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{isArabic ? 'إعادة فحص الشبكة' : 'Refresh IP'}</span>
          </button>

          <span className="text-[11px] text-slate-500 font-mono">
            ARN Technology © 2026
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
