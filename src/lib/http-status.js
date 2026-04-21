const http = require('http');

function checkUrl(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 500, status: res.statusCode });
    });
    req.on('error', (e) => resolve({ ok: false, status: 0, error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, error: 'timeout' });
    });
  });
}

async function appsStatus(cfg) {
  const backendUrl = `http://127.0.0.1:${cfg.ports.backend}/`;
  const cocinaUrl = `http://127.0.0.1:${cfg.ports.cocina}/`;
  const metroUrl = `http://127.0.0.1:${cfg.ports.expoMetro}/`;

  const [backend, cocina, expoMetro] = await Promise.all([
    checkUrl(backendUrl),
    checkUrl(cocinaUrl),
    checkUrl(metroUrl),
  ]);

  return {
    backend: { ...backend, label: 'Backend (HTTP)' },
    cocina: { ...cocina, label: 'App cocina (HTTP)' },
    expo: { ...expoMetro, label: 'Metro/Expo (puerto configurado)' },
  };
}

module.exports = { checkUrl, appsStatus };
