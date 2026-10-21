import crypto from 'crypto';

const KEEP_ALIVE_SECONDS = 30;

function safeSend(ws, payload) {
  if (ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {}
}

export function handleJellyfinSocketConnection(ws, req) {
  ws.isAlive = true;
  ws.id = crypto.randomUUID();
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  safeSend(ws, {
    MessageType: 'ForceKeepAlive',
    Data: KEEP_ALIVE_SECONDS
  });

  const timer = setInterval(() => {
    if (ws.isAlive === false) {
      clearInterval(timer);
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      clearInterval(timer);
      return;
    }
    safeSend(ws, {
      MessageType: 'KeepAlive',
      Data: KEEP_ALIVE_SECONDS
    });
  }, KEEP_ALIVE_SECONDS * 1000);

  ws.on('message', (raw) => {
    ws.isAlive = true;
    let message = null;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (!message || typeof message !== 'object') return;

    if (message.MessageType === 'KeepAlive') {
      safeSend(ws, { MessageType: 'KeepAlive', Data: KEEP_ALIVE_SECONDS });
    } else if (message.MessageType === 'SessionsStart') {
      safeSend(ws, { MessageType: 'Sessions', Data: [] });
    }
  });

  ws.on('close', () => {
    clearInterval(timer);
  });

  ws.on('error', () => {
    clearInterval(timer);
  });
}
