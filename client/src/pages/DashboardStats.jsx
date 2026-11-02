import React, { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchDashboardStats, killTranscodeTask } from '../api/client';
import { useSettingsStore } from '../store/useSettingsStore';
import { 
  Server, HardDrive, Cpu, AlertTriangle, 
  RefreshCw, XCircle, Activity, 
  CheckCircle2, Radio,
  MessageCircle, Send, Facebook, Ghost
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

/* ─── Pure Utility Helpers ─── */
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

/* ─── Studio Circular Gauge SVG (Clean, Minimalist, High Contrast) ─── */
const CircularGauge = React.memo(function CircularGauge({ 
  percent = 0, 
  size = 130, 
  strokeWidth = 8, 
  color1 = '#00d2ff',
  color2 = '#3a7bd5',
  label 
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#dash-gauge-gradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{ filter: 'drop-shadow(0 0 6px rgba(0, 210, 255, 0.4))' }}
        />
        <defs>
          <linearGradient id="dash-gauge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color1} />
            <stop offset="100%" stopColor={color2} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-black tracking-tight tabular-nums font-mono text-white">
          {percent.toFixed(1)}%
        </span>
        {label && (
          <span className="text-[10px] mt-0.5 font-medium text-[#8b92a5]">
            {label}
          </span>
        )}
      </div>
    </div>
  );
});

/* ─── Studio Activity Mini Bars (Restrained Cyan/Blue Palette) ─── */
const MiniBarChart = React.memo(function MiniBarChart({ values = [], maxVal }) {
  const max = maxVal || Math.max(...values, 1);
  return (
    <div className="flex items-end justify-between gap-[5px] h-full w-full py-1">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm transition-all duration-500 hover:opacity-100"
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            background: 'linear-gradient(to top, rgba(58, 123, 213, 0.7), #00d2ff)',
            boxShadow: '0 0 6px rgba(0, 210, 255, 0.25)',
            opacity: 0.85
          }}
        />
      ))}
    </div>
  );
});

/* ─── Status Dot (Clean & Subtle) ─── */
const STATUS_COLOR_MAP = {
  green: 'bg-[#10b981] shadow-[#10b981]/50',
  red: 'bg-rose-400 shadow-rose-400/50',
  yellow: 'bg-amber-400 shadow-amber-400/50',
};

const StatusDot = React.memo(function StatusDot({ status = 'green' }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${STATUS_COLOR_MAP[status] || STATUS_COLOR_MAP.green} shadow-[0_0_6px]`}
    />
  );
});

/* ─── Stream Task Row (Streamlined Glass Table Row) ─── */
const StreamTaskRow = React.memo(function StreamTaskRow({ task, isRtl, onKill, isPending }) {
  return (
    <tr className="dash-table-row border-b border-white/[0.06] transition-colors">
      <td className={`p-3.5 font-mono text-xs max-w-[200px] truncate ${isRtl ? 'text-right' : 'text-left'} text-white`} title={task.filePath}>
        {task.id}
      </td>
      <td className={`p-3.5 ${isRtl ? 'text-right' : 'text-left'}`}>
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
          task.type === 'direct' 
            ? 'bg-[#00d2ff]/10 text-[#00d2ff] border border-[#00d2ff]/25' 
            : 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/25'
        }`}>
          {task.type === 'direct' ? 'Direct' : 'Transcode'}
        </span>
      </td>
      <td className={`p-3.5 text-xs font-mono tabular-nums text-[#8b92a5] ${isRtl ? 'text-right' : 'text-left'}`}>
        {new Date(task.startedAt).toLocaleTimeString(isRtl ? 'ar-EG' : 'en-US')}
      </td>
      <td className={`p-3.5 ${isRtl ? 'text-right' : 'text-left'}`}>
        <button 
          type="button"
          onClick={() => onKill(task.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 active:scale-95 border border-rose-500/20 transition text-[11px] font-semibold"
          disabled={isPending}
        >
          <XCircle size={13} /> {isRtl ? 'إيقاف' : 'Kill'}
        </button>
      </td>
    </tr>
  );
});

