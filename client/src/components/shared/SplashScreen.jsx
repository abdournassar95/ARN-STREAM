import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export default function SplashScreen() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [visible, setVisible] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [taglineFade, setTaglineFade] = useState(false);
  const [bootIdx, setBootIdx] = useState(0);
  const [clockStr, setClockStr] = useState('00:00:00');
  const [memVal, setMemVal] = useState(256);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const fractureOverlayRef = useRef(null);
  const fractureFlashRef = useRef(null);
  const supernovaRef = useRef(null);
  const mxRef = useRef(null);
  const myRef = useRef(null);

  const isHidingRef = useRef(false);
  const progressTimerRef = useRef(null);
  const animFrameRef = useRef(null);

  // Boot sequence messages
  const bootMessages = [
    'INITIALIZING ARN CORE...',
    'LOADING KERNEL MODULES...',
    'ESTABLISHING NETWORK LINK...',
    'CALIBRATING STREAM PROTOCOL...',
    'AWAKENING...'
  ];

  // Dynamic rotating taglines
  const taglines = isAr ? [
    { p: 'جاري تجهيز ', h: 'الأفلام', s: '...', c: 'red' },
    { p: 'جاري فهرسة ', h: 'المسلسلات', s: '...', c: 'green' },
    { p: 'جاري تحميل ', h: 'الصوتيات', s: '...', c: 'red' },
    { p: 'جاري ربط ', h: 'الخادم المحلي', s: '...', c: 'green' },
    { p: 'جاري تحميل ', h: 'الألعاب', s: '...', c: 'red' },
    { p: 'التحقق من ', h: 'التراخيص', s: '...', c: 'green' }
  ] : [
    { p: 'Preparing ', h: 'Movies', s: '...', c: 'red' },
    { p: 'Indexing ', h: 'Series', s: '...', c: 'green' },
    { p: 'Loading ', h: 'Audio', s: '...', c: 'red' },
    { p: 'Connecting ', h: 'Local Server', s: '...', c: 'green' },
    { p: 'Initializing ', h: 'Gaming', s: '...', c: 'red' },
    { p: 'Verifying ', h: 'Licenses', s: '...', c: 'green' }
  ];

  // Build 28 glass shards for the crystal collapse exit animation
  const triggerFractureCollapse = () => {
    if (isHidingRef.current) return;
    isHidingRef.current = true;
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);

    const overlay = fractureOverlayRef.current;
    const flash = fractureFlashRef.current;
    const supernova = supernovaRef.current;
    const cont = containerRef.current;

    if (!overlay || !cont) {
      setVisible(false);
      return;
    }

    // Clear old shards
    overlay.querySelectorAll('.shard').forEach(s => s.remove());

    const COLS = 6;
    const ROWS = 4;
    const cw = window.innerWidth / COLS;
    const ch = window.innerHeight / ROWS;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const shards = [];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const shard = document.createElement('div');
        shard.className = 'shard';

        const x = c * cw - 2;
        const y = r * ch - 2;
        shard.style.left = `${x}px`;
        shard.style.top = `${y}px`;
        shard.style.width = `${cw + 4}px`;
        shard.style.height = `${ch + 4}px`;

        // Irregular polygon with jitter
        const jitter = () => Math.random() * 16;
        shard.style.clipPath = `polygon(${jitter()}% ${jitter()}%, ${100 - jitter()}% ${jitter()}%, ${100 - jitter()}% ${100 - jitter()}%, ${jitter()}% ${100 - jitter()}%)`;

        // Directional trajectory from center
        const scx = x + cw / 2;
        const scy = y + ch / 2;
        const dx = (scx - cx) * 2.5 + (Math.random() - 0.5) * 250;
        const dy = (scy - cy) * 2.5 + (Math.random() - 0.5) * 250;
        shard.style.setProperty('--tx', `${dx}px`);
        shard.style.setProperty('--ty', `${dy}px`);
        shard.style.setProperty('--rot', `${(Math.random() - 0.5) * 720}deg`);
        shard.style.animationDelay = `${Math.random() * 0.06}s`;

        const hue = Math.random();
        if (hue < 0.3) {
          shard.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,42,42,0.15) 50%, rgba(255,255,255,0.22))';
        } else if (hue < 0.6) {
          shard.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(74,222,128,0.15) 50%, rgba(255,255,255,0.22))';
        }

        overlay.appendChild(shard);
        shards.push(shard);
      }
    }

    // 1. Activate flash & supernova
    overlay.classList.add('active');
    if (flash) flash.classList.add('active');
    if (supernova) supernova.classList.add('fire');

    // 2. Hide background container quickly
    setTimeout(() => {
      cont.style.transition = 'opacity 0.28s ease-out';
      cont.style.opacity = '0';
    }, 70);

    // 3. Launch shards flying
    setTimeout(() => {
      shards.forEach(s => s.classList.add('fly'));
    }, 90);

    // 4. Complete exit & unmount
    setTimeout(() => {
      setVisible(false);
      isHidingRef.current = false;
    }, 1250);
  };

  const startSplash = () => {
    setProgress(0);
    setIsDone(false);
    isHidingRef.current = false;
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

  // Boot messages ticker
  useEffect(() => {
    if (!visible) return;
    setBootIdx(0);
    const interval = setInterval(() => {
      setBootIdx(prev => {
        if (prev < bootMessages.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [visible]);

  // Live HUD clock & memory simulation
  useEffect(() => {
    if (!visible) return;
    const updateTime = () => {
      const now = new Date();
      setClockStr(
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0')
      );
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);
    const memInterval = setInterval(() => {
      setMemVal(Math.floor(190 + Math.random() * 380));
    }, 1500);

    return () => {
      clearInterval(clockInterval);
      clearInterval(memInterval);
    };
  }, [visible]);

  // Tagline rotation (spaced to let users read multiple categories comfortably)
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setTaglineFade(true);
      setTimeout(() => {
        setTaglineIndex(prev => (prev + 1) % taglines.length);
        setTaglineFade(false);
      }, 350);
    }, 550);
    return () => clearInterval(interval);
  }, [visible, taglines.length]);

  // Progress syncing loop (~10.5 seconds to reach 100% + 1.5s victory reveal = ~12s total)
  useEffect(() => {
    if (!visible) return;
    setProgress(0);
    setIsDone(false);

    progressTimerRef.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + Math.random() * 2.4 + 1.4;
        if (next >= 100) {
          clearInterval(progressTimerRef.current);
          setIsDone(true);
          setTimeout(() => {
            triggerFractureCollapse();
          }, 350);
          return 100;
        }
        return next;
      });
    }, 28);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [visible]);

  // Escape key to skip
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        triggerFractureCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible]);

  // High Performance Lightweight Particle Canvas & 3D Interactive Stage
  useEffect(() => {
    if (!visible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    let W = window.innerWidth;
    let H = window.innerHeight;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // Cap at 1.5 for ultra-high FPS
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Optimized particle count: 48 particles (silky smooth, zero stutter)
    let mouseX = W / 2;
    let mouseY = H / 2;
    const PARTICLE_COUNT = 48;
    const particles = [];

    class Particle {
      constructor() {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
        this.vx = (Math.random() - 0.5) * 0.25;
        this.vy = (Math.random() - 0.5) * 0.25;
        this.size = Math.random() * 1.6 + 0.6;
        const r = Math.random();
        this.color = r < 0.4 ? '255, 42, 42' : r < 0.8 ? '74, 222, 128' : '255, 255, 255';
        this.alpha = Math.random() * 0.4 + 0.35;
      }
      update() {
        const dx = mouseX - this.x;
        const dy = mouseY - this.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 40000 && distSq > 0) { // 200px radius
          const dist = Math.sqrt(distSq);
          const force = ((200 - dist) / 200) * 0.12;
          this.vx += (dx / dist) * force;
          this.vy += (dy / dist) * force;
        }
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0) this.x = W;
        if (this.x > W) this.x = 0;
        if (this.y < 0) this.y = H;
        if (this.y > H) this.y = 0;
      }
      draw() {
        // Fast hardware vector fill without costly shadowBlur passes
        ctx.fillStyle = `rgba(${this.color}, ${this.alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        // Soft halo on larger particles
        if (this.size > 1.4) {
          ctx.fillStyle = `rgba(${this.color}, ${this.alpha * 0.25})`;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size * 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle());
    }

    // Lightweight Trail (Capped at 8 dots)
    const trail = [];
    class TrailDot {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.life = 1;
        this.size = Math.random() * 2.5 + 1;
      }
      update() {
        this.life -= 0.04;
        this.size *= 0.95;
      }
      draw() {
        if (this.life <= 0) return;
        ctx.fillStyle = `rgba(74, 222, 128, ${this.life * 0.6})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Shooting stars
    const stars = [];
    class ShootingStar {
      constructor() {
        this.x = Math.random() * W * 0.5;
        this.y = Math.random() * H * 0.3;
        this.len = 70 + Math.random() * 80;
        this.angle = Math.PI / 4 + (Math.random() - 0.5) * 0.25;
        this.speed = 9 + Math.random() * 5;
        this.life = 1;
      }
      update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.life -= 0.025;
      }
      draw() {
        if (this.life <= 0) return;
        const ex = this.x - Math.cos(this.angle) * this.len;
        const ey = this.y - Math.sin(this.angle) * this.len;
        const grad = ctx.createLinearGradient(this.x, this.y, ex, ey);
        grad.addColorStop(0, `rgba(255, 255, 255, ${this.life * 0.85})`);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    const starSpawnInterval = setInterval(() => {
      if (Math.random() < 0.3) stars.push(new ShootingStar());
    }, 2800);

    // RAF-throttled Mouse Tracking
    let lastTrailTime = 0;
    let pendingMouseX = mouseX;
    let pendingMouseY = mouseY;
    let mouseRafId = null;

    const handleMouseMove = (e) => {
      pendingMouseX = e.clientX;
      pendingMouseY = e.clientY;

      if (!mouseRafId) {
        mouseRafId = requestAnimationFrame(() => {
          mouseX = pendingMouseX;
          mouseY = pendingMouseY;
          if (mxRef.current) mxRef.current.textContent = Math.floor(mouseX);
          if (myRef.current) myRef.current.textContent = Math.floor(mouseY);

          const now = Date.now();
          if (now - lastTrailTime > 40) {
            if (trail.length >= 8) trail.shift();
            trail.push(new TrailDot(mouseX, mouseY));
            lastTrailTime = now;
          }

          if (stageRef.current) {
            const cx = W / 2;
            const cy = H / 2;
            const dx = (mouseX - cx) / cx;
            const dy = (mouseY - cy) / cy;
            stageRef.current.style.transform = `translate(-50%, -50%) rotateY(${dx * 4}deg) rotateX(${-dy * 4}deg)`;
          }
          mouseRafId = null;
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Ultra-Fast Render loop (Runs at full 60fps+ on any device)
    const animate = () => {
      ctx.clearRect(0, 0, W, H);

      // Lightweight proximity connection lines (Squared distance check avoids Math.sqrt)
      const pLen = particles.length;
      for (let i = 0; i < pLen; i++) {
        const p1 = particles[i];
        for (let j = i + 1; j < pLen; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 4225) { // 65 * 65
            const dist = Math.sqrt(distSq);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(74, 222, 128, ${(1 - dist / 65) * 0.08})`;
            ctx.lineWidth = 0.4;
            ctx.stroke();
          }
        }
      }

      particles.forEach(p => {
        p.update();
        p.draw();
      });

      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].update();
        trail[i].draw();
        if (trail[i].life <= 0) trail.splice(i, 1);
      }

      for (let i = stars.length - 1; i >= 0; i--) {
        stars[i].update();
        stars[i].draw();
        if (stars[i].life <= 0) stars.splice(i, 1);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (mouseRafId) cancelAnimationFrame(mouseRafId);
      clearInterval(starSpawnInterval);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [visible]);

  if (!visible) return null;

  const currentTagline = taglines[taglineIndex] || taglines[0];
  const orbitThresholds = [10, 25, 42, 58, 75, 92];

  return (
    <div id="arn-splash-container" ref={containerRef}>
      <style>{`
        #arn-splash-container {
          position: fixed; inset: 0;
          background: radial-gradient(circle at 50% 50%, #090c18 0%, #03050c 55%, #000 100%);
          overflow: hidden; z-index: 99999; isolation: isolate;
          user-select: none;
          font-family: 'Tajawal', sans-serif !important;
        }

        #starfield { position: absolute; inset: 0; z-index: 1; pointer-events: none; }

        /* Optimized Aurora & Cosmic Glow */
        .aurora {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
          opacity: 0.32;
          background:
            radial-gradient(ellipse 70% 25% at 30% 10%, rgba(74, 222, 128, 0.3), transparent 60%),
            radial-gradient(ellipse 65% 20% at 70% 15%, rgba(255, 42, 42, 0.25), transparent 60%);
          filter: blur(35px);
          animation: auroraShift 12s ease-in-out infinite alternate;
          will-change: transform;
        }
        @keyframes auroraShift {
          0% { transform: scale(1) translateX(-20px); opacity: 0.28; }
          100% { transform: scale(1.1) translateX(20px); opacity: 0.42; }
        }

        .galaxy-spiral {
          position: absolute; top: 50%; left: 50%;
          width: 800px; height: 800px; margin: -400px 0 0 -400px;
          z-index: 0; pointer-events: none; opacity: 0.12;
          animation: galaxyRotate 90s linear infinite;
          will-change: transform;
        }
        @keyframes galaxyRotate { to { transform: rotate(360deg); } }

        .god-rays {
          position: absolute; top: 50%; left: 50%;
          width: 900px; height: 900px; margin: -450px 0 0 -450px;
          z-index: 0; pointer-events: none;
          background: radial-gradient(circle, rgba(74, 222, 128, 0.08) 0%, rgba(255, 42, 42, 0.06) 35%, transparent 70%);
          animation: raysRotate 60s linear infinite; opacity: 0.5;
          will-change: transform;
        }
        @keyframes raysRotate { to { transform: rotate(360deg); } }

        .stage {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          display: flex; flex-direction: column; align-items: center;
          z-index: 5; perspective: 1200px;
          transition: transform 0.25s ease-out;
        }

        /* ============ الشعار ============ */
        .logo-container {
          position: relative; width: 210px; height: 210px;
          display: flex; align-items: center; justify-content: center;
          opacity: 0;
          animation: logoReveal 1.3s cubic-bezier(0.175, 0.885, 0.32, 1.2) 0.8s forwards;
        }
        @keyframes logoReveal {
          0% { opacity: 0; transform: scale(0.4) rotateY(180deg); }
          60% { opacity: 1; transform: scale(1.1) rotateY(0); }
          100% { opacity: 1; transform: scale(1) rotateY(0); }
        }

        .logo {
          width: 100%; height: 100%; object-fit: contain;
          border-radius: 26px;
          filter: drop-shadow(0 0 22px rgba(255, 42, 42, 0.55)) drop-shadow(0 0 38px rgba(74, 222, 128, 0.45));
          animation: logoBreathe 3s ease-in-out infinite 2s;
          z-index: 3;
        }
        @keyframes logoBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.025); } }
        .logo.done {
          filter: drop-shadow(0 0 35px rgba(255, 42, 42, 0.85)) drop-shadow(0 0 60px rgba(74, 222, 128, 0.85));
          animation: logoHeartbeat 0.6s ease-in-out 3;
        }
        @keyframes logoHeartbeat {
          0%, 100% { transform: scale(1); }
          30% { transform: scale(1.12); }
          60% { transform: scale(1.04); }
        }

        .logo-aura-red, .logo-aura-green {
          position: absolute; border-radius: 50%; pointer-events: none;
          filter: blur(30px); z-index: 1;
        }
        .logo-aura-red {
          inset: -18px;
          background: radial-gradient(circle, rgba(255, 42, 42, 0.45), transparent 70%);
          animation: auraPulse 2.5s ease-in-out infinite;
        }
        .logo-aura-green {
          inset: -25px;
          background: radial-gradient(circle, rgba(74, 222, 128, 0.38), transparent 70%);
          animation: auraPulse 2.5s ease-in-out infinite 1.25s;
        }
        @keyframes auraPulse {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(1.22); opacity: 0.65; }
        }

        /* ============ النظام الشمسي ============ */
        .solar-system {
          position: absolute; top: 50%; left: 50%;
          width: 370px; height: 370px;
          transform: translate(-50%, -50%);
          pointer-events: none; z-index: 2;
        }
        .orbit {
          position: absolute; inset: 0;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.05);
          display: flex; align-items: flex-start; justify-content: center;
          animation: orbitRotate linear infinite;
          animation-play-state: paused;
          will-change: transform;
        }
        .orbit.loaded { animation-play-state: running; }
        .orbit-1 { animation-duration: 8s; width: 230px; height: 230px; top: 70px; left: 70px; border-color: rgba(255, 42, 42, 0.15); }
        .orbit-2 { animation-duration: 12s; width: 290px; height: 290px; top: 40px; left: 40px; border-color: rgba(74, 222, 128, 0.15); animation-direction: reverse; }
        .orbit-3 { animation-duration: 16s; width: 370px; height: 370px; border-color: rgba(255, 42, 42, 0.1); }
        .orbit-4 { animation-duration: 20s; width: 460px; height: 460px; top: -45px; left: -45px; border-color: rgba(74, 222, 128, 0.1); animation-direction: reverse; }
        .orbit-5 { animation-duration: 25s; width: 560px; height: 560px; top: -95px; left: -95px; border-color: rgba(255, 255, 255, 0.06); }
        .orbit-6 { animation-duration: 30s; width: 670px; height: 670px; top: -150px; left: -150px; border-color: rgba(255, 191, 36, 0.08); animation-direction: reverse; }
        @keyframes orbitRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .planet {
          width: 9px; height: 9px; border-radius: 50%;
          position: absolute; top: -4.5px;
        }
        .planet-1 { background: #ff2a2a; box-shadow: 0 0 8px #ff2a2a; }
        .planet-2 { background: #4ade80; box-shadow: 0 0 8px #4ade80; }
        .planet-3 { background: #fff; box-shadow: 0 0 8px #fff; }
        .planet-4 { background: #fbbf24; box-shadow: 0 0 8px #fbbf24; }
        .planet-5 { background: #ff2a2a; box-shadow: 0 0 8px #ff2a2a; }
        .planet-6 { background: #4ade80; box-shadow: 0 0 8px #4ade80; }

        .constellation-ring {
          position: absolute; inset: -55px;
          border-radius: 50%; pointer-events: none; z-index: 0;
        }
        .constellation-ring::before {
          content: ''; position: absolute; inset: 0;
          border-radius: 50%;
          border: 1px dashed rgba(255, 255, 255, 0.08);
          animation: constRotate 40s linear infinite;
        }
        @keyframes constRotate { to { transform: rotate(360deg); } }

        /* ============ الأقمار الصناعية (منصات البث) ============ */
        .satellite-belt {
          position: absolute; top: 50%; left: 50%;
          width: 440px; height: 440px;
          transform: translate(-50%, -50%);
          pointer-events: none; z-index: 2;
        }
        .satellite-orbit {
          position: absolute; inset: 0;
          animation: satelliteSpin 40s linear infinite;
          will-change: transform;
        }
        .satellite-orbit:nth-child(1) { animation-delay: 0s; }
        .satellite-orbit:nth-child(2) { animation-delay: -6.66s; }
        .satellite-orbit:nth-child(3) { animation-delay: -13.33s; }
        .satellite-orbit:nth-child(4) { animation-delay: -20s; }
        .satellite-orbit:nth-child(5) { animation-delay: -26.66s; }
        .satellite-orbit:nth-child(6) { animation-delay: -33.33s; }
        @keyframes satelliteSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* خفة عالية مع مظهر فخم داكن بدون استنزاف الـ GPU */
        .satellite {
          position: absolute; top: 0; left: 50%;
          width: 44px; height: 44px;
          margin-left: -22px; margin-top: -22px;
          border-radius: 13px;
          background: rgba(8, 12, 22, 0.92);
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
          opacity: 0;
          animation: satelliteFade 0.8s ease 1.6s forwards;
          will-change: transform, opacity;
        }
        @keyframes satelliteFade { to { opacity: 1; } }

        .satellite svg {
          width: 24px; height: 24px;
          animation: satelliteCounterSpin 40s linear infinite;
          will-change: transform;
        }
        @keyframes satelliteCounterSpin { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }

        /* منصات البث */
        .satellite.netflix { border-color: rgba(229, 9, 20, 0.6); box-shadow: 0 0 12px rgba(229, 9, 20, 0.35); }
        .satellite.youtube { border-color: rgba(255, 0, 0, 0.6); box-shadow: 0 0 12px rgba(255, 0, 0, 0.35); }
        .satellite.spotify { border-color: rgba(29, 185, 84, 0.6); box-shadow: 0 0 12px rgba(29, 185, 84, 0.35); }
        .satellite.prime { border-color: rgba(0, 168, 225, 0.6); box-shadow: 0 0 12px rgba(0, 168, 225, 0.35); }
        .satellite.disney { border-color: rgba(17, 60, 207, 0.6); box-shadow: 0 0 12px rgba(17, 60, 207, 0.4); }
        .satellite.twitch { border-color: rgba(145, 70, 255, 0.6); box-shadow: 0 0 12px rgba(145, 70, 255, 0.35); }

        /* ============ النصوص ============ */
        .brand {
          font-family: 'Audiowide', sans-serif !important;
          font-size: 38px; letter-spacing: 9px; margin: 20px 0 0;
          background: linear-gradient(90deg, #4ade80, #fff, #ff2a2a);
          background-size: 200% 100%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 16px rgba(74, 222, 128, 0.45)) drop-shadow(0 0 16px rgba(255, 42, 42, 0.45));
          opacity: 0;
          animation: brandIn 0.8s ease 1.3s forwards, brandShift 6s linear infinite 2.1s;
          z-index: 3;
        }
        @keyframes brandIn { to { opacity: 1; } }
        @keyframes brandShift { to { background-position: 200% 50%; } }

        /* ============ اسم المطور (المبرمج عبده رجب نصار) ============ */
        .dev-credit {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          margin-top: 8px;
          padding: 4px 14px;
          border-radius: 9999px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          font-family: 'Tajawal', sans-serif !important;
          font-size: 13px; font-weight: 700;
          color: #10b981;
          letter-spacing: 0.5px;
          text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
          box-shadow: 0 0 15px rgba(16, 185, 129, 0.15);
          opacity: 0;
          animation: brandIn 0.8s ease 1.5s forwards;
          z-index: 3;
        }
        .dev-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
          animation: indicatorBlink 1.5s ease-in-out infinite;
        }

        .tagline {
          font-family: 'Tajawal', sans-serif !important;
          font-size: 13.5px; color: #9ca3af;
          margin-top: 10px; height: 20px;
          opacity: 0; animation: brandIn 0.8s ease 1.7s forwards;
          transition: opacity 0.3s; z-index: 3;
        }
        .tagline.fade { opacity: 0; }
        .tagline .hl { font-weight: 700; }
        .tagline .hl.red { color: #ff2a2a; text-shadow: 0 0 10px #ff2a2a; }
        .tagline .hl.green { color: #4ade80; text-shadow: 0 0 10px #4ade80; }

        .progress-text {
          font-family: 'Rajdhani', sans-serif !important;
          font-size: 11px; letter-spacing: 4px;
          color: #4ade80; margin-top: 16px;
          text-shadow: 0 0 8px #4ade80;
          opacity: 0; animation: brandIn 0.8s ease 1.8s forwards;
          z-index: 3;
        }

        /* Waveform فائق الخفة عبر GPU Compositor scaleY بدلاً من layout height */
        .waveform {
          position: absolute; bottom: 74px; left: 50%;
          transform: translateX(-50%);
          display: flex; align-items: flex-end; gap: 3px;
          height: 32px; z-index: 4; opacity: 0.75;
          pointer-events: none;
        }
        .waveform .bar {
          width: 3px; height: 32px;
          transform-origin: bottom;
          transform: scaleY(0.25);
          background: linear-gradient(180deg, #4ade80, #ff2a2a);
          border-radius: 2px;
          animation: waveScale 1.2s ease-in-out infinite;
          will-change: transform;
        }
        @keyframes waveScale {
          0%, 100% { transform: scaleY(0.25); opacity: 0.45; }
          50% { transform: scaleY(1); opacity: 1; }
        }

        .hud-top {
          position: absolute; top: 22px; left: 24px; right: 24px;
          display: flex; justify-content: space-between;
          font-family: 'Rajdhani', sans-serif !important;
          font-size: 10px; letter-spacing: 2px;
          color: rgba(74, 222, 128, 0.7); z-index: 10;
          opacity: 0; animation: brandIn 0.8s ease 1.1s forwards;
          text-shadow: 0 0 6px rgba(74, 222, 128, 0.4);
          pointer-events: none;
        }
        .hud-top .hud-left { text-align: start; }
        .hud-top .hud-right { text-align: end; }
        .hud-top .hud-center { text-align: center; }
        .hud-top .clock {
          font-family: 'Audiowide', sans-serif !important;
          font-size: 17px; color: #fff; letter-spacing: 3px;
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.4), 0 0 18px rgba(74, 222, 128, 0.3);
        }
        .hud-top .val { color: #fff; font-weight: 700; }
        .hud-top .indicator {
          display: inline-block; width: 6px; height: 6px;
          border-radius: 50%; background: #4ade80;
          box-shadow: 0 0 8px #4ade80;
          animation: indicatorBlink 1.5s ease-in-out infinite;
          margin: 0 4px; vertical-align: middle;
        }
        @keyframes indicatorBlink { 50% { opacity: 0.3; } }

        /* ============ شريط أسفل الشاشة مع اسم شركة ARN Technology ============ */
        .hud-bottom {
          position: absolute; bottom: 20px; left: 24px; right: 24px;
          display: flex; justify-content: space-between; align-items: center;
          font-family: 'Rajdhani', sans-serif !important;
          font-size: 10px; letter-spacing: 2px;
          color: rgba(255, 42, 42, 0.6); z-index: 10;
          opacity: 0; animation: brandIn 0.8s ease 1.1s forwards;
          pointer-events: none;
        }
        .hud-bottom .company-footer {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 2px; text-align: center; pointer-events: auto;
        }
        .company-badge {
          display: flex; align-items: center; gap: 6px;
          padding: 3px 12px;
          border-radius: 9999px;
          background: rgba(15, 20, 32, 0.7);
          border: 1px solid rgba(74, 222, 128, 0.25);
          box-shadow: 0 0 12px rgba(0, 0, 0, 0.5);
        }
        .company-name {
          font-family: 'Audiowide', 'Rajdhani', sans-serif !important;
          font-size: 11px; font-weight: 900; letter-spacing: 3px;
          color: #f1f5f9;
          text-shadow: 0 0 10px rgba(74, 222, 128, 0.5);
        }
        .company-sub {
          font-family: 'Tajawal', sans-serif !important;
          font-size: 9.5px; letter-spacing: 1px;
          color: #94a3b8;
        }
        .hud-bottom .skip {
          cursor: pointer; pointer-events: auto;
          padding: 4px 10px;
          border: 1px solid rgba(255, 42, 42, 0.3);
          border-radius: 4px; transition: all 0.25s;
          background: rgba(15, 20, 30, 0.6);
        }
        .hud-bottom .skip:hover {
          background: rgba(255, 42, 42, 0.2);
          border-color: #ff2a2a; color: #ff2a2a;
          box-shadow: 0 0 10px rgba(255, 42, 42, 0.4);
        }

        /* ============ سوبرنوفا ============ */
        .supernova {
          position: absolute; top: 50%; left: 50%;
          width: 100px; height: 100px; margin: -50px 0 0 -50px;
          border-radius: 50%;
          background: radial-gradient(circle, #fff, #ff2a2a 30%, transparent 70%);
          opacity: 0; pointer-events: none; z-index: 100;
          transform: scale(0);
        }
        .supernova.fire { animation: supernova 1.2s ease-out forwards; }
        @keyframes supernova {
          0% { transform: scale(0); opacity: 1; }
          30% { transform: scale(4); opacity: 0.8; }
          100% { transform: scale(18); opacity: 0; }
        }

        /* ============ تفتّت بلوري زجاجي خفيف وسلس ============ */
        .fracture-overlay {
          position: fixed; inset: 0;
          pointer-events: none;
          z-index: 100000;
          opacity: 0;
          transition: opacity 0.1s;
        }
        .fracture-overlay.active { opacity: 1; }

        .shard {
          position: absolute;
          background:
            linear-gradient(135deg,
              rgba(255, 255, 255, 0.12) 0%,
              rgba(74, 222, 128, 0.08) 35%,
              rgba(255, 42, 42, 0.08) 65%,
              rgba(255, 255, 255, 0.14) 100%);
          border: 1px solid rgba(255, 255, 255, 0.18);
          transform-origin: center;
          transform: translate(0, 0) rotate(0deg) scale(1);
          opacity: 0;
          will-change: transform, opacity;
        }

        .shard.fly {
          animation: shardFly 1.1s cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }
        @keyframes shardFly {
          0% {
            transform: translate(0, 0) rotate(0deg) scale(1);
            opacity: 1;
          }
          30% { opacity: 1; }
          100% {
            transform: translate(var(--tx, 0), var(--ty, 0)) rotate(var(--rot, 0deg)) scale(0.35);
            opacity: 0;
          }
        }

        .fracture-flash {
          position: absolute; inset: 0;
          background: radial-gradient(circle at center, rgba(255,255,255,0.85), transparent 60%);
          pointer-events: none;
          opacity: 0;
        }
        .fracture-flash.active {
          animation: flashBurst 0.5s ease-out forwards;
        }
        @keyframes flashBurst {
          0% { opacity: 0; }
          25% { opacity: 1; }
          100% { opacity: 0; }
        }

        .boot-text {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          font-family: 'Rajdhani', monospace !important;
          font-size: 11px; color: #4ade80;
          text-shadow: 0 0 8px #4ade80;
          z-index: 15; opacity: 1;
          animation: bootFade 1.8s ease 0.15s forwards;
          pointer-events: none;
        }
        @keyframes bootFade {
          0% { opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }

        @media (max-width: 640px) {
          .logo-container { width: 150px; height: 150px; }
          .brand { font-size: 28px; letter-spacing: 6px; }
          .dev-credit { font-size: 11px; padding: 3px 10px; }
          .tagline { font-size: 11px; }
          .hud-top { font-size: 8px; }
          .hud-top .clock { font-size: 13px; }
          .satellite-belt { width: 320px; height: 320px; }
          .satellite { width: 34px; height: 34px; margin-left: -17px; margin-top: -17px; border-radius: 10px; }
          .satellite svg { width: 18px; height: 18px; }
          .solar-system { width: 280px; height: 280px; }
          .orbit-1 { width: 170px; height: 170px; top: 55px; left: 55px; }
          .orbit-2 { width: 220px; height: 220px; top: 30px; left: 30px; }
          .orbit-3 { width: 280px; height: 280px; }
          .orbit-4 { width: 350px; height: 350px; top: -35px; left: -35px; }
          .orbit-5 { width: 420px; height: 420px; top: -70px; left: -70px; }
          .orbit-6 { width: 490px; height: 490px; top: -105px; left: -105px; }
          .waveform { bottom: 64px; gap: 2px; }
          .waveform .bar { width: 2px; }
          .company-name { font-size: 9.5px; letter-spacing: 2px; }
        }
      `}</style>

      {/* 1. Canvas Interactive Starfield */}
      <canvas id="starfield" ref={canvasRef} />

      {/* 2. Atmospheric Aurora & God Rays */}
      <div className="aurora" />
      <div className="god-rays" />

      {/* 3. Galaxy Spiral */}
      <svg className="galaxy-spiral" viewBox="0 0 400 400">
        <g fill="none" strokeWidth="0.5">
          <path d="M 200 200 Q 250 180 280 220 T 340 280" stroke="rgba(74, 222, 128, 0.3)" />
          <path d="M 200 200 Q 150 180 120 220 T 60 280" stroke="rgba(255, 42, 42, 0.3)" />
          <path d="M 200 200 Q 220 250 180 280 T 120 340" stroke="rgba(74, 222, 128, 0.2)" />
          <path d="M 200 200 Q 180 150 220 120 T 280 60" stroke="rgba(255, 42, 42, 0.2)" />
          <circle cx="200" cy="200" r="3" fill="rgba(255, 255, 255, 0.5)" />
        </g>
      </svg>

      {/* 4. Boot Text Sequence */}
      <div className="boot-text">{bootMessages[bootIdx]}</div>

      {/* 5. HUD Top Bar */}
      <div className="hud-top">
        <div className="hud-left">
          <div>◉ SYSTEM <span className="val">ACTIVE</span></div>
          <div>◉ NET <span className="val">LOCAL</span> <span className="indicator" /></div>
        </div>
        <div className="hud-center">
          <div className="clock">{clockStr}</div>
        </div>
        <div className="hud-right">
          <div>CORE <span className="val">ARM64</span> ◉</div>
          <div>MEM <span className="val">{memVal}</span> MB ◉</div>
        </div>
      </div>

      {/* 6. Central 3D Stage */}
      <div className="stage" ref={stageRef}>
        <div className="logo-container">
          <div className="constellation-ring" />
          <div className="logo-aura-red" />
          <div className="logo-aura-green" />

          {/* Planetary Solar System */}
          <div className="solar-system">
            <div className={`orbit orbit-1 ${progress >= orbitThresholds[0] ? 'loaded' : ''}`}><div className="planet planet-1" /></div>
            <div className={`orbit orbit-2 ${progress >= orbitThresholds[1] ? 'loaded' : ''}`}><div className="planet planet-2" /></div>
            <div className={`orbit orbit-3 ${progress >= orbitThresholds[2] ? 'loaded' : ''}`}><div className="planet planet-3" /></div>
            <div className={`orbit orbit-4 ${progress >= orbitThresholds[3] ? 'loaded' : ''}`}><div className="planet planet-4" /></div>
            <div className={`orbit orbit-5 ${progress >= orbitThresholds[4] ? 'loaded' : ''}`}><div className="planet planet-5" /></div>
            <div className={`orbit orbit-6 ${progress >= orbitThresholds[5] ? 'loaded' : ''}`}><div className="planet planet-6" /></div>
          </div>

          {/* Platform Satellites Orbiting */}
          <div className="satellite-belt">
            <div className="satellite-orbit">
              <div className="satellite netflix" title="Netflix">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#E50914" d="M5.5 2h3.2l5.1 12V2h3.2v20h-3.1L9 9.2V22H5.5V2z" />
                </svg>
              </div>
            </div>
            <div className="satellite-orbit">
              <div className="satellite youtube" title="YouTube">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="5" width="20" height="14" rx="4" fill="#FF0000" />
                  <path d="M10 9l6 3-6 3V9z" fill="#fff" />
                </svg>
              </div>
            </div>
            <div className="satellite-orbit">
              <div className="satellite spotify" title="Spotify">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#1DB954" />
                  <path d="M7 9.5c3-0.9 7-0.9 10 0.5" stroke="#000" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                  <path d="M7.5 13c2.5-0.7 6-0.6 9 0.5" stroke="#000" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  <path d="M8 16c2-0.5 5-0.4 8 0.5" stroke="#000" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            <div className="satellite-orbit">
              <div className="satellite prime" title="Prime Video">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="6" width="20" height="12" rx="3" fill="#00A8E1" />
                  <path d="M6 14c4 2 8 2 12 0" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                  <path d="M16.5 13.5l1.5 1.5-2-0.3z" fill="#fff" />
                </svg>
              </div>
            </div>
            <div className="satellite-orbit">
              <div className="satellite disney" title="Disney+">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#113CCF" />
                  <text x="12" y="16.5" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontSize="11" fontWeight="900" fill="#fff">D+</text>
                </svg>
              </div>
            </div>
            <div className="satellite-orbit">
              <div className="satellite twitch" title="Twitch">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 2h18v12l-4 4h-4l-3 3H8v-3H3V2z" fill="#9146FF" transform="translate(0, 1)" />
                  <path d="M10 7v6M15 7v6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Main 3D Neon Logo */}
          <img
            className={`logo ${isDone ? 'done' : ''}`}
            src="/ARN-logo.png"
            onError={(e) => { e.currentTarget.src = '/favicon.jpg'; }}
            alt="ARN STREAM"
          />
        </div>

        {/* Brand Title */}
        <h1 className="brand">ARN STREAM</h1>

        {/* اسم المطور - المبرمج عبده رجب نصار */}
        <div className="dev-credit">
          <span className="dev-dot" />
          <span>{isAr ? 'تطوير وبرمجة: عبده رجب نصار' : 'Developed by: Abdou Ragab Nassar'}</span>
        </div>

        {/* Tagline Rotation */}
        <div className={`tagline ${taglineFade ? 'fade' : ''}`}>
          {currentTagline.p}
          <span className={`hl ${currentTagline.c}`}>{currentTagline.h}</span>
          {currentTagline.s}
        </div>

        {/* Progress Text */}
        <div className="progress-text">
          {progress >= 100 ? (isAr ? 'جاهز · 100%' : 'READY · 100%') : `SYNCING ${Math.floor(progress)}%`}
        </div>
      </div>

      {/* 7. Lightweight GPU-Accelerated Audio Waveform (36 Bars) */}
      <div className="waveform">
        {Array.from({ length: 36 }).map((_, i) => (
          <div
            key={i}
            className="bar"
            style={{
              animationDelay: `${i * 0.035}s`,
              animationDuration: `${0.85 + (i % 6) * 0.12}s`
            }}
          />
        ))}
      </div>

      {/* 8. HUD Bottom: Mouse X/Y, Company Branding (ARN Technology), and Skip Button */}
      <div className="hud-bottom">
        <div>
          X:<span ref={mxRef}>0</span> Y:<span ref={myRef}>0</span>
        </div>

        {/* اسم الشركة أسفل الشاشة */}
        <div className="company-footer">
          <div className="company-badge">
            <span className="dev-dot" />
            <span className="company-name">ARN TECHNOLOGY</span>
          </div>
          <span className="company-sub">{isAr ? 'حقوق النشر © 2026 لشركة ARN Technology · جميع الحقوق محفوظة' : 'Copyright © 2026 ARN Technology · All Rights Reserved'}</span>
        </div>

        <div className="skip" onClick={triggerFractureCollapse}>
          ESC · SKIP
        </div>
      </div>

      {/* 9. Supernova Flash Burst */}
      <div className="supernova" ref={supernovaRef} />

      {/* 10. Crystal Fracture Glass Overlay */}
      <div className="fracture-overlay" ref={fractureOverlayRef}>
        <div className="fracture-flash" ref={fractureFlashRef} />
      </div>
    </div>
  );
}
