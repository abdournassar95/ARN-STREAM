import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, ShieldAlert, KeyRound, Copy, Check, RefreshCw,
  Sparkles, ExternalLink, MessageCircle, Send, CheckCircle2,
  AlertTriangle, Clock, Laptop, UserCheck, Lock, Unlock, HelpCircle,
  Cpu, FileCheck
} from 'lucide-react';
import { fetchLicenseStatus, activateLicenseApi, deactivateLicenseApi } from '../api/client';
import { useSettingsStore } from '../store/useSettingsStore';

export default function DashboardLicense() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const queryClient = useQueryClient();
  const { theme } = useSettingsStore();
  const isDark = theme !== 'light';

  const [serialInput, setSerialInput] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const showFeedback = (text, type = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Query license status
  const {
    data: licenseData,
    isLoading,
    isRefetching,
    refetch
  } = useQuery({
    queryKey: ['license-status'],
    queryFn: fetchLicenseStatus,
    staleTime: 30000,
    refetchOnWindowFocus: true
  });

  // Activate mutation
  const activateMutation = useMutation({
    mutationFn: (serial) => activateLicenseApi(serial),
    onSuccess: (data) => {
      showFeedback(data.message || (isRtl ? 'تم تفعيل النسخة الكاملة بنجاح!' : 'Activated successfully!'), 'success');
      setSerialInput('');
      queryClient.invalidateQueries({ queryKey: ['license-status'] });
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.message || (isRtl ? 'كود التفعيل غير صالح.' : 'Invalid serial key.');
      showFeedback(msg, 'error');
    }
  });

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: () => deactivateLicenseApi(),
    onSuccess: (data) => {
      showFeedback(data.message || (isRtl ? 'تم إرجاع الترخيص للوضع التجريبي.' : 'Deactivated successfully.'), 'info');
      queryClient.invalidateQueries({ queryKey: ['license-status'] });
    },
    onError: (err) => {
      showFeedback(err.message || 'فشل إلغاء التفعيل', 'error');
    }
  });

  const handleCopyHWID = () => {
    if (licenseData?.hwid) {
      navigator.clipboard.writeText(licenseData.hwid).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2200);
      });
    }
  };

  const handleActivate = (e) => {
    e.preventDefault();
    if (!serialInput.trim()) {
      showFeedback(isRtl ? 'يرجى لصق كود التفعيل في الحقل أولاً.' : 'Please enter serial key first.', 'error');
      return;
    }
    activateMutation.mutate(serialInput.trim());
  };

  const isLicensed = Boolean(licenseData?.isLicensed);
  const trial = licenseData?.trial;
  const isTrialActive = Boolean(trial?.isTrialActive);
  const isExpired = Boolean(trial?.isExpired);
  const daysRemaining = trial?.daysRemaining ?? 0;
  const totalDays = trial?.totalDays ?? 7;
  const trialProgress = Math.max(0, Math.min(100, Math.round(((totalDays - daysRemaining) / totalDays) * 100)));

  const getWhatsAppUrl = () => {
    const phone = licenseData?.contact?.whatsapp?.replace(/[^0-9]/g, '') || '201556710314';
    const msg = encodeURIComponent(
      `مرحباً شركة ARN Technology، أود الاستفسار عن كود تفعيل ARN Stream لجهازي:\nمعرّف الجهاز (HWID): ${licenseData?.hwid || ''}`
    );
    return `https://wa.me/${phone}?text=${msg}`;
  };

  const getTelegramUrl = () => {
    const user = licenseData?.contact?.telegram || 'ABDOURNASSAR95';
    return `https://t.me/${user}`;
  };

  return (
    <div className="space-y-7" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Toast Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            className={`fixed top-6 ${isRtl ? 'left-6' : 'right-6'} z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-2xl ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : feedback.type === 'info'
                ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            ) : feedback.type === 'info' ? (
              <Sparkles size={18} className="text-sky-400 shrink-0" />
            ) : (
              <AlertTriangle size={18} className="text-rose-400 shrink-0" />
            )}
            <span className="text-xs md:text-sm font-semibold">{feedback.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Hero Banner */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 md:p-8 border shadow-xl"
        style={{
          background: isLicensed
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(11, 15, 25, 0.7) 100%)'
            : isTrialActive
            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(11, 15, 25, 0.7) 100%)'
            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.14) 0%, rgba(11, 15, 25, 0.7) 100%)',
          borderColor: isLicensed
            ? 'rgba(16, 185, 129, 0.3)'
            : isTrialActive
            ? 'rgba(245, 158, 11, 0.3)'
            : 'rgba(239, 68, 68, 0.35)'
        }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border shadow-lg ${
                isLicensed
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-emerald-500/20'
                  : isTrialActive
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-amber-500/20'
                  : 'bg-rose-500/20 border-rose-500/40 text-rose-400 shadow-rose-500/20'
              }`}
            >
              {isLicensed ? (
                <ShieldCheck size={36} className="animate-pulse" />
              ) : isTrialActive ? (
                <Clock size={34} />
              ) : (
                <ShieldAlert size={36} />
              )}
            </div>

            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                  {isLicensed
                    ? (isRtl ? 'النسخة الكاملة مفعلة' : 'Full License Activated')
                    : isTrialActive
                    ? (isRtl ? 'النسخة التجريبية نشطة' : 'Trial Period Active')
                    : (isRtl ? 'انتهت الفترة التجريبية' : 'Trial Expired')}
                </h2>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${
                    isLicensed
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isTrialActive
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {isLicensed ? (isRtl ? 'دائم مدى الحياة' : 'Perpetual') : (isRtl ? 'تجريبي' : 'Trial')}
                </span>
              </div>

              <p className="mt-1.5 text-xs md:text-sm text-[#8b92a5] max-w-2xl leading-relaxed">
                {isLicensed
                  ? (isRtl
                    ? `مرخص رسميًا باسم "${licenseData?.license?.client || 'العميل المعتمد'}" ومحمي بنظام التشفير العقدي اللامركزي ARN Technology Node-Locked.`
                    : `Officially licensed to "${licenseData?.license?.client || 'Authorized Client'}" under ARN Node-Locked Engine.`)
                  : isTrialActive
                  ? (isRtl
                    ? `متبقي ${daysRemaining} أيام من الفترة التجريبية المجانية (${totalDays} أيام). يمكنك تفعيل النسخة الدائمة في أي وقت.`
                    : `${daysRemaining} days remaining in free trial (${totalDays} days total). You can activate anytime.`)
                  : (isRtl
                    ? 'لقد انتهت فترة الـ 7 أيام التجريبية المجانية. يرجى إدخال كود التفعيل المعتمد لمتابعة البث واستخدام المنصة.'
                    : 'The 7-day trial period has expired. Please enter an activation serial key to continue.')}
              </p>
            </div>
          </div>

          {/* Quick Refresh Button */}
          <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
              title={isRtl ? 'إعادة فحص حالة الترخيص' : 'Refresh license status'}
            >
              <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
              <span>{isRefetching ? (isRtl ? 'جاري الفحص...' : 'Checking...') : (isRtl ? 'تحديث الفحص' : 'Refresh')}</span>
            </button>
          </div>
        </div>

        {/* Trial Progress Bar (shown only during trial) */}
        {!isLicensed && (
          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="flex items-center justify-between text-xs text-[#8b92a5] mb-2 font-mono">
              <span>{isRtl ? `استهلاك التجربة: ${trialProgress}%` : `Trial elapsed: ${trialProgress}%`}</span>
              <span className={daysRemaining <= 2 ? 'text-rose-400 font-bold' : 'text-amber-400 font-semibold'}>
                {isRtl ? `${daysRemaining} أيام متبقية` : `${daysRemaining} days left`}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full transition-all duration-700 ${
                  daysRemaining <= 2
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                    : 'bg-gradient-to-r from-emerald-500 to-amber-500'
                }`}
                style={{ width: `${trialProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3 Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Hardware ID */}
        <div
          className="rounded-2xl p-5 border shadow-md relative overflow-hidden"
          style={{
            background: 'var(--dash-card-bg)',
            borderColor: 'var(--dash-card-border)'
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-bold text-[#8b92a5] uppercase tracking-wider flex items-center gap-1.5">
              <Cpu size={15} className="text-[#00d2ff]" />
              {isRtl ? 'معرّف الجهاز المقفل (HWID)' : 'Hardware ID (Node-Lock)'}
            </span>
            <button
              type="button"
              onClick={handleCopyHWID}
              className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white transition-all text-xs flex items-center gap-1"
              title={isRtl ? 'نسخ كود الجهاز' : 'Copy HWID'}
            >
              {copySuccess ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400 font-bold">{isRtl ? 'تم النسخ' : 'Copied'}</span>
                </>
              ) : (
                <>
                  <Copy size={13} className="text-slate-300" />
                  <span>{isRtl ? 'نسخ' : 'Copy'}</span>
                </>
              )}
            </button>
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-sm font-bold text-[#00d2ff] tracking-widest text-center select-all">
            {licenseData?.hwid || 'ARN-XXXX-XXXX-XXXX'}
          </div>

          <p className="mt-2 text-[11px] text-[#8b92a5] leading-relaxed">
            {isRtl
              ? 'معرّف فريد لجهازك لا يتغير عند الفورمات أو حذف البرنامج، ويُستخدم لربط كود الترخيص بجهازك حصراً.'
              : 'Unique hardware signature permanently bound to your machine.'}
          </p>
        </div>

        {/* Card 2: Security & Protection Engine */}
        <div
          className="rounded-2xl p-5 border shadow-md relative overflow-hidden"
          style={{
            background: 'var(--dash-card-bg)',
            borderColor: 'var(--dash-card-border)'
          }}
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#8b92a5] uppercase tracking-wider mb-2">
            <Lock size={15} className="text-emerald-400" />
            {isRtl ? 'نظام الحماية والأمان' : 'Security Engine'}
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-[#8b92a5]">
              <span>{isRtl ? 'المحرك الأمني:' : 'Security Engine:'}</span>
              <span className="font-semibold text-white">ARN Quad-Layer Stealth</span>
            </div>
            <div className="flex items-center justify-between text-[#8b92a5]">
              <span>{isRtl ? 'خوارزمية التوقيع:' : 'Cryptographic Sig:'}</span>
              <span className="font-mono text-emerald-400">Ed25519 Public Key</span>
            </div>
            <div className="flex items-center justify-between text-[#8b92a5]">
              <span>{isRtl ? 'العمل بدون إنترنت:' : 'Offline Support:'}</span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <Check size={12} /> {isRtl ? 'مدعوم 100%' : '100% Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[#8b92a5]">
              <span>{isRtl ? 'تاريخ أول إطلاق:' : 'First Launch:'}</span>
              <span className="font-mono text-white">{trial?.firstLaunchDate || '—'}</span>
            </div>
          </div>
        </div>

        {/* Card 3: License Type & Owner */}
        <div
          className="rounded-2xl p-5 border shadow-md relative overflow-hidden"
          style={{
            background: 'var(--dash-card-bg)',
            borderColor: 'var(--dash-card-border)'
          }}
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#8b92a5] uppercase tracking-wider mb-2">
            <UserCheck size={15} className="text-violet-400" />
            {isRtl ? 'بيانات الترخيص والمالك' : 'Ownership & Scope'}
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-[#8b92a5]">
              <span>{isRtl ? 'اسم التطبيق:' : 'Application:'}</span>
              <span className="font-semibold text-white">ARN Stream Desktop Pro</span>
            </div>
            <div className="flex items-center justify-between text-[#8b92a5]">
              <span>{isRtl ? 'المالك المعتمد:' : 'Licensee:'}</span>
              <span className="font-semibold text-[#00d2ff] truncate max-w-[140px]">
                {licenseData?.license?.client || (isRtl ? 'فترة تجريبية' : 'Trial User')}
              </span>
            </div>
            <div className="flex items-center justify-between text-[#8b92a5]">
              <span>{isRtl ? 'الصلاحية:' : 'Validity:'}</span>
              <span className="font-semibold text-emerald-400">
                {isLicensed ? (isRtl ? 'ترخيص دائم (Lifetime)' : 'Lifetime Perpetual') : (isRtl ? 'مؤقت (7 أيام)' : '7-Day Trial')}
              </span>
            </div>
            <div className="flex items-center justify-between text-[#8b92a5]">
              <span>{isRtl ? 'حالة البث:' : 'Streaming Gate:'}</span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <Check size={12} /> {isRtl ? 'مفتوح بالكامل' : 'Unrestricted'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Activation Form & Management Section */}
      <div
        className="rounded-3xl p-6 md:p-8 border shadow-xl"
        style={{
          background: 'var(--dash-card-bg)',
          borderColor: 'var(--dash-card-border)'
        }}
      >
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00d2ff]/10 border border-[#00d2ff]/20 flex items-center justify-center text-[#00d2ff]">
              <KeyRound size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {isRtl ? 'تفعيل كود التنشيط (Serial Key Activation)' : 'Activate License Key'}
              </h3>
              <p className="text-xs text-[#8b92a5]">
                {isRtl 
                  ? 'أدخل كود التفعيل الرقمي المعتمد من شركة ARN Technology لتفعيل النسخة الكاملة.'
                  : 'Enter your official license key issued by ARN Technology.'}
              </p>
            </div>
          </div>

          {/* Quick launch modal button */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('arn-open-activation-modal'))}
            className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] transition-all"
          >
            <HelpCircle size={14} />
            <span>{isRtl ? 'فتح نافذة التفعيل المنبثقة' : 'Open Dialog'}</span>
          </button>
        </div>

        <form onSubmit={handleActivate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#8b92a5] mb-2">
              {isRtl ? 'كود التفعيل (يبدأ بـ ARNLIC...)' : 'Serial Key (starts with ARNLIC...)'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                placeholder="ARNLIC.eyJjbGllbnQiOi...sig..."
                className="w-full px-4 py-3.5 rounded-xl border text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-[#00d2ff]/50 transition-all"
                style={{
                  background: 'var(--dash-input-bg)',
                  borderColor: 'var(--dash-input-border)',
                  color: 'var(--dash-input-text)'
                }}
              />
              {serialInput && (
                <button
                  type="button"
                  onClick={() => setSerialInput('')}
                  className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-[#8b92a5] hover:text-white p-1`}
                >
                  &times;
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="submit"
                disabled={activateMutation.isPending || !serialInput.trim()}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#00d2ff] to-[#0099ff] hover:from-[#38bdf8] hover:to-[#0284c7] text-[#070b14] font-bold text-xs md:text-sm shadow-lg shadow-[#00d2ff]/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {activateMutation.isPending ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>{isRtl ? 'جاري التحقق والتفعيل...' : 'Activating...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>{isRtl ? 'تفعيل النسخة الكاملة الآن' : 'Activate Full License'}</span>
                  </>
                )}
              </button>

              {isLicensed && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(isRtl ? 'هل أنت متأكد من رغبتك في إلغاء تنشيط النسخة والرجوع للوضع التجريبي؟' : 'Are you sure you want to deactivate?')) {
                      deactivateMutation.mutate();
                    }
                  }}
                  disabled={deactivateMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-rose-500/30 hover:border-rose-500/60 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Unlock size={14} />
                  <span>{deactivateMutation.isPending ? (isRtl ? 'جاري الإلغاء...' : 'Deactivating...') : (isRtl ? 'إلغاء التنشيط' : 'Deactivate')}</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-[#8b92a5] text-center sm:text-right">
              {isRtl 
                ? 'يتم التحقق من الكود مشفرًا عبر المفتاح العام دون الحاجة إلى اتصال بالإنترنت.' 
                : 'Offline instant verification via cryptographic public key.'}
            </p>
          </div>
        </form>
      </div>

      {/* Support & Purchase Information Section */}
      <div
        className="rounded-3xl p-6 md:p-8 border shadow-xl"
        style={{
          background: 'var(--dash-card-bg)',
          borderColor: 'var(--dash-card-border)'
        }}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
              <CheckCircle2 size={14} />
              {isRtl ? 'الدعم الفني وطلب التراخيص' : 'Official Licensing & Support'}
            </span>
            <h3 className="text-xl font-bold text-white">
              {isRtl ? 'شركة ARN Technology — المطور: عبده رجب نصار' : 'ARN Technology — Dev: Abdou Ragab Nassar'}
            </h3>
            <p className="mt-1 text-xs text-[#8b92a5] max-w-2xl leading-relaxed">
              {isRtl
                ? 'لشراء ترخيص دائم أو طلب كود تفعيل لأجهزة جديدة، تواصل معنا مباشرة عبر القنوات الرسمية التالية مع إرفاق معرّف الجهاز (HWID).'
                : 'To obtain a perpetual license or add new devices, reach out via our official channels with your HWID.'}
            </p>
          </div>

          {/* Social Contact Buttons (Strict ARN Technology Standard) */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* WhatsApp */}
            <a
              href={getWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <MessageCircle size={15} />
              <span>{isRtl ? 'واتساب الدعم' : 'WhatsApp'}</span>
              <ExternalLink size={12} className="opacity-60" />
            </a>

            {/* Telegram */}
            <a
              href={getTelegramUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 hover:text-sky-200 text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <Send size={15} />
              <span>{isRtl ? 'تليجرام' : 'Telegram'}</span>
              <ExternalLink size={12} className="opacity-60" />
            </a>

            {/* Facebook */}
            <a
              href="https://www.facebook.com/abdouragab.nassar"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 hover:text-blue-200 text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <span>{isRtl ? 'فيسبوك' : 'Facebook'}</span>
              <ExternalLink size={12} className="opacity-60" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
