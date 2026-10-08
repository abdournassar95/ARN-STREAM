import React from 'react';
import { Film, Tv, Music, User, Search, Sparkles, CornerDownLeft, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../store/useSettingsStore';

export default function PredictiveSearchDropdown({
  isOpen,
  results = [],
  prediction = null,
  query = '',
  selectedIndex = -1,
  isLoading = false,
  onSelect,
  onSelectPrediction,
  onViewAll,
  isRtl = true
}) {
  const { t } = useTranslation();
  const { theme } = useSettingsStore();
  const isDark = theme !== 'light';

  if (!isOpen || (!query.trim() && !isLoading)) return null;

  const getTypeBadge = (type) => {
    switch (type) {
      case 'movie':
        return {
          label: isRtl ? 'فيلم' : 'Movie',
          icon: <Film size={12} className="text-red-400" />,
          classes: 'bg-red-500/15 text-red-400 border-red-500/25'
        };
      case 'series':
        return {
          label: isRtl ? 'مسلسل' : 'Series',
          icon: <Tv size={12} className="text-indigo-400" />,
          classes: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25'
        };
      case 'track':
        return {
          label: isRtl ? 'أغنية' : 'Track',
          icon: <Music size={12} className="text-emerald-400" />,
          classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
        };
      case 'artist':
        return {
          label: isRtl ? 'فنان' : 'Artist',
          icon: <User size={12} className="text-amber-400" />,
          classes: 'bg-amber-500/15 text-amber-400 border-amber-500/25'
        };
      default:
        return {
          label: type,
          icon: <Film size={12} className="text-gray-400" />,
          classes: 'bg-gray-500/15 text-gray-300 border-gray-500/25'
        };
    }
  };

  // Highlight query match in title
  const renderHighlightedTitle = (title, q) => {
    if (!q || !title) return title;
    try {
      // Basic normalization-friendly highlight: split by query or render title
      const lowerTitle = title.toLowerCase();
      const lowerQ = q.toLowerCase();
      const index = lowerTitle.indexOf(lowerQ);
      if (index === -1) return title;
      const before = title.slice(0, index);
      const match = title.slice(index, index + q.length);
      const after = title.slice(index + q.length);
      return (
        <span>
          {before}
          <span className="text-red-400 font-bold underline decoration-red-500/40">{match}</span>
          {after}
        </span>
      );
    } catch {
      return title;
    }
  };

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;
  const showPredictionChip = prediction && prediction.toLowerCase() !== query.toLowerCase().trim();

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`absolute start-0 top-full mt-2 w-full min-w-[320px] max-w-full sm:max-w-md md:max-w-lg backdrop-blur-2xl border rounded-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 ${
        isDark 
          ? 'bg-[#0f172a]/95 border-white/15 text-white shadow-[0_20px_60px_rgba(0,0,0,0.65)]' 
          : 'bg-white/95 border-slate-200 text-slate-800 shadow-[0_20px_60px_rgba(0,0,0,0.12)]'
      }`}
    >
      {/* 1. Smart Predictive Chip */}
      {showPredictionChip && (
        <div
          onClick={() => onSelectPrediction && onSelectPrediction(prediction)}
          className={`flex items-center justify-between px-3.5 py-2.5 border-b cursor-pointer transition group ${
            isDark 
              ? 'bg-gradient-to-r from-red-950/40 via-purple-950/30 to-black/30 border-white/10 hover:bg-white/10' 
              : 'bg-gradient-to-r from-red-50 via-purple-50 to-slate-50 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center flex-shrink-0">
              <Sparkles size={13} className="animate-pulse" />
            </span>
            <span className={`text-xs flex-shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {isRtl ? 'التنبؤ الذكي:' : 'Prediction:'}
            </span>
            <span className={`text-xs font-semibold truncate transition ${
              isDark ? 'text-white group-hover:text-red-300' : 'text-slate-900 group-hover:text-red-600'
            }`}>
              {prediction}
            </span>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 flex-shrink-0 ${
            isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-200/80 text-slate-700'
          }`}>
            <span>Tab</span>
            <CornerDownLeft size={10} />
          </span>
        </div>
      )}

      {/* 2. Loading State */}
      {isLoading && (
        <div className={`flex items-center justify-center gap-2.5 py-6 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <Loader2 size={16} className="animate-spin text-red-500" />
          <span>{isRtl ? 'جاري البحث الذكي...' : 'Searching...'}</span>
        </div>
      )}

      {/* 3. Empty State */}
      {!isLoading && results.length === 0 && (
        <div className="py-8 px-4 text-center">
          <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2 ${
            isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'
          }`}>
            <Search size={18} />
          </div>
          <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {isRtl ? `لم نجد نتائج مطابقة لـ "${query}"` : `No results for "${query}"`}
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {isRtl ? 'جرّب كتابة كلمة أخرى أو تأكد من صحة الاسم' : 'Try searching with another keyword'}
          </p>
        </div>
      )}

      {/* 4. Results List */}
      {!isLoading && results.length > 0 && (
        <div className={`max-h-[360px] overflow-y-auto py-1 divide-y scrollbar-thin ${
          isDark ? 'divide-white/5' : 'divide-slate-100'
        }`}>
          {results.map((item, idx) => {
            const badge = getTypeBadge(item.type);
            const isSelected = selectedIndex === idx;

            return (
              <div
                key={`${item.type}-${item.id}-${idx}`}
                onClick={() => onSelect(item)}
                className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition ${
                  isSelected 
                    ? (isDark ? 'bg-white/15 ring-1 ring-white/20' : 'bg-slate-100 ring-1 ring-slate-200') 
                    : (isDark ? 'hover:bg-white/10' : 'hover:bg-slate-50')
                }`}
              >
                {/* Poster / Thumbnail */}
                <div className={`relative w-11 h-14 rounded-lg overflow-hidden flex-shrink-0 shadow-sm border ${
                  isDark ? 'bg-slate-800 border-white/10' : 'bg-slate-100 border-slate-200'
                }`}>
                  {item.poster ? (
                    <img
                      src={item.poster}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className={`w-full h-full flex items-center justify-center ${
                      item.poster ? 'hidden' : 'flex'
                    } ${
                      item.type === 'movie' ? 'bg-red-500/10 text-red-500' :
                      item.type === 'series' ? 'bg-indigo-500/10 text-indigo-500' :
                      item.type === 'track' ? 'bg-emerald-500/10 text-emerald-500' :
                      'bg-amber-500/10 text-amber-500'
                    }`}
                  >
                    {badge.icon}
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.classes}`}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>
                    {item.year && (
                      <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {item.year}
                      </span>
                    )}
                    {item.libraryName && (
                      <span className={`text-[10px] truncate max-w-[120px] hidden xs:inline ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        • {item.libraryName}
                      </span>
                    )}
                  </div>

                  <div className={`text-sm font-semibold truncate leading-snug ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {renderHighlightedTitle(item.title, query)}
                  </div>

                  {(item.artistName || item.albumTitle) && (
                    <div className={`text-xs truncate mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {item.artistName}{item.albumTitle ? ` • ${item.albumTitle}` : ''}
                    </div>
                  )}
                </div>

                {/* Direct Action Indicator */}
                <div className={`flex-shrink-0 opacity-60 group-hover:opacity-100 ps-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <ArrowIcon size={15} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Footer: View All & Keyboard Hints */}
      <div className={`px-3.5 py-2.5 border-t flex items-center justify-between text-xs ${
        isDark ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-200'
      }`}>
        <button
          type="button"
          onClick={onViewAll}
          className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-400 transition"
        >
          <Search size={13} />
          <span>
            {isRtl ? `عرض كل النتائج لـ "${query}"` : `View all results for "${query}"`}
          </span>
          <ArrowIcon size={12} />
        </button>

        <div className={`hidden sm:flex items-center gap-2 text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <span>↑ ↓ {isRtl ? 'للتنقل' : 'Navigate'}</span>
          <span>•</span>
          <span>Enter {isRtl ? 'للاختيار' : 'Select'}</span>
          <span>•</span>
          <span>Esc {isRtl ? 'للإغلاق' : 'Close'}</span>
        </div>
      </div>
    </div>
  );
}
