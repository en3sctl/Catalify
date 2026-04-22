const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env') });

const teamId = process.env.APPLE_TEAM_ID;
const keyId = process.env.APPLE_KEY_ID;
const configuredKeyPath = process.env.APPLE_PRIVATE_KEY_PATH;

function resolveKeyPath(configured) {
  const candidates = [];
  if (configured) candidates.push(configured);
  candidates.push(path.join(process.cwd(), 'AuthKey_BQJDU99MSG.p8'));
  if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, 'AuthKey_BQJDU99MSG.p8'));
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  throw new Error(`Private key file not found. Tried: ${candidates.join(', ')}`);
}

(async () => {
  if (!teamId || !keyId) {
    throw new Error('APPLE_TEAM_ID / APPLE_KEY_ID missing in .env');
  }

  const keyPath = resolveKeyPath(configuredKeyPath);
  const privateKey = fs.readFileSync(keyPath, 'utf8');

  const token = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '1h',
    issuer: teamId,
    header: { alg: 'ES256', kid: keyId }
  });

  const decoded = jwt.decode(token, { complete: true }) || {};
  const header = decoded.header || {};
  const payload = decoded.payload || {};

  console.log('Resolved private key path:', keyPath);
  console.log('JWT header:', JSON.stringify({ alg: header.alg, kid: header.kid, typ: header.typ }, null, 2));
  console.log('JWT payload:', JSON.stringify({ iss: payload.iss, iat: payload.iat, exp: payload.exp }, null, 2));

  const url = 'https://api.music.apple.com/v1/catalog/us/songs/203709340';
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }

  console.log('HTTP status:', res.status);
  console.log('Body snippet:', text.slice(0, 400).replace(/\s+/g, ' ').trim());

  if (parsed && Array.isArray(parsed.errors) && parsed.errors.length) {
    const e = parsed.errors[0] || {};
    console.log('Apple error:', JSON.stringify({ code: e.code, title: e.title, detail: e.detail, status: e.status }, null, 2));
  }
})().catch((err) => {
  console.error('Script error:', err && err.message ? err.message : String(err));
  if (err && err.code) console.error('Error code:', err.code);
  process.exitCode = 1;
});
