/**
 * ARN Technology — Activation & Licensing Modal Component (React)
 * Application: ARN Stream
 * Developer: Abdou Ragab Nassar (c) 2026
 */

import React, { useState, useEffect } from 'react';

export default function ActivationModal() {
    const [licenseStatus, setLicenseStatus] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [serialInput, setSerialInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [copySuccess, setCopySuccess] = useState(false);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/license/status');
            if (res.ok) {
                const data = await res.json();
                setLicenseStatus(data);

                // Auto-open modal if trial is expired and not licensed
                if (!data.canRun) {
                    setIsOpen(true);
                }
            }
        } catch (e) {
            console.error('Failed to fetch ARN Stream license status:', e);
        }
    };

    useEffect(() => {
        fetchStatus();

        // Listen for manual trigger from anywhere in the app
        const handleOpen = () => setIsOpen(true);
        window.addEventListener('arn-open-activation-modal', handleOpen);
        return () => window.removeEventListener('arn-open-activation-modal', handleOpen);
    }, []);

    const handleCopyHWID = () => {
        if (licenseStatus?.hwid) {
            navigator.clipboard.writeText(licenseStatus.hwid).then(() => {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            });
        }
    };

    const handleActivate = async () => {
        if (!serialInput.trim()) {
            setFeedback({ type: 'error', text: 'يرجى لصق كود التفعيل في الحقل أعلاه أولاً.' });
            return;
        }

        setIsLoading(true);
        setFeedback(null);

        try {
            const res = await fetch('/api/license/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serial: serialInput.trim() })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setFeedback({ type: 'success', text: data.message });
                await fetchStatus();
                setTimeout(() => {
                    setIsOpen(false);
                    setFeedback(null);
                }, 2000);
            } else {
                setFeedback({ type: 'error', text: data.message || 'كود التفعيل غير صالح.' });
            }
        } catch (err) {
            setFeedback({ type: 'error', text: `خطأ في الاتصال بالخادم: ${err.message}` });
        } finally {
            setIsLoading(false);
        }
    };

    const getWhatsAppUrl = () => {
        const phone = licenseStatus?.contact?.whatsapp?.replace(/[^0-9]/g, '') || '201556710314';
        const msg = encodeURIComponent(
            `مرحباً شركة ARN Technology، أرغب في تفعيل برنامج ARN Stream.\nكود جهازي هو: ${licenseStatus?.hwid || ''}`
        );
        return `https://wa.me/${phone}?text=${msg}`;
    };

    const getTelegramUrl = () => {
        const username = licenseStatus?.contact?.telegram || 'ABDOURNASSAR95';
        return `https://t.me/${username}`;
    };

    if (!licenseStatus) return null;

    return (
        <>
            {/* Top Bar Floating Trial Badge (if not licensed but trial is active) */}
            {!licenseStatus.isLicensed && licenseStatus.trial?.isTrialActive && !isOpen && (
                <div 
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-4 py-2.5 rounded-full bg-slate-900/90 border border-amber-500/30 text-amber-300 text-xs font-semibold shadow-2xl backdrop-blur-md cursor-pointer hover:border-amber-400 hover:scale-105 transition-all duration-300"
                    title="انقر لتنشيط النسخة الكاملة"
                >
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    <span>نسخة تجريبية: متبقي {licenseStatus.trial.daysRemaining} أيام</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 text-[10px] font-bold">تنشيط</span>
                </div>
            )}

            {/* Modal Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" 
                    dir="rtl"
                >
                    <div className="relative w-full max-w-lg p-6 sm:p-8 rounded-2xl bg-[#0f172a]/95 border border-sky-500/20 shadow-2xl text-slate-100 font-sans overflow-hidden">
                        
                        {/* Glow effect */}
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

                        {/* Header */}
                        <div className="flex items-center justify-between mb-5 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-lg">
                                    🛡️
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">تنشيط النسخة الكاملة</h2>
                                    <p className="text-xs text-slate-400">ARN Stream — منصة البث وإدارة الوسائط</p>
                                </div>
                            </div>

                            {licenseStatus.canRun && (
                                <button 
                                    onClick={() => setIsOpen(false)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-500/20 border border-white/10 transition"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Banner Status */}
                        <div className={`p-3.5 rounded-xl border mb-5 flex items-center justify-between text-xs sm:text-sm ${
                            licenseStatus.isLicensed 
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                : licenseStatus.trial?.isTrialActive
                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                    : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                        }`}>
                            <div className="flex items-center gap-2">
                                <span>{licenseStatus.isLicensed ? '✔' : '⏳'}</span>
                                <span>
                                    {licenseStatus.isLicensed 
                                        ? `النسخة مفعلة لـ: ${licenseStatus.license?.client || 'عميل معتمد'}`
                                        : licenseStatus.trial?.isTrialActive
                                            ? `النسخة التجريبية نشطة: متبقي ${licenseStatus.trial.daysRemaining} أيام`
                                            : (licenseStatus.trial?.reason || 'انتهت الفترة التجريبية')}
                                </span>
                            </div>
                            <span className="font-mono font-bold text-xs uppercase px-2 py-0.5 rounded bg-black/20">
                                {licenseStatus.isLicensed ? 'LICENSED' : licenseStatus.trial?.isTrialActive ? 'TRIAL' : 'EXPIRED'}
                            </span>
                        </div>

                        {/* HWID Section */}
                        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 mb-4">
                            <label className="block text-xs font-semibold text-sky-400 mb-2">
                                كود جهازك الفريد (Hardware ID):
                            </label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 p-2.5 rounded-lg bg-black/40 border border-sky-500/30 font-mono text-sm sm:text-base font-bold text-sky-200 text-center tracking-widest select-all">
                                    {licenseStatus.hwid}
                                </div>
                                <button 
                                    onClick={handleCopyHWID}
                                    className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-sky-400 border border-sky-500/30 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap"
                                >
                                    <span>{copySuccess ? 'تم النسخ ✓' : 'نسخ'}</span>
                                </button>
                            </div>

                            {/* Direct Social Contact Links */}
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-xs text-slate-400">
                                <span>أرسل الكود لمسؤول المبيعات للحصول على السيريال:</span>
                                <div className="flex items-center gap-2">
                                    <a 
                                        href={getWhatsAppUrl()} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition"
                                        title="تواصل عبر واتساب"
                                    >
                                        💬
                                    </a>
                                    <a 
                                        href={getTelegramUrl()} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center hover:bg-sky-500 hover:text-white transition"
                                        title="تواصل عبر تليجرام"
                                    >
                                        ✈️
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Serial Input Section */}
                        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 mb-5">
                            <label className="block text-xs font-semibold text-sky-400 mb-2">
                                أدخل كود التفعيل المستلم (Activation Serial):
                            </label>
                            <textarea
                                value={serialInput}
                                onChange={(e) => setSerialInput(e.target.value)}
                                placeholder="الصق كود التفعيل هنا (ARNLIC....)"
                                className="w-full h-18 p-2.5 rounded-lg bg-black/40 border border-white/10 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 resize-none mb-3 text-left dir-ltr"
                                spellCheck="false"
                            />

                            <button
                                onClick={handleActivate}
                                disabled={isLoading}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition active:scale-[0.99] disabled:opacity-50"
                            >
                                {isLoading ? 'جاري التحقق...' : 'تنشيط النسخة الكاملة الآن ⚡'}
                            </button>

                            {feedback && (
                                <div className={`mt-3 p-2.5 rounded-lg text-xs border ${
                                    feedback.type === 'success' 
                                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' 
                                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                                }`}>
                                    {feedback.text}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="text-center text-[11px] text-slate-500">
                            <div>حقوق النشر &copy; 2026 لشركة ARN Technology. جميع الحقوق محفوظة.</div>
                            <div className="text-emerald-400 font-semibold mt-0.5">تطوير وبرمجة: عبده رجب نصار</div>
                        </div>

                    </div>
                </div>
            )}
        </>
    );
}
