import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, X } from 'lucide-react';

// Captures the browser's beforeinstallprompt event and offers a glass
// "Install App" pill. Dismissal is remembered so it never nags the user.
export default function PWAInstallPrompt() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  );

  useEffect(() => {
    if (installed) return;

    let dismissed = false;
    try { dismissed = localStorage.getItem('arn_pwa_install_dismissed') === '1'; } catch {}
    if (dismissed) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [installed]);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setVisible(false);
    } catch {}
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem('arn_pwa_install_dismissed', '1'); } catch {}
  };

  if (!visible || installed) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 z-[9000] flex sm:justify-end pointer-events-none">
      <div
        className="pointer-events-auto w-full sm:w-auto max-w-sm flex items-center gap-3 p-3 pr-4 rounded-2xl bg-surface/80 backdrop-blur-xl border border-border shadow-2xl animate-slideInUp"
        style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(229,9,20,0.12)' }}
      >
        <div className="w-11 h-11 flex-shrink-0 rounded-xl bg-primaryMovies/20 border border-primaryMovies/30 flex items-center justify-center text-primaryMovies">
          <Download size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-text truncate">
            {isAr ? 'تثبيت تطبيق ARN Stream' : 'Install ARN Stream App'}
          </div>
          <div className="text-[11px] text-muted truncate">
            {isAr ? 'ثبّته على جهازك لتجربة أسرع وبدون إطار المتصفح' : 'Add it to your device for a faster, frameless experience'}
          </div>
        </div>
        <button
          onClick={install}
          className="flex-shrink-0 px-3.5 py-2 rounded-xl bg-primaryMovies hover:brightness-110 text-white text-xs font-bold transition flex items-center gap-1.5"
        >
          <Download size={13} />
          {isAr ? 'تثبيت' : 'Install'}
        </button>
        <button
          onClick={dismiss}
          aria-label={isAr ? 'إغلاق' : 'Dismiss'}
          className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-muted hover:text-text transition flex items-center justify-center"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
