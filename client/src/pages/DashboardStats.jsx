import React, { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchDashboardStats, killTranscodeTask } from '../api/client';
import { useSettingsStore } from '../store/useSettingsStore';
import { 
  Server, HardDrive, Cpu, AlertTriangle, 
  RefreshCw, XCircle, Activity, 
  CheckCircle2, Zap, Radio,
  MessageCircle, Send, Facebook, Ghost
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

/* ─── Pure Utility Helpers (Hoisted to module scope to avoid re-allocation) ─── */
function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m`;
}

/* ─── Circular Gauge SVG (Memoized) ─── */
const CircularGauge = React.memo(function CircularGauge({ 
  percent = 0, 
  size = 140, 
  strokeWidth = 10, 
  color = '#06b6d4', 
  bgColor = 'rgba(6,182,212,0.08)', 
  label 
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  const colorId = color.replace('#', '');

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={bgColor} strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={`url(#gauge-gradient-${colorId})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
        <defs>
          <linearGradient id={`gauge-gradient-${colorId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={`${color}80`} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl md:text-3xl font-black tracking-tight tabular-nums font-mono" style={{ color: 'var(--dash-gauge-text)' }}>
          {percent.toFixed(1)}%
        </span>
        {label && <span className="text-[10px] mt-0.5 font-medium" style={{ color: 'var(--dash-muted-text)' }}>{label}</span>}
      </div>
    </div>
  );
});

/* ─── Mini Bar Chart (Memoized) ─── */
const DEFAULT_CHART_COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

const MiniBarChart = React.memo(function MiniBarChart({ values = [], maxVal, colors = DEFAULT_CHART_COLORS }) {
  const max = maxVal || Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[3px] h-full">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-[6px] md:w-[7px] rounded-t-sm transition-all duration-500"
          style={{
            height: `${Math.max(6, (v / max) * 100)}%`,
            background: `linear-gradient(to top, ${colors[i % colors.length]}90, ${colors[i % colors.length]})`,
            boxShadow: `0 0 4px ${colors[i % colors.length]}30`
          }}
        />
      ))}
    </div>
  );
});

/* ─── Status Dot (Memoized) ─── */
const STATUS_COLOR_MAP = {
  green: 'bg-emerald-400 shadow-emerald-400/50',
  red: 'bg-red-400 shadow-red-400/50',
  yellow: 'bg-amber-400 shadow-amber-400/50',
};

const StatusDot = React.memo(function StatusDot({ status = 'green' }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLOR_MAP[status] || STATUS_COLOR_MAP.green} shadow-[0_0_6px]`} />;
});