/* ─── ARN Technology Developer Footer ─── */
const DashboardFooter = React.memo(function DashboardFooter({ isRtl }) {
  return (
    <div className="w-full mt-10 pt-6 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="text-center sm:text-start flex flex-col gap-0.5">
        <h3 className="font-extrabold text-base tracking-tight text-white whitespace-nowrap">
          ARN Technology
        </h3>
        <p className="text-xs text-[#8b92a5] whitespace-nowrap">
          {isRtl ? 'حقوق النشر © 2026 لشركة ARN Technology. جميع الحقوق محفوظة.' : 'Copyright © 2026 ARN Technology. All rights reserved.'}
        </p>
        <p className="text-xs whitespace-nowrap mt-0.5 text-[#cbd5e1]">
          {isRtl ? 'تطوير وبرمجة:' : 'Developed by:'}{' '}
          <span className="text-[#10b981] font-bold">{isRtl ? 'عبده رجب نصار' : 'Abdou Ragab Nassar'}</span>
        </p>
      </div>
      
      {/* Social Circular Buttons */}
      <div className="flex items-center gap-3">
        <a 
          href="https://wa.me/201556710314" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="w-10 h-10 rounded-full border border-white/[0.08] bg-white/[0.03] text-[#8b92a5] flex items-center justify-center transition-all hover:scale-110 active:scale-95 hover:bg-[#1e293b] hover:border-[#10b981] hover:text-[#10b981] shadow-sm"
          title="WhatsApp"
        >
          <MessageCircle size={18} />
        </a>
        <a 
          href="https://t.me/ABDOURNASSAR95" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="w-10 h-10 rounded-full border border-white/[0.08] bg-white/[0.03] text-[#8b92a5] flex items-center justify-center transition-all hover:scale-110 active:scale-95 hover:bg-[#1e293b] hover:border-[#00d2ff] hover:text-[#00d2ff] shadow-sm"
          title="Telegram"
        >
          <Send size={18} />
        </a>
        <a 
          href="https://www.facebook.com/abdouragab.nassar" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="w-10 h-10 rounded-full border border-white/[0.08] bg-white/[0.03] text-[#8b92a5] flex items-center justify-center transition-all hover:scale-110 active:scale-95 hover:bg-[#1e293b] hover:border-[#3b82f6] hover:text-[#3b82f6] shadow-sm"
          title="Facebook"
        >
          <Facebook size={18} />
        </a>
        <a 
          href="https://m.me/abdouragab.nassar" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="w-10 h-10 rounded-full border border-white/[0.08] bg-white/[0.03] text-[#8b92a5] flex items-center justify-center transition-all hover:scale-110 active:scale-95 hover:bg-[#1e293b] hover:border-[#00d2ff] hover:text-[#00d2ff] shadow-sm"
          title="Messenger"
        >
          <Ghost size={18} />
        </a>
      </div>
    </div>
  );
});

