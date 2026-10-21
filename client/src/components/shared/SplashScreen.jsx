import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export default function SplashScreen() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [taglineFade, setTaglineFade] = useState(false);

  const taglines = [
    { arPrefix: 'جاري تجهيز مكتبة ', arHl: 'الأفلام', arSuffix: '...', enPrefix: 'Preparing ', enHl: 'Movies', enSuffix: ' library...' },
    { arPrefix: 'جاري فهرسة ', arHl: 'المسلسلات', arSuffix: '...', enPrefix: 'Indexing ', enHl: 'Series', enSuffix: ' catalog...' },
    { arPrefix: 'جاري تحميل ', arHl: 'الصوتيات', arSuffix: '...', enPrefix: 'Loading ', enHl: 'Music & Audio', enSuffix: '...' },
    { arPrefix: 'جاري الاتصال بـ ', arHl: 'الخادم المحلي', arSuffix: '...', enPrefix: 'Connecting to ', enHl: 'Local Server', enSuffix: '...' },
    { arPrefix: 'جاري ضبط جودة ', arHl: 'البث', arSuffix: '...', enPrefix: 'Calibrating ', enHl: 'Stream', enSuffix: ' quality...' },
    { arPrefix: 'جاري التحقق من ', arHl: 'التراخيص', arSuffix: '...', enPrefix: 'Verifying ', enHl: 'Credentials', enSuffix: '...' }
  ];

  const hideSplash = () => {
    setFading(true);
    setTimeout(() => {
      setVisible(false);
      setFading(false);
    }, 1000);
  };

  const startSplash = () => {
    setProgress(0);
    setFading(false);
    setVisible(true);
  };

  // Check whether to show on startup
  useEffect(() => {
    const shown = sessionStorage.getItem('arn_splash_screen_shown');
    if (!shown) {
      sessionStorage.setItem('arn_splash_screen_shown', 'true');
      startSplash();
    }

    const handleCustomTrigger = () => {
      startSplash();
    };

    window.addEventListener('arn:show-splash', handleCustomTrigger);
    return () => window.removeEventListener('arn:show-splash', handleCustomTrigger);
  }, []);

  // Tagline rotation
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      setTaglineFade(true);
      setTimeout(() => {
        setTaglineIndex((prev) => (prev + 1) % taglines.length);
        setTaglineFade(false);
      }, 400);
    }, 1400);

    return () => clearInterval(interval);
  }, [visible, taglines.length]);

  // Progress counter
  useEffect(() => {
    if (!visible || fading) return;

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + Math.random() * 3.2 + 0.8;
        if (next >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => {
            hideSplash();
          }, 800);
          return 100;
        }
        return next;
      });
    }, 130);

    return () => clearInterval(progressInterval);
  }, [visible, fading]);

  // Listen to Escape key to skip
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        hideSplash();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible]);

  if (!visible) return null;

  const currentTagline = taglines[taglineIndex];

  return (
    <div id="arn-splash-container" className={fading ? 'hide' : ''}>
      <style>{`
        #arn-splash-container {
          position: fixed;
          inset: 0;
          background: radial-gradient(ellipse at 50% 50%, #0a0f2e 0%, #05060f 60%, #000 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          transition: opacity 1s ease, visibility 1s ease;
          overflow: hidden;
          font-family: 'Tajawal', sans-serif !important;
          user-select: none;
        }

        #arn-splash-container,
        #arn-splash-container * {
          font-family: 'Tajawal', sans-serif !important;
        }

        #arn-splash-container.hide {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        /* ===== نجوم ===== */
        .arn-stars {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(1px 1px at 20% 30%, #7dd3fc, transparent),
            radial-gradient(1px 1px at 60% 70%, #a78bfa, transparent),
            radial-gradient(2px 2px at 80% 20%, #f0abfc, transparent),
            radial-gradient(1px 1px at 10% 80%, #7dd3fc, transparent),
            radial-gradient(1px 1px at 40% 50%, #a78bfa, transparent),
            radial-gradient(2px 2px at 90% 60%, #f0abfc, transparent);
          animation: arnTwinkle 4s ease-in-out infinite alternate;
          opacity: 0.7;
          pointer-events: none;
        }

        @keyframes arnTwinkle {
          0% { opacity: 0.4; }
          100% { opacity: 0.9; }
        }

        /* ===== هالات ===== */
        .arn-aura {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
        }
        .arn-aura.cyan {
          width: 450px; height: 450px;
          background: #06b6d4;
          top: 5%; left: 10%;
          opacity: 0.35;
          animation: arnAuraFloat 7s ease-in-out infinite alternate;
        }
        .arn-aura.purple {
          width: 500px; height: 500px;
          background: #8b5cf6;
          bottom: 5%; right: 10%;
          opacity: 0.3;
          animation: arnAuraFloat 7s ease-in-out infinite alternate-reverse;
        }
        .arn-aura.pink {
          width: 300px; height: 300px;
          background: #ec4899;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          opacity: 0.15;
          animation: arnPulseAura 4s ease-in-out infinite;
        }

        @keyframes arnAuraFloat {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(50px, -30px) scale(1.2); }
        }
        @keyframes arnPulseAura {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.15; }
          50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0.3; }
        }

        /* ===== الأيقونات العائمة ===== */
        .arn-icons-orbit {
          position: absolute;
          top: 50%; left: 50%;
          width: 420px; height: 420px;
          transform: translate(-50%, -50%);
          z-index: 1;
          pointer-events: none;
          animation: arnOrbitSpin 30s linear infinite;
        }

        @keyframes arnOrbitSpin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        .arn-floating-icon {
          position: absolute;
          width: 60px; height: 60px;
          border-radius: 16px;
          background: rgba(15, 20, 40, 0.7);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .arn-floating-icon svg {
          width: 32px; height: 32px;
          animation: arnCounterSpin 30s linear infinite;
        }

        @keyframes arnCounterSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }

        .arn-icon-movie {
          top: 0; left: 50%;
          transform: translateX(-50%);
          border: 1.5px solid rgba(125, 211, 252, 0.5);
          box-shadow: 0 0 25px rgba(6, 182, 212, 0.6), inset 0 0 12px rgba(6, 182, 212, 0.2);
        }
        .arn-icon-tv {
          bottom: 0; right: 0;
          border: 1.5px solid rgba(167, 139, 250, 0.5);
          box-shadow: 0 0 25px rgba(139, 92, 246, 0.6), inset 0 0 12px rgba(139, 92, 246, 0.2);
        }
        .arn-icon-music {
          bottom: 0; left: 0;
          border: 1.5px solid rgba(236, 72, 153, 0.5);
          box-shadow: 0 0 25px rgba(236, 72, 153, 0.6), inset 0 0 12px rgba(236, 72, 153, 0.2);
        }

        /* ================= الشعار ================= */
        .arn-logo-wrap {
          position: relative;
          z-index: 3;
          width: 240px; height: 240px;
          opacity: 0;
          animation: arnLogoReveal 1.4s cubic-bezier(0.19, 1, 0.22, 1) forwards,
                     arnLogoHover 4s ease-in-out infinite 1.4s;
        }

        @keyframes arnLogoReveal {
          0% { opacity: 0; transform: scale(0.5) rotateY(180deg); filter: blur(20px); }
          70% { opacity: 1; transform: scale(1.05) rotateY(0); filter: blur(0); }
          100% { opacity: 1; transform: scale(1) rotateY(0); }
        }
        @keyframes arnLogoHover {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }

        .arn-logo-svg {
          width: 100%; height: 100%;
          filter:
            drop-shadow(0 0 25px rgba(6, 182, 212, 0.7))
            drop-shadow(0 0 45px rgba(139, 92, 246, 0.5))
            drop-shadow(0 0 65px rgba(236, 72, 153, 0.3));
        }

        .arn-ring-1 { transform-origin: 130px 130px; animation: arnSpinCW 15s linear infinite; }
        .arn-ring-2 { transform-origin: 130px 130px; animation: arnSpinCCW 20s linear infinite; }
        .arn-ring-3 { transform-origin: 130px 130px; animation: arnSpinCW 25s linear infinite; }

        @keyframes arnSpinCW { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes arnSpinCCW { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }

        .arn-core-pulse {
          transform-origin: 130px 130px;
          animation: arnCorePulse 2s ease-in-out infinite;
        }
        @keyframes arnCorePulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
        }

        .arn-trace-path {
          stroke-dasharray: 400;
          stroke-dashoffset: 400;
          animation: arnTraceDraw 3s ease forwards;
        }
        @keyframes arnTraceDraw { to { stroke-dashoffset: 0; } }

        /* ================= النصوص ================= */
        #arn-splash-container .arn-brand,
        .arn-brand {
          position: relative;
          z-index: 2;
          margin-top: 24px;
          font-family: 'Audiowide', sans-serif !important;
          font-size: 48px;
          letter-spacing: 6px;
          line-height: 1.1;
          background: linear-gradient(90deg, #00d2ff 0%, #38bdf8 22%, #818cf8 50%, #c084fc 75%, #f472b6 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          opacity: 0;
          animation: arnFadeSlideUp 1s ease 0.8s forwards,
                     arnNeonShift 5s linear infinite 1.8s;
          text-align: center;
          filter: drop-shadow(0 0 25px rgba(6, 182, 212, 0.45));
        }

        @keyframes arnNeonShift {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }

        @keyframes arnFadeSlideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ===== شارات الوسائط ===== */
        .arn-media-badges {
          position: relative;
          z-index: 2;
          margin-top: 18px;
          display: flex;
          gap: 12px;
          opacity: 0;
          animation: arnFadeSlideUp 1s ease 1.1s forwards;
        }

        .arn-media-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 16px;
          border-radius: 999px;
          background: rgba(15, 20, 40, 0.6);
          backdrop-filter: blur(10px);
          font-size: 13px;
          font-weight: 500;
          color: #cbd5e1;
        }

        .arn-media-badge .arn-em { font-size: 16px; line-height: 1; }

        .arn-media-badge.movies { border: 1px solid rgba(6, 182, 212, 0.4); }
        .arn-media-badge.series { border: 1px solid rgba(139, 92, 246, 0.4); }
        .arn-media-badge.audio  { border: 1px solid rgba(236, 72, 153, 0.4); }

        .arn-media-badge.movies .arn-em { filter: drop-shadow(0 0 6px #06b6d4); }
        .arn-media-badge.series .arn-em { filter: drop-shadow(0 0 6px #a78bfa); }
        .arn-media-badge.audio  .arn-em { filter: drop-shadow(0 0 6px #ec4899); }

        /* ===== النص المتغير ===== */
        .arn-tagline-wrap {
          position: relative;
          z-index: 2;
          margin-top: 18px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          animation: arnFadeSlideUp 1s ease 1.3s forwards;
        }

        .arn-tagline {
          font-family: 'Tajawal', sans-serif;
          font-size: 15px;
          font-weight: 400;
          color: #94a3b8;
          letter-spacing: 0.5px;
          transition: opacity 0.4s ease, transform 0.4s ease;
          text-align: center;
        }

        .arn-tagline.fade-out {
          opacity: 0;
          transform: translateY(-10px);
        }

        .arn-tagline .hl { color: #7dd3fc; font-weight: 600; }

        /* ================= شريط التحميل ================= */
        .arn-loader-wrap {
          position: relative;
          z-index: 2;
          margin-top: 28px;
          width: 320px;
          opacity: 0;
          animation: arnFadeSlideUp 1s ease 1.5s forwards;
        }

        .arn-loader {
          width: 100%;
          height: 5px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          overflow: hidden;
          position: relative;
          box-shadow: inset 0 0 10px rgba(6, 182, 212, 0.2);
        }

        .arn-loader-bar {
          height: 100%;
          border-radius: 10px;
          background: linear-gradient(90deg, #06b6d4, #7dd3fc, #a78bfa, #ec4899);
          background-size: 300% 100%;
          box-shadow:
            0 0 15px rgba(6, 182, 212, 0.9),
            0 0 30px rgba(167, 139, 250, 0.6);
          transition: width 0.15s ease-out;
          animation: arnNeonShift 2s linear infinite;
        }

        .arn-percent {
          position: absolute;
          top: -26px;
          right: 0;
          font-family: 'Rajdhani', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #7dd3fc;
          letter-spacing: 2px;
          text-shadow: 0 0 10px rgba(125, 211, 252, 0.8);
        }

        /* ================= حالة الاتصال ================= */
        .arn-status {
          position: relative;
          z-index: 2;
          margin-top: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: 'Tajawal', sans-serif !important;
          font-size: 15px;
          font-weight: 500;
          color: #94a3b8;
          letter-spacing: 0.5px;
          opacity: 0;
          animation: arnFadeSlideUp 1s ease 1.8s forwards;
        }

        .arn-status span {
          font-family: 'Tajawal', sans-serif !important;
        }

        .arn-dot-pulse {
          position: relative;
          width: 9px; height: 9px;
          border-radius: 50%;
          background: #06b6d4;
          box-shadow: 0 0 10px #06b6d4, 0 0 20px #06b6d4;
        }

        .arn-dot-pulse::before,
        .arn-dot-pulse::after {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 1.5px solid #06b6d4;
          animation: arnRadarPing 2s ease-out infinite;
        }
        .arn-dot-pulse::after { animation-delay: 1s; }

        @keyframes arnRadarPing {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }

        /* ================= بطاقة المطور ================= */
        .arn-developer {
          position: relative;
          z-index: 2;
          margin-top: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 22px;
          border-radius: 999px;
          background: rgba(15, 20, 40, 0.55);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(167, 139, 250, 0.35);
          box-shadow:
            0 0 25px rgba(139, 92, 246, 0.25),
            inset 0 0 15px rgba(139, 92, 246, 0.08);
          opacity: 0;
          animation: arnDevReveal 1.2s cubic-bezier(0.19, 1, 0.22, 1) 2.1s forwards,
                     arnDevPulse 3s ease-in-out infinite 3.3s;
        }

        @keyframes arnDevReveal {
          0% { opacity: 0; transform: translateY(20px) scale(0.9); filter: blur(8px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }

        @keyframes arnDevPulse {
          0%, 100% {
            box-shadow:
              0 0 25px rgba(139, 92, 246, 0.25),
              inset 0 0 15px rgba(139, 92, 246, 0.08);
          }
          50% {
            box-shadow:
              0 0 40px rgba(139, 92, 246, 0.45),
              0 0 60px rgba(236, 72, 153, 0.25),
              inset 0 0 20px rgba(139, 92, 246, 0.15);
          }
        }

        .arn-developer .label {
          font-family: 'Tajawal', sans-serif;
          font-size: 13px;
          font-weight: 400;
          color: #94a3b8;
          letter-spacing: 0.5px;
        }

        .arn-developer .name {
          font-family: 'Tajawal', sans-serif;
          font-size: 19px;
          font-weight: 900;
          letter-spacing: 0.5px;
          background: linear-gradient(90deg, #7dd3fc, #a78bfa, #f472b6, #ec4899);
          background-size: 300% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: arnNeonShift 3s linear infinite;
          filter: drop-shadow(0 0 8px rgba(167, 139, 250, 0.5));
        }

        .arn-developer .icon-star {
          font-size: 14px;
          animation: arnStarSpin 4s linear infinite;
          filter: drop-shadow(0 0 6px #fbbf24);
          color: #fbbf24;
        }

        @keyframes arnStarSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* ================= زر التخطي السريع ================= */
        .arn-skip-btn {
          position: absolute;
          top: 24px;
          left: 24px;
          z-index: 10;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #94a3b8;
          padding: 6px 16px;
          border-radius: 999px;
          font-family: 'Tajawal', sans-serif;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .arn-skip-btn:hover {
          background: rgba(6, 182, 212, 0.2);
          border-color: rgba(6, 182, 212, 0.5);
          color: #7dd3fc;
          transform: scale(1.05);
        }

        /* ================= الإصدار ================= */
        .arn-version {
          position: absolute;
          bottom: 24px;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: 'Rajdhani', sans-serif;
          font-size: 11px;
          color: #475569;
          letter-spacing: 4px;
          opacity: 0;
          animation: arnFadeSlideUp 1s ease 2.8s forwards;
        }

        .arn-version .sep {
          width: 30px;
          height: 1px;
          background: linear-gradient(90deg, transparent, #475569, transparent);
        }

        /* ================= تجاوب الشاشات الصغيرة ================= */
        @media (max-width: 600px) {
          .arn-logo-wrap { width: 180px; height: 180px; }
          .arn-brand { font-size: 38px; letter-spacing: 5px; }
          .arn-brand .arn-sub { font-size: 15px; letter-spacing: 9px; }
          .arn-loader-wrap { width: 250px; }
          .arn-icons-orbit { width: 300px; height: 300px; }
          .arn-floating-icon { width: 48px; height: 48px; }
          .arn-floating-icon svg { width: 24px; height: 24px; }
          .arn-media-badge { font-size: 11px; padding: 5px 12px; }
          .arn-tagline { font-size: 13px; }
          .arn-developer { padding: 6px 16px; gap: 8px; }
          .arn-developer .name { font-size: 16px; }
          .arn-developer .label { font-size: 11px; }
          .arn-skip-btn { top: 16px; left: 16px; padding: 4px 12px; font-size: 11px; }
        }
      `}</style>

      {/* زر التخطي */}
      <button
        type="button"
        className="arn-skip-btn"
        onClick={hideSplash}
        title={isAr ? 'اضغط للتخطي والدخول فوراً' : 'Click to skip into app'}
      >
        <span>{isAr ? 'تخطي' : 'Skip'}</span>
        <span style={{ fontSize: '10px', opacity: 0.6 }}>[ESC]</span>
      </button>

      {/* خلفية النجوم والهالات */}
      <div className="arn-stars" />
      <div className="arn-aura cyan" />
      <div className="arn-aura purple" />
      <div className="arn-aura pink" />

      {/* مدار أيقونات الوسائط العائمة */}
      <div className="arn-icons-orbit">
        <div className="arn-floating-icon arn-icon-movie">
          <svg viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M7 4v16 M17 4v16 M2 9h5 M2 15h5 M17 9h5 M17 15h5" />
          </svg>
        </div>
        <div className="arn-floating-icon arn-icon-tv">
          <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M17 2l-5 5-5-5" />
            <path d="M8 12v4 M12 11v6 M16 13v2" />
          </svg>
        </div>
        <div className="arn-floating-icon arn-icon-music">
          <svg viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
      </div>

      {/* الشعار المتطور */}
      <div className="arn-logo-wrap">
        <svg className="arn-logo-svg" viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="arnCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#0891b2" />
            </linearGradient>
            <linearGradient id="arnPurpleGrad" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
            <linearGradient id="arnPinkGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#f472b6" />
            </linearGradient>
            <linearGradient id="arnTriGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
            <linearGradient id="arnTextGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="50%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#f472b6" />
            </linearGradient>
            <filter id="arnGlowCyan" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="arnGlowPurple" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="arnGlowPink" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <g className="arn-ring-1">
            <circle cx="130" cy="130" r="118" fill="none" stroke="url(#arnCyanGrad)" strokeWidth="1.5" strokeDasharray="4 8" opacity="0.6" />
          </g>
          <g className="arn-ring-2">
            <circle cx="130" cy="130" r="106" fill="none" stroke="url(#arnPurpleGrad)" strokeWidth="1" opacity="0.4" />
            <g fill="#a78bfa" opacity="0.8">
              <circle cx="130" cy="24" r="2.5" />
              <circle cx="200" cy="45" r="2.5" />
              <circle cx="236" cy="130" r="2.5" />
              <circle cx="200" cy="215" r="2.5" />
              <circle cx="130" cy="236" r="2.5" />
              <circle cx="60" cy="215" r="2.5" />
              <circle cx="24" cy="130" r="2.5" />
              <circle cx="60" cy="45" r="2.5" />
            </g>
          </g>
          <g className="arn-ring-3">
            <circle cx="130" cy="130" r="92" fill="none" stroke="url(#arnPinkGrad)" strokeWidth="1" strokeDasharray="2 6" opacity="0.5" />
          </g>

          <g className="arn-core-pulse">
            <path d="M 130 45 L 218 200 L 42 200 Z" fill="none" stroke="url(#arnTriGrad)" strokeWidth="3.5" strokeLinejoin="round" filter="url(#arnGlowCyan)" />
            <path d="M 130 68 L 200 190 L 60 190 Z" fill="none" stroke="url(#arnTriGrad)" strokeWidth="2" strokeLinejoin="round" opacity="0.6" filter="url(#arnGlowPurple)" />
          </g>

          <path className="arn-trace-path" d="M 130 45 L 218 200 L 42 200 Z" fill="none" stroke="#7dd3fc" strokeWidth="2" strokeLinejoin="round" opacity="0.9" />

          <g transform="translate(20, 130)" fill="#06b6d4" opacity="0.85">
            <rect x="0" y="-10" width="2" height="20" rx="1" />
            <rect x="6" y="-18" width="2" height="36" rx="1" />
            <rect x="12" y="-24" width="2" height="48" rx="1" />
            <rect x="18" y="-14" width="2" height="28" rx="1" />
          </g>
          <g transform="translate(220, 130)" fill="#ec4899" opacity="0.85">
            <rect x="0" y="-14" width="2" height="28" rx="1" />
            <rect x="6" y="-24" width="2" height="48" rx="1" />
            <rect x="12" y="-18" width="2" height="36" rx="1" />
            <rect x="18" y="-10" width="2" height="20" rx="1" />
          </g>

          <g fontFamily="Audiowide, sans-serif" fontSize="54" textAnchor="middle">
            <text x="130" y="162" fill="#06b6d4" opacity="0.5" filter="url(#arnGlowCyan)" transform="translate(-2,0)">ARN</text>
            <text x="130" y="162" fill="#a78bfa" opacity="0.5" filter="url(#arnGlowPurple)" transform="translate(2,0)">ARN</text>
            <text x="130" y="162" fill="none" stroke="#ffffff" strokeWidth="1" filter="url(#arnGlowPink)">ARN</text>
            <text x="130" y="162" fill="url(#arnTextGrad)">ARN</text>
          </g>
        </svg>
      </div>

      {/* اسم المنصة من الصورة: ARN STREAM على سطر واحد وبخط Audiowide الفضائي المتوهج */}
      <h1 className="arn-brand">
        ARN STREAM
      </h1>

      {/* شارات الوسائط */}
      <div className="arn-media-badges">
        <div className="arn-media-badge movies"><span className="arn-em">🎬</span><span>{isAr ? 'أفلام' : 'Movies'}</span></div>
        <div className="arn-media-badge series"><span className="arn-em">📺</span><span>{isAr ? 'مسلسلات' : 'Series'}</span></div>
        <div className="arn-media-badge audio"><span className="arn-em">🎵</span><span>{isAr ? 'صوتيات' : 'Music'}</span></div>
      </div>

      {/* النص المتغير */}
      <div className="arn-tagline-wrap">
        <p className={`arn-tagline ${taglineFade ? 'fade-out' : ''}`}>
          {isAr ? currentTagline.arPrefix : currentTagline.enPrefix}
          <span className="hl">{isAr ? currentTagline.arHl : currentTagline.enHl}</span>
          {isAr ? currentTagline.arSuffix : currentTagline.enSuffix}
        </p>
      </div>

      {/* شريط التحميل الرقمي */}
      <div className="arn-loader-wrap">
        <span className="arn-percent">{Math.floor(progress)}%</span>
        <div className="arn-loader">
          <div className="arn-loader-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* حالة الاتصال بالخادم */}
      <div className="arn-status">
        <span className="arn-dot-pulse" />
        <span>
          {progress >= 100
            ? (isAr ? 'تم الاتصال بالخادم بنجاح — استمتع بالبث' : 'Connected to server successfully!')
            : (isAr ? 'جاري الاتصال بالخادم...' : 'Connecting to local server...')}
        </span>
      </div>

      {/* بطاقة المطور */}
      <div className="arn-developer">
        <span className="icon-star">✦</span>
        <span className="label">{isAr ? 'تطوير' : 'Developed by'}</span>
        <span className="name">{isAr ? 'عبده نصار' : 'Abdou Nassar'}</span>
        <span className="icon-star">✦</span>
      </div>

      {/* الإصدار والشبكة */}
      <div className="arn-version">
        <span>V2.0.3</span>
        <span className="sep" />
        <span>LOCAL NETWORK</span>
      </div>
    </div>
  );
}
