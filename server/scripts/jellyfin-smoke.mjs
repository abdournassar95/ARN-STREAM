import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

const realAppData = process.env.APPDATA;
const realDb = path.join(realAppData, 'ARN_Stream', 'data', 'media.db');
const testRoot = path.join(os.tmpdir(), 'arn-jf-test');
const testData = path.join(testRoot, 'ARN_Stream', 'data');

fs.rmSync(testRoot, { recursive: true, force: true });
fs.mkdirSync(testData, { recursive: true });

const source = new Database(realDb, { readonly: true });
await source.backup(path.join(testData, 'media.db'));
source.close();

process.env.APPDATA = testRoot;

const express = (await import('express')).default;
const bcrypt = (await import('bcryptjs')).default;
const router = (await import('../routes/jellyfin/router.js')).default;
const apiStreamRouter = (await import('../routes/stream.js')).default;
const db = (await import('../db.js')).default;

const passwordHash = await bcrypt.hash('testpass', 4);
db.prepare(`
  INSERT OR REPLACE INTO users (id, username, password_hash, display_name, role, is_active, show_on_login, can_download, can_cast)
  VALUES (99999, 'jftest', ?, 'JF Test', 'admin', 1, 1, 1, 1)
`).run(passwordHash);

const app = express();
app.use(express.json());
app.use(router);
app.use('/api/stream', apiStreamRouter);

const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

let failures = 0;
function check(name, condition, detail) {
  if (condition) {
    console.log(`PASS ${name}`);
  } else {
    failures++;
    console.log(`FAIL ${name} ${detail === undefined ? '' : JSON.stringify(detail).slice(0, 500)}`);
  }
}

async function json(pathname, options = {}) {
  const response = await fetch(base + pathname, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

const publicInfo = await json('/System/Info/Public');
check('System/Info/Public', publicInfo.response.ok && publicInfo.body.Version === '10.11.0', publicInfo.body);

const publicUsers = await json('/Users/Public');
check('Users/Public', publicUsers.response.ok && Array.isArray(publicUsers.body), publicUsers.body);

const lowercaseUsers = await json('/users/public');
check('users/public lowercase', lowercaseUsers.response.ok && Array.isArray(lowercaseUsers.body), lowercaseUsers.body);

const login = await json('/Users/AuthenticateByName', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: 'MediaBrowser Client="Smoke", Device="Node", DeviceId="smoke", Version="1.0"'
  },
  body: JSON.stringify({ Username: 'jftest', Pw: 'testpass' })
});
check('AuthenticateByName', login.response.ok && Boolean(login.body.AccessToken), login.body);
const token = login.body.AccessToken;
const userId = login.body.User && login.body.User.Id;
const authHeaders = { authorization: `MediaBrowser Token="${token}"` };

const views = await json('/UserViews', { headers: authHeaders });
check('UserViews', views.response.ok && views.body.Items.length > 0, views.body);
const libraryId = views.body.Items[0] && views.body.Items[0].Id;

const libraryItems = await json(
  `/Users/${userId}/Items?ParentId=${libraryId}&Limit=5&SortBy=SortName&SortOrder=Ascending&Fields=PrimaryImageAspectRatio`,
  { headers: authHeaders }
);
check('Library items', libraryItems.response.ok && Array.isArray(libraryItems.body.Items), libraryItems.body);
console.log('  library item count:', libraryItems.body.TotalRecordCount, 'sample:', libraryItems.body.Items.slice(0, 3).map((item) => `${item.Type}:${item.Name}`));

const latest = await json(`/Users/${userId}/Items/Latest?ParentId=${libraryId}&Limit=5`, { headers: authHeaders });
check('Latest items', latest.response.ok && Array.isArray(latest.body), latest.body);

const resume = await json(`/Users/${userId}/Items/Resume?Limit=5`, { headers: authHeaders });
check('Resume items', resume.response.ok && Array.isArray(resume.body.Items), resume.body);

