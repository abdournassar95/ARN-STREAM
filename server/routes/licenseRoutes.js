/**
 * ARN Technology — License API Routes & Security Gate (ESM)
 * Target Application: ARN Stream
 * Developer: Abdou Ragab Nassar (c) 2026
 */

import express from 'express';
import { licenseService } from '../services/licenseService.js';

const router = express.Router();

/**
 * GET /api/license/status
 * Returns current licensing and trial status
 */
router.get('/status', (req, res) => {
    try {
        const status = licenseService.getStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve license status', details: err.message });
    }
});

/**
 * POST /api/license/activate
 * Body: { serial: 'ARNLIC...' }
 */
router.post('/activate', (req, res) => {
    const { serial } = req.body;
    if (!serial) {
        return res.status(400).json({ success: false, message: 'يرجى تقديم كود التفعيل (Serial Key)' });
    }

    const result = licenseService.activate(serial);
    if (result.success) {
        res.json(result);
    } else {
        res.status(400).json(result);
    }
});

/**
 * POST /api/license/deactivate
 */
router.post('/deactivate', (req, res) => {
    const result = licenseService.deactivate();
    res.json(result);
});

/**
 * Security Middleware: Gates streaming and media endpoints if license or trial is expired
 */
export function licenseGateMiddleware(req, res, next) {
    // Whitelist essential routes and static media/images (ultra-fast pass-through)
    if (
        req.path.startsWith('/api/license') ||
        req.path.startsWith('/api/auth') ||
        req.path === '/api/health' ||
        req.path.startsWith('/api/image') ||
        req.path.startsWith('/channels')
    ) {
        return next();
    }

    if (!licenseService.canRunQuick()) {
        const status = licenseService.getStatus(true);
        return res.status(402).json({
            error: 'LICENSE_EXPIRED',
            message: status.trial?.reason || 'انتهت الفترة التجريبية. يرجى تفعيل النسخة الكاملة لمتابعة البث واستخدام المنصة.',
            hwid: status.hwid,
            appName: status.appName
        });
    }

    next();
}

export default router;
