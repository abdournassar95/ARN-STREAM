import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Shield, Lock, User, Eye, EyeOff, Sparkles, CheckCircle, AlertCircle, ArrowRight, KeyRound, Languages, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicUsers } from '../api/client';
import OnboardingLibrariesWizard from '../components/auth/OnboardingLibrariesWizard';

/* ─── Animated Ring Canvas (Decorative) ─── */
function AnimatedRing({ size = 160 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let angle = 0;
    let animFrame;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;
      const r = size / 2 - 12;

      // Background track
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 5;
      ctx.stroke();

      // Animated arc segments
      const segments = 5;
      for (let i = 0; i < segments; i++) {
        const segAngle = (Math.PI * 2) / segments;
        const startA = angle + i * segAngle;
        const endA = startA + segAngle * 0.6;

        const grad = ctx.createConicGradient(startA, cx, cy);
        grad.addColorStop(0, 'rgba(6, 182, 212, 0)');
        grad.addColorStop(0.3, 'rgba(6, 182, 212, 0.8)');
        grad.addColorStop(0.5, 'rgba(234, 179, 8, 0.9)');
        grad.addColorStop(0.7, 'rgba(16, 185, 129, 0.8)');
        grad.addColorStop(1, 'rgba(6, 182, 212, 0)');

        ctx.beginPath();
        ctx.arc(cx, cy, r, startA, endA);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Center moon/crescent shape
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6, 182, 212, 0.04)';
      ctx.fill();
      ctx.restore();

      angle += 0.008;
      animFrame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrame);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="pointer-events-none"
    />
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { isInitialized, isAuthenticated, hasLibraries, isLoading, checkAuth, login, setupAdmin } = useAuthStore();

  const [activeTab, setActiveTab] = useState('login');
  const [step, setStep] = useState('auth');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSettingUpAdmin, setIsSettingUpAdmin] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const { data: publicUsers = [], isLoading: loadingPublicUsers } = useQuery({
    queryKey: ['publicUsers'],
    queryFn: fetchPublicUsers,
    enabled: isInitialized && !isLoading
  });

  useEffect(() => { checkAuth(); }, []);

  useEffect(() => {
    if (!isLoading) setActiveTab(isInitialized ? 'login' : 'register');
  }, [isInitialized, isLoading]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isSettingUpAdmin) {
      if (hasLibraries === false) {
        setStep('libraries');
      } else if (step !== 'libraries') {
        const target = location.state?.from?.pathname || '/';
        navigate(target, { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, navigate, location, step, isSettingUpAdmin, hasLibraries]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg(''); setSuccessMsg('');
    if (!username.trim() || !password) {
      setErrorMsg(isRtl ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      setSuccessMsg(isRtl ? 'تم تسجيل الدخول بنجاح!' : 'Logged in successfully!');
      setTimeout(() => {
        const target = location.state?.from?.pathname || '/';
        navigate(target, { replace: true });
      }, 500);
    } catch (err) {
      setErrorMsg(err.response?.data?.error?.message || (isRtl ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : 'Invalid username or password'));
    } finally { setSubmitting(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg(''); setSuccessMsg('');
    if (!username.trim() || !password) {
      setErrorMsg(isRtl ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }
    if (password.length < 4) {
      setErrorMsg(isRtl ? 'يجب أن تكون كلمة المرور 4 أحرف على الأقل' : 'Password must be at least 4 characters');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    setSubmitting(true);
    setIsSettingUpAdmin(true);
    try {
      await setupAdmin({
        username: username.trim(),
        password,
        display_name: displayName.trim() || username.trim()
      });
      setSuccessMsg(isRtl ? 'تم إنشاء حساب المسؤول بنجاح!' : 'Admin account created successfully!');
      setTimeout(() => { setSuccessMsg(''); setStep('libraries'); }, 500);
    } catch (err) {
      setErrorMsg(err.response?.data?.error?.message || (isRtl ? 'فشل إنشاء حساب المسؤول. حاول مجدداً.' : 'Failed to create admin account. Try again.'));
    } finally { setSubmitting(false); }
  };

  const toggleLanguage = () => i18n.changeLanguage(isRtl ? 'en' : 'ar');

  const inputCls = 'w-full bg-[#0c1829]/70 border border-amber-500/25 rounded-2xl px-12 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 focus:bg-[#0c1829]/90 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_0_12px_rgba(245,158,11,0.06)]';
  const labelCls = 'block text-xs font-bold text-slate-300 mb-1.5 tracking-wide';
  const iconEnd = `absolute ${isRtl ? 'left-4' : 'right-4'} top-3.5 text-slate-500 group-focus-within:text-cyan-400 transition-colors`;
  const iconStart = `absolute ${isRtl ? 'right-4' : 'left-4'} top-3.5 text-slate-500 group-focus-within:text-cyan-400 transition-colors`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060911] via-[#0a0f1e] to-[#040608] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans" dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ─── Top Bar ─── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
            <Play size={20} className="text-white fill-white ms-0.5" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-200">ARN MEDIA</h1>
            <p className="text-[9px] font-bold text-cyan-400/70 tracking-widest -mt-0.5">{isRtl ? 'منصة بث الميديا' : 'MEDIA STREAMING PLATFORM'}</p>
          </div>
        </div>
        <button type="button" onClick={toggleLanguage} className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all backdrop-blur-xl hover:scale-105">
          <Languages size={16} className="text-cyan-400" />
          <span>{isRtl ? 'EN' : 'AR'}</span>
        </button>
      </div>

      {/* ─── Ambient Glows ─── */}
      <div className="absolute top-1/4 -right-32 w-[500px] h-[500px] bg-cyan-500/8 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-1/4 -left-32 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '5s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px] pointer-events-none" />

      {step === 'libraries' ? (
        <OnboardingLibrariesWizard
          adminUser={{ username: username.trim(), display_name: displayName.trim() || username.trim() }}
          onComplete={() => navigate('/', { replace: true })}
        />
      ) : (
        <div className="w-full max-w-[920px] relative z-10 animate-fadeIn mt-16">

          {/* ─── Tab Switcher ─── */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center gap-1 bg-[#0c1829]/60 backdrop-blur-xl border border-white/10 rounded-full p-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
              <button
                type="button"
                onClick={() => { setActiveTab('login'); setErrorMsg(''); }}
                className={`px-8 py-3 rounded-full text-sm font-bold transition-all ${
                  activeTab === 'login'
                    ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-white border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isRtl ? 'تسجيل الدخول' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('register'); setErrorMsg(''); }}
                disabled={isInitialized}
                className={`px-8 py-3 rounded-full text-sm font-bold transition-all ${
                  activeTab === 'register'
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-white border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                    : 'text-slate-400 hover:text-slate-200'
                } ${isInitialized ? 'opacity-40 pointer-events-none' : ''}`}
              >
                {isRtl ? 'إنشاء حساب' : 'Create Account'}
              </button>
            </div>
          </div>

          {/* ─── Main Dual Panel ─── */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-0 md:gap-6 items-stretch">

            {/* ═══ LOGIN PANEL ═══ */}
            <div className={`backdrop-blur-3xl bg-[#0c1829]/50 border border-white/10 rounded-[2rem] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-500 ${
              activeTab === 'login' ? 'opacity-100 scale-100' : 'opacity-40 scale-[0.97] pointer-events-none'
            } ${activeTab !== 'login' ? 'hidden md:block' : ''}`}>
              <h2 className="text-xl font-bold text-slate-100 mb-6 text-center">{isRtl ? 'تسجيل الدخول' : 'Sign In'}</h2>

              {activeTab === 'login' && errorMsg && (
                <div className="mb-5 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <AlertCircle size={16} className="shrink-0" /><span>{errorMsg}</span>
                </div>
              )}
              {activeTab === 'login' && successMsg && (
                <div className="mb-5 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle size={16} className="shrink-0" /><span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                {(!selectedUser && publicUsers.length > 0) ? (
                  // Profile Selection View
                  <div className="space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {publicUsers.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { setSelectedUser(u); setUsername(u.username); setErrorMsg(''); }}
                          className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-cyan-500/30 transition-all hover:scale-105 group"
                        >
                          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-cyan-500/20 overflow-hidden border-2 border-transparent group-hover:border-cyan-400 transition-all">
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.display_name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{u.display_name.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <span className="text-xs font-bold text-slate-300 group-hover:text-cyan-300 truncate w-full text-center">
                            {u.display_name}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedUser({ manual: true })}
                        className="w-full py-2.5 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-colors"
                      >
                        {isRtl ? 'تسجيل دخول يدوي' : 'Manual Login'}
                      </button>
                    </div>
                  </div>
                ) : (
                  // Password or Manual Entry View
                  <div className="space-y-4 animate-fadeIn">
                    {selectedUser && selectedUser.id && (
                      <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm overflow-hidden">
                          {selectedUser.avatar ? (
                            <img src={selectedUser.avatar} alt={selectedUser.display_name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{selectedUser.display_name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-bold text-slate-200">{selectedUser.display_name}</div>
                          <div className="text-[10px] text-cyan-400">@{selectedUser.username}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setSelectedUser(null); setPassword(''); setErrorMsg(''); }}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                          title={isRtl ? 'العودة للملفات' : 'Back to Profiles'}
                        >
                          {isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                        </button>
                      </div>
                    )}

                    {(!selectedUser || selectedUser.manual) && (
                      <div>
                        <label className={labelCls}>{isRtl ? 'اسم المستخدم' : 'Username'}</label>
                        <div className="relative group">
                          <input type="text" value={activeTab === 'login' ? username : ''} onChange={(e) => activeTab === 'login' && setUsername(e.target.value)} placeholder={isRtl ? 'اسم المستخدم' : 'admin'} autoComplete="username" className={inputCls} />
                          <User size={18} className={iconEnd} />
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <label className={labelCls}>{isRtl ? 'رقم سري' : 'Password'}</label>
                      <div className="relative group">
                        <input type={showPassword ? 'text' : 'password'} value={activeTab === 'login' ? password : ''} onChange={(e) => activeTab === 'login' && setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" className={inputCls} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className={`${iconEnd} hover:text-cyan-400 cursor-pointer`}>
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                        <KeyRound size={18} className={iconStart} />
                      </div>
                    </div>
                    
                    {selectedUser && selectedUser.manual && publicUsers.length > 0 && (
                      <div className="flex justify-start">
                        <button
                          type="button"
                          onClick={() => { setSelectedUser(null); setErrorMsg(''); }}
                          className="text-[10px] text-cyan-500 hover:text-cyan-400 font-semibold"
                        >
                          {isRtl ? 'العودة لاختيار الحساب' : 'Back to Profile Selection'}
                        </button>
                      </div>
                    )}

                    <div className="pt-3">
                      <button type="submit" disabled={submitting || activeTab !== 'login'} className="relative w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-sm shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2 overflow-hidden group">
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-out" />
                        {submitting && activeTab === 'login' ? (
                          <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <><span>{isRtl ? 'تسجيل الدخول' : 'Log In'}</span><ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} /></>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>

            {/* ═══ CENTER RING ═══ */}
            <div className="hidden md:flex items-center justify-center">
              <AnimatedRing size={140} />
            </div>

            {/* ═══ REGISTER PANEL ═══ */}
            <div className={`backdrop-blur-3xl bg-[#0c1829]/50 border border-white/10 rounded-[2rem] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-500 ${
              activeTab === 'register' ? 'opacity-100 scale-100' : 'opacity-40 scale-[0.97] pointer-events-none'
            } ${activeTab !== 'register' ? 'hidden md:block' : ''}`}>
              <h2 className="text-xl font-bold text-slate-100 mb-6 text-center">{isRtl ? 'إنشاء حساب' : 'Create Account'}</h2>

              {isInitialized && (
                <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold text-center animate-fadeIn">
                  {isRtl ? 'تم إعداد الحساب بالفعل. استخدم تسجيل الدخول.' : 'Account already set up. Use Sign In.'}
                </div>
              )}

              {activeTab === 'register' && errorMsg && (
                <div className="mb-5 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <AlertCircle size={16} className="shrink-0" /><span>{errorMsg}</span>
                </div>
              )}
              {activeTab === 'register' && successMsg && (
                <div className="mb-5 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle size={16} className="shrink-0" /><span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className={labelCls}>{isRtl ? 'الاسم' : 'Display Name'}</label>
                  <div className="relative group">
                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={isRtl ? 'الاسم' : 'e.g. Abdou Nassar'} className={inputCls} />
                    <User size={18} className={iconEnd} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{isRtl ? 'اسم المستخدم' : 'Username'}</label>
                  <div className="relative group">
                    <input type="text" value={activeTab === 'register' ? username : ''} onChange={(e) => activeTab === 'register' && setUsername(e.target.value)} placeholder={isRtl ? 'اسم المستخدم' : 'admin'} autoComplete="username" className={inputCls} />
                    <User size={18} className={iconEnd} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{isRtl ? 'رقم سري' : 'Password'}</label>
                  <div className="relative group">
                    <input type={showPassword ? 'text' : 'password'} value={activeTab === 'register' ? password : ''} onChange={(e) => activeTab === 'register' && setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" className={inputCls} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className={`${iconEnd} hover:text-cyan-400 cursor-pointer`}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <KeyRound size={18} className={iconStart} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{isRtl ? 'تأكيد كلمة المرور' : 'Confirm Password'}</label>
                  <div className="relative group">
                    <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" className={inputCls} />
                    <KeyRound size={18} className={iconEnd} />
                  </div>
                </div>
                <div className="pt-3">
                  <button type="submit" disabled={submitting || isInitialized || activeTab !== 'register'} className="relative w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-sm shadow-[0_0_20px_rgba(245,158,11,0.4)] active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2 overflow-hidden group">
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-out" />
                    {submitting && activeTab === 'register' ? (
                      <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><Sparkles size={18} /><span>{isRtl ? 'إنشاء حساب' : 'Create Account'}</span></>
                    )}
                  </button>
                </div>
                <p className="text-center text-xs text-slate-500 mt-3">
                  {isRtl ? 'لديك حساب؟' : 'Already have an account?'}{' '}
                  <button type="button" onClick={() => setActiveTab('login')} className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors">
                    {isRtl ? 'تسجيل الدخول ←' : '→ Sign In'}
                  </button>
                </p>
              </form>
            </div>

          </div>

          {/* ─── Footer ─── */}
          <div className="mt-8 text-center text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
            {isRtl ? 'حقوق النشر © 2026 لشركة ARN Technology. جميع الحقوق محفوظة.' : 'Copyright © 2026 ARN Technology. All Rights Reserved.'}
          </div>
        </div>
      )}
    </div>
  );
}
