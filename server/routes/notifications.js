import express from 'express';
import notificationManager from '../services/notification-manager.js';
import { requireAuth } from '../services/auth.js';

const router = express.Router();

// All notification routes require authentication
router.use(requireAuth);

/**
 * GET /api/notifications
 * Fetch recent notifications and unread count
 */
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const unreadOnly = req.query.unreadOnly === 'true';
    const notifications = notificationManager.getNotifications(limit, unreadOnly);
    const unreadCount = notificationManager.getUnreadCount();

    res.json({
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'NOTIFICATIONS_FETCH_ERROR', message: err.message } });
  }
});

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read
 */
router.post('/read-all', (req, res) => {
  try {
    notificationManager.markAllAsRead();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: 'NOTIFICATIONS_UPDATE_ERROR', message: err.message } });
  }
});

/**
 * POST /api/notifications/:id/read
 * Mark single notification as read
 */
router.post('/:id/read', (req, res) => {
  try {
    const success = notificationManager.markAsRead(req.params.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: { code: 'NOTIFICATIONS_UPDATE_ERROR', message: err.message } });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete single notification
 */
router.delete('/:id', (req, res) => {
  try {
    const success = notificationManager.deleteNotification(req.params.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: { code: 'NOTIFICATIONS_DELETE_ERROR', message: err.message } });
  }
});

/**
 * DELETE /api/notifications
 * Clear all notifications
 */
router.delete('/', (req, res) => {
  try {
    notificationManager.clearAll();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: 'NOTIFICATIONS_CLEAR_ERROR', message: err.message } });
  }
});

export default router;
