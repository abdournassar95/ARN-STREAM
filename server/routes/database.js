import express from 'express';
import { requireAdmin } from '../services/auth.js';
import {
  getDatabaseStats,
  cleanOrphanedData,
  cleanMissingFiles,
  findDuplicates,
  cleanDuplicates,
  vacuumAndOptimizeDatabase,
  backupDatabase,
  listBackups,
  queryRecords,
  updateRecord,
  deleteRecord,
  remapPathPrefix,
  batchUpdateLibrary,
  batchDeleteRecords,
  checkFileExists,
  getLibraryContents,
  clearLibraryContents,
  createUserDirect
} from '../services/database-manager.js';

const router = express.Router();

// Apply requireAdmin to all routes in this router
router.use(requireAdmin);

/**
 * GET /api/database/stats
 * Get overall database stats, size, and issues count
 */
router.get('/stats', (req, res) => {
  try {
    const stats = getDatabaseStats();
    res.json({ data: stats });
  } catch (err) {
    res.status(500).json({ error: { code: 'STATS_ERROR', message: err.message } });
  }
});

/**
 * POST /api/database/clean-orphans
 * Cleans empty containers (series/seasons/albums/artists) and orphaned images/tags/state
 */
router.post('/clean-orphans', (req, res) => {
  try {
    const result = cleanOrphanedData();
    res.json({
      data: result,
      message: `تم تنظيف ${result.totalCleaned} سجل يتيم وفارغ بنجاح.`
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'CLEAN_ORPHANS_ERROR', message: err.message } });
  }
});

/**
 * POST /api/database/clean-missing
 * Cleans records pointing to missing physical files on disk
 */
router.post('/clean-missing', (req, res) => {
  try {
    const dryRun = req.body?.dryRun === true;
    const result = cleanMissingFiles(dryRun);
    res.json({
      data: result,
      message: dryRun 
        ? `تم رصد ${result.totalMissing} ملف مفقود على القرص.`
        : `تمت إزالة ${result.cleaned} سجل لملفات مفقودة من قاعدة البيانات.`
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'CLEAN_MISSING_ERROR', message: err.message } });
  }
});

/**
 * GET /api/database/duplicates
 * Lists duplicate groups across movies, tracks, episodes, and artists
 */
router.get('/duplicates', (req, res) => {
  try {
    const duplicates = findDuplicates();
    res.json({ data: duplicates });
  } catch (err) {
    res.status(500).json({ error: { code: 'DUPLICATES_ERROR', message: err.message } });
  }
});

/**
 * POST /api/database/clean-duplicates
 * Performs automatic deduplication retaining primary entry
 */
router.post('/clean-duplicates', (req, res) => {
  try {
    const result = cleanDuplicates();
    res.json({
      data: result,
      message: `تم دمج وتنظيف ${result.totalCleaned} إدخال مكرر بنجاح.`
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'CLEAN_DUPLICATES_ERROR', message: err.message } });
  }
});

/**
 * POST /api/database/vacuum
 * Executes VACUUM, ANALYZE, and PRAGMA optimize
 */
router.post('/vacuum', (req, res) => {
  try {
    const result = vacuumAndOptimizeDatabase();
    res.json({
      data: result,
      message: `تم ضغط وتسريع قاعدة البيانات بنجاح واسترجاع ${result.reclaimedFormatted}.`
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'VACUUM_ERROR', message: err.message } });
  }
});

/**
 * POST /api/database/backup
 * Creates an instant snapshot backup of media.db
 */
router.post('/backup', (req, res) => {
  try {
    const backup = backupDatabase();
    res.json({
      data: backup,
      message: `تم إنشاء نسخة احتياطية بنجاح: ${backup.filename}`
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'BACKUP_ERROR', message: err.message } });
  }
});

/**
 * GET /api/database/backups
 * Returns list of existing database backups
 */
router.get('/backups', (req, res) => {
  try {
    const backups = listBackups();
    res.json({ data: backups });
  } catch (err) {
    res.status(500).json({ error: { code: 'BACKUPS_LIST_ERROR', message: err.message } });
  }
});

/**
 * GET /api/database/records
 * Query records for data explorer with search, filtering, and pagination
 */
