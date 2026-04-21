const fs = require('fs');
const path = require('path');

/**
 * Lee DBLOCAL o MONGODB_URI del .env del backend (línea simple KEY=VAL).
 * @param {string} backendRoot
 */
function readMongoUri(backendRoot) {
  const envPath = path.join(backendRoot, '.env');
  if (!fs.existsSync(envPath)) return { uri: null, error: 'No existe .env en el backend.' };
  const text = fs.readFileSync(envPath, 'utf8');
  const lines = text.split(/\r?\n/);
  let dblocal = null;
  let mongoUri = null;
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^(DBLOCAL|MONGODB_URI)\s*=\s*(.*)$/);
    if (m) {
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (m[1] === 'DBLOCAL') dblocal = val;
      else mongoUri = val;
    }
  }
  const uri = dblocal || mongoUri;
  if (!uri) return { uri: null, error: 'Falta DBLOCAL o MONGODB_URI en .env' };
  return { uri, error: null };
}

function maskUri(uri) {
  if (!uri) return '';
  try {
    return uri.replace(/\/\/([^:@]+):([^@]+)@/, '//$1:***@');
  } catch {
    return uri;
  }
}

module.exports = { readMongoUri, maskUri };
