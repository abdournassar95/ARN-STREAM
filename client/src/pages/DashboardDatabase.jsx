import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { useScanStore } from '../store/useScanStore';
import {
  Database, HardDrive, RefreshCw, Trash2, CheckCircle2, AlertTriangle,
  FolderSync, ShieldCheck, FileSearch, Sparkles, Layers, Download,
  Search, Edit3, ArrowUpDown, Check, X, Film, Tv, Music, Folder,
  ExternalLink, ChevronRight, ChevronLeft, Disc, User, Info, FileX2,
  Users, UserPlus, KeyRound, Shield, Lock, Eye, EyeOff, FolderOpen,
  Compass, BookOpen, Drama, Scan
} from 'lucide-react';
import {
  fetchDatabaseStats, cleanOrphanedData, cleanMissingFiles, fetchDuplicates,
  cleanDuplicates, vacuumDatabase, backupDatabaseApi, fetchDatabaseBackups,
  fetchDatabaseRecords, updateDatabaseRecord, deleteDatabaseRecord,
  checkPathExists, batchRemapPaths, batchUpdateRecordsLibrary,
  batchDeleteDatabaseRecords, fetchLibraries, fetchLibraryContents,
  clearLibraryContentsApi, createDatabaseUserApi, scanSingleLibrary
} from '../api/client';