router.get('/records', (req, res) => {
  try {
    const {
      table = 'movies',
      search = '',
      libraryId = null,
      missingOnly = 'false',
      page = 1,
      limit = 25,
      sortBy = 'id',
      sortOrder = 'DESC'
    } = req.query;

    const result = queryRecords({
      table,
      search,
      libraryId: libraryId ? Number(libraryId) : null,
      missingOnly: missingOnly === 'true',
      page: Number(page) || 1,
      limit: Number(limit) || 25,
      sortBy,
      sortOrder
    });

    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
  }
});

/**
 * PUT /api/database/records/:table/:id
 * Direct update of a media/library record
 */
router.put('/records/:table/:id', (req, res) => {
  try {
    const { table, id } = req.params;
    const updated = updateRecord(table, id, req.body || {});
    res.json({
      data: updated,
      message: 'تم حفظ وتحديث بيانات السجل بنجاح.'
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'UPDATE_RECORD_ERROR', message: err.message } });
  }
});

/**
 * DELETE /api/database/records/:table/:id
 * Direct deletion of a record
 */
router.delete('/records/:table/:id', (req, res) => {
  try {
    const { table, id } = req.params;
    const deletePhysical = req.query.deletePhysicalFile === 'true';
    deleteRecord(table, id, deletePhysical);
    res.json({
      data: { success: true },
      message: 'تم حذف السجل بنجاح من قاعدة البيانات.'
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'DELETE_RECORD_ERROR', message: err.message } });
  }
});

/**
 * POST /api/database/check-path
 * Check if a path physically exists on disk
 */
router.post('/check-path', (req, res) => {
  const { path: testPath } = req.body || {};
  const exists = checkFileExists(testPath);
  res.json({ data: { path: testPath, exists } });
});

/**
 * POST /api/database/batch/paths
 * Batch remap paths prefix (e.g. changing drive letter)
 */
router.post('/batch/paths', (req, res) => {
  try {
    const { oldPrefix, newPrefix, tables } = req.body || {};
    if (!oldPrefix || !newPrefix) {
      return res.status(400).json({ error: { code: 'INVALID_PARAMS', message: 'oldPrefix and newPrefix are required' } });
    }
    const result = remapPathPrefix(oldPrefix, newPrefix, tables);
    res.json({
      data: result,
      message: `تم تحديث مسارات ${result.totalUpdated} ملف بنجاح.`
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'BATCH_PATHS_ERROR', message: err.message } });
  }
});

/**
 * POST /api/database/batch/library
 * Batch reassign library for multiple items
 */
router.post('/batch/library', (req, res) => {
  try {
    const { table, ids, libraryId } = req.body || {};
    const result = batchUpdateLibrary(table, ids, libraryId);
    res.json({
      data: result,
      message: `تم نقل وتحديث ${result.updated} عنصر بنجاح.`
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'BATCH_LIBRARY_ERROR', message: err.message } });
  }
});

/**
 * POST /api/database/batch/delete
 * Batch delete records
 */
router.post('/batch/delete', (req, res) => {
  try {
    const { table, ids } = req.body || {};
    const result = batchDeleteRecords(table, ids);
    res.json({
      data: result,
      message: `تم حذف ${result.deleted} سجل بنجاح.`
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'BATCH_DELETE_ERROR', message: err.message } });
  }
});

/**
 * GET /api/database/libraries/:id/contents
 * Get full contents and stats for a specific library
 */
router.get('/libraries/:id/contents', (req, res) => {
  try {
    const { search, page, limit, missingOnly } = req.query;
    const contents = getLibraryContents(req.params.id, {
      search,
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      missingOnly: missingOnly === 'true'
    });
    res.json({ data: contents });
  } catch (err) {
    res.status(500).json({ error: { code: 'LIBRARY_CONTENTS_ERROR', message: err.message } });
  }
});

/**
 * POST /api/database/libraries/:id/clear
 * Clear all media belonging to a library
 */
router.post('/libraries/:id/clear', (req, res) => {
  try {
    const result = clearLibraryContents(req.params.id);
    res.json({
      data: result,
      message: `تم إفراغ محتويات المكتبة (${result.deletedCount} عنصر) بنجاح.`
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'LIBRARY_CLEAR_ERROR', message: err.message } });
  }
});

/**
 * POST /api/database/users
 * Create user directly from database manager
 */
router.post('/users', (req, res) => {
  try {
    const user = createUserDirect(req.body || {});
    res.json({
      data: user,
      message: `تم إنشاء المستخدم "${user.username}" بنجاح في قاعدة البيانات.`
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'CREATE_USER_ERROR', message: err.message } });
  }
});

export default router;

