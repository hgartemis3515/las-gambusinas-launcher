const mongoose = require('mongoose');
const { readMongoUri, maskUri } = require('./env-parse');

/**
 * Ping a MongoDB usando mongoose (sin depender de mongosh).
 * @param {string} backendRoot
 */
async function checkMongo(backendRoot) {
  const { uri, error } = readMongoUri(backendRoot);
  if (error) return { ok: false, message: error, uriMasked: '' };
  const uriMasked = maskUri(uri);
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    await mongoose.connection.db.admin().command({ ping: 1 });
    await mongoose.disconnect();
    return { ok: true, message: 'Conexión correcta.', uriMasked };
  } catch (e) {
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
    return { ok: false, message: e.message || String(e), uriMasked };
  }
}

module.exports = { checkMongo };
