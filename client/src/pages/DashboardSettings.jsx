import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/useSettingsStore';
import {
  Folder, Film, Tv, Music, CheckCircle2, AlertCircle, Loader2, Trash2, Save, Scan, Plus, FolderSearch, HardDrive, ChevronLeft, Monitor, ChevronUp, ChevronDown, X, RefreshCw,
  Compass, BookOpen, Drama
} from 'lucide-react';
import {
  fetchLibraries, createLibrary, updateLibrary, deleteLibrary, scanSingleLibrary,
  validateFolderPath, browseFolders, pickSystemFolder, triggerScan, clearLibraryData,
  fetchGeneralSettings, saveGeneralSettings
} from '../api/client';
import FolderBrowserModal from '../components/modals/FolderBrowserModal';

export default function DashboardSettings({ activeTab }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const qc = useQueryClient();
  
  const { 
    theme, setTheme, 
    enableBlur, setEnableBlur, 
    defaultLibraryView, setDefaultLibraryView,
    autoPlayNext, setAutoPlayNext,
    skipTime, setSkipTime,
    upNextTime, setUpNextTime,
    homeSectionsOrder, setHomeSectionsOrder
  } = useSettingsStore();

  const isDark = theme !== 'light';

  const [libraries, setLibraries] = useState([]);
  const [deletedLibraryIds, setDeletedLibraryIds] = useState([]);
  const [validations, setValidations] = useState({});
  const [notification, setNotification] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningLibId, setScanningLibId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const [browserState, setBrowserState] = useState({
    isOpen: false,
    libId: null,
    pathIndex: null,
    currentPath: null,
    parentPath: null,
    drives: [],
    folderList: [],
    loading: false
  });

  const [serverSettings, setServerSettings] = useState({ port: '8096', dlnaEnabled: true });

  const moveSection = (index, direction) => {
    if (!homeSectionsOrder) return;
    const newOrder = [...homeSectionsOrder];
    if (direction === 'up' && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setHomeSectionsOrder(newOrder);
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
      setHomeSectionsOrder(newOrder);
    }
  };

  
  const getSectionName = (key) => {
    const map = {
      continueWatching: isRtl ? 'متابعة المشاهدة' : 'Continue Watching',
      continueListening: isRtl ? 'متابعة الاستماع (صوتيات)' : 'Continue Listening',
      recentlyAdded: isRtl ? 'المضاف مؤخراً (عام)' : 'Recently Added (Mixed)',
      collections: isRtl ? 'المجموعات' : 'Collections'
    };
    if (map[key]) return map[key];
    if (key.startsWith('lib_')) {
      const libId = parseInt(key.split('_')[1]);
      const libInfo = libraries.find(l => l.id === libId);
      if (libInfo) return (isRtl ? 'أحدث ' : 'Latest in ') + libInfo.name;
    }
    return key;
  };

  // Ensure compatibility with older string arrays in localStorage
  const normalizeSections = (sections) => {
    if (!sections || !Array.isArray(sections)) return [];
    return sections.map(sec => typeof sec === 'string' ? { id: sec, enabled: true } : sec);
  };
  const currentSections = normalizeSections(homeSectionsOrder);

  const toggleSection = (index) => {
    const newOrder = [...currentSections];
    newOrder[index] = { ...newOrder[index], enabled: !newOrder[index].enabled };
    setHomeSectionsOrder(newOrder);
  };

  const moveSectionObj = (index, direction) => {
    const newOrder = [...currentSections];
    if (direction === 'up' && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setHomeSectionsOrder(newOrder);
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
      setHomeSectionsOrder(newOrder);
    }
  };


  const { data: initialLibs, isLoading: isLoadingLibs } = useQuery({
    queryKey: ['libraries', { nonEmpty: false }],
    queryFn: () => fetchLibraries(false),
  });

  const { data: generalData } = useQuery({
    queryKey: ['general-settings'],
    queryFn: fetchGeneralSettings,
  });

  useEffect(() => {
    if (generalData) {
      setServerSettings({
        port: generalData.port || '8096',
        dlnaEnabled: generalData.dlnaEnabled !== false
      });
    }
  }, [generalData]);

  useEffect(() => {
    if (initialLibs) {
      const cloned = initialLibs.map(lib => {
        let p = [];
        try { p = typeof lib.paths === 'string' ? JSON.parse(lib.paths) : lib.paths; } catch {}
        if (!Array.isArray(p)) p = [];
        if (p.length === 0) p.push('');
        return { ...lib, paths: p, _isNew: false };
      });
      setLibraries(cloned);
      setDeletedLibraryIds([]);
      
      // Auto-inject missing dynamic libraries into homeSectionsOrder
      const baseSections = ['continueWatching', 'continueListening', 'recentlyAdded', 'collections'];
      let updated = normalizeSections(homeSectionsOrder);
      for (const b of baseSections) {
        if (!updated.find(s => s.id === b)) {
          updated.push({ id: b, enabled: true });
        }
      }
      for (const lib of cloned) {
        const lid = 'lib_' + lib.id;
        if (!updated.find(s => s.id === lid)) {
          updated.push({ id: lid, enabled: true });
        }
      }
      updated = updated.filter(s => baseSections.includes(s.id) || ((s?.id || '').startsWith('lib_') && cloned.some(l => 'lib_' + l.id === s.id)));
      
      // Only trigger a state update if the order actually changed (to prevent infinite loops)
      if (JSON.stringify(updated) !== JSON.stringify(normalizeSections(homeSectionsOrder))) {
        setHomeSectionsOrder(updated);
      }
    }
  }, [initialLibs, homeSectionsOrder, setHomeSectionsOrder]);

  const checkSinglePath = useCallback(async (vKey, pathVal) => {
    if (!pathVal || !pathVal.trim()) {
      setValidations(prev => ({ ...prev, [vKey]: { exists: false, checked: false } }));
      return;
    }
    try {
      const res = await validateFolderPath(pathVal.trim());
      setValidations(prev => ({ ...prev, [vKey]: { exists: !!res?.exists, checked: true } }));
    } catch {
      setValidations(prev => ({ ...prev, [vKey]: { exists: false, checked: true } }));
    }
  }, []);

  const handleLibraryNameChange = (libId, val) => {
    setLibraries(prev => prev.map(lib => lib.id === libId ? { ...lib, name: val } : lib));
  };

  const handlePathChange = (libId, pathIndex, val) => {
    setLibraries(prev => prev.map(lib => {
      if (lib.id === libId) {
        const newPaths = [...lib.paths];
        newPaths[pathIndex] = val;
        return { ...lib, paths: newPaths };
      }
      return lib;
    }));
    checkSinglePath(`${libId}-${pathIndex}`, val);
  };

  const addPathRow = (libId, defaultVal = '') => {
    setLibraries(prev => prev.map(lib => {
      if (lib.id === libId) {
        return { ...lib, paths: [...lib.paths, defaultVal] };
      }
      return lib;
    }));
  };

  const removePathRow = (libId, pathIndex) => {
    setLibraries(prev => prev.map(lib => {
      if (lib.id === libId) {
        const newPaths = lib.paths.filter((_, i) => i !== pathIndex);
        if (newPaths.length === 0) newPaths.push('');
        return { ...lib, paths: newPaths };
      }
      return lib;
    }));
  };

  const addNewLibrary = () => {
    const newId = 'new_' + Date.now();
    setLibraries(prev => [...prev, {
      id: newId,
      name: isRtl ? 'مكتبة جديدة' : 'New Library',
      type: 'movies',
      icon: 'film',
      paths: [''],
      _isNew: true
    }]);
  };

  const handleRemoveLibrary = (libId) => {
    const lib = libraries.find(l => l.id === libId);
    if (!lib) return;
    if (!lib._isNew) {
      setDeletedLibraryIds(prev => [...prev, libId]);
    }
    setLibraries(prev => prev.filter(l => l.id !== libId));
  };

  const openDirectoryBrowser = (libId, pathIndex = null) => {
    const lib = libraries.find(l => l.id === libId);
    const existingVal = pathIndex !== null ? (lib?.paths[pathIndex] || '') : '';
    setBrowserState({
      isOpen: true,
      libId,
      pathIndex,
      initialPath: existingVal
    });
  };

  const selectCurrentDirectory = (chosenPath) => {
    if (!chosenPath) return;
    const { libId, pathIndex } = browserState;
    if (pathIndex !== null && pathIndex >= 0) {
      handlePathChange(libId, pathIndex, chosenPath);
    } else {
      addPathRow(libId, chosenPath);
    }
    setBrowserState(prev => ({ ...prev, isOpen: false }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const id of deletedLibraryIds) {
        await deleteLibrary(id);
      }
      for (const lib of libraries) {
        const validPaths = lib.paths.filter(p => p && p.trim());
        const cat = getCategoryForLib(lib);
        const payload = { 
          name: lib.name, 
          type: lib.type, 
          paths: validPaths,
          icon: lib.icon || cat?.id || 'folder'
        };
        if (lib._isNew) {
          await createLibrary(payload);
        } else {
          await updateLibrary(lib.id, payload);
        }
      }
      await saveGeneralSettings(serverSettings);
      return true;
    },
    onSuccess: async () => {
      setNotification({ type: 'success', text: isRtl ? 'تم حفظ التغييرات بنجاح' : 'Settings saved successfully' });
      qc.invalidateQueries({ queryKey: ['libraries'] });
      setIsScanning(true);
      try {
        await triggerScan();
        qc.invalidateQueries();
      } catch (err) {}
      setIsScanning(false);
      setTimeout(() => setNotification(null), 3000);
    },
  });

  const clearMutation = useMutation({
    mutationFn: clearLibraryData,
    onSuccess: () => {
      setNotification({ type: 'success', text: t('settings.clearedSuccess', 'Library cleared') });
      setConfirmClear(false);
      qc.invalidateQueries();
      setTimeout(() => setNotification(null), 3000);
    },
  });

  const renderStatus = (key, val) => {
    if (!val || !val.trim()) {
      return (
        <span className="text-[11px] text-muted flex items-center gap-1 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-border inline-block" />
          {isRtl ? 'لم يتم تعيين مسار' : 'Not configured'}
        </span>
      );
    }
    const st = validations[key];
    if (!st || !st.checked) return null;
    if (st.exists) {
      return (
        <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
          <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
          {isRtl ? 'المسار موجود على جهازك' : 'Folder exists'}
        </span>
      );
    }
    return (
      <span className="text-[11px] text-amber-400 flex items-center gap-1 mt-1 font-medium">
        <AlertCircle size={12} className="text-amber-400 flex-shrink-0" />
        {isRtl ? 'المسار غير موجود أو لا يمكن الوصول إليه' : 'Folder not found'}
      </span>
    );
  };

  const LIBRARY_CATEGORIES = [
    { id: 'film', labelAr: '🎬 أفلام سينمائية', labelEn: '🎬 Movies', icon: Film, defaultType: 'movies', color: 'text-red-400' },
    { id: 'tv', labelAr: '📺 مسلسلات وبرامج', labelEn: '📺 TV Shows', icon: Tv, defaultType: 'shows', color: 'text-sky-400' },
    { id: 'compass', labelAr: '🧭 وثائقي واستكشاف', labelEn: '🧭 Documentaries', icon: Compass, defaultType: 'shows', color: 'text-amber-400' },
    { id: 'drama', labelAr: '🎭 مسرحيات وفنون', labelEn: '🎭 Plays & Theater', icon: Drama, defaultType: 'movies', color: 'text-purple-400' },
    { id: 'book', labelAr: '📖 القرآن الكريم وإسلاميات', labelEn: '📖 Quran & Islamic', icon: BookOpen, defaultType: 'music', color: 'text-teal-400' },
    { id: 'music', labelAr: '🎵 أغاني وصوتيات', labelEn: '🎵 Songs & Music', icon: Music, defaultType: 'music', color: 'text-emerald-400' },
    { id: 'folder', labelAr: '📁 مجلد عام / مخصص', labelEn: '📁 Custom Folder', icon: Folder, defaultType: 'movies', color: 'text-slate-400' },
  ];

  const getCategoryForLib = (lib) => {
    if (lib.icon && lib.icon !== 'folder') {
      const matched = LIBRARY_CATEGORIES.find(c => c.id === lib.icon);
      if (matched) return matched;
    }
    const n = (lib.name || '').toLowerCase();
    if (n.includes('وثائق') || n.includes('doc')) return LIBRARY_CATEGORIES.find(c => c.id === 'compass');
    if (n.includes('قرآن') || n.includes('قران') || n.includes('quran') || n.includes('اسلام')) return LIBRARY_CATEGORIES.find(c => c.id === 'book');
    if (n.includes('مسرح') || n.includes('play')) return LIBRARY_CATEGORIES.find(c => c.id === 'drama');
    if (lib.type === 'shows' || n.includes('مسلسل')) return LIBRARY_CATEGORIES.find(c => c.id === 'tv');
    if (lib.type === 'music') return LIBRARY_CATEGORIES.find(c => c.id === 'music');
    return LIBRARY_CATEGORIES.find(c => c.id === 'film') || LIBRARY_CATEGORIES[0];
  };

  const renderLibIcon = (lib) => {
    const cat = getCategoryForLib(lib);
    const IconComp = cat?.icon || Folder;
    return <IconComp size={16} className={cat?.color || 'text-cyan-400'} />;
  };

  /* ── Shared style helpers ── */
  const inputStyle = {
    background: 'var(--dash-input-bg)',
    borderColor: 'var(--dash-input-border)',
    color: 'var(--dash-input-text)',
  };
  const inputFocusClass = 'outline-none transition';
  const headingStyle = { color: 'var(--dash-heading-text)' };
  const mutedStyle = { color: 'var(--dash-muted-text)' };
  const bodyStyle = { color: 'var(--dash-body-text)' };
  const cardInnerBg = isDark ? 'rgba(10,15,30,0.8)' : 'rgba(241,245,249,0.7)';
  const sectionItemBg = isDark ? 'rgba(10,15,30,0.8)' : 'rgba(241,245,249,0.6)';
  const sectionItemInactive = isDark ? 'rgba(10,15,30,0.3)' : 'rgba(241,245,249,0.3)';

  return (
    <div className="space-y-6 animate-fadeIn">
      {notification && (
        <div className="px-5 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-sm font-medium flex items-center gap-2 shadow-lg shadow-emerald-500/5">
          <CheckCircle2 size={18} />
          {notification.text}
        </div>
      )}

      {/* Main Settings Area */}
      {isLoadingLibs ? (
        <div className="dash-card">
          <div className="dash-card-inner py-12 flex justify-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          </div>
        </div>
      ) : activeTab === 'libraries' ? (
        <div className="dash-card">
          <div className="dash-card-inner p-4 sm:p-5">
            <div className="space-y-3">
              {libraries.map(lib => (
                <div key={lib.id} className="p-3.5 rounded-xl border relative transition-all shadow-sm" style={{ background: cardInnerBg, borderColor: 'var(--dash-input-border)' }}>
                  <div className="flex items-center justify-between flex-wrap gap-2.5">
                    <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                      {renderLibIcon(lib)}
                      <input 
                        type="text" 
                        value={lib.name}
                        onChange={(e) => handleLibraryNameChange(lib.id, e.target.value)}
                        className={`border text-sm font-bold rounded-lg px-2.5 py-1 w-full max-w-[170px] ${inputFocusClass}`}
                        style={inputStyle}
                        placeholder={isRtl ? 'اسم المكتبة' : 'Library Name'}
                      />

                      {/* Category / Icon Picker */}
                      <select 
                        value={lib.icon || getCategoryForLib(lib)?.id || 'folder'}
                        onChange={(e) => {
                          const chosenCat = LIBRARY_CATEGORIES.find(c => c.id === e.target.value);
                          setLibraries(prev => prev.map(l => {
                            if (l.id !== lib.id) return l;
                            return {
                              ...l,
                              icon: e.target.value,
                              ...(l._isNew && chosenCat ? { type: chosenCat.defaultType } : {})
                            };
                          }));
                        }}
                        className={`border text-xs font-semibold rounded-lg px-2 py-1 ${inputFocusClass}`}
                        style={inputStyle}
                        title={isRtl ? 'تصنيف وهوية المكتبة والأيقونة' : 'Category & Icon'}
                      >
                        {LIBRARY_CATEGORIES.map(cat => (
                          <option key={cat.id} style={{ background: 'var(--dash-select-dropdown-bg)' }} value={cat.id}>
                            {isRtl ? cat.labelAr : cat.labelEn}
                          </option>
                        ))}
                      </select>

                      {/* Engine structure type (Movies / Shows / Music) */}
                      {lib._isNew ? (
                        <select 
                          value={lib.type} 
                          onChange={(e) => setLibraries(prev => prev.map(l => l.id === lib.id ? {...l, type: e.target.value} : l))}
                          className={`border text-xs font-semibold rounded-lg px-2 py-1 ${inputFocusClass} text-slate-400`}
                          style={inputStyle}
                          title={isRtl ? 'نوع الهيكل التقني لمحرك الفحص' : 'Engine Type'}
                        >
                          <option style={{ background: 'var(--dash-select-dropdown-bg)' }} value="movies">{isRtl ? 'هيكل: أفلام' : 'Movies'}</option>
                          <option style={{ background: 'var(--dash-select-dropdown-bg)' }} value="shows">{isRtl ? 'هيكل: مسلسلات' : 'Shows'}</option>
                          <option style={{ background: 'var(--dash-select-dropdown-bg)' }} value="music">{isRtl ? 'هيكل: صوتيات' : 'Music'}</option>
                        </select>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/50">
                          {lib.type === 'movies' ? (isRtl ? 'أفلام' : 'Movies') :
                           lib.type === 'shows' ? (isRtl ? 'مسلسلات' : 'Shows') :
                           (isRtl ? 'صوتيات' : 'Music')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openDirectoryBrowser(lib.id, null)}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 text-cyan-300 text-xs font-bold flex items-center gap-1 transition"
                      >
                        <Plus size={13} className="text-cyan-400" />
                        <span>{isRtl ? 'إضافة مسار' : 'Add Path'}</span>
                      </button>
                      {!lib._isNew && (
                        <button
                          type="button"
                          onClick={async () => {
                            setScanningLibId(lib.id);
                            try {
                              await scanSingleLibrary(lib.id);
                              qc.invalidateQueries({ queryKey: ['libraries'] });
                              setNotification({ type: 'success', text: isRtl ? `تم فحص وتحديث مكتبة «${lib.name}» بنجاح` : `Scanned «${lib.name}» successfully` });
                            } catch (e) {
                              console.error(e);
                            } finally {
                              setScanningLibId(null);
                              setTimeout(() => setNotification(null), 3500);
                            }
                          }}
                          disabled={scanningLibId === lib.id}
                          className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-300 text-xs font-bold flex items-center gap-1 transition disabled:opacity-50"
                          title={isRtl ? 'فحص مجلدات هذه المكتبة فقط' : 'Scan this library only'}
                        >
                          <RefreshCw size={12} className={scanningLibId === lib.id ? 'animate-spin text-cyan-400' : ''} />
                          <span>{scanningLibId === lib.id ? (isRtl ? 'فحص...' : 'Scanning...') : (isRtl ? 'فحص' : 'Scan')}</span>
                        </button>
                      )}
                      {(!lib._isNew && lib.id > 3 || lib._isNew) && (
                        <button onClick={() => handleRemoveLibrary(lib.id)} className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 border border-red-500/20 transition">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-2.5">
                    {lib.paths.map((pathVal, idx) => {
                      const vKey = `${lib.id}-${idx}`;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={pathVal}
                              onChange={(e) => handlePathChange(lib.id, idx, e.target.value)}
                              onBlur={() => checkSinglePath(vKey, pathVal)}
                              className={`w-full h-9 px-3 rounded-lg border text-xs font-mono transition flex-1 ${inputFocusClass}`}
                              style={{ ...inputStyle, '--tw-placeholder-opacity': 1 }}
                              placeholder="E:\Media"
                              dir="ltr"
                            />
                            <button
                              onClick={() => openDirectoryBrowser(lib.id, idx)}
                              className="h-9 px-3 rounded-lg border hover:bg-cyan-500/10 hover:text-cyan-300 text-xs font-bold flex items-center gap-1 transition shrink-0"
                              style={{ background: 'var(--dash-input-bg)', borderColor: 'var(--dash-input-border)', color: 'var(--dash-muted-text)' }}
                            >
                              <FolderSearch size={14} className="text-cyan-400" />
                              <span className="hidden sm:inline">{isRtl ? 'استعراض' : 'Browse'}</span>
                            </button>
                            {lib.paths.length > 1 && (
                              <button
                                onClick={() => removePathRow(lib.id, idx)}
                                className="h-9 w-9 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center transition shrink-0"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                          {renderStatus(vKey, pathVal)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              <button 
                onClick={addNewLibrary}
                className="w-full py-2.5 rounded-xl border border-dashed border-cyan-500/20 hover:border-cyan-400/40 hover:text-cyan-300 flex items-center justify-center gap-1.5 text-xs font-bold transition shadow-sm"
                style={{ background: isDark ? 'rgba(10,15,30,0.4)' : 'rgba(241,245,249,0.4)', color: 'var(--dash-muted-text)' }}
              >
                <Plus size={16} />
                {isRtl ? 'إضافة مكتبة جديدة' : 'Add Custom Library'}
              </button>

              <div className="pt-4 mt-4 border-t border-cyan-500/10 p-4 rounded-xl bg-red-500/[0.03] border border-red-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                    <Trash2 size={14} />
                    {t('settings.clearLibrary', 'مسح قاعدة بيانات المكتبات')}
                  </div>
                  <p className="text-[11px] mt-0.5 max-w-md" style={mutedStyle}>
                    {t('settings.clearConfirm', 'سيتم مسح كافة البيانات والصور المخزنة مؤقتاً في قاعدة البيانات، هذا لا يؤثر على ملفاتك الأصلية.')}
                  </p>
                </div>
                {confirmClear ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => clearMutation.mutate()}
                      disabled={clearMutation.isPending}
                      className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-md shadow-red-600/30"
                    >
                      {clearMutation.isPending ? t('settings.clearing', 'جاري المسح...') : t('actions.delete', 'تأكيد الحذف')}
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition"
                      style={{ background: 'var(--dash-input-bg)', color: 'var(--dash-body-text)', borderColor: 'var(--dash-input-border)' }}
                    >
                      {t('actions.cancel', 'إلغاء')}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="px-3 py-1.5 rounded-lg border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition shrink-0"
                  >
                    {t('settings.clearLibrary', 'مسح المكتبة')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'general' ? (
        <div className="space-y-3">
          <div className="dash-card">
            <div className="dash-card-inner p-4 sm:p-5">
              <h3 className="text-sm font-bold mb-1 flex items-center gap-2" style={headingStyle}>
                <Monitor size={16} className="text-cyan-400" /> 
                {isRtl ? 'منفذ السيرفر (Port)' : 'Server Port'}
              </h3>
              <p className="text-[11px] mb-3" style={mutedStyle}>{isRtl ? 'رقم المنفذ الذي يعمل عليه السيرفر. يتطلب إعادة تشغيل الخادم لتطبيقه.' : 'The port number the server runs on. Requires a restart to take effect.'}</p>
              <input
                type="number"
                value={serverSettings.port}
                onChange={e => setServerSettings(prev => ({...prev, port: e.target.value}))}
                className={`w-full sm:w-48 h-9 px-3 rounded-lg border text-xs font-mono ${inputFocusClass}`}
                style={inputStyle}
              />
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-inner p-4 sm:p-5">
              <h3 className="text-sm font-bold mb-1 flex items-center gap-2" style={headingStyle}>
                <Tv size={16} className="text-emerald-400" /> 
                {isRtl ? 'دعم شبكات DLNA / UPnP' : 'DLNA / UPnP Support'}
              </h3>
              <p className="text-[11px] mb-3" style={mutedStyle}>{isRtl ? 'تفعيل البث المباشر للشاشات الذكية والأجهزة الداعمة على الشبكة المحلية.' : 'Enable streaming directly to Smart TVs, VLC, and other DLNA-compatible devices on your local network. Requires a restart.'}</p>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={serverSettings.dlnaEnabled} 
                    onChange={e => setServerSettings(prev => ({...prev, dlnaEnabled: e.target.checked}))} 
                  />
                  <div className="w-11 h-6 border rounded-full peer peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5 peer-checked:border-cyan-400/50 peer-checked:bg-cyan-500/30 peer-checked:shadow-[0_0_12px_rgba(6,182,212,0.4)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] rtl:after:left-auto rtl:after:right-[2px] peer-checked:after:bg-cyan-300 after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ background: 'var(--dash-input-bg)', borderColor: 'var(--dash-input-border)', '--tw-after-bg': 'var(--dash-muted-text)' }}>
                    <style>{`.peer ~ div::after { background: var(--dash-muted-text); }`}</style>
                  </div>
                </div>
                <span className="text-xs font-bold" style={bodyStyle}>{isRtl ? 'تفعيل خدمة DLNA' : 'Enable DLNA Service'}</span>
              </label>
            </div>
          </div>
        </div>
      ) : activeTab === 'display' ? (
        <div className="space-y-3">
          <div className="dash-card">
            <div className="dash-card-inner p-4 sm:p-5">
              <h3 className="text-sm font-bold mb-1 flex items-center gap-2" style={headingStyle}>{isRtl ? 'مظهر النظام' : 'Theme Mode'}</h3>
              <p className="text-[11px] mb-3" style={mutedStyle}>{isRtl ? 'اختر المظهر البصري المفضل لديك.' : 'Choose your preferred visual theme.'}</p>
              <select 
                value={theme}
                onChange={e => setTheme(e.target.value)}
                className={`w-full sm:w-56 h-9 px-3 rounded-lg border text-xs font-semibold ${inputFocusClass}`}
                style={inputStyle}
              >
                <option style={{ background: 'var(--dash-select-dropdown-bg)', color: 'var(--dash-input-text)' }} value="dark">{isRtl ? 'الوضع الليلي المتطور' : 'Dark Cyber Theme'}</option>
                <option style={{ background: 'var(--dash-select-dropdown-bg)', color: 'var(--dash-input-text)' }} value="light">{isRtl ? 'الوضع النهاري' : 'Light Theme'}</option>
                <option style={{ background: 'var(--dash-select-dropdown-bg)', color: 'var(--dash-input-text)' }} value="system">{isRtl ? 'حسب النظام' : 'System Default'}</option>
              </select>
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-inner p-4 sm:p-5">
              <h3 className="text-sm font-bold mb-1 flex items-center gap-2" style={headingStyle}>{isRtl ? 'التأثيرات والخلفيات السينمائية' : 'Background Effects'}</h3>
              <p className="text-[11px] mb-3" style={mutedStyle}>{isRtl ? 'تفعيل التمويه العميق والخلفيات السينمائية الملونة. قم بإغلاقها إذا كان جهازك يعاني من التقطيع.' : 'Enable heavy blur and cinematic backgrounds across the app. Disable this if your device struggles with performance.'}</p>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={enableBlur} 
                    onChange={e => setEnableBlur(e.target.checked)} 
                  />
                  <div className="w-11 h-6 border rounded-full peer peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5 peer-checked:border-cyan-400/50 peer-checked:bg-cyan-500/30 peer-checked:shadow-[0_0_12px_rgba(6,182,212,0.4)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] rtl:after:left-auto rtl:after:right-[2px] after:bg-slate-400 peer-checked:after:bg-cyan-300 after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ background: 'var(--dash-input-bg)', borderColor: 'var(--dash-input-border)' }}></div>
                </div>
                <span className="text-xs font-bold" style={bodyStyle}>{isRtl ? 'تفعيل الخلفيات السينمائية والتمويه' : 'Enable Cinematic Blur'}</span>
              </label>
            </div>
          </div>
          
          <div className="dash-card">
            <div className="dash-card-inner p-4 sm:p-5">
              <h3 className="text-sm font-bold mb-1 flex items-center gap-2" style={headingStyle}>{isRtl ? 'شكل عرض المكتبات' : 'Default Library View'}</h3>
              <p className="text-[11px] mb-3" style={mutedStyle}>{isRtl ? 'الشكل الافتراضي لعرض البطاقات عند فتح أي مكتبة.' : 'How should media be displayed by default when you enter a library?'}</p>
              <select 
                value={defaultLibraryView}
                onChange={e => setDefaultLibraryView(e.target.value)}
                className={`w-full sm:w-56 h-9 px-3 rounded-lg border text-xs font-semibold ${inputFocusClass}`}
                style={inputStyle}
              >
                <option style={{ background: 'var(--dash-select-dropdown-bg)', color: 'var(--dash-input-text)' }} value="grid">{isRtl ? 'شبكة (بوسترات كبيرة)' : 'Grid (Large Posters)'}</option>
                <option style={{ background: 'var(--dash-select-dropdown-bg)', color: 'var(--dash-input-text)' }} value="compact">{isRtl ? 'مكثف (بوسترات صغيرة)' : 'Compact (Smaller Posters)'}</option>
                <option style={{ background: 'var(--dash-select-dropdown-bg)', color: 'var(--dash-input-text)' }} value="wide">{isRtl ? 'عريض (خلفيات سينمائية)' : 'Wide (Backdrops)'}</option>
                <option style={{ background: 'var(--dash-select-dropdown-bg)', color: 'var(--dash-input-text)' }} value="list">{isRtl ? 'قائمة تفصيلية' : 'List'}</option>
              </select>
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-inner p-4 sm:p-5">
              <h3 className="text-sm font-bold mb-1 flex items-center gap-2" style={headingStyle}>{isRtl ? 'ترتيب وتفعيل أقسام الواجهة الرئيسية' : 'Home Sections Order & Visibility'}</h3>
              <p className="text-[11px] mb-3" style={mutedStyle}>{isRtl ? 'تحكم في الأقسام التي تظهر في الصفحة الرئيسية وترتيب أولويتها من الأعلى للأسفل.' : 'Control the sections and order displayed on the home page.'}</p>
              
              <div className="space-y-2">
                {currentSections.map((section, idx) => (
                  <div key={section.id} className={`flex items-center justify-between p-2.5 rounded-lg border transition-all`}
                    style={{
                      background: section.enabled ? sectionItemBg : sectionItemInactive,
                      borderColor: section.enabled ? 'var(--dash-input-border)' : 'transparent',
                      opacity: section.enabled ? 1 : 0.5
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded border text-cyan-400 text-[10px] font-mono font-bold flex items-center justify-center" style={{ background: 'var(--dash-input-bg)', borderColor: 'var(--dash-input-border)' }}>
                        {idx + 1}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={section.enabled} onChange={() => toggleSection(idx)} />
                        <div className="w-9 h-5 border rounded-full peer peer-checked:after:translate-x-4 rtl:peer-checked:after:-translate-x-4 peer-checked:border-cyan-400/50 peer-checked:bg-cyan-500/30 after:content-[''] after:absolute after:top-[2px] after:left-[2px] rtl:after:left-auto rtl:after:right-[2px] after:bg-slate-400 peer-checked:after:bg-cyan-300 after:rounded-full after:h-4 after:w-4 after:transition-all" style={{ background: 'var(--dash-input-bg)', borderColor: 'var(--dash-input-border)' }}></div>
                      </label>
                      <span className={`text-xs font-bold ${!section.enabled ? 'line-through' : ''}`} style={{ color: section.enabled ? 'var(--dash-heading-text)' : 'var(--dash-muted-text)' }}>
                        {getSectionName(section.id)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => moveSectionObj(idx, 'up')} disabled={idx === 0} className="p-1 rounded border hover:text-cyan-300 disabled:opacity-20 transition" style={{ background: 'var(--dash-input-bg)', borderColor: 'var(--dash-input-border)', color: 'var(--dash-muted-text)' }}>
                        <ChevronUp size={14} />
                      </button>
                      <button onClick={() => moveSectionObj(idx, 'down')} disabled={idx === currentSections.length - 1} className="p-1 rounded border hover:text-cyan-300 disabled:opacity-20 transition" style={{ background: 'var(--dash-input-bg)', borderColor: 'var(--dash-input-border)', color: 'var(--dash-muted-text)' }}>
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'playback' ? (
        <div className="space-y-3">
          <div className="dash-card">
            <div className="dash-card-inner p-4 sm:p-5">
              <h3 className="text-sm font-bold mb-1 flex items-center gap-2" style={headingStyle}>{isRtl ? 'التشغيل التلقائي' : 'Auto-Play Next Episode'}</h3>
              <p className="text-[11px] mb-3" style={mutedStyle}>{isRtl ? 'تشغيل الحلقة القادمة تلقائياً بعد انتهاء الحلقة الحالية.' : 'Automatically play the next episode when the current one ends.'}</p>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={autoPlayNext} 
                    onChange={e => setAutoPlayNext(e.target.checked)} 
                  />
                  <div className="w-11 h-6 border rounded-full peer peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5 peer-checked:border-cyan-400/50 peer-checked:bg-cyan-500/30 peer-checked:shadow-[0_0_12px_rgba(6,182,212,0.4)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] rtl:after:left-auto rtl:after:right-[2px] after:bg-slate-400 peer-checked:after:bg-cyan-300 after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ background: 'var(--dash-input-bg)', borderColor: 'var(--dash-input-border)' }}></div>
                </div>
                <span className="text-xs font-bold" style={bodyStyle}>{isRtl ? 'التشغيل التلقائي مفعل' : 'Auto-Play Enabled'}</span>
              </label>
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-inner p-4 sm:p-5">
              <h3 className="text-sm font-bold mb-1 flex items-center gap-2" style={headingStyle}>{isRtl ? 'مدة التخطي (ثانية)' : 'Skip Time Duration'}</h3>
              <p className="text-[11px] mb-3" style={mutedStyle}>{isRtl ? 'عدد الثواني عند استخدام أزرار التقديم والتأخير.' : 'How many seconds to seek forward or backward when using the skip buttons.'}</p>
              <select 
                value={skipTime}
                onChange={e => setSkipTime(Number(e.target.value))}
                className={`w-full sm:w-48 h-9 px-3 rounded-lg border text-xs font-semibold ${inputFocusClass}`}
                style={inputStyle}
              >
                <option value={10}>{isRtl ? '10 ثوانٍ' : '10 Seconds'}</option>
                <option value={15}>{isRtl ? '15 ثانية' : '15 Seconds'}</option>
                <option value={30}>{isRtl ? '30 ثانية' : '30 Seconds'}</option>
              </select>
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-inner p-4 sm:p-5">
              <h3 className="text-sm font-bold mb-1 flex items-center gap-2" style={headingStyle}>{isRtl ? 'توقيت نافذة الحلقة القادمة' : 'Up Next Popup Timing'}</h3>
              <p className="text-[11px] mb-3" style={mutedStyle}>{isRtl ? 'متى تظهر نافذة عرض الحلقة القادمة قبل انتهاء الفيديو.' : 'When should the "Up Next" preview popup appear before the episode ends?'}</p>
              <select 
                value={upNextTime}
                onChange={e => setUpNextTime(Number(e.target.value))}
                className={`w-full sm:w-48 h-9 px-3 rounded-lg border text-xs font-semibold ${inputFocusClass}`}
                style={inputStyle}
              >
                <option value={10}>{isRtl ? '10 ثوانٍ قبل النهاية' : '10 seconds before end'}</option>
                <option value={15}>{isRtl ? '15 ثانية قبل النهاية' : '15 seconds before end'}</option>
                <option value={30}>{isRtl ? '30 ثانية قبل النهاية' : '30 seconds before end'}</option>
              </select>
            </div>
          </div>
        </div>
      ) : null}

      {/* Save Button */}
      <div className="flex justify-end pt-4 pb-8">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isScanning}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-cyan-500/20"
        >
          {saveMutation.isPending ? <><Loader2 size={15} className="animate-spin" /> {isRtl ? 'جاري الحفظ...' : 'Saving...'}</> : isScanning ? <><Scan size={15} className="animate-spin" /> {isRtl ? 'جاري الفحص...' : 'Scanning...'}</> : <><Save size={15} /> {isRtl ? 'حفظ وإعادة فحص' : 'Save & Scan'}</>}
        </button>
      </div>

      {/* Folder Browser Modal */}
      <FolderBrowserModal
        isOpen={browserState.isOpen}
        initialPath={browserState.initialPath}
        onSelect={selectCurrentDirectory}
        onClose={() => setBrowserState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