export default function DashboardDatabase() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const queryClient = useQueryClient();
  const { theme } = useSettingsStore();
  const { user: currentUser } = useAuthStore();
  const isDark = theme !== 'light';
  const { isScanning, progress: scanProgress, currentFile: scanCurrentFile, startScan, openDetailsModal, newItems } = useScanStore();

  // Sub-tabs: 'health', 'libraries', 'users', 'explorer', 'duplicates'
  const [subTab, setSubTab] = useState('health');
  const [scanningLibId, setScanningLibId] = useState(null);

  // Notifications / Feedback toast
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // Queries
  const {
    data: stats,
    isLoading: isLoadingStats,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['database-stats'],
    queryFn: fetchDatabaseStats,
    staleTime: 0,
    refetchInterval: 15000
  });

  const {
    data: backups = [],
    refetch: refetchBackups
  } = useQuery({
    queryKey: ['database-backups'],
    queryFn: fetchDatabaseBackups
  });

  const {
    data: libraries = [],
    refetch: refetchLibraries
  } = useQuery({
    queryKey: ['database-libraries-list'],
    queryFn: () => fetchDatabaseRecords({ table: 'libraries' }).then(r => r.items)
  });

  const {
    data: duplicates,
    isLoading: isLoadingDuplicates,
    refetch: refetchDuplicates
  } = useQuery({
    queryKey: ['database-duplicates'],
    queryFn: fetchDuplicates,
    staleTime: 0,
    enabled: subTab === 'duplicates'
  });

  // Library Contents Inspector State
  const [selectedLibId, setSelectedLibId] = useState(null);
  const [libContentSearch, setLibContentSearch] = useState('');
  const [libContentMissingOnly, setLibContentMissingOnly] = useState(false);
  const [libContentPage, setLibContentPage] = useState(1);

  // Auto-select first library when opening 'libraries' tab if none selected
  useEffect(() => {
    if (subTab === 'libraries' && !selectedLibId && libraries.length > 0) {
      setSelectedLibId(libraries[0].id);
    }
  }, [subTab, selectedLibId, libraries]);

  const {
    data: libraryContentsData,
    isLoading: isLoadingLibContents,
    refetch: refetchLibContents
  } = useQuery({
    queryKey: ['database-library-contents', selectedLibId, libContentSearch, libContentMissingOnly, libContentPage],
    queryFn: () => fetchLibraryContents(selectedLibId, {
      search: libContentSearch,
      missingOnly: libContentMissingOnly,
      page: libContentPage,
      limit: 50
    }),
    enabled: subTab === 'libraries' && !!selectedLibId
  });

  // Users Management State
  const [usersSearch, setUsersSearch] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    username: '',
    password: '',
    display_name: '',
    role: 'user',
    allowed_libraries: null,
    can_download: 1,
    can_cast: 1,
    is_active: 1
  });

  const {
    data: usersData,
    isLoading: isLoadingUsers,
    refetch: refetchUsers
  } = useQuery({
    queryKey: ['database-users', usersSearch],
    queryFn: () => fetchDatabaseRecords({
      table: 'users',
      search: usersSearch,
      limit: 100
    }),
    enabled: subTab === 'users'
  });

  // Explorer State
  const [explorerTable, setExplorerTable] = useState('movies');
  const [explorerSearch, setExplorerSearch] = useState('');
  const [explorerLibraryId, setExplorerLibraryId] = useState('');
  const [explorerMissingOnly, setExplorerMissingOnly] = useState(false);
  const [explorerPage, setExplorerPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals state
  const [editingItem, setEditingItem] = useState(null);
  const [pathCheckResult, setPathCheckResult] = useState(null);
  const [isCheckingPath, setIsCheckingPath] = useState(false);
  const [showRemapModal, setShowRemapModal] = useState(false);
  const [remapOldPrefix, setRemapOldPrefix] = useState('');
  const [remapNewPrefix, setRemapNewPrefix] = useState('');
  const [batchTargetLib, setBatchTargetLib] = useState('');
  const [showBatchLibModal, setShowBatchLibModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // Query records for explorer
  const {
    data: recordsData,
    isLoading: isLoadingRecords,
    refetch: refetchRecords
  } = useQuery({
    queryKey: ['database-records', explorerTable, explorerSearch, explorerLibraryId, explorerMissingOnly, explorerPage],
    queryFn: () => fetchDatabaseRecords({
      table: explorerTable,
      search: explorerSearch,
      libraryId: explorerLibraryId || null,
      missingOnly: explorerMissingOnly,
      page: explorerPage,
      limit: 25
    }),
    enabled: subTab === 'explorer'
  });

  // Mutations
  const cleanOrphansMut = useMutation({
    mutationFn: cleanOrphanedData,
    onSuccess: (res) => {
      showNotification(res.message || 'تم تنظيف السجلات اليتيمة بنجاح.');
      queryClient.invalidateQueries({ queryKey: ['database-stats'] });
      refetchStats();
      refetchLibraries();
      if (subTab === 'libraries') refetchLibContents();
    },
    onError: (err) => showNotification(err.response?.data?.error?.message || err.message, 'error')
  });

  const cleanMissingMut = useMutation({
    mutationFn: (dryRun) => cleanMissingFiles(dryRun),
    onSuccess: (res) => {
      showNotification(res.message || 'تم تنظيف السجلات المفقودة بنجاح.');
      queryClient.invalidateQueries({ queryKey: ['database-stats'] });
      refetchStats();
      refetchLibraries();
      if (subTab === 'libraries') refetchLibContents();
      if (subTab === 'explorer') refetchRecords();
    },
    onError: (err) => showNotification(err.response?.data?.error?.message || err.message, 'error')
  });

  const cleanDuplicatesMut = useMutation({
    mutationFn: cleanDuplicates,
    onSuccess: (res) => {
      showNotification(res.message || 'تم دمج وتنظيف المكررات بنجاح.');
      queryClient.invalidateQueries({ queryKey: ['database-stats'] });
      queryClient.invalidateQueries({ queryKey: ['database-duplicates'] });
      refetchStats();
      refetchDuplicates();
      refetchLibraries();
      if (subTab === 'libraries') refetchLibContents();
      if (subTab === 'explorer') refetchRecords();
    },
    onError: (err) => showNotification(err.response?.data?.error?.message || err.message, 'error')
  });

  const vacuumMut = useMutation({
    mutationFn: vacuumDatabase,
    onSuccess: (res) => {
      showNotification(res.message || 'تم ضغط وتسريع قاعدة البيانات بنجاح.');
      queryClient.invalidateQueries({ queryKey: ['database-stats'] });
      refetchStats();
    },
    onError: (err) => showNotification(err.response?.data?.error?.message || err.message, 'error')
  });

  const backupMut = useMutation({
    mutationFn: backupDatabaseApi,
    onSuccess: (res) => {
      showNotification(res.message || 'تم إنشاء النسخة الاحتياطية بنجاح.');
      refetchBackups();
    },
    onError: (err) => showNotification(err.response?.data?.error?.message || err.message, 'error')
  });

  const updateRecordMut = useMutation({
    mutationFn: ({ table, id, payload }) => updateDatabaseRecord(table, id, payload),
    onSuccess: (res) => {
      showNotification(res.message || 'تم تحديث السجل بنجاح.');
      setEditingItem(null);
      refetchRecords();
      refetchStats();
      refetchLibraries();
      if (subTab === 'libraries') refetchLibContents();
      if (subTab === 'users') refetchUsers();
    },
    onError: (err) => showNotification(err.response?.data?.error?.message || err.message, 'error')
  });

  const deleteRecordMut = useMutation({
    mutationFn: ({ table, id, deletePhysical }) => deleteDatabaseRecord(table, id, deletePhysical),
    onSuccess: (res) => {
      showNotification(res.message || 'تم حذف السجل بنجاح.');
      refetchRecords();
      refetchStats();
      refetchLibraries();
      if (subTab === 'libraries') refetchLibContents();
      if (subTab === 'users') refetchUsers();
    },
    onError: (err) => showNotification(err.response?.data?.error?.message || err.message, 'error')
  });

  const clearLibMut = useMutation({
    mutationFn: (libId) => clearLibraryContentsApi(libId),
    onSuccess: (res) => {
      showNotification(res.message || 'تم إفراغ محتويات المكتبة بنجاح.');
      refetchLibraries();
      refetchLibContents();
      refetchStats();
    },
    onError: (err) => showNotification(err.response?.data?.error?.message || err.message, 'error')
  });

  const createUserMut = useMutation({
    mutationFn: (payload) => createDatabaseUserApi(payload),
    onSuccess: (res) => {
      showNotification(res.message || 'تم إنشاء المستخدم بنجاح.');
      setShowAddUserModal(false);
      setNewUserData({
        username: '', password: '', display_name: '', role: 'user',
        allowed_libraries: null, can_download: 1, can_cast: 1, is_active: 1
      });
      refetchUsers();
      refetchStats();
    },
    onError: (err) => showNotification(err.response?.data?.error?.message || err.message, 'error')
  });

  const remapPathsMut = useMutation({
    mutationFn: ({ oldPrefix, newPrefix }) => batchRemapPaths({ oldPrefix, newPrefix }),
    onSuccess: (res) => {
      showNotification(res.message || 'تم تحديث المسارات بنجاح.');
      setShowRemapModal(false);
      setRemapOldPrefix('');
      setRemapNewPrefix('');
      refetchRecords();
      refetchStats();
      if (subTab === 'libraries') refetchLibContents();
    },
    onError: (err) => showNotification(err.response?.data?.error?.message || err.message, 'error')
  });

  const batchLibMut = useMutation({
    mutationFn: ({ table, ids, libraryId }) => batchUpdateRecordsLibrary({ table, ids, libraryId }),
    onSuccess: (res) => {
      showNotification(res.message || 'تم نقل العناصر المحددة للمكتبة بنجاح.');
      setSelectedIds([]);
      setShowBatchLibModal(false);
      refetchRecords();
      refetchLibraries();
      if (subTab === 'libraries') refetchLibContents();
    },
    onError: (err) => showNotification(err.response?.data?.error?.message || err.message, 'error')
  });

  const batchDeleteMut = useMutation({
    mutationFn: ({ table, ids }) => batchDeleteDatabaseRecords({ table, ids }),
    onSuccess: (res) => {
      showNotification(res.message || 'تم حذف السجلات المحددة بنجاح.');
      setSelectedIds([]);
      refetchRecords();
      refetchStats();
      refetchLibraries();
      if (subTab === 'libraries') refetchLibContents();
    },
    onError: (err) => showNotification(err.response?.data?.error?.message || err.message, 'error')
  });

  // Handle path check
  const handleCheckPath = async (testPath) => {
    if (!testPath) return;
    setIsCheckingPath(true);
    setPathCheckResult(null);
    try {
      const res = await checkPathExists(testPath);
      setPathCheckResult(res);
    } catch {
      setPathCheckResult({ path: testPath, exists: false });
    } finally {
      setIsCheckingPath(false);
    }
  };

  // Toggle selection
  const toggleSelectAll = (items = []) => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(i => i.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Unified counts calculation ensuring 100% mathematical consistency across all cards & badges
  const totalOrphanedCount = useMemo(() => {
    if (!stats?.issues) return 0;
    const {
      emptySeries = 0, emptySeasons = 0, emptyAlbums = 0, emptyArtists = 0,
      orphanedImages = 0
    } = stats.issues;
    return emptySeries + emptySeasons + emptyAlbums + emptyArtists + orphanedImages;
  }, [stats]);

  const totalDuplicatesCount = useMemo(() => {
    if (!stats?.issues) return 0;
    const {
      duplicateMoviesCount = 0, duplicateTracksCount = 0,
      duplicateEpisodesCount = 0, duplicateArtistsCount = 0
    } = stats.issues;
    return duplicateMoviesCount + duplicateTracksCount + duplicateEpisodesCount + duplicateArtistsCount;
  }, [stats]);

  const totalIssuesCount = useMemo(() => {
    if (!stats?.issues) return 0;
    return totalOrphanedCount + (stats.issues.missingFilesCount || 0) + totalDuplicatesCount;
  }, [stats, totalOrphanedCount, totalDuplicatesCount]);

  const headingStyle = { color: 'var(--dash-heading-text)' };
  const mutedStyle = { color: 'var(--dash-muted-text)' };
  const inputStyle = {
    background: 'var(--dash-input-bg)',
    borderColor: 'var(--dash-input-border)',
    color: 'var(--dash-body-text)'
  };

  // Current selected library object
  const activeLibrary = useMemo(() => {
    return libraries.find(l => l.id === selectedLibId) || libraries[0] || null;
  }, [libraries, selectedLibId]);

  return (
    <div className="space-y-4 animate-fadeIn" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 ${isRtl ? 'left-6' : 'right-6'} z-50 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl flex items-center gap-3 text-sm font-medium ${
              notification.type === 'error'
                ? 'bg-rose-950/80 border-rose-500/40 text-rose-200 shadow-rose-900/20'
                : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200 shadow-emerald-900/20'
            }`}
          >
            {notification.type === 'error' ? <AlertTriangle size={18} className="text-rose-400" /> : <CheckCircle2 size={18} className="text-emerald-400" />}
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} className="opacity-60 hover:opacity-100 me-1" aria-label="Dismiss notification">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Card */}
      <div className="dash-card">
        <div className="dash-card-inner p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black flex items-center gap-2.5" style={headingStyle}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-400/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                <Database className="text-cyan-400" size={20} />
              </div>
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">
                {isRtl ? 'التحكم الشامل في قاعدة البيانات' : 'Unified Database Control Hub'}
              </span>
            </h2>
            <p className="text-xs mt-1" style={mutedStyle}>
              {isRtl
                ? 'استعراض وتحكم مباشر في المكتبات ومحتوياتها والمستخدمين وكافة الجداول والملفات مع أدوات الصيانة الذكية.'
                : 'Direct control and inspection of libraries, their contents, users, and tables with smart cleanup tools.'}
            </p>
          </div>

          {/* Sub-tab Navigation Switcher */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl border border-cyan-500/20 bg-slate-900/60 backdrop-blur-md">
            {/* Tab 1: Health */}
            <button
              onClick={() => setSubTab('health')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                subTab === 'health'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-md shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck size={14} />
              <span>{isRtl ? 'الصحة والتنظيف' : 'Health & Cleanup'}</span>
              {totalIssuesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                  {totalIssuesCount}
                </span>
              )}
            </button>

            {/* Tab 2: Libraries & Contents */}
            <button
              onClick={() => setSubTab('libraries')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                subTab === 'libraries'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-md shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderOpen size={14} />
              <span>{isRtl ? 'المكتبات ومحتوياتها' : 'Libraries & Contents'}</span>
              <span className="text-[10px] opacity-70 font-mono">({libraries.length})</span>
            </button>

            {/* Tab 3: Users */}
            <button
              onClick={() => setSubTab('users')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                subTab === 'users'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-md shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users size={14} />
              <span>{isRtl ? 'المستخدمين' : 'Users'}</span>
              <span className="text-[10px] opacity-70 font-mono">({stats?.counts?.users || 0})</span>
            </button>

            {/* Tab 4: Raw Explorer */}
            <button
              onClick={() => setSubTab('explorer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                subTab === 'explorer'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-md shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers size={14} />
              <span>{isRtl ? 'مستكشف الجداول' : 'Tables Explorer'}</span>
            </button>

            {/* Tab 5: Duplicates */}
            <button
              onClick={() => setSubTab('duplicates')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                subTab === 'duplicates'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-md shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles size={14} />
              <span>{isRtl ? 'المكررات' : 'Duplicates'}</span>
              {totalDuplicatesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  {totalDuplicatesCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SUB-TAB 1: HEALTH & CLEANUP                              */}
      {/* ========================================================= */}
      {subTab === 'health' && (
        <div className="space-y-4">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* DB Size */}
            <div className="dash-card">
              <div className="dash-card-inner p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={mutedStyle}>{isRtl ? 'حجم القاعدة' : 'DB Size'}</span>
                  <HardDrive size={16} className="text-cyan-400" />
                </div>
                <div className="mt-2">
                  <div className="text-lg sm:text-xl font-mono font-black text-cyan-300">
                    {stats?.fileSizeFormatted || '...'}
                  </div>
                  <div className="text-[10px] mt-0.5 text-slate-400 font-mono truncate" title={stats?.filePath}>
                    WAL: {stats?.walSizeFormatted || '0 B'}
                  </div>
                </div>
              </div>
            </div>

            {/* Total Media Items */}
            <div className="dash-card">
              <div className="dash-card-inner p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={mutedStyle}>{isRtl ? 'إجمالي الوسائط' : 'Total Media'}</span>
                  <Film size={16} className="text-blue-400" />
                </div>
                <div className="mt-2">
                  <div className="text-lg sm:text-xl font-mono font-black text-blue-300">
                    {((stats?.counts?.movies || 0) + (stats?.counts?.episodes || 0) + (stats?.counts?.tracks || 0)).toLocaleString()}
                  </div>
                  <div className="text-[10px] mt-0.5 text-slate-400">
                    {stats?.counts?.movies || 0} {isRtl ? 'فيلم' : 'movies'} • {stats?.counts?.episodes || 0} {isRtl ? 'حلقة' : 'eps'} • {stats?.counts?.tracks || 0} {isRtl ? 'تراك' : 'tracks'}
                  </div>
                </div>
              </div>
            </div>

            {/* Orphaned / Empty Items */}
            <div className="dash-card">
              <div className="dash-card-inner p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={mutedStyle}>{isRtl ? 'السجلات اليتيمة' : 'Orphaned'}</span>
                  <Trash2 size={16} className={totalOrphanedCount > 0 ? 'text-rose-400' : 'text-emerald-400'} />
                </div>
                <div className="mt-2">
                  <div className="text-lg sm:text-xl font-mono font-black" style={{ color: totalOrphanedCount > 0 ? '#f87171' : '#34d399' }}>
                    {totalOrphanedCount}
                  </div>
                  <div className="text-[10px] mt-0.5 text-slate-400">
                    {stats?.issues?.orphanedImages || 0} {isRtl ? 'صورة' : 'images'} • {(stats?.issues?.emptySeries || 0) + (stats?.issues?.emptySeasons || 0) + (stats?.issues?.emptyAlbums || 0) + (stats?.issues?.emptyArtists || 0)} {isRtl ? 'حاوية فارغة' : 'empty containers'}
                  </div>
                </div>
              </div>
            </div>

            {/* Missing Files */}
            <div className="dash-card">
              <div className="dash-card-inner p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={mutedStyle}>{isRtl ? 'ملفات مفقودة' : 'Missing Files'}</span>
                  <FileX2 size={16} className={stats?.issues?.missingFilesCount > 0 ? 'text-amber-400' : 'text-emerald-400'} />
                </div>
                <div className="mt-2">
                  <div className="text-lg sm:text-xl font-mono font-black" style={{ color: stats?.issues?.missingFilesCount > 0 ? '#fbbf24' : '#34d399' }}>
                    {stats?.issues?.missingFilesCount || 0}
                  </div>
                  <div className="text-[10px] mt-0.5 text-slate-400">
                    {stats?.issues?.missingFilesCount > 0 ? (isRtl ? 'غير موجودة على القرص' : 'Not on disk') : (isRtl ? 'كافة الملفات سليمة' : 'All files intact')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Card 0: Full Library Scan & Sync */}
            <div className="dash-card md:col-span-2 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-transparent border border-emerald-500/30">
              <div className="dash-card-inner p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-400 shadow-md">
                    <Scan size={20} className={isScanning ? 'animate-spin' : ''} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                      <span>{isRtl ? 'فحص شامل وتحديث فوري للمكتبات' : 'Full Library Scan & Sync'}</span>
                      {isScanning && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono animate-pulse border border-emerald-500/30">
                          {scanProgress}%
                        </span>
                      )}
                    </h3>
                    <p className="text-xs mt-1 leading-relaxed" style={mutedStyle}>
                      {isScanning 
                        ? (scanCurrentFile ? `${isRtl ? 'جاري فحص: ' : 'Scanning: '}${scanCurrentFile}` : (isRtl ? 'جاري الفحص المباشر...' : 'Scanning files...'))
                        : (isRtl
                          ? 'مسح حقيقي ولحظي لكافة مسارات الأقراص الصلبة، رصد أي وسائط أو حلقات جديدة، وتحديث قاعدة البيانات دون الحاجة لإعادة التشغيل.'
                          : 'Deep real-time scan of all local disks, detect newly added media, and sync database instantly.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {newItems.length > 0 && !isScanning && (
                    <button
                      type="button"
                      onClick={openDetailsModal}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Sparkles size={13} className="text-amber-400" />
                      <span>{isRtl ? `عرض المكتشف (${newItems.length})` : `New Items (${newItems.length})`}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={startScan}
                    disabled={isScanning}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg ${
                      isScanning
                        ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 cursor-not-allowed'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25 active:scale-95'
                    }`}
                  >
                    <Scan size={15} className={isScanning ? 'animate-spin' : ''} />
                    <span>{isScanning ? (isRtl ? `جاري الفحص (${scanProgress}%)` : `Scanning (${scanProgress}%)`) : (isRtl ? 'بدء الفحص الشامل الآن' : 'Start Full Scan Now')}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 1: Clean Orphaned Data */}
            <div className="dash-card">
              <div className="dash-card-inner p-4 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 text-cyan-400">
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={headingStyle}>
                      {isRtl ? 'تنظيف السجلات اليتيمة والحاويات الفارغة' : 'Clean Orphaned Data & Empty Containers'}
                    </h3>
                    <p className="text-xs mt-1 leading-relaxed" style={mutedStyle}>
                      {isRtl
                        ? 'إزالة المسلسلات والمواسم الفارغة التي لا تملك حلقات، والألبومات والفنانين الفارغين، وحذف الصور والوسوم وحالات التشغيل غير المرتبطة بأي وسائط.'
                        : 'Purge empty series, seasons, albums, and artists with no tracks, plus delete unreferenced images and playback states.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {isRtl ? 'المرصود حالياً:' : 'Detected:'} {totalOrphanedCount} {isRtl ? 'عنصر' : 'items'}
                  </span>
                  <button
                    onClick={() => cleanOrphansMut.mutate()}
                    disabled={cleanOrphansMut.isPending}
                    className="px-3.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-300 text-xs font-semibold flex items-center gap-2 transition-all"
                  >
                    {cleanOrphansMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    <span>{isRtl ? 'تنظيف السجلات اليتيمة الآن' : 'Clean Orphans Now'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: Clean Missing Files */}
            <div className="dash-card">
              <div className="dash-card-inner p-4 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0 text-rose-400">
                    <FileX2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={headingStyle}>
                      {isRtl ? 'إزالة السجلات للملفات المحذوفة من القرص' : 'Purge Missing Files on Disk'}
                    </h3>
                    <p className="text-xs mt-1 leading-relaxed" style={mutedStyle}>
                      {isRtl
                        ? 'فحص مسارات كافة الأفلام والحلقات والتراكات، وحذف السجلات التي تم حذف ملفاتها الفعلية من القرص لمنع ظهور أخطاء التشغيل.'
                        : 'Verify physical paths of all media files and remove database records for files deleted from the disk.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {isRtl ? 'الملفات المفقودة:' : 'Missing:'} {stats?.issues?.missingFilesCount || 0} {isRtl ? 'ملف' : 'files'}
                  </span>
                  <button
                    onClick={() => setConfirmAction({
                      title: isRtl ? 'تأكيد إزالة الملفات المفقودة' : 'Confirm Missing Files Purge',
                      message: isRtl 
                        ? `سيتم فحص وإزالة السجلات التي لم يعد ملفها الفعلي موجوداً على القرص (عددها المرصود: ${stats?.issues?.missingFilesCount || 0}). هل تريد المتابعة؟`
                        : `This will remove all records whose physical files are missing on disk (${stats?.issues?.missingFilesCount || 0} detected). Proceed?`,
                      onConfirm: () => cleanMissingMut.mutate(false)
                    })}
                    disabled={cleanMissingMut.isPending}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-300 text-xs font-semibold flex items-center gap-2 transition-all"
                  >
                    {cleanMissingMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    <span>{isRtl ? 'حذف السجلات المفقودة' : 'Purge Missing Records'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3: Deduplication */}
            <div className="dash-card">
              <div className="dash-card-inner p-4 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-400">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={headingStyle}>
                      {isRtl ? 'الدمج والتنظيف الذكي للمكررات' : 'Smart Deduplication & Merging'}
                    </h3>
                    <p className="text-xs mt-1 leading-relaxed" style={mutedStyle}>
                      {isRtl
                        ? 'رصد العناصر المكررة بنفس المسار أو العنوان والسنة، والاحتفاظ بالنسخة الأساسية السليمة مع نقل التقييمات والصور وحذف الإدخال المكرر الزائد.'
                        : 'Detect duplicate items by path or title+year, retain the best primary record, preserve images/ratings, and eliminate duplicates.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {isRtl ? 'المكررات:' : 'Duplicates:'} {totalDuplicatesCount}
                  </span>
                  <button
                    onClick={() => cleanDuplicatesMut.mutate()}
                    disabled={cleanDuplicatesMut.isPending}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-300 text-xs font-semibold flex items-center gap-2 transition-all"
                  >
                    {cleanDuplicatesMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span>{isRtl ? 'تنظيف المكررات تلقائياً' : 'Auto Deduplicate'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 4: VACUUM & Optimize */}
            <div className="dash-card">
              <div className="dash-card-inner p-4 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-400">
                    <FolderSync size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={headingStyle}>
                      {isRtl ? 'ضغط وتسريع القاعدة (VACUUM & Optimize)' : 'Vacuum & Optimize SQLite Database'}
                    </h3>
                    <p className="text-xs mt-1 leading-relaxed" style={mutedStyle}>
                      {isRtl
                        ? 'إعادة تنظيم صفحات قاعدة البيانات واسترجاع المساحة الفارغة بعد الحذف، مع تحديث إحصائيات الفهارس لتسريع استجابة الخادم.'
                        : 'Defragment database pages, reclaim deleted space, truncate WAL file, and rebuild indices for peak performance.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <span className="text-[11px] text-slate-400 font-mono">
                    SQLite WAL Mode
                  </span>
                  <button
                    onClick={() => vacuumMut.mutate()}
                    disabled={vacuumMut.isPending}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 transition-all"
                  >
                    {vacuumMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <HardDrive size={14} />}
                    <span>{isRtl ? 'ضغط وتحسين القاعدة' : 'Optimize & Vacuum'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Backup Section */}
          <div className="dash-card">
            <div className="dash-card-inner p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2" style={headingStyle}>
                    <Download size={17} className="text-cyan-400" />
                    <span>{isRtl ? 'النسخ الاحتياطي لقاعدة البيانات' : 'Database Backups'}</span>
                  </h3>
                  <p className="text-xs mt-0.5" style={mutedStyle}>
                    {isRtl ? 'احتفظ بنسخة احتياطية آمنة فورية قبل إجراء أي تعديلات كبرى.' : 'Take instant snapshots of media.db before major modifications.'}
                  </p>
                </div>
                <button
                  onClick={() => backupMut.mutate()}
                  disabled={backupMut.isPending}
                  className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-500/10 transition-all"
                >
                  {backupMut.isPending ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
                  <span>{isRtl ? 'إنشاء نسخة احتياطية فورية' : 'Create Snapshot Backup'}</span>
                </button>
              </div>

              {/* Backups List */}
              {backups.length > 0 && (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                  <div className="p-2.5 bg-slate-900/60 border-b border-slate-800 text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span>{isRtl ? 'النسخ الاحتياطية المتوفرة' : 'Available Backups'}</span>
                    <span>{backups.length} {isRtl ? 'نسخة' : 'snapshots'}</span>
                  </div>
                  <div className="divide-y divide-slate-800/60 max-h-48 overflow-y-auto">
                    {backups.slice(0, 5).map((b, idx) => (
                      <div key={b.filename || idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-900/30 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <HardDrive size={15} className="text-slate-400" />
                          <span className="font-mono text-cyan-300 font-medium">{b.filename}</span>
                        </div>
                        <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
                          <span>{b.sizeFormatted}</span>
                          <span>{new Date(b.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB 2: LIBRARIES & CONTENTS INSPECTOR                 */}
      {/* ========================================================= */}
      {subTab === 'libraries' && (
        <div className="space-y-4">
          {/* Top Library Cards List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {libraries.map((lib) => {
              const isSelected = lib.id === selectedLibId;
              const nameLower = (lib.name || '').toLowerCase();
              let Icon = Film;
              let iconTheme = 'bg-red-500/15 text-red-400 border border-red-500/30';
              if (nameLower.includes('وثائق') || nameLower.includes('doc') || lib.icon === 'compass') {
                Icon = Compass;
                iconTheme = 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
              } else if (nameLower.includes('قرآن') || nameLower.includes('قران') || nameLower.includes('quran') || lib.icon === 'book') {
                Icon = BookOpen;
                iconTheme = 'bg-teal-500/15 text-teal-400 border border-teal-500/30';
              } else if (nameLower.includes('مسرح') || nameLower.includes('play')) {
                Icon = Drama;
                iconTheme = 'bg-purple-500/15 text-purple-400 border border-purple-500/30';
              } else if (lib.type === 'shows') {
                Icon = Tv;
                iconTheme = 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30';
              } else if (lib.type === 'music') {
                Icon = Music;
                iconTheme = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
              }
              return (
                <div
                  key={lib.id}
                  onClick={() => {
                    setSelectedLibId(lib.id);
                    setLibContentPage(1);
                  }}
                  className={`dash-card cursor-pointer transition-all duration-200 ${
                    isSelected ? 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/10' : 'hover:border-slate-700'
                  }`}
                >
                  <div className="dash-card-inner p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconTheme}`}>
                          <Icon size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                            {lib.name}
                            <span className="text-[10px] text-slate-500 font-mono">#{lib.id}</span>
                          </h4>
                          <span className="text-[11px] text-cyan-400 font-medium">
                            {nameLower.includes('وثائق') ? (isRtl ? 'مكتبة وثائقية' : 'Documentaries') :
                             lib.type === 'movies' ? (isRtl ? 'مكتبة أفلام' : 'Movies') :
                             lib.type === 'shows' ? (isRtl ? 'مكتبة مسلسلات' : 'Shows') :
                             (isRtl ? 'مكتبة صوتيات' : 'Music')}
                          </span>
                        </div>
                      </div>

                      {/* Item Count Badge */}
                      <div className="text-right">
                        <span className="text-base font-mono font-black text-cyan-300">
                          {lib.mediaCount || 0}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {nameLower.includes('وثائق') ? (isRtl ? 'عمل وثائقي' : 'docs') :
                           lib.type === 'movies' ? (isRtl ? 'فيلم' : 'movies') :
                           lib.type === 'shows' ? (isRtl ? 'مسلسل' : 'series') :
                           (isRtl ? 'تراك' : 'tracks')}
                        </div>
                      </div>
                    </div>

                    {/* Folder Paths */}
                    <div className="text-[11px] font-mono text-slate-400 truncate bg-slate-950/40 p-2 rounded-lg border border-slate-800/80" title={Array.isArray(lib.paths) ? lib.paths.join(', ') : ''}>
                      <span className="text-slate-500">{isRtl ? 'المجلدات:' : 'Folders:'} </span>
                      {Array.isArray(lib.paths) && lib.paths.length > 0 ? lib.paths.join(' • ') : (isRtl ? 'لم يحدد مسار' : 'No paths')}
                    </div>

                    {/* Action Bar on Library Card */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px]">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          setScanningLibId(lib.id);
                          try {
                            await scanSingleLibrary(lib.id);
                            showNotification(isRtl ? `تم فحص وتحديث مكتبة «${lib.name}» بنجاح` : `Scanned «${lib.name}» successfully`);
                            refetchLibraries();
                            refetchStats();
                            refetchLibContents();
                          } catch (err) {
                            showNotification(err.response?.data?.error?.message || err.message, 'error');
                          } finally {
                            setScanningLibId(null);
                          }
                        }}
                        disabled={scanningLibId === lib.id || isScanning}
                        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold disabled:opacity-40"
                        title={isRtl ? 'فحص مجلدات هذه المكتبة فقط والبحث عن وسائط جديدة' : 'Scan this library folder'}
                      >
                        <RefreshCw size={13} className={scanningLibId === lib.id ? 'animate-spin text-emerald-400' : ''} />
                        <span>{scanningLibId === lib.id ? (isRtl ? 'فحص...' : 'Scanning...') : (isRtl ? 'فحص الآن' : 'Scan Now')}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItem({ ...lib, table: 'libraries' });
                        }}
                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
                      >
                        <Edit3 size={13} />
                        <span>{isRtl ? 'تعديل' : 'Edit'}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmAction({
                            title: isRtl ? 'إفراغ محتويات المكتبة' : 'Clear Library Contents',
                            message: isRtl 
                              ? `هل أنت متأكد من حذف كافة الوسائط والملفات المسجلة داخل مكتبة "${lib.name}" من قاعدة البيانات؟`
                              : `Clear all media records belonging to library "${lib.name}"?`,
                            onConfirm: () => clearLibMut.mutate(lib.id)
                          });
                        }}
                        className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
                      >
                        <Trash2 size={13} />
                        <span>{isRtl ? 'إفراغ المحتويات' : 'Clear'}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmAction({
                            title: isRtl ? 'حذف المكتبة' : 'Delete Library',
                            message: isRtl 
                              ? `هل أنت متأكد من حذف مكتبة "${lib.name}" نهائياً من قاعدة البيانات؟`
                              : `Delete library "${lib.name}" from database?`,
                            onConfirm: () => deleteRecordMut.mutate({ table: 'libraries', id: lib.id, deletePhysical: false })
                          });
                        }}
                        className="text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
                      >
                        <X size={13} />
                        <span>{isRtl ? 'حذف' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Library Contents Inspector */}
          {activeLibrary && (
            <div className="dash-card">
              <div className="dash-card-inner p-4 space-y-3">
                {/* Header & Filter Controls */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2" style={headingStyle}>
                      <FolderOpen size={17} className="text-cyan-400" />
                      <span>{isRtl ? `محتويات مكتبة: ${activeLibrary.name}` : `Contents of: ${activeLibrary.name}`}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                        {libraryContentsData?.totalCount || 0} {isRtl ? 'عنصر' : 'items'}
                      </span>
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* Search inside this library */}
                    <div className="relative flex-1 md:w-64">
                      <Search size={14} className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-slate-400`} />
                      <input
                        type="text"
                        placeholder={isRtl ? 'بحث داخل هذه المكتبة...' : 'Search in this library...'}
                        value={libContentSearch}
                        onChange={(e) => {
                          setLibContentSearch(e.target.value);
                          setLibContentPage(1);
                        }}
                        className="w-full rounded-xl border py-1.5 text-xs focus:outline-none focus:border-cyan-400 ps-9 pe-3"
                        style={inputStyle}
                      />
                    </div>

                    {/* Toggle missing only */}
                    <button
                      onClick={() => {
                        setLibContentMissingOnly(!libContentMissingOnly);
                        setLibContentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
                        libContentMissingOnly
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                          : 'border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FileX2 size={13} />
                      <span>{isRtl ? 'المفقودة فقط' : 'Missing Only'}</span>
                    </button>

                    {/* Scan this library button */}
                    <button
                      onClick={async () => {
                        setScanningLibId(activeLibrary.id);
                        try {
                          await scanSingleLibrary(activeLibrary.id);
                          showNotification(isRtl ? `تم فحص وتحديث مكتبة «${activeLibrary.name}» بنجاح` : `Scanned «${activeLibrary.name}» successfully`);
                          refetchLibraries();
                          refetchStats();
                          refetchLibContents();
                        } catch (err) {
                          showNotification(err.response?.data?.error?.message || err.message, 'error');
                        } finally {
                          setScanningLibId(null);
                        }
                      }}
                      disabled={scanningLibId === activeLibrary.id || isScanning}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={scanningLibId === activeLibrary.id ? 'animate-spin text-emerald-400' : ''} />
                      <span>{scanningLibId === activeLibrary.id ? (isRtl ? 'جاري الفحص...' : 'Scanning...') : (isRtl ? 'فحص المكتبة الآن' : 'Scan Library Now')}</span>
                    </button>
                  </div>
                </div>

                {/* Contents Table */}
                {isLoadingLibContents ? (
                  <div className="p-10 text-center text-slate-400 flex flex-col items-center gap-2">
                    <RefreshCw size={20} className="animate-spin text-cyan-400" />
                    <span className="text-xs">{isRtl ? 'جاري جلب محتويات المكتبة...' : 'Loading contents...'}</span>
                  </div>
                ) : libraryContentsData?.items?.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 flex flex-col items-center gap-2">
                    <FileSearch size={24} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-300">{isRtl ? 'المكتبة فارغة أو لا توجد نتائج مطابقة' : 'No items found in this library'}</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right" dir={isRtl ? 'rtl' : 'ltr'}>
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400 font-semibold">
                          <th className="p-2.5 w-14 text-center">ID</th>
                          <th className="p-2.5">{isRtl ? 'العنوان' : 'Title'}</th>
                          <th className="p-2.5">{isRtl ? 'السنة / التفاصيل' : 'Details'}</th>
                          <th className="p-2.5">{isRtl ? 'مسار الملف وحالته على القرص' : 'Path & Status'}</th>
                          <th className="p-2.5 text-center w-24">{isRtl ? 'إجراءات' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {libraryContentsData?.items?.map((item) => {
                          const itemTable = activeLibrary.type === 'movies' ? 'movies' : (activeLibrary.type === 'shows' ? 'series' : 'tracks');
                          return (
                            <tr key={item.id} className="hover:bg-slate-900/30 transition-colors">
                              <td className="p-2.5 text-center font-mono text-slate-500">#{item.id}</td>
                              <td className="p-2.5 font-bold text-slate-100">
                                {item.title || item.name}
                              </td>
                              <td className="p-2.5 text-slate-400 font-mono text-[11px]">
                                {item.year ? `(${item.year})` : ''}
                                {item.seasonsCount ? ` • ${item.seasonsCount} ${isRtl ? 'مواسم' : 'seasons'}` : ''}
                                {item.artistName ? ` • ${item.artistName}` : ''}
                              </td>
                              <td className="p-2.5 font-mono text-[11px] text-slate-300 max-w-sm truncate" title={item.path}>
                                {item.path ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.exists ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                                    <span className="truncate">{item.path}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-500 italic">{item.episodesCount ? `${item.episodesCount} ${isRtl ? 'حلقة' : 'episodes'}` : '-'}</span>
                                )}
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditingItem({ ...item, table: itemTable });
                                      setPathCheckResult(null);
                                    }}
                                    className="p-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20"
                                    title={isRtl ? 'تعديل' : 'Edit'}
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    onClick={() => setConfirmAction({
                                      title: isRtl ? 'تأكيد الحذف' : 'Confirm Delete',
                                      message: isRtl 
                                        ? `هل أنت متأكد من حذف "${item.title || item.name}" نهائياً من قاعدة البيانات؟`
                                        : `Delete "${item.title || item.name}" from database?`,
                                      onConfirm: () => deleteRecordMut.mutate({ table: itemTable, id: item.id, deletePhysical: false })
                                    })}
                                    className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20"
                                    title={isRtl ? 'حذف' : 'Delete'}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB 3: USERS & RBAC CONTROL                           */}
      {/* ========================================================= */}
      {subTab === 'users' && (
        <div className="space-y-4">
          <div className="dash-card">
            <div className="dash-card-inner p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2" style={headingStyle}>
                  <Users size={17} className="text-cyan-400" />
                  <span>{isRtl ? 'المستخدمون والصلاحيات داخل قاعدة البيانات' : 'Database Users & RBAC'}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                    {usersData?.totalCount || 0}
                  </span>
                </h3>
                <p className="text-xs mt-0.5" style={mutedStyle}>
                  {isRtl ? 'إدارة حسابات المستخدمين والتعديل المباشر لكلمات المرور والرتب والمكتبات المسموح بها.' : 'Directly manage user records, passwords, roles, and allowed libraries.'}
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search size={14} className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-slate-400`} />
                  <input
                    type="text"
                    placeholder={isRtl ? 'بحث في المستخدمين...' : 'Search users...'}
                    value={usersSearch}
                    onChange={(e) => setUsersSearch(e.target.value)}
                    className="w-full rounded-xl border py-1.5 text-xs focus:outline-none focus:border-cyan-400 ps-9 pe-3"
                    style={inputStyle}
                  />
                </div>

                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/10 transition-all whitespace-nowrap"
                >
                  <UserPlus size={14} />
                  <span>{isRtl ? 'إضافة مستخدم' : 'Add User'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Users Table Card */}
          <div className="dash-card">
            <div className="dash-card-inner overflow-hidden">
              {isLoadingUsers ? (
                <div className="p-10 text-center text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw size={20} className="animate-spin text-cyan-400" />
                  <span className="text-xs">{isRtl ? 'جاري جلب المستخدمين...' : 'Loading users...'}</span>
                </div>
              ) : usersData?.items?.length === 0 ? (
                <div className="p-10 text-center text-slate-400 flex flex-col items-center gap-2">
                  <Users size={24} className="text-slate-500" />
                  <span className="text-xs font-bold text-slate-300">{isRtl ? 'لا يوجد مستخدمون مطابقون للبحث' : 'No users found'}</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right" dir={isRtl ? 'rtl' : 'ltr'}>
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400 font-semibold">
                        <th className="p-3 w-12 text-center">ID</th>
                        <th className="p-3">{isRtl ? 'اسم المستخدم' : 'Username'}</th>
                        <th className="p-3">{isRtl ? 'الاسم الظاهر' : 'Display Name'}</th>
                        <th className="p-3">{isRtl ? 'الرتبة' : 'Role'}</th>
                        <th className="p-3">{isRtl ? 'المكتبات المسموحة' : 'Allowed Libraries'}</th>
                        <th className="p-3">{isRtl ? 'الصلاحيات والحالة' : 'Permissions & Status'}</th>
                        <th className="p-3 text-center w-28">{isRtl ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {usersData?.items?.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-900/30 transition-colors">
                          <td className="p-3 text-center font-mono text-slate-500">#{user.id}</td>
                          <td className="p-3 font-bold text-slate-100 flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 font-bold text-xs">
                              {user.username.slice(0, 2).toUpperCase()}
                            </div>
                            <span>{user.username}</span>
                          </td>
                          <td className="p-3 text-slate-300">{user.display_name || user.username}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              user.role === 'admin' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' :
                              user.role === 'guest' ? 'bg-slate-500/15 border-slate-500/30 text-slate-300' :
                              'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                            }`}>
                              {user.role === 'admin' ? (isRtl ? 'مدير (Admin)' : 'Admin') :
                               user.role === 'guest' ? (isRtl ? 'ضيف (Guest)' : 'Guest') :
                               (isRtl ? 'مستخدم (User)' : 'User')}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400">
                            {user.allowed_libraries && Array.isArray(user.allowed_libraries) ? (
                              <span className="text-[11px] font-mono text-cyan-400">
                                {user.allowed_libraries.length} {isRtl ? 'مكتبات محددة' : 'libraries'}
                              </span>
                            ) : (
                              <span className="text-[11px] text-emerald-400 font-medium">
                                {isRtl ? 'كافة المكتبات (غير مقيد)' : 'All Libraries'}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className={`px-2 py-0.5 rounded-full ${user.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                {user.is_active ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'معطل' : 'Inactive')}
                              </span>
                              {user.can_download ? <span className="text-slate-500" title="Download">DL✓</span> : null}
                              {user.can_cast ? <span className="text-slate-500" title="Cast">Cast✓</span> : null}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setEditingItem({ ...user, table: 'users' })}
                                className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20"
                                title={isRtl ? 'تعديل المستخدم' : 'Edit User'}
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                onClick={() => setConfirmAction({
                                  title: isRtl ? 'تأكيد حذف المستخدم' : 'Confirm Delete User',
                                  message: isRtl 
                                    ? `هل أنت متأكد من حذف المستخدم "${user.username}" نهائياً من قاعدة البيانات؟`
                                    : `Are you sure you want to delete user "${user.username}"?`,
                                  onConfirm: () => deleteRecordMut.mutate({ table: 'users', id: user.id, deletePhysical: false })
                                })}
                                disabled={currentUser?.id === user.id}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 disabled:opacity-30 disabled:pointer-events-none"
                                title={isRtl ? 'حذف المستخدم' : 'Delete User'}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB 4: RAW TABLES EXPLORER & EDITOR                   */}
      {/* ========================================================= */}
      {subTab === 'explorer' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="dash-card">
            <div className="dash-card-inner p-3 sm:p-4 space-y-3">
              {/* Entity Selection Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/80 pb-3">
                {[
                  { id: 'movies', label: isRtl ? 'الأفلام' : 'Movies', icon: Film, count: stats?.counts?.movies },
                  { id: 'series', label: isRtl ? 'المسلسلات' : 'Series', icon: Tv, count: stats?.counts?.series },
                  { id: 'episodes', label: isRtl ? 'الحلقات' : 'Episodes', icon: Disc, count: stats?.counts?.episodes },
                  { id: 'tracks', label: isRtl ? 'المقاطع الصوتية' : 'Tracks', icon: Music, count: stats?.counts?.tracks },
                  { id: 'albums', label: isRtl ? 'الألبومات' : 'Albums', icon: Disc, count: stats?.counts?.albums },
                  { id: 'artists', label: isRtl ? 'الفنانون' : 'Artists', icon: User, count: stats?.counts?.artists },
                  { id: 'libraries', label: isRtl ? 'المكتبات' : 'Libraries', icon: Folder, count: stats?.counts?.libraries },
                  { id: 'users', label: isRtl ? 'المستخدمون' : 'Users', icon: Users, count: stats?.counts?.users }
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setExplorerTable(tab.id);
                        setExplorerPage(1);
                        setSelectedIds([]);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                        explorerTable === tab.id
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      <Icon size={14} />
                      <span>{tab.label}</span>
                      {tab.count !== undefined && (
                        <span className="text-[10px] opacity-60 font-mono">({tab.count})</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Filter Row: Search, Library Filter, Missing Only, Batch Actions */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex flex-1 flex-wrap items-center gap-2.5">
                  {/* Live Search */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-slate-400`} />
                    <input
                      type="text"
                      placeholder={isRtl ? 'بحث في العناوين والمسارات...' : 'Search titles and paths...'}
                      value={explorerSearch}
                      onChange={(e) => {
                        setExplorerSearch(e.target.value);
                        setExplorerPage(1);
                      }}
                      className="w-full rounded-xl border py-1.5 text-xs focus:outline-none focus:border-cyan-400 ps-9 pe-3"
                      style={inputStyle}
                    />
                    {explorerSearch && (
                      <button
                        onClick={() => setExplorerSearch('')}
                        className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'left-2.5' : 'right-2.5'} text-slate-400 hover:text-slate-200`}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Library Filter */}
                  {!['libraries', 'users'].includes(explorerTable) && (
                    <select
                      value={explorerLibraryId}
                      onChange={(e) => {
                        setExplorerLibraryId(e.target.value);
                        setExplorerPage(1);
                      }}
                      className="rounded-xl border py-1.5 px-3 text-xs focus:outline-none focus:border-cyan-400"
                      style={inputStyle}
                    >
                      <option value="">{isRtl ? 'جميع المكتبات' : 'All Libraries'}</option>
                      {libraries.map(lib => (
                        <option key={lib.id} value={lib.id}>{lib.name}</option>
                      ))}
                    </select>
                  )}

                  {/* Missing Only Toggle (for files tables) */}
                  {['movies', 'episodes', 'tracks'].includes(explorerTable) && (
                    <button
                      onClick={() => {
                        setExplorerMissingOnly(!explorerMissingOnly);
                        setExplorerPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
                        explorerMissingOnly
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                          : 'border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FileX2 size={14} />
                      <span>{isRtl ? 'الملفات المفقودة فقط' : 'Missing Only'}</span>
                    </button>
                  )}
                </div>

                {/* Batch Tools */}
                <div className="flex items-center gap-2">
                  {/* Path Remap Tool */}
                  {['movies', 'episodes', 'tracks'].includes(explorerTable) && (
                    <button
                      onClick={() => setShowRemapModal(true)}
                      className="px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
                      title={isRtl ? 'استبدال بادئة المسارات لجميع الملفات' : 'Remap Path Prefix'}
                    >
                      <FolderSync size={14} />
                      <span>{isRtl ? 'استبدال المسارات' : 'Remap Paths'}</span>
                    </button>
                  )}

                  {/* Batch Selection Action Dropdown */}
                  {selectedIds.length > 0 && (
                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1">
                      <span className="text-[11px] text-cyan-300 font-bold px-1">{selectedIds.length} {isRtl ? 'محدد' : 'selected'}</span>
                      {['movies', 'series', 'tracks', 'albums', 'artists'].includes(explorerTable) && (
                        <button
                          onClick={() => setShowBatchLibModal(true)}
                          className="px-2 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs font-medium"
                        >
                          {isRtl ? 'نقل لمكتبة' : 'Reassign'}
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmAction({
                          title: isRtl ? 'تأكيد الحذف المجمع' : 'Confirm Batch Delete',
                          message: isRtl 
                            ? `هل أنت متأكد من حذف ${selectedIds.length} سجل محدد من قاعدة البيانات؟`
                            : `Delete ${selectedIds.length} selected records from database?`,
                          onConfirm: () => batchDeleteMut.mutate({ table: explorerTable, ids: selectedIds })
                        })}
                        className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-medium"
                      >
                        {isRtl ? 'حذف' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Records Table Card */}
          <div className="dash-card">
            <div className="dash-card-inner overflow-hidden">
              {isLoadingRecords ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw size={24} className="animate-spin text-cyan-400" />
                  <span className="text-xs">{isRtl ? 'جاري جلب السجلات...' : 'Loading records...'}</span>
                </div>
              ) : recordsData?.items?.length === 0 ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
                  <FileSearch size={28} className="text-slate-500" />
                  <span className="text-sm font-bold text-slate-300">{isRtl ? 'لا توجد سجلات مطابقة للبحث' : 'No matching records found'}</span>
                  <span className="text-xs text-slate-500">{isRtl ? 'جرب تغيير شروط البحث أو الفلاتر.' : 'Try changing search terms or filters.'}</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right" dir={isRtl ? 'rtl' : 'ltr'}>
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400 font-semibold">
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.length === recordsData?.items?.length && recordsData?.items?.length > 0}
                            onChange={() => toggleSelectAll(recordsData?.items || [])}
                            className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                          />
                        </th>
                        <th className="p-3 text-center w-14">ID</th>
                        <th className="p-3">{isRtl ? 'العنوان / الاسم' : 'Title / Name'}</th>
                        {!['libraries', 'users'].includes(explorerTable) && (
                          <th className="p-3">{isRtl ? 'المكتبة' : 'Library'}</th>
                        )}
                        {['movies', 'episodes', 'tracks'].includes(explorerTable) && (
                          <th className="p-3">{isRtl ? 'مسار الملف على القرص' : 'Physical Path'}</th>
                        )}
                        <th className="p-3 text-center w-28">{isRtl ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {recordsData?.items?.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-900/30 transition-colors">
                          {/* Selection Checkbox */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(item.id)}
                              onChange={() => toggleSelect(item.id)}
                              className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                            />
                          </td>

                          {/* ID */}
                          <td className="p-3 text-center font-mono text-slate-500">
                            #{item.id}
                          </td>

                          {/* Title & Info */}
                          <td className="p-3 font-medium text-slate-200">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-100 flex items-center gap-1.5">
                                {item.title || item.name || item.username || 'Untitled'}
                                {item.year && <span className="text-[10px] text-slate-400 font-mono font-normal">({item.year})</span>}
                              </span>
                              {item.seriesTitle && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {item.seriesTitle} • S{item.season_number}E{item.episode_number}
                                </span>
                              )}
                              {item.artistName && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {item.artistName} {item.albumTitle ? `• ${item.albumTitle}` : ''}
                                </span>
                              )}
                              {item.role && (
                                <span className="text-[10px] text-cyan-400 font-mono">
                                  Role: {item.role}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Library */}
                          {!['libraries', 'users'].includes(explorerTable) && (
                            <td className="p-3 text-slate-400">
                              {item.libraryName ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                  {item.libraryName}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-500 italic">{isRtl ? 'غير مصنف' : 'Unassigned'}</span>
                              )}
                            </td>
                          )}

                          {/* Path with Existence Status */}
                          {['movies', 'episodes', 'tracks'].includes(explorerTable) && (
                            <td className="p-3 font-mono text-[11px] text-slate-300 max-w-xs truncate" title={item.path}>
                              <div className="flex items-center gap-1.5">
                                {item.exists ? (
                                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" title={isRtl ? 'الملف موجود على القرص' : 'File exists on disk'} />
                                ) : (
                                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]" title={isRtl ? 'الملف مفقود من القرص' : 'File missing from disk'} />
                                )}
                                <span className="truncate">{item.path}</span>
                              </div>
                            </td>
                          )}

                          {/* Actions */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Direct Edit Button */}
                              <button
                                onClick={() => {
                                  setEditingItem({ ...item, table: explorerTable });
                                  setPathCheckResult(null);
                                }}
                                className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 transition-all"
                                title={isRtl ? 'تعديل مباشر' : 'Direct Edit'}
                              >
                                <Edit3 size={13} />
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => setConfirmAction({
                                  title: isRtl ? 'تأكيد الحذف' : 'Confirm Delete',
                                  message: isRtl 
                                    ? `هل أنت متأكد من حذف السجل "${item.title || item.name || item.username}" نهائياً من قاعدة البيانات؟`
                                    : `Are you sure you want to delete "${item.title || item.name || item.username}" permanently from the database?`,
                                  onConfirm: () => deleteRecordMut.mutate({ table: explorerTable, id: item.id, deletePhysical: false })
                                })}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all"
                                title={isRtl ? 'حذف من القاعدة' : 'Delete'}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Bar */}
              {recordsData && recordsData.totalPages > 1 && (
                <div className="p-3 border-t border-slate-800 bg-slate-900/30 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {isRtl ? 'صفحة' : 'Page'} {recordsData.page} {isRtl ? 'من' : 'of'} {recordsData.totalPages} ({recordsData.totalCount} {isRtl ? 'سجل' : 'records'})
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setExplorerPage(p => Math.max(1, p - 1))}
                      disabled={explorerPage <= 1}
                      aria-label={isRtl ? 'الصفحة السابقة' : 'Previous page'}
                      className="p-1 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <ChevronRight size={16} className={isRtl ? '' : 'rotate-180'} />
                    </button>
                    <button
                      onClick={() => setExplorerPage(p => Math.min(recordsData.totalPages, p + 1))}
                      disabled={explorerPage >= recordsData.totalPages}
                      aria-label={isRtl ? 'الصفحة التالية' : 'Next page'}
                      className="p-1 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <ChevronLeft size={16} className={isRtl ? '' : 'rotate-180'} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB 5: DUPLICATES INSPECTOR                           */}
      {/* ========================================================= */}
      {subTab === 'duplicates' && (
        <div className="space-y-4">
          <div className="dash-card">
            <div className="dash-card-inner p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2" style={headingStyle}>
                  <Sparkles size={17} className="text-amber-400" />
                  <span>{isRtl ? 'سجل المكررات المرصودة في النظام' : 'Detected Duplicates Registry'}</span>
                </h3>
                <p className="text-xs mt-0.5" style={mutedStyle}>
                  {isRtl 
                    ? 'استعراض مجموعات المكررات بالأفلام والتراكات والحلقات، ومراجعة المسارات قبل الدمج أو الحذف.' 
                    : 'Review identified duplicate groups and inspect paths before merging or cleaning.'}
                </p>
              </div>
              <button
                onClick={() => cleanDuplicatesMut.mutate()}
                disabled={cleanDuplicatesMut.isPending || duplicates?.totalGroups === 0}
                className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-500/10 transition-all disabled:opacity-40"
              >
                {cleanDuplicatesMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>{isRtl ? 'دمج وتنظيف كل المكررات بضغطة زر' : 'Auto Deduplicate All'}</span>
              </button>
            </div>
          </div>

          {isLoadingDuplicates ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw size={24} className="animate-spin text-amber-400" />
              <span className="text-xs">{isRtl ? 'جاري فحص المكررات...' : 'Scanning duplicates...'}</span>
            </div>
          ) : (!duplicates || duplicates.totalGroups === 0) ? (
            <div className="dash-card">
              <div className="dash-card-inner p-10 text-center flex flex-col items-center gap-2">
                <CheckCircle2 size={32} className="text-emerald-400" />
                <h4 className="text-sm font-bold text-slate-200">{isRtl ? 'قاعدة البيانات نظيفة تماماً من المكررات!' : 'No duplicate records found!'}</h4>
                <p className="text-xs text-slate-400">{isRtl ? 'لم يتم العثور على أي ملفات أو وسائط مكررة حالياً.' : 'Database is fully optimized without duplicates.'}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Duplicate Movies */}
              {duplicates.movies?.length > 0 && (
                <div className="dash-card">
                  <div className="dash-card-inner p-4 space-y-3">
                    <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                      <Film size={15} />
                      <span>{isRtl ? 'أفلام مكررة' : 'Duplicate Movies'} ({duplicates.movies.length} {isRtl ? 'مجموعة' : 'groups'})</span>
                    </h4>
                    <div className="space-y-2">
                      {duplicates.movies.map((grp, gIdx) => (
                        <div key={gIdx} className="p-3 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                          <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                            <span>{grp.groupKey}</span>
                            <span className="text-[10px] text-amber-400 font-mono font-semibold">{grp.count} {isRtl ? 'نسخ مكررة' : 'copies'}</span>
                          </div>
                          <div className="divide-y divide-slate-800/60">
                            {grp.items.map(item => (
                              <div key={item.id} className="py-1.5 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 font-mono text-[11px] truncate text-slate-300" title={item.path}>
                                  <span className={`w-2 h-2 rounded-full ${item.exists ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                                  <span className="text-slate-500">#{item.id}</span>
                                  <span className="truncate">{item.path}</span>
                                </div>
                                <button
                                  onClick={() => deleteRecordMut.mutate({ table: 'movies', id: item.id, deletePhysical: false })}
                                  className="text-rose-400 hover:text-rose-300 text-[10px] px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20"
                                >
                                  {isRtl ? 'حذف هذه النسخة' : 'Delete'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Duplicate Tracks */}
              {duplicates.tracks?.length > 0 && (
                <div className="dash-card">
                  <div className="dash-card-inner p-4 space-y-3">
                    <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                      <Music size={15} />
                      <span>{isRtl ? 'مقاطع صوتية مكررة' : 'Duplicate Audio Tracks'} ({duplicates.tracks.length} {isRtl ? 'مجموعة' : 'groups'})</span>
                    </h4>
                    <div className="space-y-2">
                      {duplicates.tracks.map((grp, gIdx) => (
                        <div key={gIdx} className="p-3 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                          <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                            <span>{grp.groupKey}</span>
                            <span className="text-[10px] text-amber-400 font-mono font-semibold">{grp.count} {isRtl ? 'نسخ مكررة' : 'copies'}</span>
                          </div>
                          <div className="divide-y divide-slate-800/60">
                            {grp.items.map(item => (
                              <div key={item.id} className="py-1.5 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 font-mono text-[11px] truncate text-slate-300" title={item.path}>
                                  <span className={`w-2 h-2 rounded-full ${item.exists ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                                  <span className="text-slate-500">#{item.id}</span>
                                  <span className="truncate">{item.path}</span>
                                </div>
                                <button
                                  onClick={() => deleteRecordMut.mutate({ table: 'tracks', id: item.id, deletePhysical: false })}
                                  className="text-rose-400 hover:text-rose-300 text-[10px] px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20"
                                >
                                  {isRtl ? 'حذف هذه النسخة' : 'Delete'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: DIRECT EDIT MODAL (FOR MEDIA, LIBRARY, OR USER) */}
      {/* ========================================================= */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="dash-card w-full max-w-lg shadow-2xl border border-cyan-500/30 overflow-hidden"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="dash-card-inner p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold flex items-center gap-2" style={headingStyle}>
                    <Edit3 size={16} className="text-cyan-400" />
                    <span>
                      {editingItem.table === 'users' ? (isRtl ? 'تعديل بيانات المستخدم' : 'Edit User Record') :
                       editingItem.table === 'libraries' ? (isRtl ? 'تعديل بيانات المكتبة' : 'Edit Library') :
                       (isRtl ? 'تعديل بيانات السجل مباشرة' : 'Direct Record Editor')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">#{editingItem.id}</span>
                  </h3>
                  <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-200">
                    <X size={18} />
                  </button>
                </div>

                {/* Form Fields */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateRecordMut.mutate({
                      table: editingItem.table || explorerTable,
                      id: editingItem.id,
                      payload: editingItem
                    });
                  }}
                  className="space-y-3 text-xs"
                >
                  {/* Title / Name / Username */}
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">
                      {editingItem.table === 'users' ? (isRtl ? 'اسم المستخدم (Username):' : 'Username:') :
                       editingItem.table === 'libraries' ? (isRtl ? 'اسم المكتبة:' : 'Library Name:') :
                       (isRtl ? 'العنوان / الاسم:' : 'Title / Name:')}
                    </label>
                    <input
                      type="text"
                      value={editingItem.username !== undefined ? editingItem.username : (editingItem.title !== undefined ? editingItem.title : (editingItem.name || ''))}
                      onChange={(e) => setEditingItem({
                        ...editingItem,
                        username: editingItem.username !== undefined ? e.target.value : undefined,
                        title: editingItem.title !== undefined ? e.target.value : undefined,
                        name: editingItem.name !== undefined ? e.target.value : undefined
                      })}
                      className="w-full rounded-xl border p-2 text-xs focus:outline-none focus:border-cyan-400"
                      style={inputStyle}
                      required
                    />
                  </div>

                  {/* Display Name (Users only) */}
                  {editingItem.table === 'users' && (
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">{isRtl ? 'الاسم الظاهر:' : 'Display Name:'}</label>
                      <input
                        type="text"
                        value={editingItem.display_name || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, display_name: e.target.value })}
                        className="w-full rounded-xl border p-2 text-xs focus:outline-none focus:border-cyan-400"
                        style={inputStyle}
                      />
                    </div>
                  )}

                  {/* Password Reset Field (Users only) */}
                  {editingItem.table === 'users' && (
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">{isRtl ? 'كلمة مرور جديدة (اتركها فارغة لعدم التغيير):' : 'New Password (leave empty to keep current):'}</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={editingItem.password || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, password: e.target.value })}
                        className="w-full rounded-xl border p-2 text-xs focus:outline-none focus:border-cyan-400"
                        style={inputStyle}
                      />
                    </div>
                  )}

                  {/* Role (Users only) */}
                  {editingItem.table === 'users' && (
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">{isRtl ? 'الرتبة والصلاحية:' : 'Role:'}</label>
                      <select
                        value={editingItem.role || 'user'}
                        onChange={(e) => setEditingItem({ ...editingItem, role: e.target.value })}
                        className="w-full rounded-xl border p-2 text-xs focus:outline-none focus:border-cyan-400"
                        style={inputStyle}
                      >
                        <option value="user">{isRtl ? 'مستخدم عادي (User)' : 'User'}</option>
                        <option value="admin">{isRtl ? 'مدير النظام (Admin)' : 'Admin'}</option>
                        <option value="guest">{isRtl ? 'ضيف (Guest)' : 'Guest'}</option>
                      </select>
                    </div>
                  )}

                  {/* Allowed Libraries (Users only) */}
                  {editingItem.table === 'users' && (
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">{isRtl ? 'المكتبات المسموح بها:' : 'Allowed Libraries:'}</label>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto border border-slate-800 rounded-xl p-2 bg-slate-950/40">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                          <input
                            type="checkbox"
                            checked={editingItem.allowed_libraries === null}
                            onChange={(e) => setEditingItem({
                              ...editingItem,
                              allowed_libraries: e.target.checked ? null : []
                            })}
                            className="rounded border-slate-700 text-cyan-500"
                          />
                          <span className="font-semibold text-emerald-400">{isRtl ? 'كافة المكتبات (وصول شامل)' : 'All Libraries (Unrestricted)'}</span>
                        </label>
                        {editingItem.allowed_libraries !== null && libraries.map(lib => {
                          const isAllowed = Array.isArray(editingItem.allowed_libraries) && editingItem.allowed_libraries.includes(lib.id);
                          return (
                            <label key={lib.id} className="flex items-center gap-2 cursor-pointer text-slate-300">
                              <input
                                type="checkbox"
                                checked={isAllowed}
                                onChange={(e) => {
                                  const currentArr = Array.isArray(editingItem.allowed_libraries) ? [...editingItem.allowed_libraries] : [];
                                  if (e.target.checked) {
                                    setEditingItem({ ...editingItem, allowed_libraries: [...currentArr, lib.id] });
                                  } else {
                                    setEditingItem({ ...editingItem, allowed_libraries: currentArr.filter(id => id !== lib.id) });
                                  }
                                }}
                                className="rounded border-slate-700 text-cyan-500"
                              />
                              <span>{lib.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* User Flags (Users only) */}
                  {editingItem.table === 'users' && (
                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={Boolean(editingItem.is_active)}
                          onChange={(e) => setEditingItem({ ...editingItem, is_active: e.target.checked ? 1 : 0 })}
                          className="rounded border-slate-700 text-cyan-500"
                        />
                        <span>{isRtl ? 'حساب نشط' : 'Active Account'}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={Boolean(editingItem.can_download)}
                          onChange={(e) => setEditingItem({ ...editingItem, can_download: e.target.checked ? 1 : 0 })}
                          className="rounded border-slate-700 text-cyan-500"
                        />
                        <span>{isRtl ? 'صلاحية التحميل' : 'Allow Download'}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={Boolean(editingItem.can_cast)}
                          onChange={(e) => setEditingItem({ ...editingItem, can_cast: e.target.checked ? 1 : 0 })}
                          className="rounded border-slate-700 text-cyan-500"
                        />
                        <span>{isRtl ? 'صلاحية البث (Cast)' : 'Allow Cast'}</span>
                      </label>
                    </div>
                  )}

                  {/* Year (Media only) */}
                  {editingItem.year !== undefined && (
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">{isRtl ? 'سنة الإنتاج:' : 'Year:'}</label>
                      <input
                        type="number"
                        value={editingItem.year || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, year: e.target.value })}
                        className="w-full rounded-xl border p-2 text-xs focus:outline-none focus:border-cyan-400"
                        style={inputStyle}
                      />
                    </div>
                  )}

                  {/* Library Assignment (Media only) */}
                  {editingItem.library_id !== undefined && (
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">{isRtl ? 'المكتبة التابع لها:' : 'Assigned Library:'}</label>
                      <select
                        value={editingItem.library_id || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, library_id: e.target.value })}
                        className="w-full rounded-xl border p-2 text-xs focus:outline-none focus:border-cyan-400"
                        style={inputStyle}
                      >
                        <option value="">{isRtl ? 'غير مصنف' : 'Unassigned'}</option>
                        {libraries.map(lib => (
                          <option key={lib.id} value={lib.id}>{lib.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Physical File Path (Media only) */}
                  {editingItem.path !== undefined && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-slate-400 font-medium">{isRtl ? 'مسار الملف على القرص:' : 'Physical File Path:'}</label>
                        <button
                          type="button"
                          onClick={() => handleCheckPath(editingItem.path)}
                          disabled={isCheckingPath}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold underline"
                        >
                          {isCheckingPath ? (isRtl ? 'جاري الفحص...' : 'Checking...') : (isRtl ? 'فحص وجود الملف الآن' : 'Check Existence Now')}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={editingItem.path || ''}
                        onChange={(e) => {
                          setEditingItem({ ...editingItem, path: e.target.value });
                          setPathCheckResult(null);
                        }}
                        className="w-full rounded-xl border p-2 text-xs font-mono focus:outline-none focus:border-cyan-400"
                        style={inputStyle}
                        required
                      />

                      {/* Path check indicator */}
                      {pathCheckResult && (
                        <div className={`mt-1.5 p-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${
                          pathCheckResult.exists 
                            ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-950/60 border border-rose-500/30 text-rose-300'
                        }`}>
                          {pathCheckResult.exists ? <Check size={14} /> : <X size={14} />}
                          <span>
                            {pathCheckResult.exists 
                              ? (isRtl ? 'الملف موجود وسليم على القرص الصلب.' : 'File physically exists on disk.')
                              : (isRtl ? 'تنبيه: المسار غير موجود على القرص الصلب حالياً!' : 'Warning: File path was not found on disk!')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Plot / Description / Bio */}
                  {(editingItem.plot !== undefined || editingItem.bio !== undefined) && (
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">{isRtl ? 'الوصف / القصة / النبذة:' : 'Plot / Bio:'}</label>
                      <textarea
                        rows={3}
                        value={editingItem.plot !== undefined ? (editingItem.plot || '') : (editingItem.bio || '')}
                        onChange={(e) => setEditingItem({
                          ...editingItem,
                          plot: editingItem.plot !== undefined ? e.target.value : undefined,
                          bio: editingItem.bio !== undefined ? e.target.value : undefined
                        })}
                        className="w-full rounded-xl border p-2 text-xs focus:outline-none focus:border-cyan-400 resize-none"
                        style={inputStyle}
                      />
                    </div>
                  )}

                  {/* Modal Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setEditingItem(null)}
                      className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium"
                    >
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={updateRecordMut.isPending}
                      className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/10"
                    >
                      {updateRecordMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                      <span>{isRtl ? 'حفظ التعديلات' : 'Save Changes'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 2: ADD USER DIRECT MODAL                            */}
      {/* ========================================================= */}
      <AnimatePresence>
        {showAddUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="dash-card w-full max-w-md shadow-2xl border border-cyan-500/30"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="dash-card-inner p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold flex items-center gap-2" style={headingStyle}>
                    <UserPlus size={16} className="text-cyan-400" />
                    <span>{isRtl ? 'إضافة مستخدم جديد في قاعدة البيانات' : 'Add Database User'}</span>
                  </h3>
                  <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-slate-200">
                    <X size={18} />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    createUserMut.mutate(newUserData);
                  }}
                  className="space-y-3 text-xs"
                >
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">{isRtl ? 'اسم المستخدم (Username):' : 'Username:'}</label>
                    <input
                      type="text"
                      value={newUserData.username}
                      onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                      className="w-full rounded-xl border p-2 text-xs focus:outline-none focus:border-cyan-400"
                      style={inputStyle}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">{isRtl ? 'كلمة المرور:' : 'Password:'}</label>
                    <input
                      type="password"
                      value={newUserData.password}
                      onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                      className="w-full rounded-xl border p-2 text-xs focus:outline-none focus:border-cyan-400"
                      style={inputStyle}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">{isRtl ? 'الاسم الظاهر (اختياري):' : 'Display Name:'}</label>
                    <input
                      type="text"
                      value={newUserData.display_name}
                      onChange={(e) => setNewUserData({ ...newUserData, display_name: e.target.value })}
                      className="w-full rounded-xl border p-2 text-xs focus:outline-none focus:border-cyan-400"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">{isRtl ? 'الرتبة:' : 'Role:'}</label>
                    <select
                      value={newUserData.role}
                      onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                      className="w-full rounded-xl border p-2 text-xs focus:outline-none focus:border-cyan-400"
                      style={inputStyle}
                    >
                      <option value="user">{isRtl ? 'مستخدم عادي (User)' : 'User'}</option>
                      <option value="admin">{isRtl ? 'مدير النظام (Admin)' : 'Admin'}</option>
                      <option value="guest">{isRtl ? 'ضيف (Guest)' : 'Guest'}</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowAddUserModal(false)}
                      className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium"
                    >
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={createUserMut.isPending || !newUserData.username || !newUserData.password}
                      className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/10 disabled:opacity-40"
                    >
                      {createUserMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />}
                      <span>{isRtl ? 'إنشاء المستخدم' : 'Create User'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 3: BATCH PATH REMAP MODAL                           */}
      {/* ========================================================= */}
      <AnimatePresence>
        {showRemapModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="dash-card w-full max-w-md shadow-2xl border border-cyan-500/30"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="dash-card-inner p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold flex items-center gap-2" style={headingStyle}>
                    <FolderSync size={16} className="text-cyan-400" />
                    <span>{isRtl ? 'استبدال بادئة المسارات (Path Remap)' : 'Batch Path Prefix Remap'}</span>
                  </h3>
                  <button onClick={() => setShowRemapModal(false)} className="text-slate-400 hover:text-slate-200">
                    <X size={18} />
                  </button>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {isRtl
                    ? 'يفيد هذا الخيار عند تغيير حرف القرص (مثل نقل الملفات من D:\\ إلى E:\\) أو تغيير اسم المجلد الرئيسي، حيث سيقوم بتحديث مسارات كافة الملفات المطابقة دفعة واحدة.'
                    : 'Useful when moving media to a new drive letter or folder, updating all matched file paths in bulk.'}
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">{isRtl ? 'البادئة القديمة (المسار الحالي):' : 'Old Prefix:'}</label>
                    <input
                      type="text"
                      placeholder="D:\Movies\"
                      value={remapOldPrefix}
                      onChange={(e) => setRemapOldPrefix(e.target.value)}
                      className="w-full rounded-xl border p-2 text-xs font-mono focus:outline-none focus:border-cyan-400"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">{isRtl ? 'البادئة الجديدة (المسار الجديد):' : 'New Prefix:'}</label>
                    <input
                      type="text"
                      placeholder="E:\Movies\"
                      value={remapNewPrefix}
                      onChange={(e) => setRemapNewPrefix(e.target.value)}
                      className="w-full rounded-xl border p-2 text-xs font-mono focus:outline-none focus:border-cyan-400"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowRemapModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => remapPathsMut.mutate({ oldPrefix: remapOldPrefix, newPrefix: remapNewPrefix })}
                    disabled={!remapOldPrefix || !remapNewPrefix || remapPathsMut.isPending}
                    className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
                  >
                    {remapPathsMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <FolderSync size={14} />}
                    <span>{isRtl ? 'تحديث المسارات الآن' : 'Remap Now'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 4: BATCH REASSIGN LIBRARY MODAL                     */}
      {/* ========================================================= */}
      <AnimatePresence>
        {showBatchLibModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="dash-card w-full max-w-sm shadow-2xl border border-blue-500/30"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="dash-card-inner p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold flex items-center gap-2" style={headingStyle}>
                    <Layers size={16} className="text-blue-400" />
                    <span>{isRtl ? 'نقل العناصر المحددة لمكتبة' : 'Reassign Selected to Library'}</span>
                  </h3>
                  <button onClick={() => setShowBatchLibModal(false)} className="text-slate-400 hover:text-slate-200">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <label className="block text-slate-400 font-medium">
                    {isRtl ? `اختر المكتبة الجديدة لـ (${selectedIds.length}) عنصر:` : `Select new library for (${selectedIds.length}) items:`}
                  </label>
                  <select
                    value={batchTargetLib}
                    onChange={(e) => setBatchTargetLib(e.target.value)}
                    className="w-full rounded-xl border p-2 text-xs focus:outline-none focus:border-cyan-400"
                    style={inputStyle}
                  >
                    <option value="">{isRtl ? 'اختر مكتبة...' : 'Select a library...'}</option>
                    {libraries.map(lib => (
                      <option key={lib.id} value={lib.id}>{lib.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowBatchLibModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => batchLibMut.mutate({ table: explorerTable, ids: selectedIds, libraryId: batchTargetLib })}
                    disabled={!batchTargetLib || batchLibMut.isPending}
                    className="px-4 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 text-blue-300 text-xs font-bold disabled:opacity-40"
                  >
                    {isRtl ? 'تأكيد النقل' : 'Confirm'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* CONFIRMATION DIALOG                                       */}
      {/* ========================================================= */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="dash-card w-full max-w-sm shadow-2xl border border-rose-500/40"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="dash-card-inner p-5 space-y-3">
                <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm">
                  <AlertTriangle size={18} />
                  <span>{confirmAction.title}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {confirmAction.message}
                </p>
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    onClick={() => {
                      confirmAction.onConfirm();
                      setConfirmAction(null);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 border border-rose-500/40 text-rose-200 text-xs font-bold shadow-lg shadow-rose-900/20"
                  >
                    {isRtl ? 'تأكيد التنفيذ' : 'Confirm'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
