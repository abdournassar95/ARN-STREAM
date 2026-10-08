import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FolderSearch, Folder, HardDrive, ChevronLeft, Monitor, X, Loader2 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { browseFolders, pickSystemFolder } from '../../api/client';

export default function FolderBrowserModal({
  isOpen,
  initialPath = '',
  onSelect,
  onClose
}) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [currentPath, setCurrentPath] = useState(null);
  const [parentPath, setParentPath] = useState(null);
  const [drives, setDrives] = useState([]);
  const [folderList, setFolderList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDirectory(initialPath || undefined);
    }
  }, [isOpen, initialPath]);

  const loadDirectory = async (targetPath) => {
    setLoading(true);
    try {
      const data = await browseFolders(targetPath);
      setCurrentPath(data.current);
      setParentPath(data.parent);
      setDrives(data.drives || []);
      setFolderList(data.folders || []);
    } catch {
      try {
        const rootData = await browseFolders();
        setCurrentPath(rootData.current);
        setParentPath(rootData.parent);
        setDrives(rootData.drives || []);
        setFolderList(rootData.folders || []);
      } catch (err) {
        console.error('[FolderBrowser] Load failed:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNativePicker = async () => {
    try {
      setLoading(true);
      const res = await pickSystemFolder();
      if (res?.path) {
        onSelect(res.path);
        onClose();
      }
    } catch (err) {
      console.error('[FolderBrowser] Native picker error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-[#0a0f1e]/95 backdrop-blur-2xl border border-slate-200 dark:border-cyan-500/20 shadow-2xl dark:shadow-cyan-500/10 flex flex-col max-h-[85vh] overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-cyan-500/15 flex items-center justify-between bg-slate-50/80 dark:bg-[#060911]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <FolderSearch size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isRtl ? 'استعراض واختيار المجلد' : 'Browse & Select Folder'}
              </h3>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-sm" dir="ltr">
                {currentPath || (isRtl ? 'اختر قرصاً للبدء' : 'Select a drive to start')}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drives & Windows Dialog Button Bar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-cyan-500/10 bg-slate-100/50 dark:bg-[#060911]/40 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {drives.map(drive => (
              <button 
                key={drive} 
                onClick={() => loadDirectory(drive)} 
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition shadow-sm ${
                  currentPath?.startsWith(drive) 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-cyan-500/30 font-black' 
                    : 'bg-white dark:bg-[#0c1324] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-cyan-500/15 hover:border-cyan-400/40 hover:bg-cyan-50 dark:hover:bg-cyan-500/10'
                }`}
              >
                <HardDrive size={14} /> {drive}
              </button>
            ))}
          </div>
          
          <button 
            onClick={handleNativePicker} 
            className="px-3.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-600 dark:text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            title={isRtl ? 'فتح نافذة اختيار المجلد الخاصة بنظام ويندوز' : 'Open native Windows folder dialog'}
          >
            <Monitor size={15} /> <span>{isRtl ? 'نافذة ويندوز' : 'Windows Dialog'}</span>
          </button>
        </div>

        {/* Current Breadcrumb Path */}
        {currentPath && (
          <div className="px-6 py-3 bg-slate-50 dark:bg-[#0c1324]/50 border-b border-slate-200 dark:border-cyan-500/10 flex items-center gap-3 text-xs">
            {parentPath && (
              <button 
                onClick={() => loadDirectory(parentPath)} 
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-cyan-500/10 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 flex items-center gap-1 transition"
                title={isRtl ? 'المجلد السابق' : 'Parent folder'}
              >
                <ChevronLeft size={16} className={isRtl ? 'rotate-180' : ''} />
                <span>{isRtl ? 'للأعلى' : 'Up'}</span>
              </button>
            )}
            <div className="font-mono text-cyan-700 dark:text-cyan-300 truncate flex-1 font-semibold" dir="ltr">
              {currentPath}
            </div>
          </div>
        )}

        {/* Directory List */}
        <div className="p-4 overflow-y-auto flex-1 max-h-[42vh] space-y-1.5 scrollbar-thin scrollbar-thumb-cyan-500/20">
          {loading ? (
            <div className="py-14 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 size={30} className="animate-spin text-cyan-500 dark:text-cyan-400" />
              <span className="text-xs">{isRtl ? 'جاري قراءة المجلدات...' : 'Loading folders...'}</span>
            </div>
          ) : folderList.length === 0 ? (
            <div className="py-14 text-center text-slate-400 text-xs">
              {isRtl ? 'لا توجد مجلدات فرعية في هذا المسار' : 'No subfolders found in this directory'}
            </div>
          ) : (
            folderList.map(item => (
              <button 
                key={item.path} 
                onClick={() => loadDirectory(item.path)} 
                className="w-full px-4 py-2.5 rounded-xl text-start hover:bg-slate-100 dark:hover:bg-cyan-500/5 border border-transparent hover:border-slate-200 dark:hover:border-cyan-500/20 flex items-center justify-between text-xs text-slate-800 dark:text-slate-200 transition group"
              >
                <span className="flex items-center gap-3 truncate">
                  <Folder size={18} className="text-amber-500 dark:text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="truncate font-medium">{item.name}</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono shrink-0 ltr">
                  {item.path.split(/[\\/]/).pop()}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-cyan-500/15 bg-slate-50/80 dark:bg-[#060911]/80 flex items-center justify-between gap-4">
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 rounded-xl bg-white dark:bg-[#0c1324] hover:bg-slate-100 dark:hover:bg-[#060911] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-cyan-500/15 text-xs font-semibold transition shadow-sm"
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </button>
          <button 
            onClick={() => {
              if (currentPath) {
                onSelect(currentPath);
                onClose();
              }
            }} 
            disabled={!currentPath} 
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-black transition disabled:opacity-40 shadow-lg shadow-cyan-500/20"
          >
            {isRtl ? 'اختيار هذا المجلد' : 'Select This Folder'}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
