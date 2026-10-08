const { execSync } = require('child_process');

const PORTS = [8096, 5173];

function freePortWindows(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const lines = output.trim().split('\n');
    const pids = new Set();

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const stateOrPid = parts[parts.length - 1];
      const pid = parseInt(stateOrPid, 10);
      if (pid && pid > 0 && pid !== process.pid) {
        pids.add(pid);
      }
    }

    for (const pid of pids) {
      console.log(`[Dev Init] 🔄 جارٍ تحرير المنفذ ${port} من العملية السابقة (PID: ${pid})...`);
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      } catch {}
    }
  } catch {
    // Port is free, nothing to kill
  }
}

if (process.platform === 'win32') {
  for (const port of PORTS) {
    freePortWindows(port);
  }
}
