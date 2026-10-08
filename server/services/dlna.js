import dgram from 'dgram';
import os from 'os';
import db, { getSetting } from '../db.js';

let ssdpServer = null;
let notifyInterval = null;

export function getLocalIpAddress() {
  const nets = os.networkInterfaces();
  let validIps = [];

  for (const name of Object.keys(nets)) {
    // Ignore common virtual/VPN interfaces
    const n = name.toLowerCase();
    if (n.includes('virtualbox') || n.includes('vmware') || n.includes('vbox') || n.includes('wsl') || n.includes('hyper-v') || n.includes('tailscale') || n.includes('zerotier')) {
      continue;
    }

    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        validIps.push({ name, address: net.address });
      }
    }
  }

  if (validIps.length > 0) {
    // Try to find Wi-Fi or Ethernet first
    const preferred = validIps.find(ip => ip.name.toLowerCase().includes('wi-fi') || ip.name.toLowerCase().includes('ethernet') || ip.name.toLowerCase().includes('wlan') || ip.name.toLowerCase().includes('eth'));
    if (preferred) return preferred.address;
    return validIps[0].address;
  }
  
  return '127.0.0.1';
}

const SERVER_UUID = '37a911f6-d703-4f51-b844-934c9c10f81d';

export function getDeviceXml(host, port) {
  return `<?xml version="1.0" encoding="utf-8"?>
<root xmlns="urn:schemas-upnp-org:device-1-0">
  <specVersion>
    <major>1</major>
    <minor>0</minor>
  </specVersion>
  <device>
    <deviceType>urn:schemas-upnp-org:device:MediaServer:1</deviceType>
    <friendlyName>PersonalStream (${host})</friendlyName>
    <manufacturer>PersonalStream</manufacturer>
    <manufacturerURL>http://${host}:${port}</manufacturerURL>
    <modelDescription>PersonalStream Media Server with DLNA</modelDescription>
    <modelName>PersonalStream</modelName>
    <modelNumber>1.0</modelNumber>
    <UDN>uuid:${SERVER_UUID}</UDN>
    <serviceList>
      <service>
        <serviceType>urn:schemas-upnp-org:service:ContentDirectory:1</serviceType>
        <serviceId>urn:upnp-org:serviceId:ContentDirectory</serviceId>
        <SCPDURL>/dlna/ContentDirectory.xml</SCPDURL>
        <controlURL>/dlna/control/ContentDirectory</controlURL>
        <eventSubURL>/dlna/event/ContentDirectory</eventSubURL>
      </service>
      <service>
        <serviceType>urn:schemas-upnp-org:service:ConnectionManager:1</serviceType>
        <serviceId>urn:upnp-org:serviceId:ConnectionManager</serviceId>
        <SCPDURL>/dlna/ConnectionManager.xml</SCPDURL>
        <controlURL>/dlna/control/ConnectionManager</controlURL>
        <eventSubURL>/dlna/event/ConnectionManager</eventSubURL>
      </service>
    </serviceList>
  </device>
</root>`;
}

export function getContentDirectoryXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<scpd xmlns="urn:schemas-upnp-org:service-1-0">
  <specVersion><major>1</major><minor>0</minor></specVersion>
  <actionList>
    <action>
      <name>GetSearchCapabilities</name>
      <argumentList>
        <argument><name>SearchCaps</name><direction>out</direction><relatedStateVariable>SearchCapabilities</relatedStateVariable></argument>
      </argumentList>
    </action>
    <action>
      <name>GetSortCapabilities</name>
      <argumentList>
        <argument><name>SortCaps</name><direction>out</direction><relatedStateVariable>SortCapabilities</relatedStateVariable></argument>
      </argumentList>
    </action>
    <action>
      <name>GetSystemUpdateID</name>
      <argumentList>
        <argument><name>Id</name><direction>out</direction><relatedStateVariable>SystemUpdateID</relatedStateVariable></argument>
      </argumentList>
    </action>
    <action>
      <name>Browse</name>
      <argumentList>
        <argument><name>ObjectID</name><direction>in</direction><relatedStateVariable>A_ARG_TYPE_ObjectID</relatedStateVariable></argument>
        <argument><name>BrowseFlag</name><direction>in</direction><relatedStateVariable>A_ARG_TYPE_BrowseFlag</relatedStateVariable></argument>
        <argument><name>Filter</name><direction>in</direction><relatedStateVariable>A_ARG_TYPE_Filter</relatedStateVariable></argument>
        <argument><name>StartingIndex</name><direction>in</direction><relatedStateVariable>A_ARG_TYPE_Index</relatedStateVariable></argument>
        <argument><name>RequestedCount</name><direction>in</direction><relatedStateVariable>A_ARG_TYPE_Count</relatedStateVariable></argument>
        <argument><name>SortCriteria</name><direction>in</direction><relatedStateVariable>A_ARG_TYPE_SortCriteria</relatedStateVariable></argument>
        <argument><name>Result</name><direction>out</direction><relatedStateVariable>A_ARG_TYPE_Result</relatedStateVariable></argument>
        <argument><name>NumberReturned</name><direction>out</direction><relatedStateVariable>A_ARG_TYPE_Count</relatedStateVariable></argument>
        <argument><name>TotalMatches</name><direction>out</direction><relatedStateVariable>A_ARG_TYPE_Count</relatedStateVariable></argument>
        <argument><name>UpdateID</name><direction>out</direction><relatedStateVariable>A_ARG_TYPE_UpdateID</relatedStateVariable></argument>
      </argumentList>
    </action>
  </actionList>
  <serviceStateTable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_ObjectID</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_Result</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>SearchCapabilities</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>SortCapabilities</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="yes"><name>SystemUpdateID</name><dataType>ui4</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_Count</name><dataType>ui4</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_SortCriteria</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_Filter</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_UpdateID</name><dataType>ui4</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_BrowseFlag</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_Index</name><dataType>ui4</dataType></stateVariable>
  </serviceStateTable>
