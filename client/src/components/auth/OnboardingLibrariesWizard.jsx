import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Film, Tv, Music, FolderPlus, FolderSearch, Trash2, Plus, 
  CheckCircle, AlertCircle, Loader2, Sparkles, ArrowRight, ShieldCheck, HardDrive
} from 'lucide-react';
import { createLibrary, triggerScan, validateFolderPath } from '../../api/client';
import { useTranslation } from 'react-i18next';
import FolderBrowserModal from '../modals/FolderBrowserModal';
import { useAuthStore } from '../../store/useAuthStore';

export default function OnboardingLibrariesWizard({ adminUser, onComplete }) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [libraries, setLibraries] = useState([
    {
      id: 'init_1',
      name: isRtl ? 'أفلام' : 'Movies',
      type: 'movies',
      paths: ['']
    },
    {
      id: 'init_2',
      name: isRtl ? 'مسلسلات' : 'TV Series',
      type: 'shows',
      paths: ['']
    },
    {
      id: 'init_3',
      name: isRtl ? 'موسيقى' : 'Music',
      type: 'music',
      paths: ['']
    },
    {
      id: 'init_4',
      name: isRtl ? 'القرآن الكريم' : 'Quran',
      type: 'music',
      paths: ['']
    },
    {
      id: 'init_5',
      name: isRtl ? 'مسرحيات' : 'Plays',
      type: 'movies',
      paths: ['']
    }
  ]);

  const [validations, setValidations] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Folder browser state
  const [browserConfig, setBrowserConfig] = useState({
    isOpen: false,
    libId: null,
    pathIndex: 0,
    initialPath: ''
  });

  const checkSinglePath = useCallback(async (key, val) => {
    if (!val || !val.trim()) {
      setValidations(prev => ({ ...prev, [key]: { checked: false, exists: false } }));
      return;
    }
    try {
      const res = await validateFolderPath(val.trim());
      setValidations(prev => ({ ...prev, [key]: { checked: true, exists: !!res?.exists } }));
    } catch {
      setValidations(prev => ({ ...prev, [key]: { checked: true, exists: false } }));
    }
  }, []);

  const handleNameChange = (id, newName) => {
    setLibraries(prev => prev.map(l => l.id === id ? { ...l, name: newName } : l));
  };

  const handleTypeChange = (id, newType) => {
    setLibraries(prev => prev.map(l => {
      if (l.id !== id) return l;
      let suggestedName = l.name;
      if (l.name === 'أفلام' || l.name === 'مسلسلات' || l.name === 'موسيقى' || l.name === 'Movies' || l.name === 'TV Series' || l.name === 'Music') {
        suggestedName = newType === 'movies' ? (isRtl ? 'أفلام' : 'Movies') : newType === 'shows' ? (isRtl ? 'مسلسلات' : 'TV Series') : (isRtl ? 'موسيقى' : 'Music');
      }
      return { ...l, type: newType, name: suggestedName };
    }));
  };

  const handlePathChange = (libId, pIndex, val) => {
    setLibraries(prev => prev.map(l => {
      if (l.id !== libId) return l;
      const newPaths = [...l.paths];
      newPaths[pIndex] = val;
      return { ...l, paths: newPaths };
    }));
    checkSinglePath(`${libId}_${pIndex}`, val);
  };

  const addPathRow = (libId) => {
    setLibraries(prev => prev.map(l => {
      if (l.id !== libId) return l;
      return { ...l, paths: [...l.paths, ''] };
    }));
  };

  const removePathRow = (libId, pIndex) => {
    setLibraries(prev => prev.map(l => {
      if (l.id !== libId) return l;
      const filtered = l.paths.filter((_, i) => i !== pIndex);
      return { ...l, paths: filtered.length ? filtered : [''] };
    }));
  };

  const addLibrary = (presetType = 'movies', presetName = 'أفلام') => {
    const newId = 'lib_' + Date.now();
    setLibraries(prev => [
      ...prev,
      {
        id: newId,
        name: presetName,
        type: presetType,
        paths: ['']
      }
    ]);
  };

  const removeLibrary = (id) => {
    setLibraries(prev => prev.filter(l => l.id !== id));
  };

  const openBrowser = (libId, pathIndex) => {
    const lib = libraries.find(l => l.id === libId);
    const existingPath = lib?.paths[pathIndex] || '';
    setBrowserConfig({
      isOpen: true,
      libId,
      pathIndex,
      initialPath: existingPath
    });
  };

  const handleFolderSelected = (selectedPath) => {
    if (browserConfig.libId) {
      handlePathChange(browserConfig.libId, browserConfig.pathIndex, selectedPath);
    }
  };

  const handleSaveAndStart = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    // Filter libraries that have at least one valid path
    const validLibs = libraries
      .map(lib => ({
        ...lib,
        validPaths: lib.paths.map(p => p.trim()).filter(Boolean)
      }))
      .filter(lib => lib.validPaths.length > 0 && lib.name.trim());

    if (validLibs.length === 0) {
      setErrorMsg(isRtl ? 'يرجى تحديد مسار مجلد واحد على الأقل للمتابعة.' : 'Please specify at least one folder path to continue.');
      return;
    }

    setSubmitting(true);
    try {
      for (const lib of validLibs) {
        await createLibrary({
          name: lib.name.trim(),
          type: lib.type,
          paths: lib.validPaths,
          icon: lib.type === 'movies' ? 'film' : lib.type === 'shows' ? 'tv' : 'music'
        });
      }

      setSuccessMsg(isRtl ? 'تم حفظ المكتبات بنجاح! جاري بدء فحص الوسائط والدخول للرئيسية...' : 'Libraries saved successfully! Starting media scan...');
      
      // Trigger media scan in the background
      try {
        await triggerScan();
      } catch (scanErr) {
        console.warn('Initial background scan trigger notice:', scanErr);
      }

      setTimeout(() => {
        useAuthStore.setState({ hasLibraries: true });
        if (onComplete) onComplete();
        navigate('/', { replace: true });
      }, 1000);
    } catch (err) {
      console.error('[Onboarding Setup Error]', err);
      setErrorMsg(err.response?.data?.error?.message || (isRtl ? 'فشل حفظ المكتبات. يرجى مراجعة المسارات والمحاولة مجدداً.' : 'Failed to save libraries. Please verify folder paths.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (onComplete) onComplete();
    navigate('/', { replace: true });
  };

  return (
    <div className="w-full max-w-3xl relative z-10 bg-[#0B1221] border border-white/5 rounded-[2rem] p-6 md:p-10 shadow-2xl font-sans animate-fadeIn" dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* Wizard Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold mb-3 shadow-sm">
          <Sparkles size={14} />
          <span>{isRtl ? 'الخطوة 2 من 2: تهيئة مكتبات الوسائط' : 'Step 2 of 2: Setup Media Libraries'}</span>
        </div>

        <h1 className="text-2xl md:text-3xl font-black text-white drop-shadow-sm">
          {isRtl ? `مرحباً بك${adminUser?.display_name ? `، ${adminUser.display_name}` : ''}! 🎉` : `Welcome${adminUser?.display_name ? `, ${adminUser.display_name}` : ''}! 🎉`}
        </h1>
        <p className="text-xs md:text-sm text-slate-300 mt-2 max-w-xl mx-auto leading-relaxed">
          {isRtl
            ? 'تم إنشاء حساب المدير الرئيسي بنجاح. أضف الآن مجلدات الوسائط الخاصة بك على جهازك (أفلام، مسلسلات، موسيقى) لتبدأ المنصة بفحصها وتنظيمها تلقائياً.'
            : 'Super admin account initialized. Add your local media folders (Movies, Shows, Music) so the server can index and organize your collection automatically.'}
        </p>

        {/* Quick Add Presets Bar */}
        <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
          <button
            type="button"
            onClick={() => addLibrary('movies', isRtl ? 'أفلام' : 'Movies')}
            className="px-3 py-1.5 rounded-full bg-[#121B2D] border border-white/5 hover:border-white/10 text-red-400 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Film size={14} className="text-red-400" />
            <span>{isRtl ? '+ إضافة مكتبة أفلام' : '+ Add Movies Library'}</span>
          </button>
          <button
            type="button"
            onClick={() => addLibrary('shows', isRtl ? 'مسلسلات' : 'TV Series')}
            className="px-3 py-1.5 rounded-full bg-[#121B2D] border border-white/5 hover:border-white/10 text-sky-400 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Tv size={14} className="text-sky-400" />
            <span>{isRtl ? '+ إضافة مكتبة مسلسلات' : '+ Add Series Library'}</span>
          </button>
          <button
            type="button"
            onClick={() => addLibrary('music', isRtl ? 'موسيقى' : 'Music')}
            className="px-3 py-1.5 rounded-full bg-[#121B2D] border border-white/5 hover:border-white/10 text-teal-400 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Music size={14} className="text-teal-400" />
            <span>{isRtl ? '+ إضافة مكتبة موسيقى' : '+ Add Music Library'}</span>
          </button>
          <button
            type="button"
            onClick={() => addLibrary('music', isRtl ? 'القرآن الكريم' : 'Quran')}
            className="px-3 py-1.5 rounded-full bg-[#121B2D] border border-white/5 hover:border-white/10 text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Music size={14} className="text-emerald-400" />
            <span>{isRtl ? '+ إضافة القرآن الكريم' : '+ Add Quran'}</span>
          </button>
          <button
            type="button"
            onClick={() => addLibrary('movies', isRtl ? 'مسرحيات' : 'Plays')}
            className="px-3 py-1.5 rounded-full bg-[#121B2D] border border-white/5 hover:border-white/10 text-purple-400 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Film size={14} className="text-purple-400" />
            <span>{isRtl ? '+ إضافة مسرحيات' : '+ Add Plays'}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="mb-6 p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle size={18} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Libraries Cards List */}
      <div className="space-y-4 max-h-[50vh] overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-slate-700">
        {libraries.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl bg-[#0f172a] p-6">
            <FolderPlus size={36} className="mx-auto text-slate-500 mb-2 opacity-50" />
            <p className="text-sm font-semibold text-slate-400">{isRtl ? 'لا توجد مكتبات محددة حالياً' : 'No libraries configured yet'}</p>
            <p className="text-xs text-slate-500 mt-1">{isRtl ? 'استخدم الأزرار أعلاه لإضافة مكتبة جديدة' : 'Use the buttons above to add a library'}</p>
          </div>
        ) : (
          libraries.map((lib, libIdx) => {
            const isMovies = lib.type === 'movies';
            const isShows = lib.type === 'shows';
            const isMusic = lib.type === 'music';

            return (
              <React.Fragment key={lib.id}>
                <div className="p-5 rounded-2xl bg-[#131B2C] border border-white/5 transition shadow-sm relative group">
                  {/* Top Row: Type & Name */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isMovies ? 'bg-[#2A1D2D] text-red-400 border border-red-500/10' :
                        isShows ? 'bg-[#152740] text-sky-400 border border-sky-500/10' :
                        'bg-[#122A30] text-teal-400 border border-teal-500/10'
                      }`}>
                        {isMovies ? <Film size={18} /> : isShows ? <Tv size={18} /> : <Music size={18} />}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={lib.name}
                          onChange={(e) => handleNameChange(lib.id, e.target.value)}
                          placeholder={isRtl ? 'اسم المكتبة' : 'Library Name'}
                          className="bg-[#0B101E] border border-white/5 rounded-2xl px-3 py-1.5 text-sm font-bold text-slate-100 focus:outline-none focus:border-[#1ea1f2] transition w-36 sm:w-44"
                        />
                        
                        <select
                          value={lib.type}
                          onChange={(e) => handleTypeChange(lib.id, e.target.value)}
                          className="bg-[#0B101E] border border-white/5 rounded-2xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-[#1ea1f2] transition"
                        >
                          <option value="movies">{isRtl ? 'أفلام (Movies)' : 'Movies'}</option>
                          <option value="shows">{isRtl ? 'مسلسلات (Shows)' : 'Shows'}</option>
                          <option value="music">{isRtl ? 'موسيقى (Music)' : 'Music'}</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeLibrary(lib.id)}
                      className="self-end sm:self-center p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                      title={isRtl ? 'حذف هذه المكتبة' : 'Remove this library'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Paths rows */}
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                      <span>{isRtl ? 'مجلدات الوسائط على القرص:' : 'Media folders on disk:'}</span>
                      <button
                         type="button"
                         onClick={() => addPathRow(lib.id)}
                         className="text-[#1ea1f2] hover:text-[#1a90d9] text-[11px] flex items-center gap-1 font-bold transition"
                      >
                         <Plus size={12} />
                         <span>{isRtl ? 'إضافة مسار إضافي' : 'Add another path'}</span>
                      </button>
                    </div>

                    {lib.paths.map((pathVal, pIdx) => {
                      const vKey = `${lib.id}_${pIdx}`;
                      const valStatus = validations[vKey];

                      return (
                        <div key={pIdx} className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={pathVal}
                              onChange={(e) => handlePathChange(lib.id, pIdx, e.target.value)}
                              placeholder={isRtl ? 'مثال: D:\\Media\\Movies أو اختر عبر زر استعراض' : 'e.g. D:\\Media\\Movies or Browse'}
                              dir="ltr"
                              className={`w-full bg-[#0B101E] border rounded-2xl px-3.5 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none transition ${
                                valStatus?.checked
                                  ? valStatus.exists
                                    ? 'border-[#1ea1f2] focus:border-[#1ea1f2]'
                                    : 'border-amber-500 focus:border-amber-500'
                                  : 'border-white/5 focus:border-[#1ea1f2]'
                              }`}
                            />
                            {valStatus?.checked && (
                              <div className="absolute right-3 top-2.5 flex items-center gap-1 pointer-events-none">
                                {valStatus.exists ? (
                                  <span className="text-[10px] text-[#1ea1f2] font-sans font-bold flex items-center gap-1">
                                    <CheckCircle size={14} /> {isRtl ? 'موجود' : 'Found'}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-500 font-sans font-bold flex items-center gap-1">
                                    <AlertCircle size={14} /> {isRtl ? 'غير موجود' : 'Not found'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => openBrowser(lib.id, pIdx)}
                            className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                          >
                            <FolderSearch size={14} />
                            <span>{isRtl ? 'استعراض' : 'Browse'}</span>
                          </button>

                          {lib.paths.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePathRow(lib.id, pIdx)}
                              className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-white/5 transition shrink-0"
                              title={isRtl ? 'إزالة هذا المسار' : 'Remove path'}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {libIdx < libraries.length - 1 && (
                  <div className="border-b border-white/5" />
                )}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Footer Actions */}
      <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-end gap-4">
        <button
          type="button"
          onClick={handleSaveAndStart}
          disabled={submitting}
          className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-[#1ea1f2] hover:bg-[#1a90d9] text-white font-black text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:pointer-events-none shadow-sm"
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>{isRtl ? 'جاري حفظ وتجهيز السيرفر...' : 'Saving and setting up server...'}</span>
            </>
          ) : (
            <>
              <span>{isRtl ? 'حفظ وبدء فحص الوسائط والتشغيل' : 'Save & Start Media Scan'}</span>
              <ArrowRight size={16} className={isRtl ? 'rotate-180' : ''} />
            </>
          )}
        </button>
      </div>

      {/* Reusable Directory Browser Modal */}
      <FolderBrowserModal
        isOpen={browserConfig.isOpen}
        initialPath={browserConfig.initialPath}
        onSelect={handleFolderSelected}
        onClose={() => setBrowserConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
