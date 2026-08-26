const os = require('os');

const SKIP_IFACE = /virtual|vethernet|vmware|vbox|hyper-?v|docker|wsl|loopback|bluetooth|vpn|zerotier|pseudo/i;

function isLanIPv4(addr) {
  if (!addr || addr === '127.0.0.1' || addr.startsWith('169.254.')) return false;
  const parts = addr.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

function scoreAddress(name, addr) {
  let s = 0;
  if (/wi-?fi|wlan|wireless/i.test(name)) s += 30;
  if (/ethernet|eth|lan/i.test(name)) s += 40;
  if (addr.startsWith('192.168.')) s += 20;
  else if (addr.startsWith('10.')) s += 10;
  else if (addr.startsWith('172.')) s += 5;
  return s;
}

/**
 * IPv4 LAN de esta PC (la que deben usar tablets/mozos para hablar con el backend).
 * Si no hay red, cae a 127.0.0.1.
 */
function getLanIPv4() {
  const nets = os.networkInterfaces() || {};
  const found = [];
  for (const [name, list] of Object.entries(nets)) {
    if (SKIP_IFACE.test(name || '')) continue;
    for (const net of list || []) {
      const family = net.family;
      if (family !== 'IPv4' && family !== 4) continue;
      if (net.internal) continue;
      const addr = net.address;
      if (!isLanIPv4(addr)) continue;
      found.push({ name, addr, score: scoreAddress(name, addr) });
    }
  }
  found.sort((a, b) => b.score - a.score);
  return found[0]?.addr || '127.0.0.1';
}

function buildServiceUrls(cfg = {}) {
  const host = getLanIPv4();
  const backendPort = Number(cfg.ports?.backend) || 3000;
  const cocinaPort = Number(cfg.ports?.cocina) || 3001;
  const backendOrigin = `http://${host}:${backendPort}`;
  return {
    host,
    backendPort,
    cocinaPort,
    backendOrigin,
    urls: {
      root: `${backendOrigin}/`,
      login: `${backendOrigin}/login`,
      cocina: `http://${host}:${cocinaPort}/`,
    },
  };
}

module.exports = { getLanIPv4, buildServiceUrls };