const nextUp = await json('/Shows/NextUp?Limit=5', { headers: authHeaders });
check('NextUp', nextUp.response.ok && Array.isArray(nextUp.body.Items), nextUp.body);

const item = libraryItems.body.Items[0];
if (item) {
  const details = await json(`/Items/${item.Id}`, { headers: authHeaders });
  check('Item details', details.response.ok && details.body.Id === item.Id, details.body);

  const userDetails = await json(`/Users/${userId}/Items/${item.Id}`, { headers: authHeaders });
  check('SDK user item details', userDetails.response.ok && userDetails.body.Id === item.Id, userDetails.body);

  const playbackInfo = await json(`/Items/${item.Id}/PlaybackInfo?UserId=${userId}`, { headers: authHeaders });
  const sourceInfo = playbackInfo.body && playbackInfo.body.MediaSources && playbackInfo.body.MediaSources[0];
  check(
    'PlaybackInfo',
    playbackInfo.response.ok && Boolean(sourceInfo) && Boolean(sourceInfo.Path) && Array.isArray(sourceInfo.RequiredHttpHeaders),
    playbackInfo.body
  );
  if (sourceInfo && sourceInfo.TranscodingUrl) {
    check('PlaybackInfo URL form', sourceInfo.TranscodingUrl.startsWith('/api/stream/'), sourceInfo.TranscodingUrl);
  }

  const image = await fetch(`${base}/Items/${item.Id}/Images/Primary`, { redirect: 'manual' });
  check('Image endpoint', image.status === 302 || image.status === 404, image.status);

  const favorite = await json(`/UserFavoriteItems/${item.Id}`, { method: 'POST', headers: authHeaders });
  check('Favorite add', favorite.response.ok && favorite.body.IsFavorite === true, favorite.body);
  const unfavorite = await json(`/UserFavoriteItems/${item.Id}`, { method: 'DELETE', headers: authHeaders });
  check('Favorite remove', unfavorite.response.ok && unfavorite.body.IsFavorite === false, unfavorite.body);
}

const progress = await json('/Sessions/Playing/Progress', {
  method: 'POST',
  headers: { ...authHeaders, 'content-type': 'application/json' },
  body: JSON.stringify({
    ItemId: item && item.Id,
    PositionTicks: 10000000,
    PlaySessionId: 'smoke-session'
  })
});
check('Progress report', progress.response.status === 204, progress.response.status);

const prefs = await json('/DisplayPreferences/smoke', { headers: authHeaders });
check('Display preferences', prefs.response.ok && prefs.body.Id === 'smoke', prefs.body);

const endpoint = await json('/System/Endpoint', { headers: authHeaders });
check('System endpoint', endpoint.response.ok && endpoint.body.IsInNetwork === true, endpoint.body);

const unauthorized = await json('/Users');
check('Protected endpoint rejects anonymous', unauthorized.response.status === 401, unauthorized.response.status);

const trackRow = db.prepare('SELECT * FROM tracks LIMIT 200').all().find((row) => row.path && fs.existsSync(row.path));
if (trackRow) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const streamResponse = await fetch(
      `${base}/Audio/tr_${trackRow.id}/universal?ApiKey=${encodeURIComponent(token)}`,
      { headers: { Range: 'bytes=0-1023' }, signal: controller.signal }
    );
    check(
      'Audio stream proxy',
      streamResponse.status === 206
      && String(streamResponse.headers.get('content-range') || '').startsWith('bytes 0-1023/')
      && Number(streamResponse.headers.get('content-length')) === 1024,
      {
        status: streamResponse.status,
        contentRange: streamResponse.headers.get('content-range'),
        contentLength: streamResponse.headers.get('content-length'),
        contentType: streamResponse.headers.get('content-type')
      }
    );
    if (streamResponse.body) await streamResponse.body.cancel();
  } catch (error) {
    check('Audio stream proxy', false, error.message);
  } finally {
    clearTimeout(timer);
  }
} else {
  console.log('SKIP Audio stream proxy (no readable track in test database)');
}

server.close();
db.close();
console.log(failures === 0 ? 'ALL PASSED' : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