/* ─── Stream Task Row (Memoized to prevent table fan-out re-renders) ─── */
const StreamTaskRow = React.memo(function StreamTaskRow({ task, isRtl, onKill, isPending }) {
  return (
    <tr className="dash-table-row" style={{ borderBottom: '1px solid var(--dash-card-border)' }}>
      <td className={`p-3 font-mono text-sm max-w-[200px] truncate ${isRtl ? 'text-right' : 'text-left'}`} style={{ color: 'var(--dash-body-text)' }} title={task.filePath}>
        {task.id}
      </td>
      <td className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
          task.type === 'direct' 
            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        }`}>
          {task.type === 'direct' ? 'Direct' : 'Transcode'}
        </span>
      </td>
      <td className={`p-3 text-xs font-mono tabular-nums ${isRtl ? 'text-right' : 'text-left'}`} style={{ color: 'var(--dash-muted-text)' }}>
        {new Date(task.startedAt).toLocaleTimeString(isRtl ? 'ar-EG' : 'en-US')}
      </td>
      <td className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>
        <button 
          onClick={() => onKill(task.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 border border-red-500/15 transition text-[11px] font-semibold"
          disabled={isPending}
        >
          <XCircle size={13} /> {isRtl ? 'إيقاف' : 'Kill'}
        </button>
      </td>
    </tr>
  );
});

/* ─── ARN Technology Brand & Developer Footer (Memoized Static Subtree) ─── */
const DashboardFooter = React.memo(function DashboardFooter({ isRtl }) {
  return (
    <div className="w-full mt-10 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: 'var(--dash-card-border)' }}>
      <div className="text-center sm:text-start flex flex-col gap-0.5">
        <h3 className="font-extrabold text-base sm:text-lg tracking-tight whitespace-nowrap" style={{ color: 'var(--dash-heading-text)' }}>
          ARN Technology
        </h3>
        <p className="text-xs whitespace-nowrap" style={{ color: 'var(--dash-muted-text)' }}>
          {isRtl ? 'جميع الحقوق محفوظة © 2026' : 'All rights reserved © 2026'}
        </p>
        <p className="text-xs whitespace-nowrap mt-0.5" style={{ color: 'var(--dash-body-text)' }}>
          {isRtl ? 'تطوير وبرمجة:' : 'Developed by:'}{' '}
          <span className="text-[#10b981] font-bold">{isRtl ? 'عبده رجب نصار' : 'Abdou Ragab Nassar'}</span>
        </p>
      </div>
      
      <div className="flex items-center gap-3">
        <a 
          href="https://wa.me/201556710314" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="w-10 h-10 rounded-full border flex items-center justify-center transition-all shadow-sm hover:scale-110 active:scale-95 group hover:bg-[#1e293b] hover:border-[#10b981]" 
          style={{ background: 'var(--dash-card-bg)', borderColor: 'var(--dash-card-border)', color: 'var(--dash-muted-text)' }}
          title="WhatsApp"
        >
          <MessageCircle size={18} className="group-hover:text-[#10b981] transition-colors" />
        </a>
        <a 
          href="https://t.me/ABDOURNASSAR95" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="w-10 h-10 rounded-full border flex items-center justify-center transition-all shadow-sm hover:scale-110 active:scale-95 group hover:bg-[#1e293b] hover:border-[#38bdf8]" 
          style={{ background: 'var(--dash-card-bg)', borderColor: 'var(--dash-card-border)', color: 'var(--dash-muted-text)' }}
          title="Telegram"
        >
          <Send size={18} className="group-hover:text-[#38bdf8] transition-colors" />
        </a>
        <a 
          href="https://www.facebook.com/abdouragab.nassar" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="w-10 h-10 rounded-full border flex items-center justify-center transition-all shadow-sm hover:scale-110 active:scale-95 group hover:bg-[#1e293b] hover:border-[#3b82f6]" 
          style={{ background: 'var(--dash-card-bg)', borderColor: 'var(--dash-card-border)', color: 'var(--dash-muted-text)' }}
          title="Facebook"
        >
          <Facebook size={18} className="group-hover:text-[#3b82f6] transition-colors" />
        </a>
        <a 
          href="https://m.me/abdouragab.nassar" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="w-10 h-10 rounded-full border flex items-center justify-center transition-all shadow-sm hover:scale-110 active:scale-95 group hover:bg-[#1e293b] hover:border-[#8b5cf6]" 
          style={{ background: 'var(--dash-card-bg)', borderColor: 'var(--dash-card-border)', color: 'var(--dash-muted-text)' }}
          title="Messenger"
        >
          <Ghost size={18} className="group-hover:text-[#8b5cf6] transition-colors" />
        </a>
      </div>
    </div>
  );
});

/* ─── Main Component: DashboardStats ─── */
export default function DashboardStats() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const queryClient = useQueryClient();
  
  // Performance Optimization: Subscribe only to derived theme boolean instead of entire settings store
  const isDark = useSettingsStore(s => s.theme !== 'light');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 5000,
    refetchOnWindowFocus: false, // Prevents unexpected spike requests on window focus
  });

  const killMutation = useMutation({
    mutationFn: killTranscodeTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    }
  });

  // Performance Optimization: Stable callback reference with useCallback
  const handleKill = useCallback((id) => {
    if (window.confirm(isRtl ? 'هل أنت متأكد من إيقاف هذه المهمة؟' : 'Are you sure you want to stop this task?')) {
      killMutation.mutate(id);
    }
  }, [isRtl, killMutation]);

  // Performance Optimization: Generate stable visual activity bars once on mount to prevent continuous 5s re-animation thrashing
  const activityBars = useMemo(() => {
    return [45, 65, 38, 72, 52, 68, 84, 58, 42, 70, 62, 50];
  }, []);

  // Performance Optimization: Stable memoized server status metrics
  const serverStatusItems = useMemo(() => {
    if (!data?.server) return [];
    return [
      { id: 'uptime', label: 'Uptime', value: formatUptime(data.server.uptime), status: 'green' },
      { id: 'platform', label: 'Platform', value: data.server.platform === 'win32' ? 'Windows' : data.server.platform, status: 'green' },
      { id: 'cpuCores', label: 'CPU Cores', value: data.server.cpuCores, status: 'green' },
      { id: 'streams', label: 'Streams', value: data.streams?.total || 0, status: (data.streams?.total || 0) > 0 ? 'yellow' : 'green' },
    ];
  }, [data?.server, data?.streams?.total]);

  if (isLoading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <Zap size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-400" />
        </div>
        <span className="text-sm" style={{ color: 'var(--dash-muted-text)' }}>
          {isRtl ? 'جاري تحميل البيانات...' : 'Loading data...'}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 flex items-center justify-center">
        <div className="text-center p-6 rounded-2xl bg-red-500/5 border border-red-500/20">
          <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-400 text-sm">
            {isRtl ? 'حدث خطأ أثناء جلب البيانات' : 'Error loading data'}: {error.message}
          </p>
        </div>
      </div>
    );
  }

  const stats = data;
  const storagePercent = stats?.storage?.usagePercent || 0;
  const memPercent = stats?.memory?.usagePercent || 0;
  const unmatchedTotal = (stats?.unmatched?.movies || 0) + (stats?.unmatched?.series || 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Refresh Row */}
      <div className="flex justify-end">
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-[transform,colors,box-shadow] duration-200 backdrop-blur-sm hover:text-cyan-300 hover:-translate-y-0.5 active:scale-95 shadow-sm hover:shadow-md"
          style={{
            background: isDark ? 'rgba(12,19,36,0.8)' : 'rgba(255,255,255,0.6)',
            borderColor: 'var(--dash-input-border)',
            color: 'var(--dash-muted-text)'
          }}
        >
          <RefreshCw size={14} /> {isRtl ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* === Top Stats Grid === */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5">
        
        {/* ── Storage Card (circular gauge) ── */}
        <div className="xl:col-span-3 dash-card group">
          <div className="dash-card-inner p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="dash-card-title">
                <HardDrive size={15} className="text-cyan-400" />
                {isRtl ? 'تغطية التخزين' : 'Storage Coverage'}
              </h3>
            </div>
            <div className="flex items-center gap-4">
              <CircularGauge percent={storagePercent} size={120} strokeWidth={8} color="#06b6d4" />
              <div className="flex flex-col gap-1 min-w-0">
                <div>
                  <span className="text-lg font-bold text-cyan-300 tabular-nums font-mono">
                    GB {((stats?.storage?.free || 0) / (1024**3)).toFixed(1)}
                  </span>
                  <span className="text-[10px] block" style={{ color: 'var(--dash-muted-text)' }}>
                    {isRtl ? 'متاح' : 'Free'}
                  </span>
                </div>
                <div className="h-px w-full bg-cyan-500/10 my-1" />
                <div>
                  <span className="text-sm font-semibold tabular-nums font-mono" style={{ color: 'var(--dash-body-text)' }}>
                    GB {((stats?.storage?.total || 0) / (1024**3)).toFixed(1)}
                  </span>
                  <span className="text-[10px] block" style={{ color: 'var(--dash-muted-text)' }}>
                    {isRtl ? 'إجمالي' : 'Total'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Resources Card (CPU/RAM) ── */}
        <div className="xl:col-span-3 dash-card group">
          <div className="dash-card-inner p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="dash-card-title">
                <Cpu size={15} className="text-blue-400" />
                {isRtl ? 'استخدام الموارد' : 'Resource Usage'}
              </h3>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-4xl font-black tracking-tight tabular-nums font-mono" style={{ color: 'var(--dash-gauge-text)' }}>
                  {memPercent.toFixed(1)}
                  <span className="text-lg text-blue-400">%</span>
                </div>
                <div className="text-[10px] mt-0.5 font-medium uppercase tracking-wider" style={{ color: 'var(--dash-muted-text)' }}>
                  CPU/RAM
                </div>
              </div>
              <div className="text-end">
                <span className="text-lg font-bold text-blue-300 tabular-nums font-mono">
                  GB {((stats?.memory?.used || 0) / (1024**3)).toFixed(2)}
                </span>
                <span className="text-[10px] block" style={{ color: 'var(--dash-muted-text)' }}>
                  {isRtl ? 'مستخدم' : 'Used'}
                </span>
                {/* Usage bar */}
                <div className="w-24 h-1.5 rounded-full bg-blue-500/10 mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-1000"
                    style={{ width: `${Math.min(memPercent, 100)}%`, boxShadow: '0 0 8px rgba(59,130,246,0.4)' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Server Status Card ── */}
        <div className="xl:col-span-3 dash-card group">
          <div className="dash-card-inner p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="dash-card-title">
                <Server size={15} className="text-emerald-400" />
                {isRtl ? 'حالة الخادم' : 'Server Status'}
              </h3>
            </div>
            <div className="text-2xl font-black mb-3 tracking-tight tabular-nums font-mono" style={{ color: 'var(--dash-gauge-text)' }}>
              {formatUptime(stats?.server?.uptime)}
            </div>
            <div className="space-y-1.5">
              {serverStatusItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium" style={{ color: 'var(--dash-muted-text)' }}>{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums font-mono" style={{ color: 'var(--dash-body-text)' }}>{item.value}</span>
                    <StatusDot status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── System Log (Bar chart) ── */}
        <div className="xl:col-span-3 dash-card group">
          <div className="dash-card-inner p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="dash-card-title">
                <Activity size={15} className="text-purple-400" />
                {isRtl ? 'سجل النظام' : 'System Log'}
              </h3>
            </div>
            <div className="flex-1 min-h-[80px]">
              <MiniBarChart values={activityBars} />
            </div>
          </div>
        </div>
      </div>

      {/* === Second Row === */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5">
        {/* Alerts */}
        <div className="xl:col-span-3 dash-card group">
          <div className="dash-card-inner p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-400" />
              </div>
              <div>
                <div className="text-3xl font-black text-amber-400 tabular-nums font-mono">{unmatchedTotal}</div>
                <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--dash-muted-text)' }}>
                  {isRtl ? 'عناصر غير مطابقة' : 'Unmatched Items'}
                </div>
              </div>
            </div>
            {unmatchedTotal > 0 && (
              <div className="mt-3 pt-3 border-t border-amber-500/10 flex gap-3 text-[11px]">
                <span style={{ color: 'var(--dash-body-text)' }}>
                  {isRtl ? 'أفلام' : 'Movies'}: <span className="text-amber-300 font-bold tabular-nums font-mono">{stats.unmatched.movies}</span>
                </span>
                <span style={{ color: 'var(--dash-body-text)' }}>
                  {isRtl ? 'مسلسلات' : 'Series'}: <span className="text-amber-300 font-bold tabular-nums font-mono">{stats.unmatched.series}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Live Feed / Streams */}
        <div className="xl:col-span-9 dash-card group">
          <div className="dash-card-inner p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="dash-card-title">
                <Radio size={15} className="text-emerald-400" />
                {isRtl ? 'شبكة البث الحالية' : 'Active Broadcast Network'}
              </h3>
              {(stats?.streams?.total || 0) > 0 && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  <span className="text-[11px] text-emerald-400 font-bold">Live Feed</span>
                </div>
              )}
            </div>

            {(!stats?.streams?.tasks || stats.streams.tasks.length === 0) ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                {/* Decorative grid pattern */}
                <div 
                  className="relative w-full max-w-md h-28 rounded-xl overflow-hidden border" 
                  style={{ 
                    background: isDark ? 'rgba(10,15,30,0.5)' : 'rgba(241,245,249,0.5)', 
                    borderColor: 'var(--dash-card-border)' 
                  }}
                >
                  <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `radial-gradient(var(--dash-dot-color) 1px, transparent 1px)`, backgroundSize: '16px 16px' }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-cyan-500/5 border border-cyan-500/10 flex items-center justify-center">
                        <CheckCircle2 size={20} className="text-cyan-500/40" />
                      </div>
                      <span className="text-[11px] font-medium" style={{ color: 'var(--dash-muted-text)' }}>
                        {isRtl ? 'لا توجد أي مهام أو عمليات بث حالياً' : 'No active streams or tasks'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" dir={isRtl ? 'rtl' : 'ltr'}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--dash-card-border)' }}>
                      <th className={`p-3 font-semibold text-[11px] uppercase tracking-wider ${isRtl ? 'text-right' : 'text-left'}`} style={{ color: 'var(--dash-muted-text)' }}>{isRtl ? 'المعرف' : 'ID'}</th>
                      <th className={`p-3 font-semibold text-[11px] uppercase tracking-wider ${isRtl ? 'text-right' : 'text-left'}`} style={{ color: 'var(--dash-muted-text)' }}>{isRtl ? 'النوع' : 'Type'}</th>
                      <th className={`p-3 font-semibold text-[11px] uppercase tracking-wider ${isRtl ? 'text-right' : 'text-left'}`} style={{ color: 'var(--dash-muted-text)' }}>{isRtl ? 'وقت البدء' : 'Started'}</th>
                      <th className={`p-3 font-semibold text-[11px] uppercase tracking-wider ${isRtl ? 'text-right' : 'text-left'}`} style={{ color: 'var(--dash-muted-text)' }}>{isRtl ? 'الإجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.streams.tasks.map((task) => (
                      <StreamTaskRow 
                        key={task.id} 
                        task={task} 
                        isRtl={isRtl} 
                        onKill={handleKill} 
                        isPending={killMutation.isPending} 
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ARN Technology Brand & Developer Footer (Memoized Subtree) */}
      <DashboardFooter isRtl={isRtl} />
    </div>
  );
}