</scpd>`;
}

export function getConnectionManagerXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<scpd xmlns="urn:schemas-upnp-org:service-1-0">
  <specVersion><major>1</major><minor>0</minor></specVersion>
  <actionList>
    <action>
      <name>GetProtocolInfo</name>
      <argumentList>
        <argument><name>Source</name><direction>out</direction><relatedStateVariable>SourceProtocolInfo</relatedStateVariable></argument>
        <argument><name>Sink</name><direction>out</direction><relatedStateVariable>SinkProtocolInfo</relatedStateVariable></argument>
      </argumentList>
    </action>
  </actionList>
  <serviceStateTable>
    <stateVariable sendEvents="yes"><name>SourceProtocolInfo</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="yes"><name>SinkProtocolInfo</name><dataType>string</dataType></stateVariable>
  </serviceStateTable>
</scpd>`;
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function handleBrowse(objectId, host, port) {
  const baseHttp = `http://${host}:${port}`;
  let items = [];

  if (objectId === '0' || !objectId) {
    // Root containers
    items.push(
      `<container id="movies" parentID="0" restricted="1" searchable="0"><dc:title>الأفلام (Movies)</dc:title><upnp:class>object.container.storageFolder</upnp:class></container>`,
      `<container id="series" parentID="0" restricted="1" searchable="0"><dc:title>المسلسلات (Series)</dc:title><upnp:class>object.container.storageFolder</upnp:class></container>`,
      `<container id="music" parentID="0" restricted="1" searchable="0"><dc:title>الموسيقى (Music)</dc:title><upnp:class>object.container.storageFolder</upnp:class></container>`
    );
  } else if (objectId === 'movies') {
    const movies = db.prepare('SELECT * FROM movies ORDER BY added_at DESC LIMIT 500').all();
    for (const m of movies) {
      const title = escapeXml(m.title + (m.year ? ` (${m.year})` : ''));
      items.push(
        `<item id="movie-${m.id}" parentID="movies" restricted="1">` +
        `<dc:title>${title}</dc:title>` +
        `<upnp:class>object.item.videoItem.movie</upnp:class>` +
        `<res protocolInfo="http-get:*:video/mp4:*">${baseHttp}/api/stream/movie/${m.id}</res>` +
        `</item>`
      );
    }
  } else if (objectId === 'series') {
    const series = db.prepare(`
      SELECT series.* FROM series 
      WHERE EXISTS (SELECT 1 FROM seasons JOIN episodes ON episodes.season_id = seasons.id WHERE seasons.series_id = series.id)
      ORDER BY title ASC LIMIT 500
    `).all();
    for (const s of series) {
      items.push(
        `<container id="series-${s.id}" parentID="series" restricted="1" searchable="0">` +
        `<dc:title>${escapeXml(s.title)}</dc:title>` +
        `<upnp:class>object.container.storageFolder</upnp:class>` +
        `</container>`
      );
    }
  } else if (objectId.startsWith('series-')) {
    const sId = objectId.replace('series-', '');
    const episodes = db.prepare(`
      SELECT episodes.*, seasons.season_number 
      FROM episodes 
      JOIN seasons ON seasons.id = episodes.season_id 
      WHERE seasons.series_id = ? 
      ORDER BY seasons.season_number, episodes.episode_number
    `).all(sId);
    for (const ep of episodes) {
      const epTitle = escapeXml(`S${ep.season_number} E${ep.episode_number} - ${ep.title}`);
      items.push(
        `<item id="ep-${ep.id}" parentID="${objectId}" restricted="1">` +
        `<dc:title>${epTitle}</dc:title>` +
        `<upnp:class>object.item.videoItem</upnp:class>` +
        `<res protocolInfo="http-get:*:video/mp4:*">${baseHttp}/api/stream/episode/${ep.id}</res>` +
        `</item>`
      );
    }
  } else if (objectId === 'music') {
    const artists = db.prepare('SELECT * FROM artists ORDER BY name ASC LIMIT 500').all();
    for (const a of artists) {
      items.push(
        `<container id="artist-${a.id}" parentID="music" restricted="1" searchable="0">` +
        `<dc:title>${escapeXml(a.name)}</dc:title>` +
        `<upnp:class>object.container.person.musicArtist</upnp:class>` +
        `</container>`
      );
    }
  } else if (objectId.startsWith('artist-')) {
    const aId = objectId.replace('artist-', '');
    const tracks = db.prepare(`
      SELECT tracks.*, albums.title as albumTitle 
      FROM tracks 
      JOIN albums ON albums.id = tracks.album_id 
      WHERE albums.artist_id = ? 
      ORDER BY tracks.title ASC
    `).all(aId);
    for (const tr of tracks) {
      const trTitle = escapeXml(tr.title);
      items.push(
        `<item id="track-${tr.id}" parentID="${objectId}" restricted="1">` +
        `<dc:title>${trTitle}</dc:title>` +
        `<upnp:class>object.item.audioItem.musicTrack</upnp:class>` +
        `<res protocolInfo="http-get:*:audio/mpeg:*">${baseHttp}/api/stream/track/${tr.id}</res>` +
        `</item>`
      );
    }
  }

  const didl = `<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">${items.join('')}</DIDL-Lite>`;

  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:BrowseResponse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1">
      <Result>${escapeXml(didl)}</Result>
      <NumberReturned>${items.length}</NumberReturned>
      <TotalMatches>${items.length}</TotalMatches>
      <UpdateID>1</UpdateID>
    </u:BrowseResponse>
  </s:Body>
</s:Envelope>`;
}

export function startDlna(port = 8096) {
  stopDlna();
  const host = getLocalIpAddress();

  try {
    ssdpServer = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    ssdpServer.on('error', (err) => {
      console.warn('[DLNA/SSDP] Socket warning:', err.message);
    });

    ssdpServer.on('message', (msg, rinfo) => {
      const text = msg.toString();
      if (text.startsWith('M-SEARCH')) {
        const isTarget =
          text.includes('ssdp:all') ||
          text.includes('upnp:rootdevice') ||
          text.includes('urn:schemas-upnp-org:device:MediaServer:1') ||
          text.includes('urn:schemas-upnp-org:service:ContentDirectory:1');

        if (isTarget) {
          const response = [
            'HTTP/1.1 200 OK',
            'CACHE-CONTROL: max-age=1800',
            `DATE: ${new Date().toUTCString()}`,
            'EXT:',
            `LOCATION: http://${host}:${port}/dlna/device.xml`,
            'SERVER: Windows/10 UPnP/1.0 PersonalStream/1.0',
            'ST: urn:schemas-upnp-org:device:MediaServer:1',
            `USN: uuid:${SERVER_UUID}::urn:schemas-upnp-org:device:MediaServer:1`,
            '',
            ''
          ].join('\r\n');

          const buf = Buffer.from(response);
          ssdpServer.send(buf, 0, buf.length, rinfo.port, rinfo.address, () => {});
        }
      }
    });

    ssdpServer.bind(1900, () => {
      try {
        ssdpServer.addMembership('239.255.255.250');
        console.log(`[DLNA] SSDP service listening on 239.255.255.250:1900 (${host}:${port})`);
      } catch (err) {
        console.warn('[DLNA] Multicast membership notice:', err.message);
      }
    });

    // Notify alive every 3 minutes
    const sendNotify = () => {
      if (!ssdpServer) return;
      const notifyMsg = [
        'NOTIFY * HTTP/1.1',
        'HOST: 239.255.255.250:1900',
        'CACHE-CONTROL: max-age=1800',
        `LOCATION: http://${host}:${port}/dlna/device.xml`,
        'NT: urn:schemas-upnp-org:device:MediaServer:1',
        'NTS: ssdp:alive',
        'SERVER: Windows/10 UPnP/1.0 PersonalStream/1.0',
        `USN: uuid:${SERVER_UUID}::urn:schemas-upnp-org:device:MediaServer:1`,
        '',
        ''
      ].join('\r\n');
      const buf = Buffer.from(notifyMsg);
      ssdpServer.send(buf, 0, buf.length, 1900, '239.255.255.250', () => {});
    };

    notifyInterval = setInterval(sendNotify, 180000);
    sendNotify();
  } catch (err) {
    console.error('[DLNA] Failed to start DLNA service:', err.message);
  }
}

export function stopDlna() {
  if (notifyInterval) {
    clearInterval(notifyInterval);
    notifyInterval = null;
  }
  if (ssdpServer) {
    try {
      ssdpServer.close();
    } catch {}
    ssdpServer = null;
  }
}
