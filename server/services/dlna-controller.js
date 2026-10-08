/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ARN Stream - DLNA PlayTo Controller (Digital Media Controller / DMC)
 * وحدة التحكم في الشاشات الذكية المنزلية والبث المباشر (AVTransport & RenderingControl)
 * 
 * تطوير وبرمجة: عبده رجب نصار (ARN Technology)
 * حقوق النشر (c) 2026 لشركة ARN Technology. جميع الحقوق محفوظة.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import dgram from 'dgram';
import http from 'http';
import { URL } from 'url';
import sessionManager from './session-manager.js';

// Format seconds into HH:MM:SS for UPnP REL_TIME
export function formatRelTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// Parse HH:MM:SS into seconds
export function parseRelTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.trim().split(':').map(Number);
  if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  } else if (parts.length === 2) {
    return (parts[0] * 60) + parts[1];
  }
  return 0;
}

// SSRF protection: Validate that target host is a private or local network IP
export function isPrivateOrLocalHost(hostname) {
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
  const parts = h.split('.').map(Number);
  if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
  }
  return false;
}

// Build DIDL-Lite XML for Smart TV display metadata
export function buildDidlMetadata(media, streamUrl) {
  const title = media?.title || 'ARN Stream Video';
  const type = media?.type || 'movie';
  const mime = type === 'track' ? 'audio/mpeg' : 'video/mp4';
  const upnpClass = type === 'track' ? 'object.item.audioItem.musicTrack' : 'object.item.videoItem.movie';

  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const escapedStreamUrl = String(streamUrl || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const posterTag = media?.poster
    ? `<upnp:albumArtURI xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">${String(media.poster).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</upnp:albumArtURI>`
    : '';

  const didl = `<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:sec="http://www.sec.co.kr/">` +
    `<item id="arn_media_${media?.id || '1'}" parentID="0" restricted="1">` +
    `<dc:title>${escapedTitle}</dc:title>` +
    `<upnp:class>${upnpClass}</upnp:class>` +
    posterTag +
    `<res protocolInfo="http-get:*:${mime}:DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000">${escapedStreamUrl}</res>` +
    `</item></DIDL-Lite>`;

  return didl;
}

export class DlnaController {
  constructor() {
    /**
     * Map of deviceId -> DlnaDevice
     * DlnaDevice: {
     *   id: string,
     *   udn: string,
     *   name: string,
     *   location: string,
     *   avTransportUrl: string,
     *   renderingControlUrl: string,
     *   manufacturer: string,
     *   modelName: string,
     *   lastSeen: number,
     *   isPlaying: boolean
     * }
     */
    this.devices = new Map();
    this.discoverySocket = null;
    this.searchTimer = null;
    this.activePollTimer = null;
    this.isSearching = false;
  }

  /**
   * Start SSDP Controller service to discover Smart TVs on network
   */
  startDiscovery() {
    this.stopDiscovery();

    try {
      this.discoverySocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.discoverySocket.on('error', (err) => {
        console.warn('[DLNA-Controller] Socket warning:', err.message);
      });

      this.discoverySocket.on('message', (msg) => {
        this.handleSsdpMessage(msg.toString());
      });

      this.discoverySocket.bind(0, () => {
        console.log('[DLNA-Controller] DMC discovery service active.');
        this.triggerSearch();

        // Search every 45s for newly turned-on TVs
        this.searchTimer = setInterval(() => this.triggerSearch(), 45000);

        // Position polling for active DLNA sessions every 2.5s
        this.activePollTimer = setInterval(() => this.pollActiveRenderers(), 2500);
      });
    } catch (err) {
      console.error('[DLNA-Controller] Discovery initialization failed:', err.message);
    }
  }

  /**
   * Send SSDP M-SEARCH multicast query for AVTransport renderers
   */
  triggerSearch() {
    if (!this.discoverySocket) return;

    const targets = [
      'urn:schemas-upnp-org:service:AVTransport:1',
      'urn:schemas-upnp-org:device:MediaRenderer:1'
    ];

    targets.forEach((target) => {
      const searchMsg = [
        'M-SEARCH * HTTP/1.1',
        'HOST: 239.255.255.250:1900',
        'MAN: "ssdp:discover"',
        'MX: 3',
        `ST: ${target}`,
        '',
        ''
      ].join('\r\n');

      const buf = Buffer.from(searchMsg);
      try {
        this.discoverySocket.send(buf, 0, buf.length, 1900, '239.255.255.250', () => {});
      } catch {}
    });
  }

  /**
   * Handle incoming SSDP response / notification
   */
  handleSsdpMessage(text) {
    if (!text.includes('200 OK') && !text.includes('NOTIFY')) return;

    // Check if message targets AVTransport or MediaRenderer
    const isAvTarget = text.includes('AVTransport:1') || text.includes('MediaRenderer:1');
    if (!isAvTarget) return;

    const locMatch = text.match(/LOCATION:\s*(http:\/\/[^\r\n]+)/i);
    if (!locMatch) return;

    const locationUrl = locMatch[1].trim();
    this.inspectDeviceDescription(locationUrl);
  }

  /**
   * Fetch device description XML and extract friendlyName and AVTransport control URL
   */
  async inspectDeviceDescription(locationUrl) {
    try {
      const urlObj = new URL(locationUrl);
      if (!isPrivateOrLocalHost(urlObj.hostname)) {
        return; // Prevent SSRF to external or unexpected hosts
      }
      const req = http.get(locationUrl, { timeout: 4000 }, (res) => {
        let xml = '';
        res.on('data', (chunk) => { xml += chunk; });
        res.on('end', () => {
          this.parseDeviceXml(xml, locationUrl);
        });
      });

      req.on('error', () => {});
      req.on('timeout', () => req.destroy());
    } catch {}
  }

  /**
   * Parse XML description and register device
   */
  parseDeviceXml(xml, locationUrl) {
    if (!xml || !xml.includes('urn:schemas-upnp-org:service:AVTransport:1')) return;

    const friendlyNameMatch = xml.match(/<friendlyName>([^<]+)<\/friendlyName>/i);
    const manufacturerMatch = xml.match(/<manufacturer>([^<]+)<\/manufacturer>/i);
    const modelNameMatch = xml.match(/<modelName>([^<]+)<\/modelName>/i);
    const udnMatch = xml.match(/<UDN>uuid:([^<]+)<\/UDN>/i) || xml.match(/<UDN>([^<]+)<\/UDN>/i);

    const friendlyName = friendlyNameMatch ? friendlyNameMatch[1].trim() : 'Smart TV (DLNA)';
    const manufacturer = manufacturerMatch ? manufacturerMatch[1].trim() : '';
    const modelName = modelNameMatch ? modelNameMatch[1].trim() : '';
    const rawUdn = udnMatch ? udnMatch[1].trim() : locationUrl;
    const cleanUdn = rawUdn.replace(/^uuid:/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');

    // Extract AVTransport service block
    const avServiceMatch = xml.match(/<service>[\s\S]*?<serviceType>urn:schemas-upnp-org:service:AVTransport:1<\/serviceType>[\s\S]*?<\/service>/i);
    if (!avServiceMatch) return;

    const avControlMatch = avServiceMatch[0].match(/<controlURL>([^<]+)<\/controlURL>/i);
    if (!avControlMatch) return;

    const baseObj = new URL(locationUrl);
    const avTransportUrl = new URL(avControlMatch[1].trim(), baseObj).toString();

    // Extract RenderingControl service block (for volume/mute)
    let renderingControlUrl = null;
    const rcServiceMatch = xml.match(/<service>[\s\S]*?<serviceType>urn:schemas-upnp-org:service:RenderingControl:1<\/serviceType>[\s\S]*?<\/service>/i);
    if (rcServiceMatch) {
      const rcControlMatch = rcServiceMatch[0].match(/<controlURL>([^<]+)<\/controlURL>/i);
      if (rcControlMatch) {
        renderingControlUrl = new URL(rcControlMatch[1].trim(), baseObj).toString();
      }
    }

    const deviceId = `dlna_${cleanUdn}`;
    const device = {
      id: deviceId,
      udn: cleanUdn,
      name: friendlyName,
      location: locationUrl,
      avTransportUrl,
      renderingControlUrl,
      manufacturer,
      modelName,
      lastSeen: Date.now(),
      isPlaying: false
    };

    this.devices.set(deviceId, device);

    // Register with sessionManager so it appears immediately in /devices
    sessionManager.registerSession({
      deviceId,
      name: friendlyName,
      type: 'dlna_renderer',
      isDlna: true,
      dlnaControlUrl: avTransportUrl,
      userId: 'system',
      userName: 'DLNA',
      userDisplayName: manufacturer ? `${friendlyName} (${manufacturer})` : friendlyName,
      capabilities: {
        PlayableMediaTypes: ['video', 'audio'],
        SupportedCommands: ['play', 'pause', 'stop', 'seek', 'seek_delta', 'volume', 'mute', 'transfer'],
        SupportsRemoteControl: true
      }
    });
  }

  /**
   * Send UPnP SOAP Action via HTTP POST
   */
  sendSoapAction(endpointUrl, serviceType, actionName, args = {}) {
    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(endpointUrl);
        const actionUrn = `"${serviceType}#${actionName}"`;

        let argsXml = '';
        for (const [k, v] of Object.entries(args)) {
          const escapedVal = String(v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
          argsXml += `<${k}>${escapedVal}</${k}>`;
        }

        const soapBody =
          `<?xml version="1.0" encoding="utf-8"?>` +
          `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">` +
          `<s:Body>` +
          `<u:${actionName} xmlns:u="${serviceType}">` +
          argsXml +
          `</u:${actionName}>` +
          `</s:Body>` +
          `</s:Envelope>`;

        const postData = Buffer.from(soapBody, 'utf-8');

        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || 80,
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset="utf-8"',
            'SOAPAction': actionUrn,
            'Content-Length': postData.length,
            'Connection': 'close',
            'User-Agent': 'ARN-Stream/2.0 DLNA-DMC UPnP/1.0'
          },
          timeout: 5000
        };

        const req = http.request(options, (res) => {
          let resXml = '';
          res.on('data', (c) => { resXml += c; });
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, xml: resXml });
            } else {
              console.warn(`[DLNA-SOAP] ${actionName} failed with HTTP ${res.statusCode}:`, resXml.slice(0, 200));
              resolve({ success: false, statusCode: res.statusCode, xml: resXml });
            }
          });
        });

        req.on('error', (err) => {
          console.warn(`[DLNA-SOAP] Request error ${actionName}:`, err.message);
          resolve({ success: false, error: err.message });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({ success: false, error: 'Timeout' });
        });

        req.write(postData);
        req.end();
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  }

  /**
   * DLNA PlayTo Action: Set media URL on Smart TV and begin playing
   */
  async playToDevice(deviceId, mediaUrl, mediaInfo = {}, startTime = 0) {
    const dev = this.devices.get(deviceId);
    if (!dev) return { success: false, message: 'DLNA device not found' };

    const avUrl = dev.avTransportUrl;
    const metadataXml = buildDidlMetadata(mediaInfo, mediaUrl);

    // 1. Stop any currently playing media
    await this.sendSoapAction(avUrl, 'urn:schemas-upnp-org:service:AVTransport:1', 'Stop', {
      InstanceID: 0
    });

    // 2. SetAVTransportURI
    const setRes = await this.sendSoapAction(avUrl, 'urn:schemas-upnp-org:service:AVTransport:1', 'SetAVTransportURI', {
      InstanceID: 0,
      CurrentURI: mediaUrl,
      CurrentURIMetaData: metadataXml
    });

    if (!setRes.success) {
      console.warn(`[DLNA] Failed to set AVTransport URI on ${dev.name}`);
      return setRes;
    }

    // 3. Play
    const playRes = await this.sendSoapAction(avUrl, 'urn:schemas-upnp-org:service:AVTransport:1', 'Play', {
      InstanceID: 0,
      Speed: '1'
    });

    // 4. If starting with an offset, seek immediately
    if (startTime > 0) {
      setTimeout(() => {
        this.seek(deviceId, startTime);
      }, 800);
    }

    dev.isPlaying = true;

    // Update in sessionManager
    sessionManager.updatePlaybackState(deviceId, {
      isPlaying: true,
      currentTime: startTime || 0,
      duration: mediaInfo?.duration || 0,
      media: {
        id: mediaInfo?.id,
        title: mediaInfo?.title,
        type: mediaInfo?.type,
        poster: mediaInfo?.poster,
        duration: mediaInfo?.duration || 0
      }
    });

    return playRes;
  }

  /**
   * DLNA Resume Play
   */
  async play(deviceId) {
    const dev = this.devices.get(deviceId);
    if (!dev) return false;
    dev.isPlaying = true;
    sessionManager.updatePlaybackState(deviceId, { isPlaying: true });
    return this.sendSoapAction(dev.avTransportUrl, 'urn:schemas-upnp-org:service:AVTransport:1', 'Play', {
      InstanceID: 0,
      Speed: '1'
    });
  }

  /**
   * DLNA Pause
   */
  async pause(deviceId) {
    const dev = this.devices.get(deviceId);
    if (!dev) return false;
    dev.isPlaying = false;
    sessionManager.updatePlaybackState(deviceId, { isPlaying: false });
    return this.sendSoapAction(dev.avTransportUrl, 'urn:schemas-upnp-org:service:AVTransport:1', 'Pause', {
      InstanceID: 0
    });
  }

  /**
   * DLNA Stop
   */
  async stop(deviceId) {
    const dev = this.devices.get(deviceId);
    if (!dev) return false;
    dev.isPlaying = false;
    sessionManager.updatePlaybackState(deviceId, { isPlaying: false, currentTime: 0 });
    return this.sendSoapAction(dev.avTransportUrl, 'urn:schemas-upnp-org:service:AVTransport:1', 'Stop', {
      InstanceID: 0
    });
  }

  /**
   * DLNA Seek
   */
  async seek(deviceId, seconds) {
    const dev = this.devices.get(deviceId);
    if (!dev) return false;
    const targetRelTime = formatRelTime(seconds);
    sessionManager.updatePlaybackState(deviceId, { currentTime: seconds });
    return this.sendSoapAction(dev.avTransportUrl, 'urn:schemas-upnp-org:service:AVTransport:1', 'Seek', {
      InstanceID: 0,
      Unit: 'REL_TIME',
      Target: targetRelTime
    });
  }

  /**
   * DLNA Set Volume (0 to 1)
   */
  async setVolume(deviceId, volumeValue) {
    const dev = this.devices.get(deviceId);
    if (!dev || !dev.renderingControlUrl) return false;
    const volPercent = Math.round(Math.max(0, Math.min(1, volumeValue)) * 100);
    sessionManager.updatePlaybackState(deviceId, { volume: volumeValue, isMuted: false });
    return this.sendSoapAction(dev.renderingControlUrl, 'urn:schemas-upnp-org:service:RenderingControl:1', 'SetVolume', {
      InstanceID: 0,
      Channel: 'Master',
      DesiredVolume: volPercent
    });
  }

  /**
   * DLNA Set Mute
   */
  async setMute(deviceId, isMuted) {
    const dev = this.devices.get(deviceId);
    if (!dev || !dev.renderingControlUrl) return false;
    sessionManager.updatePlaybackState(deviceId, { isMuted: Boolean(isMuted) });
    return this.sendSoapAction(dev.renderingControlUrl, 'urn:schemas-upnp-org:service:RenderingControl:1', 'SetMute', {
      InstanceID: 0,
      Channel: 'Master',
      DesiredMute: isMuted ? 1 : 0
    });
  }

  /**
   * Query DLNA TV current position & duration to sync with phone/PC controller
   */
  async pollPosition(deviceId) {
    const dev = this.devices.get(deviceId);
    if (!dev) return null;

    const res = await this.sendSoapAction(dev.avTransportUrl, 'urn:schemas-upnp-org:service:AVTransport:1', 'GetPositionInfo', {
      InstanceID: 0
    });

    if (res.success && res.xml) {
      const trackDurMatch = res.xml.match(/<TrackDuration>([^<]+)<\/TrackDuration>/i);
      const relTimeMatch = res.xml.match(/<RelTime>([^<]+)<\/RelTime>/i);

      if (relTimeMatch) {
        const curSec = parseRelTime(relTimeMatch[1]);
        const durSec = trackDurMatch ? parseRelTime(trackDurMatch[1]) : 0;

        sessionManager.updatePlaybackState(deviceId, {
          currentTime: curSec,
          ...(durSec > 0 ? { duration: durSec } : {})
        });

        return { currentTime: curSec, duration: durSec };
      }
    }
    return null;
  }

  /**
   * Background polling for active DLNA playback sessions
   */
  pollActiveRenderers() {
    for (const [id, dev] of this.devices.entries()) {
      if (dev.isPlaying) {
        this.pollPosition(id).catch(() => {});
      }
    }
  }

  stopDiscovery() {
    if (this.searchTimer) {
      clearInterval(this.searchTimer);
      this.searchTimer = null;
    }
    if (this.activePollTimer) {
      clearInterval(this.activePollTimer);
      this.activePollTimer = null;
    }
    if (this.discoverySocket) {
      try { this.discoverySocket.close(); } catch {}
      this.discoverySocket = null;
    }
  }
}

// Global Singleton Instance
export const dlnaController = new DlnaController();
export default dlnaController;
