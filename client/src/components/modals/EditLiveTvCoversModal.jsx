import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Sparkles, RotateCcw, Plus, Upload, Tv } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../store/useSettingsStore';

export const PRESET_CHANNELS = [
  { id: 'bein_sports', name: 'beIN SPORTS 1', category: 'sports', url: '/channels/bein_sports.svg' },
  { id: 'ssc_sports', name: 'SSC SPORTS 1 HD', category: 'sports', url: '/channels/ssc_sports.svg' },
  { id: 'mbc_hd', name: 'MBC 1 HD', category: 'general', url: '/channels/mbc_hd.svg' },
  { id: 'osn_tv', name: 'OSN tv Movies', category: 'cinema', url: '/channels/osn_tv.svg' },
  { id: 'natgeo', name: 'National Geographic', category: 'docs', url: '/channels/natgeo.svg' },
  { id: 'alkass', name: 'Alkass Sports', category: 'sports', url: '/channels/alkass.svg' },
];

export const DEFAULT_LIVE_TV_COVERS = PRESET_CHANNELS.slice(0, 5).map(c => c.url);

export default function EditLiveTvCoversModal({ isOpen, onClose }) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const fileInputRef = useRef(null);

  const { liveTvCovers, setLiveTvCovers, resetLiveTvCovers } = useSettingsStore();

  const [selectedCovers, setSelectedCovers] = useState(() => {
    return (liveTvCovers && liveTvCovers.length > 0) ? liveTvCovers : DEFAULT_LIVE_TV_COVERS;
  });

  const [customUrlInput, setCustomUrlInput] = useState('');
  const [customList, setCustomList] = useState([]);

  if (!isOpen) return null;

  const handleToggleCover = (url) => {
    if (selectedCovers.includes(url)) {
      setSelectedCovers(selectedCovers.filter(c => c !== url));
    } else {
      if (selectedCovers.length >= 5) {
        // Keep max 5 covers, replace the last
        setSelectedCovers([...selectedCovers.slice(0, 4), url]);
      } else {
        setSelectedCovers([...selectedCovers, url]);
      }
    }
  };

  const handleAddCustomUrl = (e) => {
    e.preventDefault();
    const trimmed = customUrlInput.trim();
    if (!trimmed) return;
    if (!customList.includes(trimmed)) {
      setCustomList(prev => [trimmed, ...prev]);
    }
    handleToggleCover(trimmed);
    setCustomUrlInput('');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result;
      if (dataUrl) {
        setCustomList(prev => [dataUrl, ...prev]);
        handleToggleCover(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = () => {
    setLiveTvCovers(selectedCovers);
    onClose();
  };

  const handleReset = () => {
    resetLiveTvCovers();
    setSelectedCovers(DEFAULT_LIVE_TV_COVERS);
  };

  const allAvailable = [
    ...PRESET_CHANNELS,
    ...customList.map((url, i) => ({ id: `custom_${i}`, name: isArabic ? 'صورة مخصصة' : 'Custom Image', url }))
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#0c1017] border border-red-500/30 rounded-2xl sm:rounded-3xl shadow-[0_0_50px_rgba(239,68,68,0.25)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-red-950/40 via-surface to-surface">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 shadow-md">
              <Tv size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{isArabic ? 'تخصيص صور قنوات البث المباشر' : 'Customize Live TV Channels Posters'}</span>
                <Sparkles size={16} className="text-red-400" />
              </h2>
              <p className="text-xs text-muted">
                {isArabic ? 'اختر حتى 5 قنوات لتظهر بشكل ثلاثي الأبعاد على بطاقة البث' : 'Choose up to 5 channels to display in 3D on the card'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-muted hover:text-white flex items-center justify-center transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Selected preview bar */}
        <div className="px-5 py-3.5 bg-black/50 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white/80">
              {isArabic ? `القنوات المحددة (${selectedCovers.length} من 5):` : `Selected (${selectedCovers.length} of 5):`}
            </span>
          </div>

          {/* Mini thumbnails preview */}
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3, 4].map(idx => {
              const url = selectedCovers[idx];
              return (
                <div
                  key={idx}
                  className={`w-9 h-12 rounded-lg border flex items-center justify-center overflow-hidden transition-all ${
                    url 
                      ? 'border-red-500 bg-red-950/30 shadow-md ring-1 ring-red-500/30' 
                      : 'border-dashed border-white/20 bg-white/5'
                  }`}
                >
                  {url ? (
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-white/20 font-bold">{idx + 1}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Channels Grid / Selection Body */}
        <div className="p-5 overflow-y-auto max-h-[50vh] space-y-5 custom-scrollbar">
          {/* Preset Channels */}
          <div>
            <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-3">
              {isArabic ? 'قنوات تليفزيونية مقترحة' : 'Suggested TV Channels'}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {allAvailable.map((item, idx) => {
                const isSelected = selectedCovers.includes(item.url);
                return (
                  <button
                    key={item.id || idx}
                    type="button"
                    onClick={() => handleToggleCover(item.url)}
                    className={`group relative rounded-xl overflow-hidden border p-2 flex flex-col items-center gap-2 transition-all ${
                      isSelected
                        ? 'border-red-500 bg-red-950/25 ring-2 ring-red-500/30 shadow-lg shadow-red-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="w-full aspect-[2/3] rounded-lg overflow-hidden bg-black/60 relative">
                      <img 
                        src={item.url} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-white/90 text-center truncate w-full">
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add custom channel image URL / upload */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <h4 className="text-xs font-bold text-white/80">
              {isArabic ? 'إضافة شعار / بوستر قناة خاص بك' : 'Add Custom Channel Logo / Poster'}
            </h4>
            
            <form onSubmit={handleAddCustomUrl} className="flex gap-2">
              <input
                type="url"
                value={customUrlInput}
                onChange={e => setCustomUrlInput(e.target.value)}
                placeholder={isArabic ? 'ضع رابط صورة القناة (https://...)' : 'Enter image URL (https://...)'}
                className="flex-1 px-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-muted focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                disabled={!customUrlInput.trim()}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white text-xs font-bold flex items-center gap-1 transition"
              >
                <Plus size={14} />
                <span>{isArabic ? 'إضافة' : 'Add'}</span>
              </button>
            </form>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-medium text-white flex items-center gap-2 transition"
              >
                <Upload size={13} />
                <span>{isArabic ? 'رفع صورة من جهازك' : 'Upload from device'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/10 bg-[#080b10] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted hover:text-white bg-white/5 hover:bg-white/10 transition"
          >
            <RotateCcw size={13} />
            <span>{isArabic ? 'استعادة الافتراضي' : 'Reset to Default'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-muted hover:text-white transition"
            >
              {isArabic ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition flex items-center gap-1.5"
            >
              <Check size={14} />
              <span>{isArabic ? 'حفظ التغييرات' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
