/**
 * Dev bootstrap: frees ports 8096/5173 on Windows before starting the dev stack.
 *
 * Safety: only processes whose image name is node.exe / ARN_Stream.exe are
 * terminated — never an unrelated application that happens to use the port.
 */
const { execSync } = require('child_process');

const PORTS = [8096, 5173];
const KILLABLE_IMAGES = new Set(['node.exe', 'arn_stream.exe', 'nodemon.exe', 'electron.exe']);

function listListeningPids(port) {
  try {
    const output = execSync(`netstat -ano -p tcp | findstr :${port}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const pids = new Set();
    for (const line of output.split('\n')) {
      const parts = line.trim().split(/\s+/);
      const pid = parseInt(parts[parts.length - 1], 10);
      if (Number.isFinite(pid) && pid > 0 && pid !== process.pid) pids.add(pid);
    }
    return pids;
  } catch {
    return new Set(); // port is free
  }
}

function imageNameFor(pid) {
  try {
    const csv = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    const match = csv.match(/^"([^"]+)"/);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function freePort(port) {
  for (const pid of listListeningPids(port)) {
    const image = imageNameFor(pid);
    if (!image || !KILLABLE_IMAGES.has(image)) {
      console.log(`[Dev Init] ⚠️ المنفذ ${port} مشغول بالعملية ${image || pid} — تم تجاهلها (ليست عملية ARN/Node).`);
      continue;
    }
    console.log(`[Dev Init] 🔄 تحرير المنفذ ${port} من ${image} (PID: ${pid})...`);
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
    } catch {}
  }
}

if (process.platform === 'win32') {
  try {
    execSync('taskkill /F /IM ARN_Stream.exe', { stdio: 'ignore' });
  } catch {}
  PORTS.forEach(freePort);
}