/* ─── Main Component: DashboardStats ─── */
export default function DashboardStats() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 5000,
    refetchOnWindowFocus: false,
  });

  const killMutation = useMutation({
    mutationFn: killTranscodeTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    }
  });

  const handleKill = useCallback((id) => {
    if (window.confirm(isRtl ? 'هل أنت متأكد من إيقاف هذه المهمة؟' : 'Are you sure you want to stop this task?')) {
      killMutation.mutate(id);
    }
  }, [isRtl, killMutation]);

  // Clean, consistent activity bars
  const activityBars = useMemo(() => {
    return [45, 65, 38, 72, 52, 68, 84, 58, 42, 70, 62, 50];
  }, []);

  // Server metrics list
  const serverStatusItems = useMemo(() => {
    if (!data?.server) return [];
    return [
      { id: 'uptime', label: isRtl ? 'زمن التشغيل' : 'Uptime', value: formatUptime(data.server.uptime), status: 'green' },
      { id: 'platform', label: isRtl ? 'نظام التشغيل' : 'Platform', value: data.server.platform === 'win32' ? 'Windows' : data.server.platform, status: 'green' },
      { id: 'cpuCores', label: isRtl ? 'أنوية المعالج' : 'CPU Cores', value: data.server.cpuCores, status: 'green' },
      { id: 'streams', label: isRtl ? 'البثوث النشطة' : 'Streams', value: data.streams?.total || 0, status: (data.streams?.total || 0) > 0 ? 'yellow' : 'green' },
    ];
  }, [data?.server, data?.streams?.total, isRtl]);

  if (isLoading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-2 border-[#00d2ff]/20 border-t-[#00d2ff] animate-spin" />
        </div>
        <span className="text-xs text-[#8b92a5]">
          {isRtl ? 'جاري قراءة مؤشرات النظام...' : 'Loading system metrics...'}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 flex items-center justify-center">
        <div className="text-center p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20 max-w-md">
          <AlertTriangle size={30} className="text-rose-400 mx-auto mb-3" />
          <p className="text-rose-400 text-sm">
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
      {/* Top Action Row */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] hover:border-[#00d2ff]/40 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-semibold text-[#8b92a5] hover:text-white transition-all shadow-sm active:scale-95"
        >
          <RefreshCw size={13} /> {isRtl ? 'تحديث فوري' : 'Refresh'}
        </button>
      </div>

      {/* === Top Stats Grid (Restrained, Professional Glass Cards) === */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5">
        
        {/* ── 1. Storage Coverage Card ── */}
        <div className="xl:col-span-3 dash-card group">
          <div className="dash-card-inner p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <h3 className="dash-card-title text-white">
                <HardDrive size={15} className="text-[#00d2ff]" />
                {isRtl ? 'تغطية التخزين' : 'Storage Coverage'}
              </h3>
            </div>
            
            <div className="flex items-center gap-4 my-auto">
              <CircularGauge percent={storagePercent} size={115} strokeWidth={8} color1="#00d2ff" color2="#3a7bd5" />
              <div className="flex flex-col gap-1.5 min-w-0">
                <div>
                  <span className="text-base font-bold text-[#00d2ff] tabular-nums font-mono block">
                    GB {((stats?.storage?.free || 0) / (1024**3)).toFixed(1)}
                  </span>
                  <span className="text-[10px] text-[#8b92a5] block">
                    {isRtl ? 'المساحة المتاحة' : 'Free Space'}
                  </span>
                </div>
                <div className="h-px w-full bg-white/[0.08]" />
                <div>
                  <span className="text-xs font-semibold tabular-nums font-mono text-[#cbd5e1] block">
                    GB {((stats?.storage?.total || 0) / (1024**3)).toFixed(1)}
                  </span>
                  <span className="text-[10px] text-[#8b92a5] block">
                    {isRtl ? 'إجمالي القرص' : 'Total Space'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. Resource Usage Card (CPU/RAM) ── */}
        <div className="xl:col-span-3 dash-card group">
          <div className="dash-card-inner p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <h3 className="dash-card-title text-white">
                <Cpu size={15} className="text-[#00d2ff]" />
                {isRtl ? 'استخدام الموارد' : 'Resource Usage'}
              </h3>
            </div>

            <div className="my-auto space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-3xl font-black tracking-tight tabular-nums font-mono text-white">
                    {memPercent.toFixed(1)}
                    <span className="text-base text-[#00d2ff] font-sans ml-1">%</span>
                  </div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-[#8b92a5] mt-0.5">
                    RAM / MEMORY
                  </div>
                </div>

                <div className="text-end">
                  <span className="text-sm font-bold text-[#00d2ff] tabular-nums font-mono block">
                    GB {((stats?.memory?.used || 0) / (1024**3)).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-[#8b92a5] block">
                    {isRtl ? 'المستخدم' : 'Used'}
                  </span>
                </div>
              </div>

              {/* Smooth Sleek Meter */}
              <div className="w-full h-2 rounded-full bg-black/40 border border-white/[0.08] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#3a7bd5] to-[#00d2ff] transition-all duration-1000"
                  style={{
                    width: `${Math.min(memPercent, 100)}%`,
                    boxShadow: '0 0 8px rgba(0, 210, 255, 0.4)'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Server Status Card ── */}
        <div className="xl:col-span-3 dash-card group">
          <div className="dash-card-inner p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="dash-card-title text-white">
                <Server size={15} className="text-[#00d2ff]" />
                {isRtl ? 'حالة الخادم' : 'Server Status'}
              </h3>
            </div>

            <div className="text-xl font-black mb-3 tracking-tight tabular-nums font-mono text-white">
              {formatUptime(stats?.server?.uptime)}
            </div>

            <div className="space-y-1.5 border-t border-white/[0.06] pt-2.5">
              {serverStatusItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <span className="text-[#8b92a5]">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums font-mono text-white">
                      {item.value}
                    </span>
                    <StatusDot status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 4. System Log Activity Card ── */}
        <div className="xl:col-span-3 dash-card group">
          <div className="dash-card-inner p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="dash-card-title text-white">
                <Activity size={15} className="text-[#00d2ff]" />
                {isRtl ? 'نشاط النظام' : 'System Activity'}
              </h3>
              <span className="text-[10px] text-[#8b92a5] font-mono">Real-time</span>
            </div>

            <div className="h-[88px] w-full mt-auto">
              <MiniBarChart values={activityBars} />
            </div>
          </div>
        </div>

      </div>

      {/* === Second Row: Alerts & Live Broadcasts === */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5">
        
        {/* Unmatched Items Alert */}
        <div className="xl:col-span-3 dash-card group">
          <div className="dash-card-inner p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={19} className="text-amber-400" />
              </div>
              <div>
                <div className="text-2xl font-black text-amber-400 tabular-nums font-mono">
                  {unmatchedTotal}
                </div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-[#8b92a5]">
                  {isRtl ? 'عناصر غير مطابقة' : 'Unmatched Items'}
                </div>
              </div>
            </div>

            {unmatchedTotal > 0 && (
              <div className="mt-3 pt-3 border-t border-white/[0.08] flex gap-4 text-xs">
                <span className="text-[#cbd5e1]">
                  {isRtl ? 'أفلام' : 'Movies'}:{' '}
                  <span className="text-amber-300 font-bold font-mono">{stats.unmatched.movies}</span>
                </span>
                <span className="text-[#cbd5e1]">
                  {isRtl ? 'مسلسلات' : 'Series'}:{' '}
                  <span className="text-amber-300 font-bold font-mono">{stats.unmatched.series}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Live Feed / Active Broadcasts Table */}
        <div className="xl:col-span-9 dash-card group">
          <div className="dash-card-inner p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="dash-card-title text-white">
                <Radio size={15} className="text-[#00d2ff]" />
                {isRtl ? 'شبكة البث الحالية' : 'Active Broadcast Network'}
              </h3>
              {(stats?.streams?.total || 0) > 0 && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/25">
                  <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <span className="text-[10px] text-[#10b981] font-bold">Live Stream</span>
                </div>
              )}
            </div>

            {(!stats?.streams?.tasks || stats.streams.tasks.length === 0) ? (
              <div className="py-7 flex flex-col items-center justify-center gap-2.5">
                <div className="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-[#8b92a5]">
                  <CheckCircle2 size={20} className="text-[#00d2ff]/60" />
                </div>
                <span className="text-xs text-[#8b92a5] font-medium">
                  {isRtl ? 'لا توجد أي مهام أو عمليات بث جارية حالياً' : 'No active streams or transcoding tasks'}
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" dir={isRtl ? 'rtl' : 'ltr'}>
                  <thead>
                    <tr className="border-b border-white/[0.08]">
                      <th className={`p-3 font-semibold text-[11px] uppercase tracking-wider text-[#8b92a5] ${isRtl ? 'text-right' : 'text-left'}`}>
                        {isRtl ? 'المعرف' : 'ID'}
                      </th>
                      <th className={`p-3 font-semibold text-[11px] uppercase tracking-wider text-[#8b92a5] ${isRtl ? 'text-right' : 'text-left'}`}>
                        {isRtl ? 'النوع' : 'Type'}
                      </th>
                      <th className={`p-3 font-semibold text-[11px] uppercase tracking-wider text-[#8b92a5] ${isRtl ? 'text-right' : 'text-left'}`}>
                        {isRtl ? 'وقت البدء' : 'Started'}
                      </th>
                      <th className={`p-3 font-semibold text-[11px] uppercase tracking-wider text-[#8b92a5] ${isRtl ? 'text-right' : 'text-left'}`}>
                        {isRtl ? 'الإجراء' : 'Action'}
                      </th>
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

      {/* Footer */}
      <DashboardFooter isRtl={isRtl} />
    </div>
  );
}
