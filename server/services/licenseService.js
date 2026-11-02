/**
 * ARN Technology — Enterprise Node-Locked Licensing & Quad-Layer Stealth Engine (ESM)
 * Target Application: ARN Stream
 * Developer: Abdou Ragab Nassar (c) 2026
 * 
 * Includes 4 obfuscated layers (AppData + Registry + ProgramData Stealth Shadow + Disguised COM CLSID)
 * and automatic cross-layer self-healing to prevent trial reset upon uninstall/reinstall.
 * Optimized with high-speed in-memory caching to eliminate process blocking.
 */

import { execSync } from 'child_process';
import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import path from 'path';

const ARN_MASTER_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEABIRLl8UtimRGIhCtlZz7CEYm8wjWl6f5gqq8kOfYYwk=
-----END PUBLIC KEY-----`;

class LicenseService {
    constructor() {
        this.appId = 'ARN-Stream';
        this.appName = 'ARN Stream';
        this.trialDays = 7;
        this.publicKeyPem = ARN_MASTER_PUBLIC_KEY;
        this._cachedHWID = null;
        this._cachedState = null;
        this._cachedStatus = null;
        this._lastStatusCheck = 0;
        this._lastTrialSave = 0;

        this.contactInfo = {
            whatsapp: '+201556710314',
            telegram: 'ABDOURNASSAR95',
            facebook: 'abdouragab.nassar',
            messenger: 'abdouragab.nassar',
            companyName: 'ARN Technology',
            developerName: 'عبده رجب نصار'
        };

        // 1. Layer 1: AppData
        const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        this.layer1Dir = path.join(appData, 'ARN Technology', this.appId);
        this.layer1File = path.join(this.layer1Dir, 'sys_lic.dat');
        this.hwidFile = path.join(this.layer1Dir, 'hwid.dat');

        this.hwid = this.getHWID();

        // 2. Layer 2: Standard Registry
        this.layer2RegPath = `HKCU\\Software\\ARN Technology\\${this.appId}`;

        // 3. Layer 3: ProgramData Obfuscated Machine Shadow
        const progData = process.env.ProgramData || 'C:\\ProgramData';
        this.layer3Dir = path.join(progData, 'WindowsCoreDiagnostics');
        const shadowHash = crypto.createHash('md5').update(`SHADOW_${this.appId}_${this.hwid}`).digest('hex').substring(0, 12);
        this.layer3File = path.join(this.layer3Dir, `nt_${shadowHash}.dat`);

        // 4. Layer 4: Disguised Windows COM CLSID
        const clsidHash = crypto.createHash('md5').update(`CLSID_${this.appId}_${this.hwid}`).digest('hex').toUpperCase();
        this.layer4Clsid = `{${clsidHash.substring(0, 8)}-${clsidHash.substring(8, 12)}-${clsidHash.substring(12, 16)}-${clsidHash.substring(16, 20)}-${clsidHash.substring(20, 32)}}`;
        this.layer4RegPath = `HKCU\\Software\\Classes\\CLSID\\${this.layer4Clsid}`;

        this._ensureDirs();

        // 256-bit AES encryption key derived from HWID & appId
        this.encryptionKey = crypto.createHash('sha256')
            .update(`ARN_SECRET_KEY_SALT_${this.hwid}_${this.appId}`, 'utf8')
            .digest();

        // Warm up status in background/init
        this.getStatus(true);
    }

    _ensureDirs() {
        try {
            if (!fs.existsSync(this.layer1Dir)) fs.mkdirSync(this.layer1Dir, { recursive: true });
        } catch (e) {}
        try {
            if (!fs.existsSync(this.layer3Dir)) fs.mkdirSync(this.layer3Dir, { recursive: true });
        } catch (e) {}
    }

    getHWID() {
        if (this._cachedHWID) return this._cachedHWID;

        // Try reading cached HWID file for instant startup (< 1ms)
        try {
            if (this.hwidFile && fs.existsSync(this.hwidFile)) {
                const saved = fs.readFileSync(this.hwidFile, 'utf8').trim();
                if (saved.startsWith('ARN-') && saved.length === 19) {
                    this._cachedHWID = saved;
                    return saved;
                }
            }
        } catch (e) {}

        let systemUUID = '';
        let cpuId = '';
        let diskSerial = '';
        let boardSerial = '';

        if (process.platform === 'win32') {
            try {
                const psCmd = '$u=(Get-CimInstance Win32_ComputerSystemProduct).UUID;' +
                              '$c=(Get-CimInstance Win32_Processor | Select-Object -First 1).ProcessorId;' +
                              '$d=(Get-CimInstance Win32_DiskDrive | Select-Object -First 1).SerialNumber;' +
                              '$b=(Get-CimInstance Win32_BaseBoard).SerialNumber;' +
                              'Write-Output "$u;;;$c;;;$d;;;$b"';

                const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`, {
                    timeout: 8000,
                    windowsHide: true,
                    encoding: 'utf8',
                    stdio: ['pipe', 'pipe', 'ignore']
                });

                if (out) {
                    const parts = out.trim().split(';;;');
                    systemUUID = parts[0] || '';
                    cpuId = parts[1] || '';
                    diskSerial = parts[2] || '';
                    boardSerial = parts[3] || '';
                }
            } catch (e) {}
        }

        const fallback = [
            os.hostname(),
            os.platform(),
            os.arch(),
            os.cpus()[0]?.model || 'generic_cpu',
            os.totalmem()
        ].join('|');

        const rawSeed = [systemUUID, cpuId, diskSerial, boardSerial, fallback].join(':::ARN_TECH:::');
        const hash = crypto.createHash('sha256').update(rawSeed, 'utf8').digest('hex').toUpperCase();

        const p1 = hash.substring(0, 4);
        const p2 = hash.substring(4, 8);
        const p3 = hash.substring(8, 12);
        const p4 = hash.substring(12, 16);

        this._cachedHWID = `ARN-${p1}-${p2}-${p3}-${p4}`;

        // Save for subsequent instant boots
        try {
            if (this.hwidFile) {
                fs.writeFileSync(this.hwidFile, this._cachedHWID, 'utf8');
            }
        } catch (e) {}

        return this._cachedHWID;
    }

    _encrypt(data) {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        const json = JSON.stringify(data);
        let enc = cipher.update(json, 'utf8', 'hex');
        enc += cipher.final('hex');
        const tag = cipher.getAuthTag().toString('hex');
        return `${iv.toString('hex')}:${tag}:${enc}`;
    }

    _decrypt(payload) {
        try {
            if (!payload || typeof payload !== 'string') return null;
            const parts = payload.trim().split(':');
            if (parts.length !== 3) return null;

            const iv = Buffer.from(parts[0], 'hex');
            const tag = Buffer.from(parts[1], 'hex');
            const enc = parts[2];

            const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
            decipher.setAuthTag(tag);

            let dec = decipher.update(enc, 'hex', 'utf8');
            dec += decipher.final('utf8');

            return JSON.parse(dec);
        } catch (e) {
            return null;
        }
    }

    _readLayer1() {
        if (!fs.existsSync(this.layer1File)) return null;
        try {
            const raw = fs.readFileSync(this.layer1File, 'utf8');
            return this._decrypt(raw);
        } catch (e) {
            return null;
        }
    }

    _readLayer2() {
        if (process.platform !== 'win32') return null;
        try {
            const out = execSync(`reg query "${this.layer2RegPath}" 2>nul`, { windowsHide: true, encoding: 'utf8', timeout: 3000 });
            const fl = out.match(/FL\s+REG_SZ\s+(\d+)/);
            const ls = out.match(/LS\s+REG_SZ\s+(\d+)/);
            const tp = out.match(/TP\s+REG_DWORD\s+0x([0-9a-fA-F]+)/);
            const lic = out.match(/LIC\s+REG_SZ\s+([^\r\n]+)/);

            if (fl || ls || lic) {
                return {
                    trialFirstLaunch: fl ? parseInt(fl[1], 10) : null,
                    trialLastSeen: ls ? parseInt(ls[1], 10) : null,
                    trialTampered: tp ? parseInt(tp[1], 16) === 1 : false,
                    activatedSerial: lic ? lic[1].trim() : null
                };
            }
        } catch (e) {}
        return null;
    }

    _readLayer3() {
        if (!fs.existsSync(this.layer3File)) return null;
        try {
            const raw = fs.readFileSync(this.layer3File, 'utf8');
            return this._decrypt(raw);
        } catch (e) {
            return null;
        }
    }

    _readLayer4() {
        if (process.platform !== 'win32') return null;
        try {
            const out = execSync(`reg query "${this.layer4RegPath}" 2>nul`, { windowsHide: true, encoding: 'utf8', timeout: 3000 });
            const p = out.match(/PackageData\s+REG_SZ\s+([^\r\n]+)/);
            if (p) return this._decrypt(p[1]);
        } catch (e) {}
        return null;
    }

    loadState(forceReload = false) {
        if (!forceReload && this._cachedState) {
            return this._cachedState;
        }

        const l1 = this._readLayer1();
        const l2 = this._readLayer2();
        const l3 = this._readLayer3();
        const l4 = this._readLayer4();

        const candidates = [l1, l2, l3, l4].filter(Boolean);
        if (candidates.length === 0) {
            this._cachedState = {};
            return this._cachedState;
        }

        let earliestLaunch = null;
        let latestSeen = null;
        let isTampered = false;
        let activeSerial = null;

        for (const c of candidates) {
            if (c.trialTampered) isTampered = true;
            if (c.activatedSerial && !activeSerial) activeSerial = c.activatedSerial;

            if (c.trialFirstLaunch) {
                if (!earliestLaunch || c.trialFirstLaunch < earliestLaunch) {
                    earliestLaunch = c.trialFirstLaunch;
                }
            }
            if (c.trialLastSeen) {
                if (!latestSeen || c.trialLastSeen > latestSeen) {
                    latestSeen = c.trialLastSeen;
                }
            }
        }

        const consolidated = {
            trialFirstLaunch: earliestLaunch,
            trialLastSeen: latestSeen,
            trialTampered: isTampered,
            activatedSerial: activeSerial
        };

        // Self-Healing
        if (!l1 || !l2 || !l3 || !l4) {
            this.saveState(consolidated);
        }

        this._cachedState = consolidated;
        return consolidated;
    }

    saveState(state) {
        this._ensureDirs();
        this._cachedState = { ...state };
        const encrypted = this._encrypt(state);

        try { fs.writeFileSync(this.layer1File, encrypted, 'utf8'); } catch (e) {}
        try { fs.writeFileSync(this.layer3File, encrypted, 'utf8'); } catch (e) {}

        if (process.platform === 'win32') {
            try {
                const fl = state.trialFirstLaunch || 0;
                const ls = state.trialLastSeen || 0;
                const tp = state.trialTampered ? 1 : 0;
                const lic = state.activatedSerial ? state.activatedSerial.trim() : '';

                let cmd2 = `reg add "${this.layer2RegPath}" /v "FL" /t REG_SZ /d "${fl}" /f >nul 2>&1 & ` +
                           `reg add "${this.layer2RegPath}" /v "LS" /t REG_SZ /d "${ls}" /f >nul 2>&1 & ` +
                           `reg add "${this.layer2RegPath}" /v "TP" /t REG_DWORD /d ${tp} /f >nul 2>&1`;
                if (lic) cmd2 += ` & reg add "${this.layer2RegPath}" /v "LIC" /t REG_SZ /d "${lic}" /f >nul 2>&1`;

                const cmd4 = `reg add "${this.layer4RegPath}" /ve /t REG_SZ /d "Windows System Hardware Sync Provider" /f >nul 2>&1 & ` +
                             `reg add "${this.layer4RegPath}" /v "PackageData" /t REG_SZ /d "${encrypted}" /f >nul 2>&1`;

                execSync(`${cmd2} & ${cmd4}`, { windowsHide: true, timeout: 4000 });
            } catch (e) {}
        }
        this._lastTrialSave = Date.now();
    }

    checkTrial(state) {
        const now = Date.now();
        if (!state) state = this.loadState();

        let firstLaunch = state.trialFirstLaunch;
        let lastSeen = state.trialLastSeen;
        let isTampered = state.trialTampered || false;

        // 1. First time launch
        if (!firstLaunch) {
            firstLaunch = now;
            lastSeen = now;
            state.trialFirstLaunch = firstLaunch;
            state.trialLastSeen = lastSeen;
            state.trialTampered = false;
            this.saveState(state);
        }

        // 2. Anti-Clock Rollback (detect clock manipulation backwards by > 10 mins)
        const TOLERANCE_MS = 10 * 60 * 1000;
        if (now < (lastSeen - TOLERANCE_MS)) {
            isTampered = true;
            state.trialTampered = true;
            this.saveState(state);
            return {
                isTrialActive: false,
                isExpired: true,
                isTampered: true,
                daysRemaining: 0,
                totalDays: this.trialDays,
                reason: 'تم رصد تلاعب في توقيت النظام (Clock Rollback). تم إيقاف النسخة التجريبية لأسباب أمنية.'
            };
        }

        state.trialLastSeen = now;
        // Only persist trialLastSeen to disk/registry if 30 minutes have passed since last save
        if (!this._lastTrialSave || (now - this._lastTrialSave > 30 * 60 * 1000)) {
            this.saveState(state);
        }

        if (isTampered) {
            return {
                isTrialActive: false,
                isExpired: true,
                isTampered: true,
                daysRemaining: 0,
                totalDays: this.trialDays,
                reason: 'تم رصد تلاعب مسبق في توقيت النظام أو ملفات الترخيص.'
            };
        }

        // 3. Compute Remaining Days
        const durationMs = this.trialDays * 24 * 60 * 60 * 1000;
        const expiryTime = firstLaunch + durationMs;
        const remainingMs = expiryTime - now;

        if (remainingMs <= 0) {
            return {
                isTrialActive: false,
                isExpired: true,
                isTampered: false,
                daysRemaining: 0,
                totalDays: this.trialDays,
                reason: `انتهت الفترة التجريبية المحددة بـ (${this.trialDays}) أيام. يرجى تفعيل النسخة الكاملة للمتابعة.`
            };
        }

        return {
            isTrialActive: true,
            isExpired: false,
            isTampered: false,
            daysRemaining: Math.ceil(remainingMs / (24 * 60 * 60 * 1000)),
            totalDays: this.trialDays,
            firstLaunchDate: new Date(firstLaunch).toLocaleDateString('ar-EG')
        };
    }

    verifySerial(serialKey) {
        if (!serialKey || typeof serialKey !== 'string') {
            return { valid: false, reason: 'السيريال فارغ أو غير صالح' };
        }

        const parts = serialKey.trim().split('.');
        if (parts.length !== 3 || parts[0] !== 'ARNLIC') {
            return { valid: false, reason: 'صيغة كود التفعيل غير صحيحة (يجب أن تبدأ بـ ARNLIC)' };
        }

        try {
            const b64decode = (s) => {
                let b = s.replace(/-/g, '+').replace(/_/g, '/');
                while (b.length % 4) b += '=';
                return Buffer.from(b, 'base64');
            };

            const payloadBuf = b64decode(parts[1]);
            const sigBuf = b64decode(parts[2]);

            const isVerified = crypto.verify(null, payloadBuf, this.publicKeyPem, sigBuf);
            if (!isVerified) {
                return { valid: false, reason: 'فشل التحقق الرقمي: كود التفعيل مزيف أو تم التعديل عليه' };
            }

            const payload = JSON.parse(payloadBuf.toString('utf8'));

            // HWID check
            if (payload.hwid && payload.hwid !== '*') {
                if (payload.hwid.trim().toUpperCase() !== this.hwid.trim().toUpperCase()) {
                    return {
                        valid: false,
                        reason: `كود التفعيل مخصص لجهاز آخر (${payload.hwid}) ولا يعمل على هذا الجهاز (${this.hwid})`
                    };
                }
            }

            // App check
            if (payload.appId && payload.appId !== '*') {
                if (payload.appId !== this.appId) {
                    return {
                        valid: false,
                        reason: `كود التفعيل هذا مخصص لتطبيق آخر (${payload.appId}) وليس لـ ${this.appId}`
                    };
                }
            }

            // Expiration check
            if (payload.expiresAt && Date.now() > new Date(payload.expiresAt).getTime()) {
                return {
                    valid: false,
                    reason: `انتهت صلاحية هذا الترخيص بتاريخ ${new Date(payload.expiresAt).toLocaleDateString('ar-EG')}`
                };
            }

            return { valid: true, payload };
        } catch (e) {
            return { valid: false, reason: `خطأ في فك تشفير السيريال: ${e.message}` };
        }
    }

    canRunQuick() {
        if (!this._cachedStatus) {
            this.getStatus();
        }
        return this._cachedStatus ? this._cachedStatus.canRun : true;
    }

    getStatus(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && this._cachedStatus && (now - this._lastStatusCheck < 60000)) {
            return this._cachedStatus;
        }

        const state = this.loadState(forceRefresh);
        let isLicensed = false;
        let licensePayload = null;

        if (state.activatedSerial) {
            const ver = this.verifySerial(state.activatedSerial);
            if (ver.valid) {
                isLicensed = true;
                licensePayload = ver.payload;
            } else {
                state.activatedSerial = null;
                this.saveState(state);
            }
        }

        const trial = this.checkTrial(state);
        const canRun = isLicensed || trial.isTrialActive;

        this._cachedStatus = {
            appId: this.appId,
            appName: this.appName,
            hwid: this.hwid,
            isLicensed: isLicensed,
            license: licensePayload,
            trial: trial,
            canRun: canRun,
            contact: this.contactInfo
        };
        this._lastStatusCheck = now;

        return this._cachedStatus;
    }

    activate(serialKey) {
        const ver = this.verifySerial(serialKey);
        if (!ver.valid) {
            return { success: false, message: ver.reason };
        }

        const state = this.loadState(true);
        state.activatedSerial = serialKey.trim();
        this.saveState(state);
        const status = this.getStatus(true);

        return {
            success: true,
            message: `تم تفعيل النسخة الكاملة لـ ARN Stream بنجاح باسم: ${ver.payload.client || 'عميل معتمد'}!`,
            license: ver.payload,
            status
        };
    }

    deactivate() {
        const state = this.loadState(true);
        state.activatedSerial = null;
        this.saveState(state);
        const status = this.getStatus(true);
        return { success: true, message: 'تم إرجاع الترخيص للحالة التجريبية', status };
    }
}

export const licenseService = new LicenseService();
