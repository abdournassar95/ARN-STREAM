import db from '../db.js';
import sessionManager from './session-manager.js';
import crypto from 'crypto';

// Ensure table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS system_notifications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    category TEXT DEFAULT 'general',
    link TEXT,
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_created ON system_notifications(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_notifications_read ON system_notifications(read);
`);

class NotificationManager {
  /**
   * Push a notification to DB and broadcast to all connected WebSocket clients
   * @param {Object} options
   * @param {string} options.title - Notification title
   * @param {string} options.message - Notification message body
   * @param {'info'|'success'|'warning'|'error'} [options.type='info'] - Severity type
   * @param {'scan'|'metadata'|'health'|'device'|'general'} [options.category='general'] - Category tag
   * @param {string} [options.link] - Optional client navigation link (e.g. '/database' or '/library/1')
   * @param {Object} [options.data] - Additional metadata payload
   */
  notify({ title, message, type = 'info', category = 'general', link = null, data = null }) {
    if (!title) return null;

    const id = `notif-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const cleanTitle = String(title).trim();
    const cleanMsg = String(message || '').trim();

    try {
      db.prepare(`
        INSERT INTO system_notifications (id, title, message, type, category, link, read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      `).run(id, cleanTitle, cleanMsg, type, category, link);

      // Prune to keep only latest 100 notifications
      db.prepare(`
        DELETE FROM system_notifications
        WHERE id NOT IN (
          SELECT id FROM system_notifications ORDER BY created_at DESC LIMIT 100
        )
      `).run();
    } catch (err) {
      console.error('[NotificationManager] DB Insert error:', err.message);
    }

    const payload = {
      id,
      title: cleanTitle,
      message: cleanMsg,
      type,
      category,
      link,
      data,
      read: false,
      created_at: new Date().toISOString()
    };

    // Real-Time Broadcast to all active clients (< 5ms)
    try {
      sessionManager.broadcast('notification', payload);
    } catch (err) {
      console.warn('[NotificationManager] Broadcast failed:', err.message);
    }

    return payload;
  }

  /**
   * Get recent notifications
   */
  getNotifications(limit = 50, unreadOnly = false) {
    try {
      const query = unreadOnly
        ? `SELECT * FROM system_notifications WHERE read = 0 ORDER BY created_at DESC LIMIT ?`
        : `SELECT * FROM system_notifications ORDER BY created_at DESC LIMIT ?`;
      return db.prepare(query).all(limit).map(n => ({
        ...n,
        read: Boolean(n.read)
      }));
    } catch (err) {
      console.error('[NotificationManager] Get error:', err.message);
      return [];
    }
  }

  /**
   * Get unread notifications count
   */
  getUnreadCount() {
    try {
      const row = db.prepare(`SELECT COUNT(*) as cnt FROM system_notifications WHERE read = 0`).get();
      return row ? row.cnt : 0;
    } catch (err) {
      return 0;
    }
  }

  /**
   * Mark single notification as read
   */
  markAsRead(id) {
    try {
      db.prepare(`UPDATE system_notifications SET read = 1 WHERE id = ?`).run(id);
      sessionManager.broadcast('notification_read', { id });
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead() {
    try {
      db.prepare(`UPDATE system_notifications SET read = 1`).run();
      sessionManager.broadcast('notification_all_read', {});
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Delete single notification
   */
  deleteNotification(id) {
    try {
      db.prepare(`DELETE FROM system_notifications WHERE id = ?`).run(id);
      sessionManager.broadcast('notification_deleted', { id });
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    try {
      db.prepare(`DELETE FROM system_notifications`).run();
      sessionManager.broadcast('notification_cleared', {});
      return true;
    } catch (err) {
      return false;
    }
  }
}

export const notificationManager = new NotificationManager();
export default notificationManager;
